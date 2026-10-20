import { nav, addFullscreenAll, ctx2d, buildControls, getDevice, FullscreenPass, fitCanvas, onVisible, showError, attachPanZoom } from './gpu.js'
import { mountDensity } from './demo.js'
import { ROOTS } from './systems.js'

nav('roots.html')
const $ = (id) => document.getElementById(id)
const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
const cd = (a, b) => { const q = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / q, (a[1] * b[0] - a[0] * b[1]) / q] }
const deg = (a) => (Math.atan2(a[1], a[0]) * 180 / Math.PI)
const len = (a) => Math.hypot(a[0], a[1])
function arrow(c, x0, y0, x1, y1, col, w = 2.5) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke()
  const a = Math.atan2(y1 - y0, x1 - x0); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 11 * Math.cos(a - 0.4), y1 - 11 * Math.sin(a - 0.4)); c.lineTo(x1 - 11 * Math.cos(a + 0.4), y1 - 11 * Math.sin(a + 0.4)); c.fill()
}
function grid(c, w, h, X, Y, S, step = 1) {
  c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h)
  c.strokeStyle = '#162028'; c.lineWidth = 1
  for (let g = Math.floor(-w / S); g <= w / S; g += step) { c.beginPath(); c.moveTo(X(g), 0); c.lineTo(X(g), h); c.stroke() }
  for (let g = Math.floor(-h / S); g <= h / S; g += step) { c.beginPath(); c.moveTo(0, Y(g)); c.lineTo(w, Y(g)); c.stroke() }
  c.strokeStyle = '#3a4a55'; c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(w, Y(0)); c.moveTo(X(0), 0); c.lineTo(X(0), h); c.stroke()
}
// 在 canvas 上拖动若干个点（世界坐标），返回 redraw
function dragPoints(cv, pts, toWorld, toPx, onMove, opt = {}) {
  let k = -1
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
    let best = 22; k = -1
    pts.forEach((p, i) => { const [px, py] = toPx(p); const d = Math.hypot(px - x, py - y); if (d < best) { best = d; k = i } })
    if (k >= 0) { cv.setPointerCapture(e.pointerId); e.stopImmediatePropagation() } else opt.miss?.(e)
  }, true)
  cv.addEventListener('pointermove', (e) => { if (k < 0) return; const r = cv.getBoundingClientRect(); pts[k].splice(0, 2, ...toWorld(e.clientX - r.left, e.clientY - r.top)); onMove(k) })
  cv.addEventListener('pointerup', () => { k = -1 })
}

// 1 · 复数乘法
;(() => {
  const root = $('d-mul'), cv = root.querySelector('canvas'), ro = root.querySelector('.readout')
  const P = [[1.2, 0.5], [0.8, 0.9]]
  let W = 0, H = 0, S = 1
  const X = (x) => W / 2 + x * S, Y = (y) => H / 2 - y * S
  function draw() {
    const [c, w, h] = ctx2d(cv); W = w; H = h; S = h / 5.2
    grid(c, w, h, X, Y, S)
    c.strokeStyle = '#ffffff33'; c.setLineDash([4, 4]); c.beginPath(); c.arc(X(0), Y(0), S, 0, 7); c.stroke(); c.setLineDash([])
    const [a, b] = P, ab = cm(a, b)
    const arc = (ang0, ang1, r, col) => { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(X(0), Y(0), r, -ang0, -ang1, ang1 > ang0); c.stroke() }
    arc(0, Math.atan2(a[1], a[0]), 26, '#5cc8ff'); arc(Math.atan2(a[1], a[0]), Math.atan2(a[1], a[0]) + Math.atan2(b[1], b[0]), 40, '#ffb347')
    arrow(c, X(0), Y(0), X(a[0]), Y(a[1]), '#5cc8ff'); arrow(c, X(0), Y(0), X(b[0]), Y(b[1]), '#ffb347'); arrow(c, X(0), Y(0), X(ab[0]), Y(ab[1]), '#ff6fae', 3)
    c.font = '15px sans-serif'
    for (const [p, t, col] of [[a, 'a', '#5cc8ff'], [b, 'b', '#ffb347'], [ab, 'a·b', '#ff6fae']]) { c.fillStyle = col; c.fillText(t, X(p[0]) + 8, Y(p[1]) - 8) }
    for (const p of P) { c.fillStyle = '#fff'; c.beginPath(); c.arc(X(p[0]), Y(p[1]), 7, 0, 7); c.fill() }
    ro.textContent = `|a| = ${len(a).toFixed(2)}, ∠a = ${deg(a).toFixed(0)}°   ·   |b| = ${len(b).toFixed(2)}, ∠b = ${deg(b).toFixed(0)}°   ⇒   |a·b| = ${len(ab).toFixed(2)} = ${len(a).toFixed(2)} × ${len(b).toFixed(2)}，∠(a·b) = ${(((deg(a) + deg(b)) % 360 + 540) % 360 - 180).toFixed(0)}° = ∠a + ∠b`
  }
  dragPoints(cv, P, (x, y) => [(x - W / 2) / S, (H / 2 - y) / S], (p) => [X(p[0]), Y(p[1])], draw)
  window.addEventListener('resize', draw); draw()
})()

