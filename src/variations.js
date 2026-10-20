import { nav, addFullscreenAll, badge, ctx2d } from './gpu.js'
import { mountDensity, mountLyap } from './demo.js'
import { ICON, ICON_PRESETS, SINCOS, ROOTS, CIFS, CIFS_PRESETS } from './systems.js'
import { ICON_CONTROLS, SINCOS_CONTROLS } from './defs.js'

nav('variations.html')
const $ = (id) => document.getElementById(id)
const C1 = ICON_PRESETS.find((p) => p.id === 'C1'), C2 = ICON_PRESETS.find((p) => p.id === 'C2'), C3 = ICON_PRESETS.find((p) => p.id === 'C3')
const ctlOf = (...ids) => ICON_CONTROLS.filter((c) => ids.includes(c.i))
const tw = (t, T) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / T) // 0→1→0 的往返

// 1 · 扩展公式
mountDensity($('d-ext'), {
  sys: ICON, params: C1.p, view: { cx: 0, cy: 0, scale: C1.scale }, look: { palette: 'pink' },
  controls: ICON_CONTROLS, presets: ICON_PRESETS,
})

// 2 · 一步迭代（纯 JS + Canvas 2D，展示真实数值）
;(() => {
  const root = $('d-step'), cv = root.querySelector('canvas'), pre = root.querySelector('pre')
  const [a0, a1, a2, a3, a4] = C2.p
  const n = 5
  let z = [0.3, 0.2], pts = [], last = null
  const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
  const pw = (a, k) => { let r = [1, 0]; for (let i = 0; i < k; i++) r = cm(r, a); return r }
  const f = (v) => v.toFixed(3)
  function step(record) {
    const r2 = z[0] ** 2 + z[1] ** 2, r = Math.sqrt(r2), th = Math.atan2(z[1], z[0])
    const zn = pw(z, n)
    const s = a0 + a1 * r2 + a2 * zn[0] + a3 * r * Math.cos(n * 0 * th)
    const sz = [s * z[0], s * z[1]]
    const cj = pw([z[0], -z[1]], n - 1), t4 = [a4 * cj[0], a4 * cj[1]]
    const nz = [sz[0] + t4[0], sz[1] + t4[1]]
    if (record) last = { z: [...z], r2, th, zn, s, sz, t4, nz }
    z = nz; pts.push(nz)
  }
  function draw() {
    const [c, w, h] = ctx2d(cv)
    c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h)
    const S = w / 1.7, X = (x) => w / 2 + x * S, Y = (y) => h / 2 - y * S
    c.strokeStyle = '#1d2a33'; c.lineWidth = 1
    for (let g = -0.8; g <= 0.81; g += 0.1) { c.beginPath(); c.moveTo(X(g), Y(-0.85)); c.lineTo(X(g), Y(0.85)); c.stroke(); c.beginPath(); c.moveTo(X(-0.85), Y(g)); c.lineTo(X(0.85), Y(g)); c.stroke() }
    c.strokeStyle = '#3a4a55'; c.beginPath(); c.moveTo(X(-0.85), Y(0)); c.lineTo(X(0.85), Y(0)); c.moveTo(X(0), Y(-0.85)); c.lineTo(X(0), Y(0.85)); c.stroke()
    const N = pts.length
    c.fillStyle = N > 500 ? '#ffb34766' : '#ffb347cc'
    for (const p of pts) c.fillRect(X(p[0]) - (N > 500 ? 0.7 : 1.5), Y(p[1]) - (N > 500 ? 0.7 : 1.5), N > 500 ? 1.4 : 3, N > 500 ? 1.4 : 3)
    if (last && N < 60) {
      const arr = (a, b, col, lab) => {
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(X(a[0]), Y(a[1])); c.lineTo(X(b[0]), Y(b[1])); c.stroke()
        const ang = Math.atan2(Y(b[1]) - Y(a[1]), X(b[0]) - X(a[0])); c.beginPath(); c.moveTo(X(b[0]), Y(b[1]))
        c.lineTo(X(b[0]) - 10 * Math.cos(ang - 0.4), Y(b[1]) - 10 * Math.sin(ang - 0.4)); c.lineTo(X(b[0]) - 10 * Math.cos(ang + 0.4), Y(b[1]) - 10 * Math.sin(ang + 0.4)); c.fill()
        c.font = '13px sans-serif'; c.fillText(lab, X(b[0]) + 6, Y(b[1]) - 6)
      }
      arr([0, 0], last.z, '#ffffff', 'z')
      arr(last.z, last.sz, '#ffb347', 's·z')
      arr(last.sz, last.nz, '#ff6fae', '+ a4·z̄⁴')
      c.fillStyle = '#7ee787'; c.beginPath(); c.arc(X(last.nz[0]), Y(last.nz[1]), 6, 0, 7); c.fill()
      // 所在格子 +1
      const gx = Math.floor(last.nz[0] / 0.1) * 0.1, gy = Math.floor(last.nz[1] / 0.1) * 0.1
      c.strokeStyle = '#7ee787'; c.lineWidth = 2; c.strokeRect(X(gx), Y(gy + 0.1), 0.1 * S, 0.1 * S)
    }
    c.fillStyle = '#cfd6d0'; c.font = '13px sans-serif'; c.fillText(`已走 ${N} 步`, 10, 20)
    if (last && N < 60) {
      const L = last
      pre.textContent =
`第 ${N} 步，参数 C2（Conradi）：a0=${a0} a1=${a1} a2=${a2} a3=${a3} a4=${a4}, n=5, p=0
① 长度与角度   z = ${f(L.z[0])} + ${f(L.z[1])}i
                |z|² = ${f(L.r2)}    θ = ${(L.th * 180 / Math.PI).toFixed(1)}°
② 括号里的数   s = a0 + a1|z|² + a2·Re(z⁵) + a3|z|·cos(0)
                  = ${a0} ${a1 * L.r2 >= 0 ? '+' : '−'} ${f(Math.abs(a1 * L.r2))} ${a2 * L.zn[0] >= 0 ? '+' : '−'} ${f(Math.abs(a2 * L.zn[0]))} ${a3 * Math.sqrt(L.r2) >= 0 ? '+' : '−'} ${f(Math.abs(a3 * Math.sqrt(L.r2)))}
                  = ${f(L.s)}
③ 乘以 z      s·z = ${f(L.sz[0])} + ${f(L.sz[1])}i
               （s 是实数：只缩放 ×${f(L.s)}，不旋转；加了 ω 才会转）
④ 加共轭项    a4·z̄⁴ = ${f(L.t4[0])} + ${f(L.t4[1])}i
                新 z = ${f(L.nz[0])} + ${f(L.nz[1])}i  → 这个格子 +1，从新点出发重复`
    } else if (N >= 60) pre.textContent = `已走 ${N} 步。几十步时看不出规律；几千步开始有轮廓；上百万步后，五重对称的形状才清楚浮现——这就是为什么要交给 GPU。`
    else pre.textContent = '按“下一步”开始。'
  }
  root.querySelector('.one').onclick = () => { step(true); draw() }
  root.querySelector('.ten').onclick = () => { for (let k = 0; k < 10; k++) step(k === 9); draw() }
  root.querySelector('.many').onclick = () => { for (let k = 0; k < 2000; k++) step(false); last = null; draw() }
  root.querySelector('.rst').onclick = () => { z = [0.3, 0.2]; pts = []; last = null; draw() }
  window.addEventListener('resize', draw)
  draw()
})()

