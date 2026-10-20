import { nav, addFullscreenAll, ctx2d, buildControls, onVisible } from './gpu.js'
import { mountDensity, mountLyap } from './demo.js'
import { CLIFFORD, ICON, LORENZ, IFS, IFS_PRESETS, ifsParams } from './systems.js'
import { CLIFFORD_CONTROLS, CLIFFORD_PRESETS, LORENZ_CONTROLS } from './defs.js'

nav('iterate.html')
const $ = (id) => document.getElementById(id)

// 1 · 蛛网图 + 分岔图
;(() => {
  const root = $('d-cobweb'), cw = root.querySelector('canvas.cw'), bf = root.querySelector('canvas.bf'), ro = root.querySelector('.readout')
  const st = { r: 3.56, x0: 0.2, n: 60 }
  let bfImg = null, bfW = 0
  const R0 = 2.5, R1 = 4.0
  function drawBif() {
    const [c, w, h] = ctx2d(bf)
    if (!bfImg || bfW !== w) {
      bfW = w
      c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h)
      c.fillStyle = 'rgba(255,179,71,0.18)'
      for (let i = 0; i < w; i++) {
        const r = R0 + (R1 - R0) * (i / w); let x = 0.4
        for (let k = 0; k < 400; k++) x = r * x * (1 - x)
        for (let k = 0; k < 300; k++) { x = r * x * (1 - x); c.fillRect(i, h * (1 - x), 1, 1) }
      }
      bfImg = c.getImageData(0, 0, bf.width, bf.height)
    } else c.putImageData(bfImg, 0, 0)
    const dpr = bf.width / w; c.setTransform(dpr, 0, 0, dpr, 0, 0)
    const xr = (st.r - R0) / (R1 - R0) * w
    c.strokeStyle = '#5cc8ff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(xr, 0); c.lineTo(xr, h); c.stroke()
    c.fillStyle = '#ddd'; c.font = '12px sans-serif'; c.fillText(`分岔图（r 从 ${R0} 到 ${R1}）`, 8, 16)
  }
  function drawCob() {
    const [c, w, h] = ctx2d(cw); const P = 24, S = w - 2 * P, X = (x) => P + x * S, Y = (y) => h - P - y * S
    c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h)
    c.strokeStyle = '#3a4a55'; c.strokeRect(X(0), Y(1), S, S)
    c.strokeStyle = '#5a6a75'; c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(1), Y(1)); c.stroke()
    c.strokeStyle = '#7ee787'; c.lineWidth = 2; c.beginPath()
    for (let k = 0; k <= 200; k++) { const x = k / 200; const y = st.r * x * (1 - x); k ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y)) }
    c.stroke()
    let x = st.x0; c.strokeStyle = '#ffb347cc'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(X(x), Y(0))
    const xs = []
    for (let k = 0; k < st.n; k++) { const y = st.r * x * (1 - x); c.lineTo(X(x), Y(y)); c.lineTo(X(y), Y(y)); x = y; xs.push(x) }
    c.stroke()
    c.fillStyle = '#ddd'; c.font = '12px sans-serif'; c.fillText(`蛛网图  r = ${st.r.toFixed(3)}`, 8, 16)
    ro.textContent = '最后几次的 x：' + xs.slice(-6).map((v) => v.toFixed(4)).join(', ')
  }
  const draw = () => { drawCob(); drawBif() }
  buildControls(root.querySelector('.ctl'), st, [
    { key: 'r', label: 'r', min: 2.5, max: 4, step: 0.001, digits: 3 },
    { key: 'x0', label: '起点 x₀', min: 0.01, max: 0.99, step: 0.001, digits: 3 },
    { key: 'n', label: '步数', min: 1, max: 300, step: 1 },
  ], draw)
  const refresh = () => root.querySelectorAll('.ctl input[type=range]').forEach((inp, i) => { if (i === 0) { inp.value = st.r; inp.nextSibling.textContent = st.r.toFixed(3) } })
  bf.addEventListener('pointerdown', (e) => { const r = bf.getBoundingClientRect(); st.r = R0 + (R1 - R0) * (e.clientX - r.left) / r.width; refresh(); draw() })
  window.addEventListener('resize', () => { bfImg = null; draw() })
  onVisible(root, (v) => { if (v) draw() })
})()