// 2 · 根的轨迹
;(() => {
  const root = $('d-traj'), cv = root.querySelector('canvas'), ro = root.querySelector('.readout')
  const st = { R: 3.2, speed: 0.5, play: 1 }
  let th = 0, roots = null, trails = [[], [], [], [], []], start = null, raf = 0, visible = false
  const N = 5
  function solve(t, init) {
    // z^5 + t z + 1，Aberth，以上一帧的根为初值（保证轨迹连续）
    const cf = [[1, 0], [0, 0], [0, 0], [0, 0], t, [1, 0]]
    let r = init || Array.from({ length: N }, (_, k) => [1.3 * Math.cos(2 * Math.PI * k / N + 0.4), 1.3 * Math.sin(2 * Math.PI * k / N + 0.4)])
    for (let it = 0; it < 30; it++) {
      r = r.map((z, i) => {
        let p = cf[0], dp = [0, 0]
        for (let k = 1; k <= N; k++) { dp = [dp[0] + 0, dp[1]]; dp = cm(dp, z); dp = [dp[0] + p[0], dp[1] + p[1]]; p = cm(p, z); p = [p[0] + cf[k][0], p[1] + cf[k][1]] }
        const ratio = cd(p, dp); let s = [0, 0]
        r.forEach((w, j) => { if (j !== i) { const q = cd([1, 0], [z[0] - w[0], z[1] - w[1]]); s = [s[0] + q[0], s[1] + q[1]] } })
        const den = [1 - cm(ratio, s)[0], -cm(ratio, s)[1]], wv = cd(ratio, den)
        return Number.isFinite(wv[0]) ? [z[0] - wv[0], z[1] - wv[1]] : z
      })
    }
    return r
  }
  const cols = ['#ff6fae', '#ffb347', '#e8f07a', '#5cc8ff', '#b48cff']
  function reset() { roots = null; trails = [[], [], [], [], []]; th = 0; start = null }
  function frame() {
    raf = 0; if (!visible) return
    if (st.play) th += 0.02 * st.speed
    const t = [st.R * Math.cos(th), st.R * Math.sin(th)]
    roots = solve(t, roots)
    if (!start) start = roots.map((z) => [...z])
    roots.forEach((z, i) => { trails[i].push(z); if (trails[i].length > 900) trails[i].shift() })
    const [c, w, h] = ctx2d(cv); const S = h / 4.2, X = (x) => w * 0.42 + x * S, Y = (y) => h / 2 - y * S
    grid(c, w, h, X, Y, S, 0.5)
    trails.forEach((tr, i) => { c.strokeStyle = cols[i] + 'aa'; c.lineWidth = 2; c.beginPath(); tr.forEach((z, k) => (k ? c.lineTo(X(z[0]), Y(z[1])) : c.moveTo(X(z[0]), Y(z[1])))); c.stroke() })
    start.forEach((z) => { c.strokeStyle = '#fff6'; c.beginPath(); c.arc(X(z[0]), Y(z[1]), 9, 0, 7); c.stroke() })
    roots.forEach((z, i) => { c.fillStyle = cols[i]; c.beginPath(); c.arc(X(z[0]), Y(z[1]), 6, 0, 7); c.fill() })
    // 右侧：t 的圆
    const cx = w * 0.86, cy = h / 2, rr = Math.min(h * 0.32, 90)
    c.strokeStyle = '#ffffff55'; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.stroke()
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + rr * Math.cos(th), cy - rr * Math.sin(th), 6, 0, 7); c.fill()
    c.font = '13px sans-serif'; c.fillText(`t = ${st.R.toFixed(2)}·e^{iθ}`, cx - 48, cy + rr + 22)
    const turns = Math.floor(th / (2 * Math.PI))
    ro.textContent = `θ = ${((th * 180 / Math.PI) % 360).toFixed(0)}°，已走 ${turns} 圈。白圈 = 出发时根的位置。` + (turns >= 1 ? ' 看看每个颜色的根，走完一圈后回到了谁的白圈？' : '')
    if (st.play) raf = requestAnimationFrame(frame)
  }
  buildControls(root.querySelector('.ctl'), st, [
    { key: 'R', label: '半径 R', min: 0.2, max: 6, step: 0.01, digits: 2 },
    { key: 'speed', label: '速度', min: 0.1, max: 3, step: 0.05, digits: 2 },
    { key: 'play', label: '播放', type: 'check' },
  ], (k) => { if (k === 'R') reset(); if (!raf && visible) raf = requestAnimationFrame(frame) })
  onVisible(root, (v) => { visible = v; if (v && !raf) raf = requestAnimationFrame(frame) })
})()

