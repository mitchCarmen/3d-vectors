import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Simple Perlin noise implementation
class PerlinNoise {
    constructor() {
        this.permutation = [];
        for (let i = 0; i < 256; i++) this.permutation[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
        }
        this.permutation = [...this.permutation, ...this.permutation];
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = this.fade(x), v = this.fade(y), w = this.fade(z);
        const p = this.permutation;
        const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
        const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
        return this.lerp(
            this.lerp(
                this.lerp(this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z), u),
                this.lerp(this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z), u), v),
            this.lerp(
                this.lerp(this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1), u),
                this.lerp(this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    }
}

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
        this.bloomEnabled = false;
        this.flowEnabled = false;
        this.time = 0;
        this.perlin = new PerlinNoise();

        this.params = {
            count: 25,
            magnitude: 3,
            direction: 0,
            components: 1,
            entropy: 0.5,
            color: '#6080ff'
        };

        this.init();
        this.setupPostProcessing();
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
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 1.5;
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

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5,   // strength
            0.4,   // radius
            0.85   // threshold
        );
        this.bloomPass.enabled = false;
        this.composer.addPass(this.bloomPass);
    }

    setupControls() {
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

        // Effect toggles
        document.getElementById('bloomToggle').addEventListener('change', (e) => {
            this.bloomEnabled = e.target.checked;
            this.bloomPass.enabled = this.bloomEnabled;
        });

        document.getElementById('flowToggle').addEventListener('change', (e) => {
            this.flowEnabled = e.target.checked;
            if (this.flowEnabled) {
                this.storeOriginalDirections();
            }
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
                case 'b':
                    document.getElementById('bloomToggle').click();
                    break;
                case 'f':
                    document.getElementById('flowToggle').click();
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

    storeOriginalDirections() {
        this.vectors.forEach(v => {
            v.originalDirection = v.direction.clone();
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
                direction.clone().normalize(),
                origin,
                mag,
                arrowColor,
                mag * 0.2,
                mag * 0.1
            );

            this.vectors.push({
                origin,
                direction: direction.clone(),
                originalDirection: direction.clone(),
                magnitude: mag,
                baseColor: arrowColor
            });
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
            const newColor = this.getVariedColor(baseColor, i);
            arrow.setColor(newColor);
            this.vectors[i].baseColor = newColor;
        });
    }

    updateStats() {
        const avgMag = this.vectors.reduce((sum, v) => sum + v.magnitude, 0) / this.vectors.length;
        document.getElementById('stats').textContent =
            `${this.params.count} vectors | avg mag: ${avgMag.toFixed(1)}`;
    }

    updateFlow() {
        if (!this.flowEnabled) return;

        const flowSpeed = 0.3;
        const flowScale = 0.15;

        this.vectors.forEach((v, i) => {
            const arrow = this.arrows[i];

            // Use Perlin noise to modulate direction
            const noiseX = this.perlin.noise(
                v.origin.x * flowScale + this.time * flowSpeed,
                v.origin.y * flowScale,
                v.origin.z * flowScale
            );
            const noiseY = this.perlin.noise(
                v.origin.x * flowScale,
                v.origin.y * flowScale + this.time * flowSpeed,
                v.origin.z * flowScale + 100
            );
            const noiseZ = this.perlin.noise(
                v.origin.x * flowScale + 200,
                v.origin.y * flowScale,
                v.origin.z * flowScale + this.time * flowSpeed
            );

            // Blend original direction with noise
            const blendFactor = 0.4;
            const newDir = new THREE.Vector3(
                v.originalDirection.x + noiseX * blendFactor,
                v.originalDirection.y + noiseY * blendFactor,
                v.originalDirection.z + noiseZ * blendFactor
            ).normalize();

            // Update arrow direction
            arrow.setDirection(newDir);

            // Subtle magnitude pulsing
            const pulseMag = v.magnitude * (1 + Math.sin(this.time * 2 + i * 0.5) * 0.1);
            arrow.setLength(pulseMag, pulseMag * 0.2, pulseMag * 0.1);
        });
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

        // Reset toggles
        document.getElementById('bloomToggle').checked = false;
        document.getElementById('flowToggle').checked = false;
        this.bloomEnabled = false;
        this.flowEnabled = false;
        this.bloomPass.enabled = false;

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
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.time += 0.016; // ~60fps time step
        this.orbitControls.update();

        if (this.flowEnabled) {
            this.updateFlow();
        }

        if (this.bloomEnabled) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

new VectorVisualizer();
