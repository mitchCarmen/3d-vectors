import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PRESETS = {
    flow: { count: 40, magnitude: 4, direction: 0.6, components: 0.3, entropy: 0.1, color: '#40c0ff' },
    explosion: { count: 60, magnitude: 5, direction: 0, components: 2, entropy: 0.9, color: '#ff6040' },
    starfield: { count: 80, magnitude: 6, direction: 0.2, components: 0.5, entropy: 0.3, color: '#ffffa0' },
    rain: { count: 50, magnitude: 4, direction: -0.9, components: 0.2, entropy: 0.2, color: '#6090ff' },
    chaos: { count: 70, magnitude: 4, direction: 0, components: 1.8, entropy: 1.0, color: '#ff40ff' },
    minimal: { count: 8, magnitude: 3, direction: 0.3, components: 0.8, entropy: 0.2, color: '#80ffb0' }
};

class VectorVisualizer {
    constructor() {
        this.vectors = [];
        this.arrows = [];
        this.panelCollapsed = false;

        this.params = {
            count: 25,
            magnitude: 3,
            direction: 0,
            components: 1,
            entropy: 0.5,
            color: '#6080ff'
        };

        this.init();
        this.setupControls();
        this.setupKeyboard();
        this.loadFromURL();
        this.generateVectors();
        this.animate();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0f);
        this.scene.fog = new THREE.Fog(0x0a0a0f, 25, 60);

        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(12, 10, 12);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.minDistance = 5;
        this.orbitControls.maxDistance = 50;

        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 20, 10);
        this.scene.add(directionalLight);

        const gridHelper = new THREE.GridHelper(20, 20, 0x2a2a4e, 0x1a1a2e);
        this.scene.add(gridHelper);

        const axesHelper = new THREE.AxesHelper(10);
        axesHelper.material.opacity = 0.3;
        axesHelper.material.transparent = true;
        this.scene.add(axesHelper);

        const originGeometry = new THREE.SphereGeometry(0.12, 16, 16);
        const originMaterial = new THREE.MeshBasicMaterial({ color: 0x8080ff });
        this.originSphere = new THREE.Mesh(originGeometry, originMaterial);
        this.scene.add(this.originSphere);

        window.addEventListener('resize', () => this.onResize());
    }

    setupControls() {
        // Collapse/expand panel
        const controls = document.getElementById('controls');
        const toggleBtn = document.getElementById('toggle-btn');
        const collapseBtn = document.getElementById('collapse-btn');

        collapseBtn.addEventListener('click', () => this.togglePanel());
        toggleBtn.addEventListener('click', () => this.togglePanel());

        // Sliders
        this.bindSlider('vectorCount', 'countVal', 'count', parseInt, v => v);
        this.bindSlider('magnitude', 'magVal', 'magnitude', parseFloat, v => v.toFixed(1));
        this.bindSlider('direction', 'dirVal', 'direction', parseFloat, v => v.toFixed(2));
        this.bindSlider('components', 'compVal', 'components', parseFloat, v => v.toFixed(2));
        this.bindSlider('entropy', 'entropyVal', 'entropy', parseFloat, v => v.toFixed(2));

        // Color
        document.getElementById('arrowColor').addEventListener('input', (e) => {
            this.params.color = e.target.value;
            this.updateColors();
            this.updateURL();
        });

        // Presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = PRESETS[btn.dataset.preset];
                if (preset) this.applyPreset(preset);
            });
        });

        // Action buttons
        document.getElementById('randomize').addEventListener('click', () => this.randomizeAll());
        document.getElementById('reset').addEventListener('click', () => this.resetAll());
        document.getElementById('share').addEventListener('click', () => this.copyShareLink());
    }

    bindSlider(sliderId, valId, param, parser, formatter) {
        const slider = document.getElementById(sliderId);
        const valDisplay = document.getElementById(valId);
        slider.addEventListener('input', (e) => {
            this.params[param] = parser(e.target.value);
            valDisplay.textContent = formatter(this.params[param]);
            this.generateVectors();
            this.updateURL();
        });
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.key.toLowerCase()) {
                case 'h':
                    this.togglePanel();
                    break;
                case ' ':
                    e.preventDefault();
                    this.randomizeAll();
                    break;
                case 'r':
                    this.resetAll();
                    break;
                case 's':
                    this.copyShareLink();
                    break;
            }
        });
    }

    togglePanel() {
        this.panelCollapsed = !this.panelCollapsed;
        document.getElementById('controls').classList.toggle('collapsed', this.panelCollapsed);
        document.getElementById('toggle-btn').classList.toggle('visible', this.panelCollapsed);
    }

    applyPreset(preset) {
        Object.assign(this.params, preset);
        this.updateUIFromParams();
        this.generateVectors();
        this.updateURL();
    }

    updateUIFromParams() {
        document.getElementById('vectorCount').value = this.params.count;
        document.getElementById('magnitude').value = this.params.magnitude;
        document.getElementById('direction').value = this.params.direction;
        document.getElementById('components').value = this.params.components;
        document.getElementById('entropy').value = this.params.entropy;
        document.getElementById('arrowColor').value = this.params.color;

        document.getElementById('countVal').textContent = this.params.count;
        document.getElementById('magVal').textContent = this.params.magnitude.toFixed(1);
        document.getElementById('dirVal').textContent = this.params.direction.toFixed(2);
        document.getElementById('compVal').textContent = this.params.components.toFixed(2);
        document.getElementById('entropyVal').textContent = this.params.entropy.toFixed(2);
    }

    updateURL() {
        const params = new URLSearchParams();
        params.set('n', this.params.count);
        params.set('m', this.params.magnitude.toFixed(1));
        params.set('d', this.params.direction.toFixed(2));
        params.set('c', this.params.components.toFixed(2));
        params.set('e', this.params.entropy.toFixed(2));
        params.set('col', this.params.color.replace('#', ''));
        history.replaceState(null, '', '#' + params.toString());
    }

    loadFromURL() {
        const hash = window.location.hash.slice(1);
        if (!hash) return;

        const params = new URLSearchParams(hash);
        if (params.has('n')) this.params.count = parseInt(params.get('n'));
        if (params.has('m')) this.params.magnitude = parseFloat(params.get('m'));
        if (params.has('d')) this.params.direction = parseFloat(params.get('d'));
        if (params.has('c')) this.params.components = parseFloat(params.get('c'));
        if (params.has('e')) this.params.entropy = parseFloat(params.get('e'));
        if (params.has('col')) this.params.color = '#' + params.get('col');

        this.updateUIFromParams();
    }

    copyShareLink() {
        this.updateURL();
        navigator.clipboard.writeText(window.location.href).then(() => {
            const toast = document.getElementById('share-toast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2000);
        });
    }

    generateVectors() {
        this.arrows.forEach(arrow => this.scene.remove(arrow));
        this.arrows = [];
        this.vectors = [];

        const color = new THREE.Color(this.params.color);

        for (let i = 0; i < this.params.count; i++) {
            const originSpread = 8;
            const origin = new THREE.Vector3(
                (Math.random() - 0.5) * originSpread,
                (Math.random() - 0.5) * originSpread,
                (Math.random() - 0.5) * originSpread
            );

            const direction = this.generateDirection();
            const baseMag = this.params.magnitude;
            const magVariation = this.params.entropy * baseMag * 0.5;
            const mag = baseMag + (Math.random() - 0.5) * magVariation * 2;

            const arrowColor = this.getVariedColor(color, i);
            const arrow = new THREE.ArrowHelper(
                direction.normalize(),
                origin,
                mag,
                arrowColor,
                mag * 0.2,
                mag * 0.1
            );

            this.vectors.push({ origin, direction, magnitude: mag });
            this.arrows.push(arrow);
            this.scene.add(arrow);
        }

        this.updateStats();
    }

    generateDirection() {
        const entropy = this.params.entropy;
        const dirBias = this.params.direction;
        const compSpread = this.params.components;

        let x = (Math.random() - 0.5) * 2 * compSpread;
        let y = (Math.random() - 0.5) * 2 * compSpread;
        let z = (Math.random() - 0.5) * 2 * compSpread;

        y += dirBias * 2;

        if (entropy < 0.5) {
            const uniformity = 1 - entropy * 2;
            x = x * (1 - uniformity);
            y = y * (1 - uniformity) + uniformity;
            z = z * (1 - uniformity);
        }

        if (entropy > 0.5) {
            const chaos = (entropy - 0.5) * 2;
            x += (Math.random() - 0.5) * chaos;
            y += (Math.random() - 0.5) * chaos;
            z += (Math.random() - 0.5) * chaos;
        }

        return new THREE.Vector3(x, y, z);
    }

    getVariedColor(baseColor, index) {
        const hsl = {};
        baseColor.getHSL(hsl);

        const hueVariation = this.params.entropy * 0.15;
        hsl.h += (Math.random() - 0.5) * hueVariation;
        hsl.l = Math.max(0.3, Math.min(0.7, hsl.l + (Math.random() - 0.5) * 0.1));
        hsl.s = Math.min(1, hsl.s + 0.1);

        const variedColor = new THREE.Color();
        variedColor.setHSL(hsl.h, hsl.s, hsl.l);
        return variedColor;
    }

    updateColors() {
        const baseColor = new THREE.Color(this.params.color);
        this.arrows.forEach((arrow, i) => {
            arrow.setColor(this.getVariedColor(baseColor, i));
        });
    }

    updateStats() {
        const avgMag = this.vectors.reduce((sum, v) => sum + v.magnitude, 0) / this.vectors.length;
        document.getElementById('stats').textContent =
            `${this.params.count} vectors | avg mag: ${avgMag.toFixed(1)}`;
    }

    randomizeAll() {
        this.params.count = Math.floor(Math.random() * 70 + 10);
        this.params.magnitude = Math.random() * 5 + 1;
        this.params.direction = (Math.random() - 0.5) * 2;
        this.params.components = Math.random() * 1.5 + 0.3;
        this.params.entropy = Math.random();

        const hue = Math.random();
        const color = new THREE.Color();
        color.setHSL(hue, 0.7, 0.5);
        this.params.color = '#' + color.getHexString();

        this.updateUIFromParams();
        this.generateVectors();
        this.updateURL();
    }

    resetAll() {
        this.params = {
            count: 25,
            magnitude: 3,
            direction: 0,
            components: 1,
            entropy: 0.5,
            color: '#6080ff'
        };

        this.updateUIFromParams();
        this.generateVectors();
        this.updateURL();

        this.camera.position.set(12, 10, 12);
        this.orbitControls.reset();
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.orbitControls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new VectorVisualizer();
