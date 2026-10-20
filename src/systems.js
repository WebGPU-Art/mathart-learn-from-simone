// 各种“规则”的 WGSL 片段。每个系统提供 mInit / mStep / mProj（或 mMulti），参数通过 P(i) 读取。

// ---------- 扩展对称吸引子（Field–Golubitsky 族，按 S. Conradi 的写法） ----------
// z' = {a0 + a1|z|² + a2 Re(zⁿ) + a3 |z| Re[(z/|z|)^(np)] + iω} z + a4 z̄ⁿ⁻¹ + a5 / z̄
// P0..P5 = a0..a5, P6 = ω, P7 = n, P8 = p
export const ICON = {
  name: '对称吸引子',
  wgsl: /* wgsl */ `
fn mInit(s: ptr<function, St>) { (*s).a = vec4f(0.35 + 0.3 * rnd(s), 0.15 + 0.3 * rnd(s), 0.0, 0.0); }
fn mStep(s: ptr<function, St>) {
  let z = (*s).a.xy; let r2 = dot(z, z); let r = sqrt(r2); let n = i32(P(7));
  let zn = cpowi(z, n);
  var t = P(0) + P(1) * r2 + P(2) * zn.x;
  if (P(3) != 0.0 && r > 1e-12) { t += P(3) * r * cos(f32(n) * P(8) * atan2(z.y, z.x)); }
  var nz = cmul(vec2f(t, P(6)), z) + P(4) * cpowi(conj(z), n - 1);
  if (P(5) != 0.0) { nz += P(5) * cdiv(vec2f(1.0, 0.0), conj(z)); }
  (*s).a = vec4f(nz, 0.0, 0.0);
}
fn mProj(s: St) -> vec2f { return s.a.xy; }
`,
  keys: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'ω', 'n', 'p'],
}
// 预设：src C = 参数读自 Conradi 公开图片上的标注；N = 本项目随机搜索
export const ICON_PRESETS = [
  { id: 'C1', src: 'C', label: 'C1 · 十瓣花（n=5, p=9, 含 a5/z̄）', p: [0.4145, -1.7525, 1.214, 0.0456, -1.5751, -0.1062, 0, 5, 9], scale: 0.8, palette: 'pink' },
  { id: 'C2', src: 'C', label: 'C2 · 经典五角星（n=5, p=0）', p: [3.8262, -1.7777, -1.9226, -4.4305, 0.9726, 0, 0, 5, 0], scale: 0.8, palette: 'fire' },
  { id: 'C3', src: 'C', label: 'C3 · 115 齿（n=5, p=23）', p: [2.7369, -3.9062, -1.4331, -0.0803, 0.6054, 0, 0, 5, 23], scale: 1.0, palette: 'ice' },
  { id: 'N3', src: 'N', label: '3 重（随机搜索）', p: [1.4857, -2.9504, -0.8352, 0, 1.4345, 0, 0, 3, 0], scale: 0.72, palette: 'magma' },
  { id: 'N4', src: 'N', label: '4 重（随机搜索）', p: [1.463, -1.0698, 0.971, 0, -1.2518, 0, 0, 4, 0], scale: 1.35, palette: 'ice' },
  { id: 'N6', src: 'N', label: '6 重 · p=1（随机搜索）', p: [1.459, -1.4753, -1.6068, 0.7368, 1.3742, 0, 0, 6, 1], scale: 1.13, palette: 'fire' },
  { id: 'N7', src: 'N', label: '7 重 · p=8 锯齿（随机搜索）', p: [2.3806, -3.4906, 1.0786, 0.2016, -1.3391, 0, 0, 7, 8], scale: 0.86, palette: 'aurora' },
  { id: 'N8', src: 'N', label: '8 重（随机搜索）', p: [2.2512, -1.8336, 0.7267, 0, -0.4119, 0, 0, 8, 0], scale: 1.0, palette: 'pink' },
  { id: 'N12', src: 'N', label: '12 重 · p=3（随机搜索）', p: [2.5083, -3.4436, 0.2173, -0.624, -0.1933, 0, 0, 12, 3], scale: 1.04, palette: 'teal' },
]

