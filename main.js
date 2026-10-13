import * as THREE from "three/webgpu";
import {
  Fn, attribute, instanceIndex, storage, uniform, uint, float, vec3, color,
  cross, normalize, cos, sin, exp, abs, fract, hash, mix, smoothstep, step,
  varying, transformNormalToView, pass, mrt, output, emissive, screenUV,
} from "three/tsl";
import { makeHandStrands } from "./hands.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

const small = matchMedia("(max-width: 700px)").matches;
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- strands (CPU, once): authored over two hands, see hands.js -------------
// Phones get roughly half the strands.
const FLOW = small ? 240 : 500, WANDER = small ? 460 : 1000, COUNT = FLOW + WANDER;
const N = 64; // control points per strand
const strandData = await makeHandStrands(FLOW, WANDER, N);

// --- tube geometry: only (progress, angle); positions are computed on the GPU --
const TUBULAR = 90, RADIAL = 6;
function makeTubeGrid() {
  const verts = (TUBULAR + 1) * (RADIAL + 1);
  const progress = new Float32Array(verts), angle = new Float32Array(verts);
  for (let j = 0, k = 0; j <= TUBULAR; j++)
    for (let r = 0; r <= RADIAL; r++, k++) {
      progress[k] = j / TUBULAR;
      angle[k] = (r / RADIAL) * Math.PI * 2;
    }
  const index = [];
  for (let j = 0; j < TUBULAR; j++)
    for (let r = 0; r < RADIAL; r++) {
      const a = j * (RADIAL + 1) + r, b = a + RADIAL + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  g.setAttribute("progress", new THREE.BufferAttribute(progress, 1));
  g.setAttribute("angle", new THREE.BufferAttribute(angle, 1));
  g.setIndex(index);
  return g;
}

// --- uniforms ----------------------------------------------------------------
const uTime = uniform(0);
const uClick = uniform(-100);
const uPointer = uniform(new THREE.Vector3(99, 99, 99));
const uPush = uniform(0);
const uGlow = uniform(0); // CTA hover, eased 0..1

// --- TSL ---------------------------------------------------------------------
const pts = storage(new THREE.StorageBufferAttribute(strandData, 4), "vec4", COUNT * N).toReadOnly();

const point = (k) => pts.element(instanceIndex.mul(N).add(uint(k.clamp(0, N - 1)))).xyz;

// Catmull-Rom through the strand's control points, plus the pointer push.
const sampleCurve = Fn(([p]) => {
  const t = p.clamp(0, 1).mul(N - 1);
  const i = t.floor(), f = t.sub(i);
  const p0 = point(i.sub(1)), p1 = point(i), p2 = point(i.add(1)), p3 = point(i.add(2));
  const c = p1.mul(2)
    .add(p2.sub(p0).mul(f))
    .add(p0.mul(2).sub(p1.mul(5)).add(p2.mul(4)).sub(p3).mul(f.mul(f)))
    .add(p3.sub(p0).add(p1.sub(p2).mul(3)).mul(f.mul(f).mul(f)))
    .mul(0.5);
  const d = c.sub(uPointer);
  return c.add(d.mul(uPush.mul(exp(d.dot(d).mul(-6)))));
});

const progress = attribute("progress", "float");
const angle = attribute("angle", "float");
const rand = (o) => hash(instanceIndex.add(o));

const center = sampleCurve(progress);
const EPS = 0.004;
const tangent = normalize(sampleCurve(progress.add(EPS)).sub(sampleCurve(progress.sub(EPS))));
// Fixed-axis frame: singular only where the tangent is parallel to +Z.
const b1 = normalize(cross(tangent, vec3(0, 0, 1)));
const b2 = cross(tangent, b1);
const radial = b1.mul(cos(angle)).add(b2.mul(sin(angle)));

// Grow-in: each strand's head sweeps 0 -> 1 after a random delay.
const head = uTime.sub(rand(1).mul(2)).mul(0.45).clamp(0, 1.1);
const taper = smoothstep(0, 0.05, progress).mul(smoothstep(0, 0.05, float(1).sub(progress)));
const growth = float(1).sub(smoothstep(head.sub(0.08), head, progress));
const radius = mix(0.003, 0.008, rand(5)).mul(taper).mul(growth);

const isFlow = pts.element(instanceIndex.mul(N)).w; // 1 = flow strand with tail
const accent = step(0.88, rand(11)); // ~12% of strands glow
const phase = fract(uTime.mul(0.12).add(rand(3)));
const band = float(1).sub(smoothstep(0, 0.07, abs(progress.sub(phase))));
const flash = exp(uTime.sub(uClick).mul(-2.5));
const glowColor = mix(color("#8fb8ff"), color("#e0d4ff"), rand(17));

const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.15 });
material.positionNode = center.add(radial.mul(radius));
material.normalNode = transformNormalToView(varying(radial));
const wanderColor = mix(color("#5b4bff"), color("#b6a2ff"), rand(9));
const flowColor = mix(color("#a77bff"), color("#c2185b"), smoothstep(0.35, 0.9, progress));
material.colorNode = mix(wanderColor, flowColor, isFlow);
material.emissiveNode = glowColor.mul(accent.mul(band.mul(uGlow.mul(4).add(6)).add(flash.mul(3))).add(flash.mul(0.25)));

