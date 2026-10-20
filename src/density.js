// 通用“点密度”渲染器：几万条轨道在 GPU 上并行迭代，每一步把点落进的格子 +1（原子加），
// 再用一个全屏片元着色器把计数取对数、映射到颜色。所有吸引子、IFS、根云都共用这一套。
import { getDevice, compile, fitCanvas, FULLSCREEN_VS } from './gpu.js'
import { PALETTES } from './palettes.js'

// ---------- 公共 WGSL：状态、随机数、复数 ----------
export const COMMON_WGSL = /* wgsl */ `
struct St { a: vec4f, b: vec4f, col: f32, skip: f32, rng: u32 };
struct U {
  view: vec4f,      // cx, cy, scale(半高), aspect(宽/高)
  size: vec4u,      // W, H, 每线程每帧迭代数, 帧号
  misc: vec4f,      // 颜色模式, burn, 时间, 未用
  p: array<vec4f, 8>,
};
var<private> PO: array<f32, 32>;
fn P(i: u32) -> f32 { return PO[i]; }
fn loadParams() { for (var i = 0u; i < 32u; i++) { PO[i] = u.p[i / 4u][i % 4u]; } }
fn pcg(v: u32) -> u32 { let s = v * 747796405u + 2891336453u; let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
fn rnd(s: ptr<function, St>) -> f32 { (*s).rng = pcg((*s).rng); return f32((*s).rng >> 8u) / 16777216.0; }
fn cmul(a: vec2f, b: vec2f) -> vec2f { return vec2f(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
fn cdiv(a: vec2f, b: vec2f) -> vec2f { let d = dot(b, b); return vec2f(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / d; }
fn conj(a: vec2f) -> vec2f { return vec2f(a.x, -a.y); }
fn cpowi(z: vec2f, n: i32) -> vec2f { var r = vec2f(1.0, 0.0); for (var k = 0; k < n; k++) { r = cmul(r, z); } return r; }
fn cexpi(t: f32) -> vec2f { return vec2f(cos(t), sin(t)); }
const PI = 3.14159265358979;
fn badv(v: vec4f) -> bool { let m = max(abs(v.x), max(abs(v.y), abs(v.z))); return !(m < 1e6); }
`