// 2 · 四步渲染
;(async () => {
  const root = $('d-density')
  const api = await mountDensity(root, {
    sys: CLIFFORD, params: [-1.4, 1.6, 1.0, 0.7, 0], view: { cx: 0, cy: 0, scale: 2.1 }, src: 'K',
    look: { palette: 'fire', linear: 0, lo: 0.1, gamma: 1.1, glow: 0.35 },
    lookControls: ['palette', 'linear', 'gamma', 'lo', 'exposure', 'glow'],
  })
  if (!api) return
  const L = api.v.look
  root.querySelectorAll('button[data-k]').forEach((b) => {
    b.onclick = () => {
      const k = Number(b.dataset.k)
      if (k === 1) { Object.assign(L, { palette: 'bone', linear: 1, lo: 0, gamma: 1, glow: 0, exposure: 2.5 }); api.v.threads; api.v.reset(); api.v.points = 0; one = true }
      if (k === 2) Object.assign(L, { palette: 'bone', linear: 1, lo: 0, gamma: 1, glow: 0, exposure: 1 })
      if (k === 3) Object.assign(L, { palette: 'bone', linear: 0, lo: 0.1, gamma: 1.1, glow: 0, exposure: 1 })
      if (k === 4) Object.assign(L, { palette: 'fire', linear: 0, lo: 0.1, gamma: 1.1, glow: 0.35, exposure: 1 })
      if (k !== 1 && one) { one = false; api.v.reset() }
      api.refresh(); api.redraw()
    }
  })
  // 第一步：只迭代一帧（约几十万个点）就停住，看起来是散点
  let one = false
  const step0 = api.v.step.bind(api.v)
  api.v.step = (compute = true) => { if (one && api.v.frame >= 1) compute = false; step0(compute) }
})()

// 3 · Clifford + 参数地图
;(async () => {
  const root = $('d-clifford')
  let map = null
  const dv = await mountDensity(root, {
    sys: CLIFFORD, params: CLIFFORD_PRESETS[0].p, view: CLIFFORD_PRESETS[0].view, look: { palette: 'magma' },
    controls: CLIFFORD_CONTROLS, presets: CLIFFORD_PRESETS,
    onParam: (i, api) => { if (!map) return; if (i >= 2) { map.m.params[i] = api.v.params[i]; map.redraw() } map.setPick(api.v.params[0], api.v.params[1], false) },
    onPreset: (pr, api) => { if (!map) return; for (let i = 0; i < 5; i++) map.m.params[i] = pr.p[i]; map.setPick(pr.p[0], pr.p[1], false); map.redraw() },
  })
  map = await mountLyap(root, {
    sys: CLIFFORD, ix: 0, iy: 1, params: CLIFFORD_PRESETS[0].p, view: { cx: 0, cy: 0, scale: 3 }, pick: [-1.4, 1.6], iters: 300, lmax: 0.9, labels: ['a', 'b'],
    onPick: (a, b) => { if (!dv) return; dv.v.params[0] = a; dv.v.params[1] = b; dv.refresh?.(); dv.v.reset(); dv.kick(); root.querySelector('.badges').innerHTML = '<span class="badge n">本项目探索</span>' },
  })
})()

// 4 · 对称从哪里来：f(Rz) = R f(z)
;(() => {
  const presets = [
    { label: '3 重（随机搜索）', src: 'N', p: [1.4857, -2.9504, -0.8352, 0, 1.4345, 0, 0, 3, 0], scale: 0.72, palette: 'magma' },
    { label: '5 重（Conradi C2）', src: 'C', p: [3.8262, -1.7777, -1.9226, -4.4305, 0.9726, 0, 0, 5, 0], scale: 0.85, palette: 'fire' },
    { label: '6 重（随机搜索）', src: 'N', p: [1.459, -1.4753, -1.6068, 0.7368, 1.3742, 0, 0, 6, 1], scale: 1.13, palette: 'ice' },
    { label: '7 重 + ω（随机搜索）', src: 'N', p: [2.3806, -3.4906, 1.0786, 0.2016, -1.3391, 0, 0.05, 7, 8], scale: 0.86, palette: 'aurora' },
  ]
  let probe = [0.35, 0.2]
  const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
  const pw = (a, k) => { let r = [1, 0]; for (let i = 0; i < k; i++) r = cm(r, a); return r }
  const f = (p, z) => {
    const n = p[7], r2 = z[0] ** 2 + z[1] ** 2, r = Math.sqrt(r2), th = Math.atan2(z[1], z[0])
    const t = p[0] + p[1] * r2 + p[2] * pw(z, n)[0] + (p[3] ? p[3] * r * Math.cos(n * p[8] * th) : 0)
    const a = cm([t, p[6]], z), b = pw([z[0], -z[1]], n - 1)
    return [a[0] + p[4] * b[0], a[1] + p[4] * b[1]]
  }
  mountDensity($('d-sym'), {
    sys: ICON, params: presets[1].p, view: { cx: 0, cy: 0, scale: presets[1].scale }, look: { palette: 'fire' }, presets, src: 'C',
    controls: [{ i: 7, label: 'n（对称重数）', min: 2, max: 12, step: 1 }, { i: 6, label: 'ω', min: -0.3, max: 0.3, step: 0.001 }],
    panFilter: (e) => e.shiftKey,
    onPointer(cv, api) {
      let drag = false
      cv.addEventListener('pointerdown', (e) => { if (e.shiftKey) return; drag = true; probe = api.v.toWorld(e.clientX, e.clientY); api.redraw() })
      cv.addEventListener('pointermove', (e) => { if (!drag) return; probe = api.v.toWorld(e.clientX, e.clientY); api.redraw() })
      cv.addEventListener('pointerup', () => { drag = false })
    },
    overlay(c, v) {
      const p = Array.from(v.params), n = p[7], R = [Math.cos(2 * Math.PI / n), Math.sin(2 * Math.PI / n)]
      const z = probe, Rz = cm(R, z), fz = f(p, z), fRz = f(p, Rz), Rfz = cm(R, fz)
      const P = (q) => v.toCss(q[0], q[1])
      const dot = (q, col, r = 6, ring = false) => { const [x, y] = P(q); c.beginPath(); c.arc(x, y, r, 0, 7); if (ring) { c.strokeStyle = col; c.lineWidth = 2.5; c.stroke() } else { c.fillStyle = col; c.fill() } }
      const ln = (a, b, col) => { const [x0, y0] = P(a), [x1, y1] = P(b); c.strokeStyle = col; c.lineWidth = 1.5; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]) }
      ln(z, Rz, '#ffffff99'); ln(z, fz, '#ffb34799'); ln(Rz, fRz, '#ffb34799')
      dot(z, '#fff'); dot(Rz, '#bbb'); dot(fz, '#ffb347', 5); dot(fRz, '#ffb347', 6); dot(Rfz, '#5cc8ff', 11, true)
      c.font = '13px sans-serif'; c.fillStyle = '#fff'
      const lab = (q, t, dx = 10) => { const [x, y] = P(q); c.fillText(t, x + dx, y - 8) }
      lab(z, 'z'); lab(Rz, 'Rz'); lab(fz, 'f(z)'); lab(fRz, 'f(Rz) = R·f(z)', 14)
    },
    readout: (api) => `转角 360°/n = ${(360 / api.v.params[7]).toFixed(1)}°`,
  })
})()