// --- scene -------------------------------------------------------------------
const renderer = new THREE.WebGPURenderer();
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.className = "webgl";
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);
camera.position.set(0, 0.1, 7.2);

// Hands, orb and its light move together (desktop: shifted right of the copy).
const hero = new THREE.Group();
scene.add(hero);
const tubes = new THREE.InstancedMesh(makeTubeGrid(), material, COUNT);
tubes.frustumCulled = false; // real positions only exist on the GPU
hero.add(tubes);

// Deep indigo centre falling off to near-black.
scene.backgroundNode = mix(color("#1d1850"), color("#040410"), screenUV.sub(0.5).length().mul(1.8).clamp(0, 1));

// The orb is both the glow and the main light the tubes respond to.
const ORB = new THREE.Vector3(0, 0.35, 0.45);
const orbMat = new THREE.MeshStandardNodeMaterial({ color: "#000000" });
orbMat.emissiveNode = color("#dcd8ff").mul(flash.mul(4).add(uGlow.mul(5)).add(6));
const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), orbMat);
orb.position.copy(ORB);
const orbLight = new THREE.PointLight("#c9c2ff", 9, 6, 1.2);
orbLight.position.copy(ORB);
hero.add(orb, orbLight);

scene.add(new THREE.HemisphereLight("#6f63ff", "#12081f", 0.5));
const rim = new THREE.DirectionalLight("#7a6bff", 2);
rim.position.set(0, 2, -4);
scene.add(rim);

const stars = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicNodeMaterial({ color: "#aab0ff" }), 700);
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
  .add(bloom(scenePass.getTextureNode("emissive"), 1.2, 0.5, 0));

// --- interaction --------------------------------------------------------------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane();
const hit = new THREE.Vector3(), last = new THREE.Vector2(), ORIGIN = new THREE.Vector3();
let speed = 0, glowTarget = 0;
addEventListener("pointermove", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  speed += Math.hypot(e.clientX - last.x, e.clientY - last.y);
  last.set(e.clientX, e.clientY);
});
const flashNow = () => { uClick.value = uTime.value; };
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

  // Scroll: pull back and lift the hands; canvas dims to a backdrop.
  const s = Math.min(scrollY / innerHeight, 1.5);
  const cam = new THREE.Vector3(ndc.x * 0.35, 0.1 + ndc.y * 0.2, 7.2 + s * 2.2);
  if (still) camera.position.set(0, 0.1, 7.2 + s * 2.2);
  else camera.position.lerp(cam, ease(3, dt));
  camera.lookAt(hero.position.x * 0.5, s * 0.6, 0);
  hero.position.y = s * 0.9;
  renderer.domElement.style.opacity = String(1 - Math.min(s, 1) * 0.7);

  uGlow.value += (glowTarget - uGlow.value) * ease(5, dt);
  orbLight.intensity = 9 + uGlow.value * 8;

  ray.setFromCamera(ndc, camera);
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(hit).negate(), ORIGIN);
  if (ray.ray.intersectPlane(plane, hit)) uPointer.value.copy(tubes.worldToLocal(hit));
  uPush.value += (Math.min(speed * 0.004, 0.6) - uPush.value) * ease(6, dt);
  speed *= Math.exp(-8 * dt);

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