function computeCode(sys) {
  return COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read_write> state: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> hist: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> csum: array<atomic<i32>>;
@group(0) @binding(4) var<storage, read_write> mx: array<atomic<u32>>;
${sys.wgsl}
fn plot(q: vec2f, ang: f32) {
  let W = u.size.x; let H = u.size.y;
  let fx = ((q.x - u.view.x) / (u.view.w * u.view.z) * 0.5 + 0.5) * f32(W);
  let fy = (0.5 - (q.y - u.view.y) / u.view.z * 0.5) * f32(H);
  if (!(fx >= 0.0 && fy >= 0.0 && fx < f32(W) && fy < f32(H))) { return; }
  let idx = u32(fy) * W + u32(fx);
  let c = atomicAdd(&hist[idx], 1u) + 1u;
  if (c > atomicLoad(&mx[0])) { atomicMax(&mx[0], c); }
  if (u.misc.x > 0.5) {
    atomicAdd(&csum[2u * idx], i32(round(cos(ang) * 16.0)));
    atomicAdd(&csum[2u * idx + 1u], i32(round(sin(ang) * 16.0)));
  }
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) g: vec3u) {
  let i = g.x;
  if (i * 3u + 2u >= arrayLength(&state)) { return; }
  loadParams();
  var s: St;
  s.a = state[3u * i]; s.b = state[3u * i + 1u];
  let c = state[3u * i + 2u]; s.col = c.x; s.skip = c.y; s.rng = bitcast<u32>(c.z);
  if (u.size.w == 0u) { s.rng = pcg(i * 9781u + 12345u + u32(u.misc.z * 1000.0)); mInit(&s); s.skip = u.misc.y; }
  let mode = u.misc.x;
  for (var k = 0u; k < u.size.z; k++) {
${sys.multi ? `
    var pts: array<vec4f, 32>;
    let n = mMulti(&s, &pts);
    for (var j = 0u; j < n; j++) { plot(pts[j].xy, pts[j].z); }
` : `
    let q0 = mProj(s);
    mStep(&s);
    if (badv(s.a)) { mInit(&s); s.skip = 40.0; continue; }
    if (s.skip > 0.0) { s.skip -= 1.0; continue; }
    let q = mProj(s);
    var ang = 0.0;
    if (mode > 1.5) { ang = s.col * 2.0 * PI; } else if (mode > 0.5) { let d = q - q0; ang = atan2(d.y, d.x); }
    plot(q, ang);
`}
  }
  state[3u * i] = s.a; state[3u * i + 1u] = s.b;
  state[3u * i + 2u] = vec4f(s.col, s.skip, bitcast<f32>(s.rng), 0.0);
}
`
}

// 显示：模式 0 调色板 / 1 色相(方向或映射编号) / 2 双色 / 3 墨水(浅底) / 4 浮雕
const RENDER_WGSL = /* wgsl */ `
struct R {
  size: vec4f,       // W, H, mode, gamma
  tone: vec4f,       // lo, exposure, glow, relief
  bg: vec4f,
  extra: vec4f,      // unwrap(0..1), sat, hueShift, linear(1 = 不取对数)
  stops: array<vec4f, 8>,
  duo: array<vec4f, 2>,
};
@group(0) @binding(0) var<uniform> r: R;
@group(0) @binding(1) var<storage, read> hist: array<u32>;
@group(0) @binding(2) var<storage, read> csum: array<i32>;
@group(0) @binding(3) var<storage, read> mx: array<u32>;
fn pal(t: f32) -> vec3f {
  let x = clamp(t, 0.0, 1.0) * 7.0; let i = u32(floor(x)); let f = x - floor(x);
  return mix(r.stops[min(i, 7u)].rgb, r.stops[min(i + 1u, 7u)].rgb, f);
}
fn hsv(h: f32, s: f32, v: f32) -> vec3f {
  let k = vec3f(1.0, 2.0 / 3.0, 1.0 / 3.0);
  let p = abs(fract(vec3f(h) + k) * 6.0 - 3.0);
  return v * mix(vec3f(1.0), clamp(p - 1.0, vec3f(0.0), vec3f(1.0)), s);
}
fn src(px: vec2f) -> vec2f {
  // 极坐标展开：横轴 = 角度，纵轴 = 半径（外圈在上）
  let W = r.size.x; let H = r.size.y; let u = r.extra.x;
  if (u <= 0.0) { return px; }
  let c = vec2f(W, H) * 0.5; let R = 0.5 * min(W, H) * 0.995;
  let th = (px.x / W * 2.0 - 1.0) * PI; let rad = (1.0 - px.y / H) * R;
  let q = c + vec2f(cos(th), -sin(th)) * rad;
  return mix(px, q, u);
}
const PI = 3.14159265358979;
fn cnt(p: vec2f) -> f32 {
  let W = u32(r.size.x); let H = u32(r.size.y);
  if (p.x < 0.0 || p.y < 0.0 || p.x >= r.size.x || p.y >= r.size.y) { return 0.0; }
  return f32(hist[u32(p.y) * W + u32(p.x)]);
}
fn tval(c: f32) -> f32 {
  let m = max(f32(mx[0]), 1.0);
  var t = select(log(1.0 + c) / log(1.0 + m), c / m, r.extra.w > 0.5) * r.tone.y;
  t = clamp((t - r.tone.x) / max(1.0 - r.tone.x, 1e-3), 0.0, 1.0);
  return pow(t, r.size.w) * step(0.5, c);
}
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let p = src(fc.xy);
  let c = cnt(p);
  var t = tval(c);
  let mode = r.size.z;
  var g = 0.0;
  if (r.tone.z > 0.0) {
    for (var k = 0; k < 12; k++) {
      let a = f32(k) * 0.5236; let rr = select(2.5, 6.0, k % 2 == 1);
      g += tval(cnt(p + vec2f(cos(a), sin(a)) * rr));
    }
    g = g / 12.0 * r.tone.z;
  }
  var col: vec3f;
  if (mode < 0.5) {
    col = pal(t);
  } else if (mode < 1.5 || mode < 2.5) {
    let W = u32(r.size.x);
    var ang = 0.0;
    if (p.x >= 0.0 && p.y >= 0.0 && p.x < r.size.x && p.y < r.size.y) {
      let idx = u32(p.y) * W + u32(p.x);
      ang = atan2(f32(csum[2u * idx + 1u]), f32(csum[2u * idx]));
    }
    if (mode < 1.5) {
      col = hsv(fract(ang / (2.0 * PI) + r.extra.z), r.extra.y * (1.0 - 0.55 * pow(t, 4.0)), t);
    } else {
      let m = clamp(abs(ang) / PI, 0.0, 1.0);
      col = mix(r.duo[0].rgb, r.duo[1].rgb, m) * t;
    }
  } else if (mode < 3.5) {
    col = mix(r.bg.rgb, pal(1.0), t);
    return vec4f(col - g * 0.15, 1.0);
  } else {
    let e = 1.5;
    let tx = tval(cnt(p + vec2f(e, 0.0))) - tval(cnt(p - vec2f(e, 0.0)));
    let ty = tval(cnt(p + vec2f(0.0, e))) - tval(cnt(p - vec2f(0.0, e)));
    let n = normalize(vec3f(-tx * r.tone.w, -ty * r.tone.w, 1.0));
    let L = normalize(vec3f(-0.6, -0.7, 0.9));
    let sh = clamp(dot(n, L), 0.0, 1.0);
    col = pal(t) * (0.35 + 0.95 * sh) + vec3f(pow(sh, 24.0) * t * 0.5);
  }
  col = col + r.bg.rgb * (1.0 - t) + pal(0.85) * g;
  return vec4f(col, 1.0);
}
`

function hex(h) { return [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) }

// DensityView：一个 canvas + 一个系统（system）
// sys = { wgsl, multi, params(默认数组, 长度 ≤ 32), view:{cx,cy,scale}, color: 0/1/2, threads, iters, burn }
export class DensityView {
  static async create(canvas, sys, opts = {}) {
    const v = new DensityView()
    await v.init(canvas, sys, opts)
    return v
  }
  async init(canvas, sys, opts) {
    this.device = await getDevice()
    this.canvas = canvas
    this.ctx = canvas.getContext('webgpu')
    this.format = navigator.gpu.getPreferredCanvasFormat()
    this.ctx.configure({ device: this.device, format: this.format, alphaMode: 'opaque' })
    this.dpr = opts.dprScale ?? 1
    this.maxSide = opts.maxSide ?? 1600
    this.view = { cx: 0, cy: 0, scale: 1.5, ...(sys.view || {}) }
    this.look = { mode: 0, palette: 'ice', gamma: 1.0, lo: 0.1, exposure: 1.0, glow: 0.25, relief: 6, sat: 0.85, hueShift: 0, unwrap: 0, ...(opts.look || {}) }
    this.uBuf = this.device.createBuffer({ size: 16 * 3 + 16 * 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    this.rBuf = this.device.createBuffer({ size: 16 * 4 + 16 * 8 + 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    this.mxBuf = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
    const rmod = compile(this.device, FULLSCREEN_VS + RENDER_WGSL, 'density-render')
    this.rPipe = this.device.createRenderPipeline({
      layout: 'auto', vertex: { module: rmod, entryPoint: 'vs' },
      fragment: { module: rmod, entryPoint: 'fs', targets: [{ format: this.format }] }, primitive: { topology: 'triangle-list' },
    })
    this.points = 0
    this.setSystem(sys)
  }
  setSystem(sys) {
    this.sys = sys
    this.threads = sys.threads ?? 32768
    this.iters = sys.iters ?? 48
    this.params = new Float32Array(32)
    ;(sys.params || []).forEach((x, i) => { this.params[i] = x })
    const key = sys.wgsl + (sys.multi ? 'M' : '')
    if (this._key !== key) {
      this._key = key
      const mod = compile(this.device, computeCode(sys), 'density-compute')
      this.cPipe = this.device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } })
    }
    this.stateBuf?.destroy()
    this.stateBuf = this.device.createBuffer({ size: this.threads * 48, usage: GPUBufferUsage.STORAGE })
    this._bindKey = null
    this.reset()
  }
  setParam(i, x) { this.params[i] = x; this.reset() }
  reset() { this.frame = 0; this.points = 0; this.needClear = true }
  ensureSize() {
    const changed = fitCanvas(this.canvas, this.dpr, this.maxSide)
    const W = this.canvas.width, H = this.canvas.height
    if (!this.histBuf || this.W !== W || this.H !== H) {
      this.W = W; this.H = H
      this.histBuf?.destroy(); this.csBuf?.destroy()
      this.histBuf = this.device.createBuffer({ size: W * H * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
      this.csBuf = this.device.createBuffer({ size: W * H * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
      this._bindKey = null
      this.reset()
    }
    if (!this._bindKey) {
      this._bindKey = 1
      this.cBind = this.device.createBindGroup({
        layout: this.cPipe.getBindGroupLayout(0),
        entries: [this.uBuf, this.stateBuf, this.histBuf, this.csBuf, this.mxBuf].map((b, i) => ({ binding: i, resource: { buffer: b } })),
      })
      this.rBind = this.device.createBindGroup({
        layout: this.rPipe.getBindGroupLayout(0),
        entries: [this.rBuf, this.histBuf, this.csBuf, this.mxBuf].map((b, i) => ({ binding: i, resource: { buffer: b } })),
      })
    }
    return changed
  }
  // 世界坐标 <-> 屏幕
  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect(), asp = r.width / r.height
    const qx = (clientX - r.left) / r.width * 2 - 1, qy = 1 - (clientY - r.top) / r.height * 2
    return [this.view.cx + qx * asp * this.view.scale, this.view.cy + qy * this.view.scale]
  }
  toCss(x, y) {
    const r = this.canvas.getBoundingClientRect(), asp = r.width / r.height
    return [((x - this.view.cx) / (asp * this.view.scale) * 0.5 + 0.5) * r.width, (0.5 - (y - this.view.cy) / this.view.scale * 0.5) * r.height]
  }
  // 推进一帧：迭代若干步并显示。compute=false 只重画（改颜色时用）
  step(compute = true) {
    this.ensureSize()
    const dev = this.device
    const enc = dev.createCommandEncoder()
    if (this.needClear) {
      enc.clearBuffer(this.histBuf); enc.clearBuffer(this.csBuf); enc.clearBuffer(this.mxBuf)
      this.needClear = false
    }
    const L = this.look
    const colMode = L.mode === 1 || L.mode === 2 ? (this.sys.colorVar === 'map' ? 2 : 1) : 0
    if (compute) {
      const u = new ArrayBuffer(16 * 3 + 16 * 8)
      const f = new Float32Array(u), q = new Uint32Array(u)
      f[0] = this.view.cx; f[1] = this.view.cy; f[2] = this.view.scale; f[3] = this.W / this.H
      q[4] = this.W; q[5] = this.H; q[6] = this.frame === 0 ? Math.max(1, Math.ceil(this.iters / 4)) : this.iters; q[7] = this.frame
      f[8] = this.sys.multi ? (colMode ? 2 : 0) : colMode; f[9] = this.sys.burn ?? 200; f[10] = (this.seed = (this.seed ?? 0) + 1) % 997; f[11] = 0
      f.set(this.params, 12)
      dev.queue.writeBuffer(this.uBuf, 0, u)
      const pass = enc.beginComputePass()
      pass.setPipeline(this.cPipe)
      pass.setBindGroup(0, this.cBind)
      pass.dispatchWorkgroups(Math.ceil(this.threads / 64))
      pass.end()
      this.points += this.threads * q[6] * (this.sys.multi ? (this.sys.perStep ?? 16) : 1)
      this.frame++
    }
    const r = new Float32Array(16 + 32 + 8)
    r[0] = this.W; r[1] = this.H; r[2] = L.mode; r[3] = L.gamma
    r[4] = L.lo; r[5] = L.exposure; r[6] = L.glow; r[7] = L.relief
    const pl = PALETTES[L.palette] || PALETTES.ice
    const bg = L.mode === 3 ? hex(pl.paper || '#f3efe4') : hex(pl.stops[0])
    r.set([...bg, 1], 8)
    r[12] = L.unwrap; r[13] = L.sat; r[14] = L.hueShift; r[15] = L.linear ? 1 : 0
    const stops = L.mode === 3 ? (pl.ink || ['#f3efe4', '#d9d2c2', '#b1a892', '#857c69', '#5b5446', '#3a352c', '#24211b', '#141310']) : pl.stops
    for (let k = 0; k < 8; k++) r.set([...hex(stops[Math.min(k, stops.length - 1)]), 1], 16 + 4 * k)
    r.set([...hex(L.duoA || '#3fd9f2'), 1], 48); r.set([...hex(L.duoB || '#ff7326'), 1], 52)
    dev.queue.writeBuffer(this.rBuf, 0, r)
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] })
    rp.setPipeline(this.rPipe)
    rp.setBindGroup(0, this.rBind)
    rp.draw(3)
    rp.end()
    dev.queue.submit([enc.finish()])
  }
}

// ---------- 参数平面的李雅普诺夫地图：每个像素一组参数，迭代并估计指数 ----------
export function lyapCode(sys, ix, iy) {
  return COMMON_WGSL + /* wgsl */ `
