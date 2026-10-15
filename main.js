import * as THREE from "three/webgpu";
import { uniform, color, exp, mix, pass, mrt, output, emissive, screenUV } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { t } from "./i18n.js";

// Shared stage: renderer, theme, orb, breathing, scroll and pointer. The visual
// itself is a module picked per page:
//   <body data-visual="tubes|dust" data-shape="hands|diamond" data-theme="dark|light">

const small = matchMedia("(max-width: 700px)").matches;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
const { visual: VISUAL = "tubes", shape: SHAPE = "hands" } = document.body.dataset;

const STAGING = {
  hands: { orb: [0, 0.35, 0.45], tilt: 0, y: 0, spin: 0 },
  // Tilted toward the camera so the table shows; the orb glows inside the stone.
  diamond: { orb: [0, -0.15, 0], tilt: 0.35, y: 0.35, spin: 0.12 },
}[SHAPE] ?? { orb: [0, 0.35, 0.45], tilt: 0, y: 0, spin: 0 };

// <body data-theme="light"> switches the palette; everything else is shared.
const THEMES = {
  dark: {
    bg: ["#1d1850", "#040410"], wander: ["#5b4bff", "#b6a2ff"], flow: ["#a77bff", "#c2185b"],
    glow: ["#8fb8ff", "#e0d4ff"], orb: "#dcd8ff", light: "#c9c2ff",
    hemi: ["#6f63ff", "#12081f", 0.5], rim: "#7a6bff", dust: "#aab0ff",
    motes: ["#9d8cff", "#f1ecff"], motesAdditive: true,
    orbScale: 1, bloom: 1.2, toneMapping: THREE.ACESFilmicToneMapping,
  },
  light: {
    // Pure white: added light can't show on white, so strands are mid greys,
    // the orb is a dim gold (orbScale), and flow tails fade into the white.
    bg: ["#ffffff", "#ffffff"], wander: ["#8f877a", "#c9c2b6"], flow: ["#a39a8a", "#ffffff"],
    glow: ["#e0a95a", "#f3d39c"], orb: "#f0c27a", light: "#fff0da",
    hemi: ["#ffffff", "#b9b1a3", 1.1], rim: "#ffe7c4", dust: "#d8d2c8",
    // Motes: warm grey on the faces, gold on the facet edges.
    motes: ["#b9ad99", "#b8893f"], motesAdditive: false,
    // Linear keeps white at 1.0; Neutral/ACES would grey it out.
    orbScale: 0.16, bloom: 0.5, toneMapping: THREE.LinearToneMapping,
  },
};
const theme = THEMES[document.body.dataset.theme] ?? THEMES.dark;

// --- shared uniforms -----------------------------------------------------------
const uTime = uniform(0);
const uClick = uniform(-100);
const uPointer = uniform(new THREE.Vector3(99, 99, 99));
const uPush = uniform(0);
const uGlow = uniform(0); // CTA hover, eased 0..1
const uBreath = uniform(0); // 0 = exhaled, 1 = inhaled
const flash = exp(uTime.sub(uClick).mul(-2.5));
const u = { uTime, uPointer, uPush, uGlow, uBreath, flash };

// --- scene -------------------------------------------------------------------
const renderer = new THREE.WebGPURenderer();
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = theme.toneMapping;
renderer.domElement.className = "webgl";
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);
camera.position.set(0, 0.1, 7.2);

// Visual, orb and its light move together (desktop: shifted right of the copy).
const hero = new THREE.Group();
scene.add(hero);
const stage = new THREE.Group(); // per-shape tilt and offset
stage.rotation.x = STAGING.tilt;
stage.position.y = STAGING.y;
hero.add(stage);

const visual = VISUAL === "dust"
  ? (await import("./dust.js")).createDust({ theme, small, still, u, renderer, spin: STAGING.spin })
  : await (await import("./tubes.js")).createTubes({ shape: SHAPE, theme, small, u, spin: STAGING.spin });
stage.add(visual.object);

scene.backgroundNode = mix(color(theme.bg[0]), color(theme.bg[1]), screenUV.sub(0.5).length().mul(1.8).clamp(0, 1));

// The orb is both the glow and the main light the tubes respond to.
const ORB = new THREE.Vector3(...STAGING.orb);
const orbMat = new THREE.MeshStandardNodeMaterial({ color: "#000000" });
orbMat.emissiveNode = color(theme.orb).mul(flash.mul(4).add(uGlow.mul(5)).add(uBreath.mul(3)).add(5).mul(theme.orbScale));
const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), orbMat);
orb.position.copy(ORB);
const orbLight = new THREE.PointLight(theme.light, 9, 6, 1.2);
orbLight.position.copy(ORB);
stage.add(orb, orbLight);