// 5 · 洛伦兹
mountDensity($('d-lorenz'), {
  sys: LORENZ, params: [10, 28, 8 / 3, 0.006, 0.6, 0.15], view: { cx: 0, cy: 0, scale: 30 }, src: 'K', look: { palette: 'ice', mode: 1, gamma: 1.6, lo: 0.2, glow: 0.2, sat: 0.7 }, iters: 64,
  controls: LORENZ_CONTROLS, lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow'],
  anim: { label: '自动旋转', fn: (t, p) => { p[4] = 0.6 + t * 0.4 }, accumulate: 2 },
})

// 6 · 混沌游戏（逐点）
;(() => {
  const root = $('d-game'), cv = root.querySelector('canvas'), ro = root.querySelector('.readout')
  const V = [[0, 0], [1, 0], [0.5, 0.866]]
  let p = [0.3, 0.6], pts = [], last = null
  const step = () => { const k = Math.floor(Math.random() * 3); const q = [(p[0] + V[k][0]) / 2, (p[1] + V[k][1]) / 2]; last = { from: p, k, to: q }; p = q; pts.push(q) }
  function draw() {
    const [c, w, h] = ctx2d(cv); const S = h * 0.92, X = (x) => w / 2 + (x - 0.5) * S, Y = (y) => h * 0.96 - y * S
    c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h)
    c.fillStyle = pts.length > 2000 ? '#ffb34799' : '#ffb347'
    const r = pts.length > 2000 ? 0.8 : 2
    for (const q of pts) c.fillRect(X(q[0]) - r, Y(q[1]) - r, 2 * r, 2 * r)
    V.forEach((v, i) => { c.fillStyle = ['#ff6fae', '#7ee787', '#5cc8ff'][i]; c.beginPath(); c.arc(X(v[0]), Y(v[1]), 7, 0, 7); c.fill() })
    if (last && pts.length < 200) {
      c.strokeStyle = '#fff'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(X(last.from[0]), Y(last.from[1])); c.lineTo(X(V[last.k][0]), Y(V[last.k][1])); c.stroke(); c.setLineDash([])
      c.fillStyle = '#fff'; c.beginPath(); c.arc(X(last.to[0]), Y(last.to[1]), 5, 0, 7); c.fill()
    }
    ro.textContent = `已画 ${pts.length} 个点` + (last && pts.length < 200 ? `；这一步随机挑了 ${['粉', '绿', '蓝'][last.k]} 色顶点，走到一半的位置` : '')
  }
  root.querySelector('.g1').onclick = () => { step(); draw() }
  root.querySelector('.g10').onclick = () => { for (let i = 0; i < 10; i++) step(); draw() }
  root.querySelector('.g1k').onclick = () => { for (let i = 0; i < 1000; i++) step(); draw() }
  root.querySelector('.g0').onclick = () => { pts = []; last = null; p = [0.3, 0.6]; draw() }
  window.addEventListener('resize', draw); draw()
})()

// 7 · IFS
;(() => {
  const keys = Object.keys(IFS_PRESETS)
  const presets = keys.map((k) => ({ label: IFS_PRESETS[k].label, src: 'K', p: ifsParams(IFS_PRESETS[k]), view: IFS_PRESETS[k].view }))
  mountDensity($('d-ifs'), {
    sys: IFS, params: presets[0].p, view: presets[0].view, look: { mode: 1, gamma: 0.9 }, presets,
    controls: [{ i: 25, label: '记忆规则（禁止连续两次用同一个映射）', type: 'check' }],
    lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow'],
  })
})()

addFullscreenAll()