// 3 · Littlewood 根云
mountDensity($('d-cloud'), {
  sys: ROOTS, params: [1, 0, 18, 4, 0], view: { cx: 0, cy: 0, scale: 1.55 }, src: 'K', threads: 8192, iters: 3,
  look: { palette: 'magma', gamma: 0.85, lo: 0.0 },
  controls: [{ i: 2, label: '次数', min: 4, max: 24, step: 1 }],
  lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow'], modeOptions: [[0, '调色板（密度）'], [1, '色相 = +1 系数的比例']],
  maxPoints: 4e8,
})

// 4 · 复平面着色 + 辐角原理
;(async () => {
  const root = $('d-domain'), cv = root.querySelector('canvas.gl'), ov = root.querySelector('canvas.ov'), ro = root.querySelector('.readout')
  const st = { contours: 1, n: 3, R: 1.0 }
  const Z = [[-1.2, 0.3], [0.6, 0.7], [0.9, -0.6], [-0.3, -0.9], [1.8, 0.2], [-1.9, -0.8], [0.0, 1.4], [-0.8, 1.2]]
  const circ = [[0.2, 0.0]]
  const view = { cx: 0, cy: 0, scale: 1.8 }
  const code = /* wgsl */ `
struct U { view: vec4f, cfg: vec4f, r: array<vec4f, 8> };
@group(0) @binding(0) var<uniform> u: U;
fn hsv(h: f32, s: f32, v: f32) -> vec3f { let k = vec3f(1.0, 2.0 / 3.0, 1.0 / 3.0); let p = abs(fract(vec3f(h) + k) * 6.0 - 3.0); return v * mix(vec3f(1.0), clamp(p - 1.0, vec3f(0.0), vec3f(1.0)), s); }
@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let z = vec2f(u.view.x + (fc.x / u.cfg.z * 2.0 - 1.0) * u.view.w * u.view.z, u.view.y + (1.0 - fc.y / u.cfg.w * 2.0) * u.view.z);
  var ang = 0.0; var lg = 0.0;
  for (var i = 0; i < i32(u.cfg.x); i++) { let d = z - u.r[i].xy; ang += atan2(d.y, d.x); lg += 0.5 * log(dot(d, d) + 1e-12); }
  let h = fract(ang / 6.2831853);
  var v = 0.92;
  if (u.cfg.y > 0.5) { let f = fract(lg / 0.6931); v = 0.62 + 0.38 * pow(f, 0.6); }
  return vec4f(hsv(h, 0.8, v), 1.0);
}`
  let pass
  try { pass = new FullscreenPass(await getDevice(), cv, code, 4 + 4 + 32) } catch (e) { showError(cv, e); return }
  let visible = false, raf = 0
  const toPx = (p) => { const r = cv.getBoundingClientRect(), asp = r.width / r.height; return [((p[0] - view.cx) / (asp * view.scale) * 0.5 + 0.5) * r.width, (0.5 - (p[1] - view.cy) / view.scale * 0.5) * r.height] }
  const toW = (x, y) => { const r = cv.getBoundingClientRect(), asp = r.width / r.height; return [view.cx + (x / r.width * 2 - 1) * asp * view.scale, view.cy + (1 - y / r.height * 2) * view.scale] }
  function winding() {
    const n = st.n, [cx, cy] = circ[0]; let tot = 0, prev = null
    for (let k = 0; k <= 720; k++) {
      const t = (k / 720) * 2 * Math.PI, z = [cx + st.R * Math.cos(t), cy + st.R * Math.sin(t)]
      let a = 0; for (let i = 0; i < n; i++) a += Math.atan2(z[1] - Z[i][1], z[0] - Z[i][0])
      if (prev !== null) { let d = a - prev; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; tot += d }
      prev = a
    }
    return Math.round(tot / (2 * Math.PI))
  }
  function draw() {
    raf = 0; if (!visible) return
    fitCanvas(cv, 0.75)
    const u = pass.u; u.set([view.cx, view.cy, view.scale, cv.width / cv.height, st.n, st.contours, cv.width, cv.height])
    for (let i = 0; i < 8; i++) u.set([...Z[i], 0, 0], 8 + 4 * i)
    pass.draw()
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = ov.clientWidth, h = ov.clientHeight
    ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr)
    const c = ov.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (let i = 0; i < st.n; i++) { const [x, y] = toPx(Z[i]); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#000'; c.font = 'bold 11px sans-serif'; c.fillText(String(i + 1), x - 3.5, y + 4) }
    const [ccx, ccy] = toPx(circ[0]), rpx = toPx([circ[0][0] + st.R, circ[0][1]])[0] - ccx
    c.strokeStyle = '#fff'; c.setLineDash([6, 5]); c.lineWidth = 2; c.beginPath(); c.arc(ccx, ccy, rpx, 0, 7); c.stroke(); c.setLineDash([])
    c.fillStyle = '#fff'; c.beginPath(); c.rect(ccx - 5, ccy - 5, 10, 10); c.fill()
    const inside = Z.slice(0, st.n).filter((z) => Math.hypot(z[0] - circ[0][0], z[1] - circ[0][1]) < st.R).length
    ro.textContent = `沿虚线圆走一圈：p(z) 绕原点 ${winding()} 圈；圆里的零点：${inside} 个。（拖白点移动零点，拖小方块移动圆心）`
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(draw) }
  buildControls(root.querySelector('.ctl'), st, [
    { key: 'n', label: '零点个数', min: 1, max: 8, step: 1 },
    { key: 'R', label: '圆的半径', min: 0.1, max: 3, step: 0.01, digits: 2 },
    { key: 'contours', label: '显示 |p| 的等高条纹', type: 'check' },
  ], kick)
  // 白点和圆心都能拖；空白处拖动 = 平移视图
  const handles = () => [...Z.slice(0, st.n), circ[0]]
  let k = -1
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top
    let best = 20; k = -1
    handles().forEach((p, i) => { const [px, py] = toPx(p); const d = Math.hypot(px - x, py - y); if (d < best) { best = d; k = i } })
    if (k >= 0) { cv.setPointerCapture(e.pointerId); e.stopImmediatePropagation() }
  }, true)
  cv.addEventListener('pointermove', (e) => {
    if (k < 0) return; const r = cv.getBoundingClientRect(); const w = toW(e.clientX - r.left, e.clientY - r.top)
    if (k < st.n) Z[k] = w; else circ[0] = w
    kick()
  })
  cv.addEventListener('pointerup', () => { k = -1 })
  attachPanZoom(cv, view, kick)
  window.addEventListener('resize', kick)
  onVisible(root, (v) => { visible = v; kick() })
})()