// ---------- Clifford / de Jong ----------
// P0..P3 = a,b,c,d；P4 = 0 Clifford, 1 de Jong
export const CLIFFORD = {
  name: 'Clifford 吸引子',
  wgsl: /* wgsl */ `
fn mInit(s: ptr<function, St>) { (*s).a = vec4f(rnd(s) * 0.4 - 0.2, rnd(s) * 0.4 - 0.2, 0.0, 0.0); }
fn mStep(s: ptr<function, St>) {
  let x = (*s).a.x; let y = (*s).a.y;
  var nx: f32; var ny: f32;
  if (P(4) < 0.5) { nx = sin(P(0) * y) + P(2) * cos(P(0) * x); ny = sin(P(1) * x) + P(3) * cos(P(1) * y); }
  else { nx = sin(P(0) * y) - cos(P(1) * x); ny = sin(P(2) * x) - cos(P(3) * y); }
  (*s).a = vec4f(nx, ny, 0.0, 0.0);
}
fn mProj(s: St) -> vec2f { return s.a.xy; }
`,
}

// ---------- sin/cos(zᵐ) 映射（公式见 Conradi 2026-08 的动画；m=2 时即 x²−y², 2xy） ----------
// P0 = a, P1 = b, P2 = m
export const SINCOS = {
  name: 'sin·cos(zᵐ)',
  wgsl: /* wgsl */ `
fn mInit(s: ptr<function, St>) { (*s).a = vec4f(rnd(s) * 0.4 - 0.2, rnd(s) * 0.4, 0.0, 0.0); }
fn mStep(s: ptr<function, St>) {
  let z = cpowi((*s).a.xy, i32(P(2)));
  (*s).a = vec4f(sin(z.x + P(0)), cos(z.y + P(1)), 0.0, 0.0);
}
fn mProj(s: St) -> vec2f { return s.a.xy; }
`,
}

// ---------- 洛伦兹（RK4，三维 → 旋转投影） ----------
// P0 σ, P1 ρ, P2 β, P3 dt, P4 yaw, P5 pitch
export const LORENZ = {
  name: '洛伦兹',
  wgsl: /* wgsl */ `
fn f3(p: vec3f) -> vec3f { return vec3f(P(0) * (p.y - p.x), p.x * (P(1) - p.z) - p.y, p.x * p.y - P(2) * p.z); }
fn mInit(s: ptr<function, St>) { (*s).a = vec4f(rnd(s) * 20.0 - 10.0, rnd(s) * 20.0 - 10.0, rnd(s) * 30.0 + 5.0, 0.0); }
fn mStep(s: ptr<function, St>) {
  let p = (*s).a.xyz; let h = P(3);
  let k1 = f3(p); let k2 = f3(p + 0.5 * h * k1); let k3 = f3(p + 0.5 * h * k2); let k4 = f3(p + h * k3);
  (*s).a = vec4f(p + h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4), 0.0);
  (*s).col = clamp(length(k1) / 250.0, 0.0, 1.0) * 0.5;
}
fn mProj(s: St) -> vec2f {
  let p = s.a.xyz - vec3f(0.0, 0.0, 25.0);
  let cy = cos(P(4)); let sy = sin(P(4)); let cp = cos(P(5)); let sp = sin(P(5));
  let x1 = cy * p.x + sy * p.y; let y1 = -sy * p.x + cy * p.y;
  return vec2f(x1, cp * p.z - sp * y1);
}
`,
}

