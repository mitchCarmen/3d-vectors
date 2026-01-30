# 3D Vector Visualizer

An interactive 3D vector field visualization built with Three.js. Drag to rotate, scroll to zoom, tweak parameters to explore.

**Live Demo:** [mitchcarmen.github.io/3d-vectors](https://mitchcarmen.github.io/3d-vectors/)

![3D Vectors](https://img.shields.io/badge/Three.js-black?style=flat&logo=three.js) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **Interactive 3D Scene** - Orbit controls for rotating and zooming
- **Real-time Parameters** - Adjust vector count, magnitude, direction, spread, entropy, and color
- **Presets** - One-click configurations: Flow, Burst, Stars, Rain, Chaos, Minimal
- **Shareable URLs** - Configuration encoded in URL hash for bookmarking/sharing
- **Keyboard Shortcuts** - Quick access to common actions
- **Collapsible UI** - Hide controls to focus on the visualization

---

## Controls

### Sliders

| Parameter | Description |
|-----------|-------------|
| **Vectors** | Number of arrows in the 3D space (1-100) |
| **Magnitude** | Length of each arrow (0.5-8) |
| **Direction Bias** | Push vectors up (+) or down (-) |
| **Component Spread** | Variation in X/Y/Z components |
| **Entropy** | Chaos level: low = orderly, high = scattered |
| **Color** | Base color for arrows (with slight per-arrow variation) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `H` | Toggle control panel visibility |
| `Space` | Randomize all parameters |
| `R` | Reset to defaults |
| `S` | Copy shareable link to clipboard |

### Mouse/Touch

- **Drag** - Rotate the scene
- **Scroll/Pinch** - Zoom in/out
- **Right-drag** - Pan the camera

---

## Presets

| Preset | Description |
|--------|-------------|
| **Flow** | Orderly upward flow, cyan arrows |
| **Burst** | Explosive radial scatter, orange |
| **Stars** | Long vectors, subtle spread, yellow |
| **Rain** | Downward bias, tight spread, blue |
| **Chaos** | Maximum entropy, magenta |
| **Minimal** | Few vectors, clean look, mint green |

---

## Sharing

Every parameter change updates the URL hash. Copy the URL to share a specific configuration:

```
https://mitchcarmen.github.io/3d-vectors/#n=60&m=5.0&d=0.00&c=2.00&e=0.90&col=ff6040
```

Parameters:
- `n` - vector count
- `m` - magnitude
- `d` - direction bias
- `c` - component spread
- `e` - entropy
- `col` - hex color (without #)

---

## Running Locally

```bash
# Clone the repo
git clone https://github.com/mitchCarmen/3d-vectors.git
cd 3d-vectors

# Serve locally (ES modules require a server)
python3 -m http.server 8080

# Open in browser
open http://localhost:8080
```

---

## Tech Stack

- **Three.js** (r160) - 3D rendering
- **Vanilla JS** - No build step, no dependencies to install
- **ES Modules** - Modern import syntax via import maps

---

## Project Structure

```
3d_vectors/
├── index.html          # UI structure and styles
├── vectors.js          # Three.js visualization logic
├── README.md           # This file
├── DESIGN_PROPOSAL.md  # UI/UX improvement roadmap
└── start_point.md      # Original project spec
```

---

## License

MIT
