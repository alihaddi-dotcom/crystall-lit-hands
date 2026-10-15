import * as THREE from "three/webgpu";
import {
  Fn, attribute, instanceIndex, storage, uint, float, vec3, color,
  cross, normalize, cos, sin, exp, abs, fract, hash, mix, smoothstep, step,
  varying, transformNormalToView,
} from "three/tsl";
import { makeStrands } from "./strands.js";

// Lit GPU tubes (the Codrops technique): strands authored over a mesh in
// strands.js, positions and normals computed per vertex in TSL.

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

// u: shared uniforms/nodes from main.js (uTime, uPointer, uPush, uGlow, flash).
export async function createTubes({ shape, theme, small, u, spin }) {
  // Phones get roughly half the strands.
  const FLOW = small ? 240 : 500, WANDER = small ? 460 : 1000, COUNT = FLOW + WANDER;
  const N = 64; // control points per strand
  const strandData = await makeStrands(shape, FLOW, WANDER, N);

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
    const d = c.sub(u.uPointer);
    return c.add(d.mul(u.uPush.mul(exp(d.dot(d).mul(-6)))));
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
  const head = u.uTime.sub(rand(1).mul(2)).mul(0.45).clamp(0, 1.1);
  const taper = smoothstep(0, 0.05, progress).mul(smoothstep(0, 0.05, float(1).sub(progress)));
  const growth = float(1).sub(smoothstep(head.sub(0.08), head, progress));
  const radius = mix(0.003, 0.008, rand(5)).mul(taper).mul(growth);

  const isFlow = pts.element(instanceIndex.mul(N)).w; // 1 = flow strand with tail
  const accent = step(0.88, rand(11)); // ~12% of strands glow
  const phase = fract(u.uTime.mul(0.12).add(rand(3)));
  const band = float(1).sub(smoothstep(0, 0.07, abs(progress.sub(phase))));
  const glowColor = mix(color(theme.glow[0]), color(theme.glow[1]), rand(17));

  const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.15 });
  material.positionNode = center.add(radial.mul(radius));
  material.normalNode = transformNormalToView(varying(radial));
  const wanderColor = mix(color(theme.wander[0]), color(theme.wander[1]), rand(9));
  const flowColor = mix(color(theme.flow[0]), color(theme.flow[1]), smoothstep(0.35, 0.9, progress));
  material.colorNode = mix(wanderColor, flowColor, isFlow);
  material.emissiveNode = glowColor.mul(accent.mul(band.mul(u.uGlow.mul(4).add(6)).add(u.flash.mul(3))).add(u.flash.mul(0.25)));

  const object = new THREE.InstancedMesh(makeTubeGrid(), material, COUNT);
  object.frustumCulled = false; // real positions only exist on the GPU

  return {
    object,
    update(dt) { object.rotation.y += dt * spin; },
  };
}