// ---------- 仿射 IFS（混沌游戏）：最多 4 个映射，每个 6 个数 (a b c d e f)：x' = a x + b y + e, y' = c x + d y + f ----------
// P0..P23 映射，P24 映射个数，P25 = 1 时“禁止连续两次用同一个映射”（记忆规则）
export const IFS = {
  name: '迭代函数系统',
  colorVar: 'map',
  wgsl: /* wgsl */ `
fn mInit(s: ptr<function, St>) { (*s).a = vec4f(rnd(s), rnd(s), 0.0, 0.0); (*s).b = vec4f(-1.0, 0.0, 0.0, 0.0); }
fn mStep(s: ptr<function, St>) {
  let m = i32(P(24));
  var k = min(i32(rnd(s) * f32(m)), m - 1);
  if (P(25) > 0.5 && f32(k) == (*s).b.x) { k = (k + 1 + min(i32(rnd(s) * f32(m - 1)), m - 2)) % m; }
  let o = u32(k) * 6u; let x = (*s).a.x; let y = (*s).a.y;
  (*s).a = vec4f(P(o) * x + P(o + 1u) * y + P(o + 4u), P(o + 2u) * x + P(o + 3u) * y + P(o + 5u), 0.0, 0.0);
  (*s).b.x = f32(k);
  (*s).col = (f32(k) + 0.5) / f32(m) * 0.999;
}
fn mProj(s: St) -> vec2f { return s.a.xy; }
`,
}
const tri = (x, y) => [0.5, 0, 0, 0.5, x, y]
const cmulM = (re, im, ex, ey) => [re, -im, im, re, ex, ey]
export const IFS_PRESETS = {
  sierpinski: { label: '谢尔宾斯基三角（3 个映射）', maps: [tri(0, 0), tri(0.5, 0), tri(0.25, 0.433)], view: { cx: 0.5, cy: 0.42, scale: 0.55 } },
  carpet: { label: '谢尔宾斯基方毯（4 个角，记忆规则可试）', maps: [tri(0, 0), tri(0.5, 0), tri(0, 0.5), tri(0.5, 0.5)], view: { cx: 0.5, cy: 0.5, scale: 0.6 } },
  // 双龙：以 (i-1) 为底、数字 {0,1} 的展开，f_d(z) = (z + d)/(i - 1)
  twindragon: { label: '双龙（复数映射 (z+d)/(i−1)）', maps: [cmulM(-0.5, -0.5, 0, 0), cmulM(-0.5, -0.5, -0.5, -0.5)], view: { cx: -0.2, cy: -0.1, scale: 0.75 } },
  fern: { label: 'Barnsley 蕨（经典，4 个映射等概率版）', maps: [[0.85, 0.04, -0.04, 0.85, 0, 1.6], [0.2, -0.26, 0.23, 0.22, 0, 1.6], [-0.15, 0.28, 0.26, 0.24, 0, 0.44], [0, 0, 0, 0.16, 0, 0]], view: { cx: 0, cy: 5, scale: 5.4 } },
}
export function ifsParams(preset, memory = 0) {
  const p = new Array(32).fill(0)
  preset.maps.forEach((m, i) => m.forEach((x, j) => { p[i * 6 + j] = x }))
  p[24] = preset.maps.length; p[25] = memory
  return p
}