@group(0) @binding(0) var<uniform> u: U;
${sys.wgsl}
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  loadParams();
  let W = f32(u.size.x); let H = f32(u.size.y);
  let px = u.view.x + (fc.x / W * 2.0 - 1.0) * u.view.w * u.view.z;
  let py = u.view.y + (1.0 - fc.y / H * 2.0) * u.view.z;
  PO[${ix}u] = px; PO[${iy}u] = py;
  var s: St; s.rng = 1234567u; mInit(&s);
  let N = u.size.z;
  for (var k = 0u; k < 200u; k++) { mStep(&s); }
  var e = s; e.a = s.a + vec4f(1e-4, 0.0, 0.0, 0.0);
  var L = 0.0;
  var esc = false;
  for (var k = 0u; k < N; k++) {
    mStep(&s); mStep(&e);
    if (badv(s.a)) { esc = true; break; }
    var d = length(e.a.xyz - s.a.xyz);
    d = max(d, 1e-12);
    L += log(d / 1e-4);
    e.a = vec4f(s.a.xyz + (e.a.xyz - s.a.xyz) / d * 1e-4, e.a.w); e.b = s.b; e.col = s.col; e.rng = s.rng;
  }
  if (esc) { return vec4f(0.02, 0.02, 0.03, 1.0); }
  L = L / f32(N);
  if (L > 0.0) {
    let t = pow(clamp(L / u.misc.y, 0.0, 1.0), 0.6);
    return vec4f(ramp(t, vec3f(0.03, 0.02, 0.04), vec3f(0.36, 0.04, 0.10), vec3f(0.85, 0.31, 0.16), vec3f(1.0, 0.82, 0.48)), 1.0);
  }
  let t = pow(clamp(-L / 1.5, 0.0, 1.0), 0.7);
  return vec4f(ramp(t, vec3f(0.02, 0.03, 0.07), vec3f(0.03, 0.23, 0.40), vec3f(0.16, 0.62, 0.84), vec3f(0.85, 0.96, 1.0)), 1.0);
}
fn ramp(t: f32, a: vec3f, b: vec3f, c: vec3f, d: vec3f) -> vec3f {
  if (t < 0.333) { return mix(a, b, t * 3.0); }
  if (t < 0.667) { return mix(b, c, (t - 0.333) * 3.0); }
  return mix(c, d, (t - 0.667) * 3.0);
}
`
}

export class LyapMap {
  static async create(canvas, sys, ix, iy, view, opts = {}) {
    const m = new LyapMap()
    m.device = await getDevice()
    m.canvas = canvas; m.sys = sys; m.ix = ix; m.iy = iy
    m.view = { ...view }
    m.ctx = canvas.getContext('webgpu')
    m.format = navigator.gpu.getPreferredCanvasFormat()
    m.ctx.configure({ device: m.device, format: m.format, alphaMode: 'opaque' })
    m.uBuf = m.device.createBuffer({ size: 16 * 3 + 16 * 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    m.params = new Float32Array(32); (sys.params || []).forEach((x, i) => { m.params[i] = x })
    m.iters = opts.iters ?? 600; m.lmax = opts.lmax ?? 0.8
    m.dpr = opts.dprScale ?? 0.75
    const mod = compile(m.device, FULLSCREEN_VS + lyapCode(sys, ix, iy), 'lyap')
    m.pipe = m.device.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: 'fs', targets: [{ format: m.format }] }, primitive: { topology: 'triangle-list' } })
    m.bind = m.device.createBindGroup({ layout: m.pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: m.uBuf } }] })
    return m
  }
  toWorld(clientX, clientY) { return DensityView.prototype.toWorld.call(this, clientX, clientY) }
  toCss(x, y) { return DensityView.prototype.toCss.call(this, x, y) }
  draw() {
    fitCanvas(this.canvas, this.dpr, 1400)
    const W = this.canvas.width, H = this.canvas.height
    const u = new ArrayBuffer(16 * 3 + 16 * 8), f = new Float32Array(u), q = new Uint32Array(u)
    f[0] = this.view.cx; f[1] = this.view.cy; f[2] = this.view.scale; f[3] = W / H
    q[4] = W; q[5] = H; q[6] = this.iters; q[7] = 0
    f[8] = 0; f[9] = this.lmax; f.set(this.params, 12)
    this.device.queue.writeBuffer(this.uBuf, 0, u)
    const enc = this.device.createCommandEncoder()
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] })
    rp.setPipeline(this.pipe); rp.setBindGroup(0, this.bind); rp.draw(3); rp.end()
    this.device.queue.submit([enc.finish()])
  }
}