// 3 · 花边项
mountDensity($('d-ripple'), {
  sys: ICON, params: C3.p, view: { cx: 0, cy: 0, scale: 1.0 }, look: { palette: 'ice' }, src: 'C',
  controls: ctlOf(7, 8), lookControls: ['palette', 'gamma', 'glow'],
  onFrame(api) { const b = api.v.params[7] === 5 && api.v.params[8] === 23; $('d-ripple').querySelector('.badges').innerHTML = badge(b ? 'C' : 'N') },
  overlay(c, v) {
    const n = v.params[7], p = v.params[8], cx = 70, cy = 70, R = 42
    c.fillStyle = '#05070acc'; c.fillRect(8, 8, 124, 136)
    c.strokeStyle = '#ffb347'; c.lineWidth = 1.6; c.beginPath()
    for (let k = 0; k <= 720; k++) { const th = (k / 720) * 2 * Math.PI, r = R * (1 + 0.16 * Math.cos(n * p * th)); const x = cx + r * Math.cos(th), y = cy - r * Math.sin(th); k ? c.lineTo(x, y) : c.moveTo(x, y) }
    c.stroke(); c.fillStyle = '#eee'; c.font = '12px sans-serif'; c.fillText(`cos(np·θ)，n·p = ${n * p}`, 14, 136)
  },
})