// ---------- 两个复数映射（随机挑一个），可选“折回”函数 ----------
// 映射 k：z → A z + B z̄ + C + D z² + E/z  （复数系数，P[10k .. 10k+9]）；P20 折回：0 无（飞出去就从随机点重新出发）1 正弦 2 反演 3 z/(1+|z|)
export const CIFS = {
  name: '两个复数映射',
  colorVar: 'map',
  wgsl: /* wgsl */ `
fn mInit(s: ptr<function, St>) { (*s).a = vec4f(rnd(s) * 2.0 - 1.0, rnd(s) * 2.0 - 1.0, 0.0, 0.0); (*s).b = vec4f(0.5, 0.0, 0.0, 0.0); }
fn mStep(s: ptr<function, St>) {
  let k = select(0u, 1u, rnd(s) > 0.5); let o = k * 10u; let z = (*s).a.xy;
  var w = cmul(vec2f(P(o), P(o + 1u)), z) + cmul(vec2f(P(o + 2u), P(o + 3u)), conj(z)) + vec2f(P(o + 4u), P(o + 5u)) + cmul(vec2f(P(o + 6u), P(o + 7u)), cmul(z, z));
  let e = vec2f(P(o + 8u), P(o + 9u));
  if (dot(e, e) > 0.0 && dot(z, z) > 1e-18) { w += cdiv(e, z); }
  let f = P(20);
  if (f > 0.5 && f < 1.5) { w = vec2f(sin(w.x), sin(w.y)); }
  else if (f > 1.5 && f < 2.5) { w = w / (dot(w, w) + 0.25); }
  else if (f > 2.5) { w = w / (1.0 + length(w)); }
  if (f < 0.5 && !(length(w) < 50.0)) { w = vec2f(rnd(s) * 2.0 - 1.0, rnd(s) * 2.0 - 1.0); (*s).skip = 6.0; }
  (*s).b.x = 0.7 * (*s).b.x + 0.3 * f32(k);
  (*s).col = 0.5 * (*s).b.x;
  (*s).a = vec4f(w, 0.0, 0.0);
}
fn mProj(s: St) -> vec2f { return s.a.xy; }
`,
}
const C = (re, im) => [re, im]
const cmap = (A, B, Cc, D, E = [0, 0]) => [...A, ...B, ...Cc, ...D, ...E]
const fold = (maps, f) => { const p = new Array(21).fill(0); maps.forEach((m, i) => m.forEach((x, j) => { p[i * 10 + j] = x })); p[20] = f; return p }
// 本项目随机搜索得到的几组（蓝色角标）
export const CIFS_PRESETS = {
  yarn: { label: '毛线球（z/(1+|z|) 折回）', p: fold([cmap(C(-1.5234, -1.4515), C(-0.5734, -0.4962), C(0.4695, -0.185), C(0.0225, -0.6308)), cmap(C(2.526, -0.8598), C(-0.778, -0.2565), C(0.4362, -0.3918), C(-0.0893, 0.8223))], 3), view: { cx: 0, cy: 0, scale: 1.05 } },
  sinfold: { label: '方形织物（正弦折回）', p: fold([cmap(C(-0.1004, -1.3959), C(-0.3146, -0.244), C(-0.5707, 0.4427), C(-0.0252, -0.2358)), cmap(C(0.4916, 0.9958), C(-0.8215, -0.1284), C(-0.7846, -0.1385), C(-0.5158, 0.0083))], 1), view: { cx: 0, cy: 0, scale: 1.1 } },
  inversion: { label: '线团（反演折回）', p: fold([cmap(C(-0.9329, 1.3565), C(-0.4625, -0.6745), C(1.0385, -0.5245), C(0.0914, 0.1676)), cmap(C(-1.8103, 1.2037), C(-0.5169, 0.0306), C(0.3481, -0.0695), C(-0.3567, 0.3719))], 2), view: { cx: 0, cy: 0, scale: 1.1 } },
  flame: { label: '火焰丝（无折回，飞出就重启）', p: fold([cmap(C(0.4151, -0.0722), C(0.5984, -0.257), C(-0.6811, 0.1373), C(0.3574, -0.014), C(0.0839, -0.0425)), cmap(C(-0.6519, 0.77), C(0.3922, 0.3833), C(-0.2191, -0.5776), C(-0.2923, -0.0562), C(0.0466, 0.0407))], 0), view: { cx: 0, cy: 0, scale: 2.5 } },
}