scene.add(new THREE.HemisphereLight(...theme.hemi));
const rim = new THREE.DirectionalLight(theme.rim, 2);
rim.position.set(0, 2, -4);
scene.add(rim);

const stars = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicNodeMaterial({ color: theme.dust }), 700);
const m = new THREE.Matrix4(), v = new THREE.Vector3();
for (let i = 0; i < stars.count; i++) {
  v.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, -6 - Math.random() * 10);
  stars.setMatrixAt(i, m.makeScale(...Array(3).fill(0.006 + Math.random() * 0.018)).setPosition(v));
}
scene.add(stars);

// Selective bloom: only the emissive MRT target is blurred.
const scenePass = pass(scene, camera);
scenePass.setMRT(mrt({ output, emissive }));
const pipeline = new THREE.RenderPipeline(renderer);
pipeline.outputNode = scenePass.getTextureNode("output")
  .add(bloom(scenePass.getTextureNode("emissive"), theme.bloom, 0.5, 0));

// --- interaction --------------------------------------------------------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
const hit = new THREE.Vector3(), last = new THREE.Vector2(), ORIGIN = new THREE.Vector3();
let speed = 0, glowTarget = 0;
const BREATH = 8;
const breathLabel = document.querySelector("[data-breath]");
const breathDot = document.querySelector(".breath-dot");
addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  speed += Math.hypot(e.clientX - last.x, e.clientY - last.y);
  last.set(e.clientX, e.clientY);
});
const flashNow = () => {
  uClick.value = uTime.value;
  visual.burst?.();
};
for (const el of document.querySelectorAll("[data-orb]")) {
  el.addEventListener("pointerenter", () => { glowTarget = 1; });
  el.addEventListener("pointerleave", () => { glowTarget = 0; });
  el.addEventListener("click", flashNow);
}
renderer.domElement.addEventListener("pointerdown", flashNow);

function layout() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  hero.position.x = camera.aspect > 1.2 ? 1.15 : 0;
  if (still) render(0);
}
addEventListener("resize", layout);

const ease = (k, dt) => 1 - Math.exp(-k * dt); // frame-rate independent
function render(dt) {
  if (still) uTime.value = 12; // fully grown, no motion
  else uTime.value += dt;

  // Scroll: pull back and lift the visual; canvas dims to a backdrop.
  const s = Math.min(scrollY / innerHeight, 1.5);
  const cam = new THREE.Vector3(ndc.x * 0.35, 0.1 + ndc.y * 0.2, 7.2 + s * 2.2);
  if (still) camera.position.set(0, 0.1, 7.2 + s * 2.2);
  else camera.position.lerp(cam, ease(3, dt));
  camera.lookAt(hero.position.x * 0.5, s * 0.6, 0);
  hero.position.y = s * 0.9;
  renderer.domElement.style.opacity = String(1 - Math.min(s, 1) * 0.7);

  uGlow.value += (glowTarget - uGlow.value) * ease(5, dt);
  // Breathing: 4 s in, 4 s out.
  const phase = (uTime.value % BREATH) / BREATH;
  uBreath.value = still ? 0.5 : 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  orb.scale.setScalar(1 + uBreath.value * 0.45);
  orbLight.intensity = 7 + uGlow.value * 8 + uBreath.value * 4;
  const cue = t(phase < 0.5 ? "breath.in" : "breath.out");
  if (breathLabel && breathLabel.textContent !== cue && !still) breathLabel.textContent = cue;
  if (breathDot) breathDot.style.transform = `scale(${0.6 + uBreath.value})`;

  ray.setFromCamera(ndc, camera);
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(hit).negate(), ORIGIN);
  if (ray.ray.intersectPlane(plane, hit)) uPointer.value.copy(visual.object.worldToLocal(hit));
  uPush.value += (Math.min(speed * 0.004, 0.6) - uPush.value) * ease(6, dt);
  speed *= Math.exp(-8 * dt);

  // Scrolling past the hero loosens the shape (dust drifts apart).
  if (!still) visual.update(dt, THREE.MathUtils.smoothstep(s, 0.15, 1));
  pipeline.render();
}

const timer = new THREE.Timer();
await renderer.init();
layout();
document.body.classList.add("is-ready");
if (still) addEventListener("scroll", () => render(0), { passive: true });
else renderer.setAnimationLoop(() => {
  timer.update();
  render(Math.min(timer.getDelta(), 0.1));
});