// 5 · 2×2 特征值
;(() => {
  const root = $('d-eig'), cv = root.querySelector('canvas'), ro = root.querySelector('.readout')
  const st = { a: 2, b: 1, c: 1, d: 2, sym: 1 }
  const hist = []
  function draw(k) {
    if (st.sym && (k === 'b' || k === 'sym')) st.c = st.b
    if (st.sym && k === 'c') st.b = st.c
    refresh()
    const tr = st.a + st.d, det = st.a * st.d - st.b * st.c, disc = (st.a - st.d) ** 2 + 4 * st.b * st.c
    let l1, l2
    if (disc >= 0) { l1 = [(tr + Math.sqrt(disc)) / 2, 0]; l2 = [(tr - Math.sqrt(disc)) / 2, 0] } else { l1 = [tr / 2, Math.sqrt(-disc) / 2]; l2 = [tr / 2, -Math.sqrt(-disc) / 2] }
    hist.push([l1, l2]); if (hist.length > 400) hist.shift()
    const [c, w, h] = ctx2d(cv); const S = h / 9, X = (x) => w / 2 + x * S, Y = (y) => h / 2 - y * S
    grid(c, w, h, X, Y, S)
    c.fillStyle = '#ffb34744'; hist.forEach(([p, q]) => { c.fillRect(X(p[0]) - 1, Y(p[1]) - 1, 2, 2); c.fillRect(X(q[0]) - 1, Y(q[1]) - 1, 2, 2) })
    for (const [p, col] of [[l1, '#ff6fae'], [l2, '#5cc8ff']]) { c.fillStyle = col; c.beginPath(); c.arc(X(p[0]), Y(p[1]), 7, 0, 7); c.fill() }
    c.fillStyle = '#ddd'; c.font = '13px sans-serif'; c.fillText('复平面上的两个特征值（橙色小点 = 走过的路径）', 10, 18)
    const f = (z) => (Math.abs(z[1]) < 1e-9 ? z[0].toFixed(3) : `${z[0].toFixed(3)} ${z[1] >= 0 ? '+' : '−'} ${Math.abs(z[1]).toFixed(3)}i`)
    ro.textContent = `迹 a+d = ${tr.toFixed(2)}，行列式 ad−bc = ${det.toFixed(2)}，判别式 (a−d)²+4bc = ${disc.toFixed(2)} ⇒ λ₁ = ${f(l1)}，λ₂ = ${f(l2)}` + (disc < 0 ? '（一对共轭复数）' : '')
  }
  const refresh = buildControls(root.querySelector('.ctl'), st, [
    { key: 'a', label: 'a', min: -4, max: 4, step: 0.01, digits: 2 }, { key: 'b', label: 'b', min: -4, max: 4, step: 0.01, digits: 2 },
    { key: 'c', label: 'c', min: -4, max: 4, step: 0.01, digits: 2 }, { key: 'd', label: 'd', min: -4, max: 4, step: 0.01, digits: 2 },
    { key: 'sym', label: '对称（b = c）', type: 'check' },
  ], draw)
  window.addEventListener('resize', () => draw()); draw()
})()

// 6 · 波希米亚矩阵
mountDensity($('d-boh'), {
  sys: ROOTS, params: [2, 0, 0, 5, 0], view: { cx: 0, cy: 0, scale: 3.2 }, src: 'K', threads: 16384, iters: 2,
  look: { palette: 'magma', gamma: 0.8, lo: 0.0 },
  controls: [{ i: 3, label: '矩阵大小 n', min: 2, max: 6, step: 1 }, { i: 4, label: '元素取值', type: 'select', options: [[0, '{−1, 0, 1}'], [1, '{0, 1}'], [2, '{−1, 1}']] }],
  onParam: (i, api) => { if (i === 3) { api.v.view.scale = [0, 0, 2.2, 3.2, 4.0, 4.6, 5.2][api.v.params[3]]; api.v.reset() } },
  lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow'], modeOptions: [[0, '调色板（密度）'], [1, '色相 = 非零元素比例']],
  maxPoints: 5e8,
})

addFullscreenAll()