// ---------- 多项式的根（Aberth 法在 GPU 上求根），一次产出很多点 ----------
// P0 模式：0 = Conradi 的 16 次环面多项式（P1 = 常数项相位），1 = Littlewood（±1 系数，P2 = 次数），2 = 波希米亚矩阵（P3 = n，P4 = 元素集合）
export const ROOTS = {
  name: '多项式的根',
  multi: true,
  colorVar: 'map',
  perStep: 16,
  wgsl: /* wgsl */ `
fn mInit(s: ptr<function, St>) { }
fn mStep(s: ptr<function, St>) { }
fn mProj(s: St) -> vec2f { return s.a.xy; }
fn aberth(deg: i32, cf: ptr<function, array<vec2f, 25>>, rt: ptr<function, array<vec2f, 24>>, seed: f32) {
  // 初值：圆周上均匀，半径取 |c_n / c_0|^(1/n)
  let rr = pow(max(length((*cf)[deg]) / length((*cf)[0]), 1e-6), 1.0 / f32(deg)) * 1.1 + 0.05;
  for (var i = 0; i < deg; i++) { (*rt)[i] = rr * cexpi(2.0 * PI * (f32(i) + 0.25 + seed) / f32(deg) + 0.4); }
  for (var it = 0; it < 28; it++) {
    for (var i = 0; i < deg; i++) {
      let z = (*rt)[i];
      var p = (*cf)[0]; var dp = vec2f(0.0);
      for (var k = 1; k <= deg; k++) { dp = cmul(dp, z) + p; p = cmul(p, z) + (*cf)[k]; }
      let ratio = cdiv(p, dp);
      var sm = vec2f(0.0);
      for (var j = 0; j < deg; j++) { if (j != i) { sm += cdiv(vec2f(1.0, 0.0), z - (*rt)[j]); } }
      let w = cdiv(ratio, vec2f(1.0, 0.0) - cmul(ratio, sm));
      if (all(w == w)) { (*rt)[i] = z - w; }
    }
  }
}
fn mMulti(s: ptr<function, St>, out: ptr<function, array<vec4f, 32>>) -> u32 {
  var cf: array<vec2f, 25>; var rt: array<vec2f, 24>;
  var deg = 16; var ang = 0.0;
  let mode = P(0);
  if (mode < 0.5) {
    let a1 = rnd(s) * 2.0 * PI; let a2 = rnd(s) * 2.0 * PI;
    let t1 = cexpi(a1); let t2 = cexpi(a2);
    let t1_2 = cmul(t1, t1); let t1_3 = cmul(t1_2, t1); let t1_4 = cmul(t1_3, t1);
    for (var k = 0; k <= 16; k++) { cf[k] = vec2f(0.0); }
    cf[0] = vec2f(128.0, 0.0); cf[4] = vec2f(-192.0, 0.0); cf[8] = vec2f(74.0, 0.0); cf[12] = vec2f(-5.5, 0.0);
    cf[15] = cmul(t1_4, vec2f(12.9, 56.6)) + cmul(t1_3, vec2f(-14.2, -123.0)) + cmul(t1_2, vec2f(-128.0, -140.0)) + cmul(t1, vec2f(424.0, -150.0)) + vec2f(454.0, 433.0);
    cf[16] = cmul(cmul(t2, vec2f(420.0, 609.0)) + vec2f(-393.0, -483.0), cexpi(P(1)));
    ang = a1;
  } else if (mode < 1.5) {
    deg = i32(P(2)); var plus = 0.0;
    for (var k = 0; k <= deg; k++) { let b = rnd(s) > 0.5; cf[k] = vec2f(select(-1.0, 1.0, b), 0.0); plus += select(0.0, 1.0, b); }
    ang = plus / f32(deg + 1) * 2.0 * PI;
  } else {
    // 随机 n×n 矩阵 → Faddeev–LeVerrier 求特征多项式
    let n = i32(P(3)); deg = n;
    var A: array<f32, 36>; var M: array<f32, 36>; var T: array<f32, 36>; var c: array<f32, 7>;
    var nz = 0.0;
    for (var k = 0; k < n * n; k++) {
      let r = rnd(s); var v: f32;
      if (P(4) < 0.5) { v = select(select(0.0, 1.0, r > 0.6667), -1.0, r < 0.3333); }
      else if (P(4) < 1.5) { v = select(0.0, 1.0, r > 0.5); }
      else { v = select(-1.0, 1.0, r > 0.5); }
      A[k] = v; nz += abs(v); M[k] = 0.0;
    }
    c[n] = 1.0;
    for (var k = 1; k <= n; k++) {
      // M = A*M + c[n-k+1] I
      for (var i = 0; i < n; i++) { for (var j = 0; j < n; j++) {
        var sacc = 0.0; for (var l = 0; l < n; l++) { sacc += A[i * n + l] * M[l * n + j]; }
        T[i * n + j] = sacc + select(0.0, c[n - k + 1], i == j);
      } }
      var tr = 0.0;
      for (var i = 0; i < n; i++) { for (var l = 0; l < n; l++) { tr += A[i * n + l] * T[l * n + i]; } }
      for (var q = 0; q < n * n; q++) { M[q] = T[q]; }
      c[n - k] = -tr / f32(k);
    }
    for (var k = 0; k <= n; k++) { cf[k] = vec2f(c[n - k], 0.0); }
    ang = nz / f32(n * n) * 2.0 * PI;
  }
  aberth(deg, &cf, &rt, rnd(s));
  for (var i = 0; i < deg; i++) { (*out)[i] = vec4f(rt[i], ang, 0.0); }
  return u32(deg);
}
`,
}
