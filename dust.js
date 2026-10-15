import * as THREE from "three/webgpu";
import {
  Fn, instanceIndex, instancedArray, uniform, float, vec3, vec4, color, uv,
  cos, sin, exp, hash, mix, smoothstep, mx_noise_vec3,
} from "three/tsl";
import { diamondGeometry } from "./strands.js";

// "Made of light": GPU particles drift in like dust in sunlight and settle into
// a diamond — mostly on its facet edges so the cut reads, the rest on the faces.
// A compute shader springs each mote to its target, adds slow noise, and pushes
// motes away from the pointer; scroll and clicks loosen the shape.

const EDGE = 0, FACE = 1, INNER = 2;

// Target points on the diamond, packed as vec4 (xyz, kind).
export function sampleDiamond(count) {
  const geo = diamondGeometry();
  const edges = new THREE.EdgesGeometry(geo, 1).attributes.position.array; // facet edges only
  const tris = geo.toNonIndexed().attributes.position.array;

  // Cumulative weights so picks are uniform by length / area.
  const segLen = [], triArea = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < edges.length; i += 6) {
    a.fromArray(edges, i); b.fromArray(edges, i + 3);
    segLen.push((segLen.at(-1) ?? 0) + a.distanceTo(b));
  }
  for (let i = 0; i < tris.length; i += 9) {
    a.fromArray(tris, i); b.fromArray(tris, i + 3); c.fromArray(tris, i + 6);
    triArea.push((triArea.at(-1) ?? 0) + b.clone().sub(a).cross(c.clone().sub(a)).length() / 2);
  }
  const pick = (cum) => {
    const r = Math.random() * cum.at(-1);
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    return lo;
  };

  const out = new Float32Array(count * 4), p = new THREE.Vector3();
  const core = new THREE.Vector3(0, -0.2, 0);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const kind = r < 0.45 ? EDGE : r < 0.95 ? FACE : INNER;
    if (kind === EDGE) {
      const s = pick(segLen) * 6;
      a.fromArray(edges, s); b.fromArray(edges, s + 3);
      p.copy(a).lerp(b, Math.random());
    } else {
      const t = pick(triArea) * 9;
      a.fromArray(tris, t); b.fromArray(tris, t + 3); c.fromArray(tris, t + 6);
      let u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      p.copy(a).addScaledVector(b.sub(a), u).addScaledVector(c.sub(a), v);
      if (kind === INNER) p.lerp(core, Math.random() * 0.8);
    }
    out.set([p.x, p.y, p.z, kind], i * 4);
  }
  return out;
}

// Start scattered in a wide shell around the stone.
function scatter(count) {
  const out = new Float32Array(count * 4), p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.randomDirection().multiplyScalar(2.5 + Math.random() * 3.5);
    p.y *= 0.6;
    out.set([p.x, p.y, p.z, 1], i * 4);
  }
  return out;
}

// u: shared uniforms/nodes from main.js (uTime, uPointer, uPush, uBreath, flash).
export function createDust({ theme, small, still, u, renderer, spin }) {
  const COUNT = small ? 14000 : 40000;
  const targets = sampleDiamond(COUNT);
  const tgt = instancedArray(targets, "vec4");
  // Reduced motion: start (and stay) in shape.
  const pos = instancedArray(still ? targets.slice() : scatter(COUNT), "vec4");
  const vel = instancedArray(COUNT, "vec4");

  const uDt = uniform(0), uAngle = uniform(0), uForm = uniform(still ? 1 : 0);
  const uDamp = uniform(1), uBurst = uniform(0);

  const step = Fn(() => {
    const p = pos.element(instanceIndex), v = vel.element(instanceIndex), t = tgt.element(instanceIndex);
    const here = p.xyz.toVar(); // snapshot: p and v are written below
    // Spin the target around Y and let the stone swell slightly on each inhale.
    const ca = cos(uAngle), sa = sin(uAngle);
    const target = vec3(t.x.mul(ca).add(t.z.mul(sa)), t.y, t.z.mul(ca).sub(t.x.mul(sa))).mul(u.uBreath.mul(0.04).add(1));
    // Loose: wander on slow noise. Formed: spring to target with a faint shimmer.
    const drift = mx_noise_vec3(here.mul(0.6).add(vec3(0, u.uTime.mul(0.12), u.uTime.mul(0.05))));
    const force = target.sub(here).mul(uForm.mul(4)).add(drift.mul(mix(1.1, 0.06, uForm))).toVar();
    // Pointer: motes flow around the cursor.
    const d = here.sub(u.uPointer);
    force.addAssign(d.mul(u.uPush.mul(exp(d.dot(d).mul(-4))).mul(30)));
    // Click: brief outward burst from the core.
    force.addAssign(here.mul(uBurst));
    const nv = v.xyz.add(force.mul(uDt)).mul(uDamp).toVar();
    v.assign(vec4(nv, 0));
    p.assign(vec4(here.add(nv.mul(uDt)), 1));
  });
  const compute = step().compute(COUNT);

  // Rendering: one instanced sprite per mote, soft round falloff.
  const kind = tgt.toAttribute().w;
  const r = hash(instanceIndex);
  const twinkle = sin(u.uTime.mul(r.mul(1.5).add(0.5)).add(r.mul(6.283))).mul(0.5).add(0.5);
  const isEdge = float(1).sub(kind.min(1)); // 1 on facet edges
  const size = mix(0.012, 0.028, hash(instanceIndex.add(7))).mul(isEdge.mul(0.35).add(1)).mul(twinkle.mul(0.5).add(0.75));

  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: theme.motesAdditive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  material.positionNode = pos.toAttribute().xyz;
  material.scaleNode = size;
  const soft = float(1).sub(smoothstep(0.1, 0.5, uv().sub(0.5).length()));
  const tint = mix(color(theme.motes[0]), color(theme.motes[1]), mix(r, 1, isEdge.mul(0.6)));
  const alpha = mix(0.45, 0.95, isEdge).mul(twinkle.mul(0.35).add(0.65)).mul(kind.equal(INNER).select(0.5, 1));
  material.colorNode = vec4(tint.mul(u.flash.mul(0.4).add(1)), soft.mul(alpha));

  const object = new THREE.Sprite(material);
  object.count = COUNT;
  object.frustumCulled = false;

  let form = still ? 1 : 0, burst = 0, angle = 0;
  return {
    object,
    // loosen: 0 = formed, 1 = fully dissolved (driven by scroll in main.js).
    update(dt, loosen) {
      if (still) return;
      form += (1 - loosen - form) * (1 - Math.exp(-0.9 * dt));
      burst *= Math.exp(-10 * dt);
      angle += dt * spin;
      uForm.value = form; uBurst.value = burst; uAngle.value = angle;
      uDt.value = dt;
      uDamp.value = Math.exp(-3.5 * dt);
      renderer.compute(compute);
    },
    burst() { burst = 40; },
  };
}
