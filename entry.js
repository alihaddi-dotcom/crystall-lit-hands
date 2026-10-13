// The page works without 3D: only load the scene where WebGPU exists.
// ponytail: no WebGL2 path; the CSS glow is the fallback.
if (navigator.gpu && (await navigator.gpu.requestAdapter())) import("./main.js");
