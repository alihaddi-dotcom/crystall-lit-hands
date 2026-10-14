# CRYSTALL — Lit Hands

**Live:** https://alihaddi-dotcom.github.io/crystall-lit-hands/ (needs a WebGPU browser)

Experimental landing pages built around one WebGL/WebGPU scene: two hands drawn from ~1,500 lit GPU tubes, holding a glowing orb, behind a plain HTML page. English / Japanese.

| Page | |
| --- | --- |
| [`/`](https://alihaddi-dotcom.github.io/crystall-lit-hands/) | **HAKU** — a fictional energy healing salon (white-light theme) |
| [`/light.html`](https://alihaddi-dotcom.github.io/crystall-lit-hands/light.html) | **LUMEN** — meditation page (white-light theme) |
| [`/blog/`](https://alihaddi-dotcom.github.io/crystall-lit-hands/blog/) | **HAKU Journal** — bilingual blog, generated from Markdown |
| [`/crystall.html`](https://alihaddi-dotcom.github.io/crystall-lit-hands/crystall.html) | **CRYSTALL** — the original dark version |

Built with Three.js `WebGPURenderer` and TSL. The tube technique is a from-scratch reimplementation of the approach described in Mathis Biabiany's Codrops article [Drawing With Light: An Exploration of Lit GPU Tubes with TSL and WebGPU](https://tympanus.net/codrops/2026/09/07/drawing-with-light-an-exploration-of-lit-gpu-tubes-with-tsl-and-webgpu/) ([original demo](https://luminhands.netlify.app/)).

## Run

Requires Node 20.11+ and a browser with WebGPU (recent Chrome, Edge or Safari).

```bash
npm install
npm run dev
```

`npm run build` writes a static site to `dist/`.

## Writing a blog post

1. Create a folder in `posts/` named after the URL you want, lowercase with dashes, e.g. `posts/autumn-equinox/` → `/blog/autumn-equinox.html`.
2. Add `en.md` and/or `ja.md`. Each starts with a header, then Markdown:

   ```markdown
   ---
   title: Resting with the autumn equinox
   date: 2026-09-22
   description: One or two sentences for the post list and search results.
   ---

   Your post here. ~700 words reads in about 4 minutes.

   ## A subheading

   Paragraphs, **bold**, lists, > quotes and links all work.
   ```

3. `npm run dev` shows it at `/blog/` (and reloads as you edit). Push to `main` to publish.

Posts are listed newest first. If one language is missing, readers of that language see the other version with a short note. `blog/` is generated on every dev start and build — don't edit it by hand. `npm test` checks the generator.

## How it works

- **Tubes on the GPU** — each tube is a static grid of `(progress, angle)`. A TSL `positionNode` samples a Catmull-Rom curve from a storage buffer, takes the tangent by central difference, builds the cross-section from a fixed +Z axis, and outputs position and normal. `MeshStandardNodeMaterial` lights it. All strands are one instanced draw.
- **Strand authoring** (`hands.js`, runs once on load) — the hand mesh is welded into a graph and a Dijkstra geodesic field is computed from the wrist. *Flow* strands descend the field from the fingers and trail off below the wrist; *wander* strands random-walk the surface, steered away from visited vertices.
- **Look** — grow-in via a per-strand radius taper, travelling light pulses on ~12% of strands, selective bloom on the emissive MRT target, an orb that is also the key light.
- **Breathing** — the orb grows and brightens on a 4 s in / 4 s out cycle; the caption and dot follow it.
- **Page** — the canvas is a fixed backdrop. Scroll pulls the camera back and dims it; hovering a CTA brightens the orb; clicking flashes.
- **Fallbacks** — no WebGPU → the 3D never loads and a CSS glow stands in. Phones get about half the strands. `prefers-reduced-motion` renders a still frame.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `light.html`, `crystall.html` | The three pages (`data-theme` picks the scene palette) |
| `styles.css` | Shared styles, light theme, Japanese typography |
| `scripts/blog.js`, `posts/` | Blog generator (Markdown → static HTML at build time) and the posts |
| `i18n.js` | EN/JA strings and the language toggle (`?lang=ja`, saved choice, or browser language) |
| `entry.js` | Loads the scene only when WebGPU is available |
| `main.js` | Renderer, TSL tube material, scene, interaction |
| `hands.js` | Builds the strand curves over the hand mesh |
| `public/left.glb` | Hand mesh (mirrored for the right hand) |

## Credits

- Technique: Mathis Biabiany, Codrops (linked above). No code from the article was copied.
- Hand mesh: `generic-hand` from [@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles), MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
