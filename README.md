# CRYSTALL — Lit Hands

**Live:** https://alihaddi-dotcom.github.io/crystall-lit-hands/ (needs a WebGPU browser)

Experimental landing pages built around one WebGL/WebGPU scene: ~1,500 lit GPU tubes drawn over two hands or a diamond, around a glowing orb, behind a plain HTML page. English / Japanese.

| Page | |
| --- | --- |
| [`/`](https://alihaddi-dotcom.github.io/crystall-lit-hands/) | **HAKU** — a fictional energy healing salon (white-light theme, particle diamond) |
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

### In the browser (for the salon owner)

Open **[/admin/](https://alihaddi-dotcom.github.io/crystall-lit-hands/admin/)**, sign in, and use **New Post / 新規作成**. Each post has a Japanese and an English tab; fill in title, date, description and body, then **Save**. Saving commits the post to `main` and the site updates about a minute later.

**One-time setup:**

1. Create a **fine-grained** token (GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens):
   - **Resource owner:** the account that owns this repo (not an organisation)
   - **Repository access:** *Only select repositories* → `crystall-lit-hands`
   - **Permissions:** *Contents: Read and write* (Metadata: Read is added automatically); nothing else
   - **Expiration:** e.g. 90 days
2. On the admin login screen choose **Sign In with Token** and paste it once; the browser remembers it.

Don't use a classic token — its `repo` scope covers every repository the account can reach, including organisations. Fine-grained tokens only reach repos owned by the token's resource owner, so a separate editor account that is merely a collaborator can't use one here; for a real client, host the repo under their account/org or add OAuth sign-in.

> **記事の書き方（オーナー向け）** — [/admin/](https://alihaddi-dotcom.github.io/crystall-lit-hands/admin/) を開き、トークンでログインして「新規作成」。日本語・英語のタブにタイトル、公開日、概要、本文を入力して「保存」すると、約1分後にサイトへ反映されます。英語を書かない場合は、英語タブをオフにすれば日本語版が表示されます。

Developers can try the editor without a token: open `/admin/` in Chrome or Edge and choose **Work with Local Repository**, then pick this folder.

### As files

Each post is a folder in `posts/` with `index.ja.md` and/or `index.en.md` — the same layout the editor writes:

```markdown
---
title: Resting with the autumn equinox
date: 2026-09-22
description: One or two sentences for the post list and search results.
---

Your post here. ~700 words reads in about 4 minutes.
```

The folder name is the URL (`posts/autumn-equinox/` → `/blog/autumn-equinox.html`): lowercase letters, numbers and dashes. Posts made in the editor get `date-shortid` names, since titles may be Japanese. `npm run dev` shows changes at `/blog/` as you save.

Posts are listed newest first. If one language is missing, readers of that language see the other version with a short note. A post with a missing title/date/description or invalid date fails the build (and the deploy), so it never half-publishes. `blog/` is generated — don't edit it by hand.

## How it works

- **Tubes on the GPU** — each tube is a static grid of `(progress, angle)`. A TSL `positionNode` samples a Catmull-Rom curve from a storage buffer, takes the tangent by central difference, builds the cross-section from a fixed +Z axis, and outputs position and normal. `MeshStandardNodeMaterial` lights it. All strands are one instanced draw.
- **Strand authoring** (`strands.js`, runs once on load) — the mesh (hand, or a code-built diamond via `<body data-shape="diamond">`) is welded into a graph and a Dijkstra geodesic field is computed from its lowest point (wrist / culet). *Flow* strands descend the field and trail off below; *wander* strands random-walk the surface, steered away from visited vertices.
- **Dust visual** (`dust.js`, `<body data-visual="dust">`) — ~40k GPU motes sampled on the diamond (45% facet edges, 50% faces, 5% inside). A TSL compute shader springs each to its target with slow noise, flows them around the pointer, bursts on click and loosens the shape as you scroll.
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
| `public/admin/` | Blog editor ([Sveltia CMS](https://sveltiacms.app/), MIT) and its config |
| `i18n.js` | EN/JA strings and the language toggle (`?lang=ja`, saved choice, or browser language) |
| `entry.js` | Loads the scene only when WebGPU is available |
| `main.js` | Shared stage: renderer, theme, orb, breathing, scroll, pointer |
| `tubes.js`, `dust.js` | The two visuals: lit GPU tubes, or compute-shader particles |
| `strands.js` | Builds the strand curves over a mesh: hands (`public/left.glb`) or a brilliant-cut diamond |
| `public/left.glb` | Hand mesh (mirrored for the right hand) |

## Credits

- Technique: Mathis Biabiany, Codrops (linked above). No code from the article was copied.
- Hand mesh: `generic-hand` from [@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles), MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