// 4 · a5
mountDensity($('d-a5'), {
  sys: ICON, params: C1.p, view: { cx: 0, cy: 0, scale: 0.9 }, look: { palette: 'pink' }, src: 'C',
  controls: [{ i: 5, label: 'a5', min: -0.2, max: 0, step: 0.0001, digits: 4 }], lookControls: ['palette', 'gamma', 'glow'],
  onFrame(api) { const a5 = api.v.params[5]; $('d-a5').querySelector('.badges').innerHTML = badge(Math.abs(a5 + 0.1062) < 1e-6 ? 'C' : 'N') },
  readout: (api) => { const a5 = api.v.params[5]; return `a5 = ${a5.toFixed(4)}` + (a5 > -0.1045 ? '（塌缩到原点：画面几乎是空的）' : a5 < -0.158 ? '（窗口之外）' : '') },
  anim: { label: '扫描 a5：−0.104 → −0.158', fn: (t, p) => { p[5] = -0.104 - 0.054 * tw(t, 10) }, stop: (api) => { api.v.params[5] = -0.1062 } },
  iters: 64,
})

// 5 · 悬崖边：参数地图 + 视图
;(async () => {
  const root = $('d-edge')
  let map = null
  const dv = await mountDensity(root, {
    sys: ICON, params: C3.p, view: { cx: 0, cy: 0, scale: 1.0 }, look: { palette: 'ice' }, src: 'C',
    controls: [{ i: 0, label: 'a0', min: 2.2, max: 2.9, step: 0.0001, digits: 4 }, { i: 1, label: 'a1', min: -4.5, max: -3.3, step: 0.0001, digits: 4 }],
    lookControls: ['palette', 'gamma'],
    onFrame(api) {
      const p = api.v.params; root.querySelector('.badges').innerHTML = badge(Math.abs(p[0] - 2.7369) < 1e-6 && Math.abs(p[1] + 3.9062) < 1e-6 ? 'C' : 'N')
      map?.setPick(p[0], p[1], false)
    },
    readout: (api) => `a0 = ${api.v.params[0].toFixed(4)}`,
    anim: { label: '扫描 a0：2.30 → 2.738', fn: (t, p) => { p[0] = 2.30 + 0.438 * tw(t, 16); p[1] = -3.9062 }, stop: (api) => { api.v.params[0] = 2.7369 } },
    iters: 64,
  })
  map = await mountLyap(root, {
    sys: ICON, ix: 0, iy: 1, params: C3.p, view: { cx: 2.55, cy: -3.9, scale: 0.6 }, pick: [2.7369, -3.9062], iters: 260, lmax: 1.2, labels: ['a0', 'a1'],
    onPick: (a, b) => { if (!dv) return; dv.v.params[0] = a; dv.v.params[1] = b; dv.setPlaying(false); dv.v.reset(); dv.kick() },
  })
})()

