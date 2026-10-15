import * as THREE from "three/webgpu";
import {
  Fn, instanceIndex, instancedArray, uniform, float, vec3, vec4, color, uv,
  cos, sin, exp, hash, mix, smoothstep, mx_noise_vec3,
} from "three/tsl";
import { diamondGeometry } from "./strands.js";

// "Made of light": GPU particles drift in like dust in sunlight and settle into
// a shape — mostly on its edges so the form reads, the rest on the faces.
// A compute shader springs each mote to its target, adds slow noise, and pushes
// motes away from the pointer; scroll and clicks loosen the shape.
// Shapes are built from parts; odd parts spin the opposite way (the merkaba's
// counter-rotating tetrahedra).

const EDGE = 0, FACE = 1, INNER = 2;

// Tetrahedron with its apex on +Y (dir 1) or -Y (dir -1); together they form
// a star tetrahedron (merkaba), each the point-inversion of the other.
function tetrahedron(dir, R = 1.45) {
  const v = [[0, dir * R, 0]];
  const ring = (R * Math.sqrt(8)) / 3;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + (dir < 0 ? Math.PI : 0);
    v.push([Math.cos(a) * ring, (-dir * R) / 3, Math.sin(a) * ring]);
  }
  const faces = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(faces.flat().flatMap((i) => v[i]), 3));
  return g;
}

const SHAPES = {
  diamond: { parts: () => [diamondGeometry()], core: [0, -0.2, 0] },
  merkaba: { parts: () => [tetrahedron(1), tetrahedron(-1)], core: [0, 0, 0] },
};

// Fills out[offset…] with count targets on geo: vec4(xyz, kind + 4 * part).
function samplePart(geo, count, core, part, out, offset) {
  const edges = new THREE.EdgesGeometry(geo, 1).attributes.position.array; // facet edges only
  const tris = (geo.index ? geo.toNonIndexed() : geo).attributes.position.array;

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

  const p = new THREE.Vector3(), center = new THREE.Vector3(...core);
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
      if (kind === INNER) p.lerp(center, Math.random() * 0.8);
    }
    out.set([p.x, p.y, p.z, kind + 4 * part], (offset + i) * 4);
  }
}

// Target points for a shape, split evenly across its parts.
export function sampleShape(shape, count) {
  const { parts, core } = SHAPES[shape] ?? SHAPES.diamond;
  const geos = parts(), out = new Float32Array(count * 4);
  let offset = 0;
  geos.forEach((geo, part) => {
    const n = part === geos.length - 1 ? count - offset : Math.floor(count / geos.length);
    samplePart(geo, n, core, part, out, offset);
    offset += n;
  });
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
export function createDust({ shape, theme, small, still, u, renderer, spin }) {
  const COUNT = small ? 14000 : 40000;
  const targets = sampleShape(shape, COUNT);
  const tgt = instancedArray(targets, "vec4");
  // Reduced motion: start (and stay) in shape.
  const pos = instancedArray(still ? targets.slice() : scatter(COUNT), "vec4");
  const vel = instancedArray(COUNT, "vec4");

  const uDt = uniform(0), uAngle = uniform(0), uForm = uniform(still ? 1 : 0);
  const uDamp = uniform(1), uBurst = uniform(0);

  const step = Fn(() => {
    const p = pos.element(instanceIndex), v = vel.element(instanceIndex), t = tgt.element(instanceIndex);
    const here = p.xyz.toVar(); // snapshot: p and v are written below
    // Spin the target around Y (odd parts the other way) and let the shape
    // swell slightly on each inhale.
    const part = t.w.div(4).floor();
    const angle = uAngle.mul(float(1).sub(part.mod(2).mul(2)));
    const ca = cos(angle), sa = sin(angle);
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
  const packed = tgt.toAttribute().w;
  const kind = packed.sub(packed.div(4).floor().mul(4)); // strip the part index
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
