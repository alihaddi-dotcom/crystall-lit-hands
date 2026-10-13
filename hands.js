import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

// Hand: @webxr-input-profiles/assets generic-hand (MIT), rest pose.
// Strand authoring follows the article: weld the mesh into a graph, run a
// geodesic (Dijkstra) field from the wrist, then
//  - flow strands descend the field from the fingers and trail off past the wrist,
//  - wander strands random-walk the surface, steered by an occupancy count.

const HAND_LENGTH = 2.5;
const WRIST = new THREE.Vector3(-0.22, -1.35, 0);

async function loadHandGraph() {
  const gltf = await new GLTFLoader().loadAsync("/left.glb");
  gltf.scene.updateMatrixWorld(true);
  let mesh;
  gltf.scene.traverse((o) => { if (o.isMesh) mesh = o; });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", mesh.geometry.attributes.position.clone());
  g.setIndex(mesh.geometry.index.clone());
  g.applyMatrix4(mesh.matrixWorld);

  // Model space: fingers along -Y, palm faces +X. Rotate to fingers +Y, palm +Z.
  const canon = new THREE.Matrix4().set(0, 0, 1, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
  const wrist = gltf.scene.getObjectByName("wrist").getWorldPosition(new THREE.Vector3());
  g.translate(-wrist.x, -wrist.y, -wrist.z);
  g.applyMatrix4(canon);
  g.computeBoundingBox();
  const s = HAND_LENGTH / g.boundingBox.max.y;
  // Pose: lean outward, turn the palm slightly toward the centre.
  const pose = new THREE.Matrix4().compose(
    WRIST,
    new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0.45, 0.28)),
    new THREE.Vector3(s, s, s),
  );
  g.applyMatrix4(pose);

  const welded = mergeVertices(g, 1e-4);
  welded.computeVertexNormals();
  const pos = welded.attributes.position, nrm = welded.attributes.normal, idx = welded.index.array;
  const V = pos.count;
  const P = Array.from({ length: V }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i));
  const Nn = Array.from({ length: V }, (_, i) => new THREE.Vector3().fromBufferAttribute(nrm, i));
  const adj = Array.from({ length: V }, () => new Set());
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
    adj[a].add(b).add(c); adj[b].add(a).add(c); adj[c].add(a).add(b);
  }
  return { P, N: Nn, adj: adj.map((s) => [...s]) };
}

// ponytail: O(V²) Dijkstra, fine for ~1k vertices; use a heap for dense meshes.
function geodesicFromWrist({ P, adj }) {
  const V = P.length;
  const minY = Math.min(...P.map((p) => p.y));
  const dist = new Float32Array(V).fill(Infinity);
  const done = new Uint8Array(V);
  P.forEach((p, i) => { if (p.y < minY + 0.12) dist[i] = 0; });
  for (let k = 0; k < V; k++) {
    let u = -1;
    for (let i = 0; i < V; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = 1;
    for (const v of adj[u]) {
      const d = dist[u] + P[u].distanceTo(P[v]);
      if (d < dist[v]) dist[v] = d;
    }
  }
  return dist;
}

const onSurface = (graph, v, lift) => graph.P[v].clone().addScaledVector(graph.N[v], lift);

function flowStrand(graph, dist, maxDist) {
  // Start high on the hand (mostly fingers), descend to the wrist.
  let v;
  do v = (Math.random() * graph.P.length) | 0;
  while (dist[v] < maxDist * (0.35 + Math.random() * 0.5));
  const lift = 0.01 + Math.random() * 0.05;
  const pts = [onSurface(graph, v, lift)];
  while (dist[v] > 0) {
    let best = -1, bestScore = Infinity;
    for (const n of graph.adj[v]) {
      if (dist[n] >= dist[v]) continue;
      const score = dist[n] + Math.random() * 0.12;
      if (score < bestScore) { bestScore = score; best = n; }
    }
    if (best < 0) break;
    v = best;
    pts.push(onSurface(graph, v, lift));
  }
  // Tail: keep falling and fan out below the wrist.
  const dir = pts.length > 1 ? pts.at(-1).clone().sub(pts.at(-2)).normalize() : new THREE.Vector3(0, -1, 0);
  const pull = new THREE.Vector3((Math.random() - 0.7) * 1.6, -1, (Math.random() - 0.5) * 0.8).normalize();
  const p = pts.at(-1).clone();
  for (let i = 0, n = 20 + Math.random() * 40; i < n; i++) {
    dir.lerp(pull, 0.12).normalize();
    pts.push(p.addScaledVector(dir, 0.07).clone());
  }
  return pts;
}

function wanderStrand(graph, visits) {
  let v = (Math.random() * graph.P.length) | 0;
  const lift = 0.005 + Math.random() * 0.03;
  const pts = [onSurface(graph, v, lift)];
  const prev = new THREE.Vector3().randomDirection(), d = new THREE.Vector3();
  for (let i = 0, n = 25 + Math.random() * 45; i < n; i++) {
    let best = -1, bestScore = Infinity;
    for (const nb of graph.adj[v]) {
      d.subVectors(graph.P[nb], graph.P[v]).normalize();
      const score = visits[nb] * 0.6 - d.dot(prev) * 1.5 + Math.random();
      if (score < bestScore) { bestScore = score; best = nb; }
    }
    prev.subVectors(graph.P[best], graph.P[v]).normalize();
    v = best;
    visits[v]++;
    pts.push(onSurface(graph, v, lift));
  }
  return pts;
}

// Smooth the edge-hopping path, then resample to n evenly spaced points.
function resample(pts, n) {
  for (let it = 0; it < 4; it++)
    for (let i = 1; i < pts.length - 1; i++)
      pts[i] = pts[i - 1].clone().add(pts[i + 1]).multiplyScalar(0.25).addScaledVector(pts[i], 0.5);
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const out = [];
  for (let k = 0, j = 0; k < n; k++) {
    const t = (k / (n - 1)) * len.at(-1);
    while (j < pts.length - 2 && len[j + 1] < t) j++;
    const f = (t - len[j]) / (len[j + 1] - len[j] || 1);
    out.push(pts[j].clone().lerp(pts[j + 1], f));
  }
  return out;
}

// Returns packed vec4 control points (w = 1 for flow strands) for both hands.
export async function makeHandStrands(flowCount, wanderCount, N) {
  const graph = await loadHandGraph();
  const dist = geodesicFromWrist(graph);
  const maxDist = Math.max(...dist.filter(Number.isFinite));
  const visits = new Float32Array(graph.P.length);
  const count = flowCount + wanderCount;
  const data = new Float32Array(count * N * 4);
  for (let s = 0; s < count; s++) {
    const isFlow = s < flowCount;
    const pts = resample(isFlow ? flowStrand(graph, dist, maxDist) : wanderStrand(graph, visits), N);
    const mirror = s % 2 ? -1 : 1; // odd strands go on the right hand
    pts.forEach((p, i) => data.set([p.x * mirror, p.y, p.z, isFlow ? 1 : 0], (s * N + i) * 4));
  }
  return data;
}