// 6 · ω 打破镜像
mountDensity($('d-chiral'), {
  sys: ICON, params: C2.p, view: { cx: 0, cy: 0, scale: 0.85 }, look: { palette: 'fire' },
  controls: ctlOf(6), lookControls: ['palette', 'gamma', 'glow'],
  onFrame(api) { $('d-chiral').querySelector('.badges').innerHTML = badge(api.v.params[6] === 0 ? 'C' : 'N') },
  overlay(c, v) {
    const w = v.params[6], a = Math.max(0, 1 - Math.abs(w) / 0.04), n = v.params[7]
    if (a <= 0) return
    c.strokeStyle = `rgba(255,255,255,${0.55 * a})`; c.setLineDash([6, 6]); c.lineWidth = 1.2
    for (let k = 0; k < n; k++) { const th = (k * Math.PI) / n, R = 0.82; const [x1, y1] = v.toCss(-R * Math.cos(th), -R * Math.sin(th)), [x2, y2] = v.toCss(R * Math.cos(th), R * Math.sin(th)); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke() }
    c.setLineDash([])
  },
  readout: (api) => (Math.abs(api.v.params[6]) < 1e-6 ? '对称群 D₅（旋转 + 镜面）' : '对称群 Z₅（只剩旋转）') + `，ω = ${api.v.params[6].toFixed(3)}`,
  anim: { label: 'ω：0 → 0.22', fn: (t, p) => { p[6] = 0.22 * tw(t, 12) }, stop: (api) => { api.v.params[6] = 0 } },
  iters: 64,
})

// 7 · 三重到十二重
mountDensity($('d-orders'), {
  sys: ICON, params: ICON_PRESETS[3].p, view: { cx: 0, cy: 0, scale: ICON_PRESETS[3].scale }, look: { mode: 1 },
  controls: ICON_CONTROLS, presets: ICON_PRESETS.slice(3).concat(ICON_PRESETS.slice(0, 3)),
})

// 8 · 上色
;(async () => {
  const root = $('d-colour')
  const api = await mountDensity(root, {
    sys: ICON, params: C3.p, view: { cx: 0, cy: 0, scale: 1.0 }, look: { palette: 'ice' }, src: 'C',
    lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow', 'relief', 'unwrap'],
    onFrame(a) {
      if (tween) { const u = Math.min(1, (performance.now() - tween.t0) / 1500); a.v.look.unwrap = tween.from + (tween.to - tween.from) * (u * u * (3 - 2 * u)); if (u >= 1) tween = null; a.redraw() }
    },
  })
  let tween = null
  if (!api) return
  const L = api.v.look
  root.querySelectorAll('button[data-k]').forEach((b) => {
    b.onclick = () => {
      const k = b.dataset.k
      const wasColour = L.mode === 1 || L.mode === 2
      if (k === 'dir') Object.assign(L, { mode: 1 })
      if (k === 'relief') Object.assign(L, { mode: 4, palette: 'ice', relief: 8 })
      if (k === 'ink') Object.assign(L, { mode: 3, palette: 'bone' })
      if (k === 'plain') Object.assign(L, { mode: 0, palette: 'ice' })
      if (k === 'unwrap') tween = { t0: performance.now(), from: L.unwrap, to: L.unwrap > 0.5 ? 0 : 1 }
      if (k === 'plain') tween = { t0: performance.now(), from: L.unwrap, to: 0 }
      if ((L.mode === 1 || L.mode === 2) !== wasColour) api.v.reset()
      api.redraw()
      api.refresh()
    }
  })
})()

// 9 · sin·cos(z²) + 参数地图
;(async () => {
  const root = $('d-sincos')
  const P0 = [3.614, 4.722, 2]
  let center = [P0[0], P0[1]]
  let map = null
  const dv = await mountDensity(root, {
    sys: SINCOS, params: P0, view: { cx: -0.05, cy: 0, scale: 1.1 }, look: { mode: 1 }, src: 'F',
    controls: SINCOS_CONTROLS, lookControls: ['mode', 'palette', 'gamma', 'glow'],
    onParam: (i, api) => { if (!map) return; if (i === 2) { map.m.params[2] = api.v.params[2]; map.redraw() } map.setPick(api.v.params[0], api.v.params[1], false) },
    onFrame: (api) => { if (api.playing) map?.setPick(api.v.params[0], api.v.params[1], false) },
    anim: { label: '沿小圆圈走一圈', fn: (t, p) => { p[0] = center[0] + 0.24 * Math.cos(t * 0.6); p[1] = center[1] + 0.2 * Math.sin(t * 0.6) } },
    iters: 64,
  })
  map = await mountLyap(root, {
    sys: SINCOS, ix: 0, iy: 1, params: P0, view: { cx: Math.PI, cy: Math.PI, scale: Math.PI }, pick: [P0[0], P0[1]], iters: 300, lmax: 0.8, labels: ['a', 'b'],
    onPick: (a, b) => { if (!dv) return; center = [a, b]; dv.v.params[0] = a; dv.v.params[1] = b; dv.setPlaying(false); dv.v.reset(); dv.kick() },
  })
})()

// 10 · 环面上的多项式根云
mountDensity($('d-torus'), {
  sys: ROOTS, params: [0, 0], view: { cx: 0, cy: 0, scale: 1.4 }, look: { mode: 1, gamma: 0.9, lo: 0.0 }, src: 'C', threads: 8192, iters: 2,
  controls: [{ i: 1, label: '常数项相位 φ（本项目加的旋钮）', min: 0, max: 6.2832, step: 0.001 }],
  lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow'], modeOptions: [[0, '调色板（密度）'], [1, '色相 = t₁ 的角度']],
  anim: { label: '转动常数项相位 φ', fn: (t, p) => { p[1] = (t * 0.35) % (2 * Math.PI) }, accumulate: 3 },
  maxPoints: 3e8,
})

// 11 · 两个复数映射
;(() => {
  const keys = Object.keys(CIFS_PRESETS)
  let base = null
  mountDensity($('d-flame'), {
    sys: CIFS, params: CIFS_PRESETS[keys[0]].p, view: CIFS_PRESETS[keys[0]].view, look: { mode: 2, gamma: 0.9 },
    presets: keys.map((k) => ({ label: CIFS_PRESETS[k].label, src: 'N', p: CIFS_PRESETS[k].p, view: CIFS_PRESETS[k].view })),
    onPreset: (pr) => { base = [...pr.p] },
    controls: [
      { i: 20, label: '折回', type: 'select', options: [[0, '无（飞出就重启）'], [1, '正弦折叠'], [2, '反演'], [3, 'z/(1+|z|)']] },
      { i: 0, label: '映射1 A 实部', min: -3, max: 3, step: 0.001 }, { i: 1, label: '映射1 A 虚部', min: -3, max: 3, step: 0.001 },
      { i: 14, label: '映射2 C 实部', min: -2, max: 2, step: 0.001 }, { i: 15, label: '映射2 C 虚部', min: -2, max: 2, step: 0.001 },
    ],
    lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow'],
    anim: {
      label: '让系数“呼吸”',
      fn: (t, p) => {
        base ||= [...CIFS_PRESETS[keys[0]].p]
        const a = 0.35 * Math.sin(t * 0.7), b = 0.5 * Math.sin(t * 0.7 + 1)
        p[0] = base[0] * Math.cos(a) - base[1] * Math.sin(a); p[1] = base[0] * Math.sin(a) + base[1] * Math.cos(a)
        p[14] = base[14] * Math.cos(b) - base[15] * Math.sin(b); p[15] = base[14] * Math.sin(b) + base[15] * Math.cos(b)
      },
      stop: (api) => { if (base) base.forEach((x, i) => { api.v.params[i] = x }) },
      accumulate: 2,
    },
  })
})()

addFullscreenAll()
