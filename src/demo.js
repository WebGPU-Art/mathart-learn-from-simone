// 页面上的交互 demo：把 DensityView / LyapMap 挂到一个 .demo 元素上，带控件、预设、平移缩放、动画
import { DensityView, LyapMap } from './density.js'
import { buildControls, showError, onVisible, attachPanZoom, getToolbar, badge } from './gpu.js'
import { PALETTE_OPTIONS } from './palettes.js'

export function fmtCount(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(2) + ' 亿'
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + ' 万'
  return String(Math.round(n))
}

const TEST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test')
export const MODE_OPTIONS = [[0, '调色板（密度）'], [1, '色相（跳跃方向 / 映射编号）'], [2, '双色（映射比例）'], [3, '浅色纸面'], [4, '浮雕打光']]

// o: { sys, params, view, look, controls:[{i,label,min,max,step,digits}], lookControls: true|[...keys], presets:[{label,src,p,view,look}],
//      maxPoints, anim:{label, fn(t, params, api)}, overlay(ctx, v, api), onFrame(api), dpr }
export async function mountDensity(root, o) {
  const canvas = root.querySelector('canvas.gl')
  const ov = root.querySelector('canvas.ov')
  const ui = o.ui || root
  const readout = ui.querySelector('.readout')
  let v
  try {
    v = await DensityView.create(canvas, { ...o.sys, params: o.params || o.sys.params, view: o.view || o.sys.view, threads: TEST ? Math.min(o.threads || 32768, 8192) : o.threads, iters: o.iters }, { look: o.look, dprScale: o.dpr ?? 1, maxSide: o.maxSide })
  } catch (e) {
    showError(canvas, e)
    ov?.remove()
    return null
  }
  const maxPoints = TEST ? 2.5e7 : (o.maxPoints ?? 4e8)
  let visible = false, raf = 0, dirty = true, playing = false, t0 = performance.now()
  const pv = {}
  const api = { v, params: pv, redraw: () => { dirty = true; kick() }, reset: () => { v.reset(); kick() }, setPlaying: (p) => { playing = p; syncPlay(); kick() }, get playing() { return playing } }
  const syncFromV = () => { for (const c of o.controls || []) pv['p' + c.i] = v.params[c.i] }
  syncFromV()
  // ---- 参数控件
  const ctl = ui.querySelector('.ctl:not(.sys):not(.ctl2)')
  let refreshP = () => {}, refreshL = () => {}
  if (ctl && o.controls?.length) {
    refreshP = buildControls(ctl, pv, o.controls.map((c) => ({ ...c, key: 'p' + c.i })), (k) => {
      const i = Number(k.slice(1)); v.params[i] = pv[k]; v.reset(); o.onParam?.(i, api); kick()
    })
  }
  // ---- 外观控件
  const lctl = ui.querySelector('.ctl2') || ctl
  if (lctl && o.lookControls !== false) {
    const keys = Array.isArray(o.lookControls) ? o.lookControls : ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow']
    const all = {
      mode: { key: 'mode', label: '上色', type: 'select', options: o.modeOptions || MODE_OPTIONS },
      palette: { key: 'palette', label: '配色', type: 'select', options: PALETTE_OPTIONS },
      gamma: { key: 'gamma', label: '伽马', min: 0.3, max: 2.5, step: 0.05, digits: 2 },
      lo: { key: 'lo', label: '暗部截断', min: 0, max: 0.6, step: 0.01, digits: 2 },
      exposure: { key: 'exposure', label: '曝光', min: 0.5, max: 2.5, step: 0.05, digits: 2 },
      glow: { key: 'glow', label: '辉光', min: 0, max: 1, step: 0.05, digits: 2 },
      relief: { key: 'relief', label: '浮雕强度', min: 1, max: 20, step: 0.5, digits: 1 },
      unwrap: { key: 'unwrap', label: '极坐标展开', min: 0, max: 1, step: 0.01, digits: 2 },
      linear: { key: 'linear', label: '不取对数（线性）', type: 'check' },
      hueShift: { key: 'hueShift', label: '色相旋转', min: 0, max: 1, step: 0.01, digits: 2 },
    }
    refreshL = buildControls(lctl, v.look, keys.map((k) => all[k]), (k) => {
      if (k === 'mode') { v.look.mode = Number(v.look.mode); v.reset() }
      dirty = true; kick()
    })
  }
  // ---- 预设
  const badgeEl = root.querySelector('.badges')
  const setBadge = (src) => { if (badgeEl) badgeEl.innerHTML = src ? badge(src) : '' }
  const presetHost = ui.querySelector('.presets')
  api.applyPreset = (pr) => {
    if (pr.p) pr.p.forEach((x, i) => { v.params[i] = x })
    if (pr.view) Object.assign(v.view, pr.view)
    if (pr.scale) Object.assign(v.view, { cx: 0, cy: 0, scale: pr.scale })
    if (pr.palette) v.look.palette = pr.palette
    if (pr.look) Object.assign(v.look, pr.look)
    setBadge(pr.src)
    syncFromV(); refreshP(); refreshL()
    v.reset(); o.onPreset?.(pr, api); kick()
  }
  if (presetHost && o.presets?.length) {
    const sel = document.createElement('select')
    o.presets.forEach((p, k) => { const op = document.createElement('option'); op.value = k; op.textContent = p.label; sel.append(op) })
    sel.oninput = () => api.applyPreset(o.presets[Number(sel.value)])
    const lab = document.createElement('label'); lab.append('预设 ', sel); presetHost.append(lab)
    api.selectPreset = (k) => { sel.value = k; api.applyPreset(o.presets[k]) }
  }
  setBadge(o.src || o.presets?.[0]?.src)
  api.refresh = () => { refreshP(); refreshL() }
  // ---- 工具栏：动画、重置视图、保存图片
  const bar = getToolbar(root)
  let syncPlay = () => {}
  if (o.anim) {
    const b = document.createElement('button'); b.type = 'button'
    syncPlay = () => { b.textContent = playing ? '⏸ 停止动画' : '▶ ' + (o.anim.label || '播放动画') }
    b.onclick = () => { playing = !playing; if (!playing) { o.anim.stop?.(api); v.reset() } else t0 = performance.now(); syncPlay(); kick() }
    bar.append(b); syncPlay()
  }
  const home = { ...v.view }
  const hb = document.createElement('button'); hb.type = 'button'; hb.textContent = '⟲ 视图'
  hb.onclick = () => { Object.assign(v.view, api.home || home); v.reset(); kick() }
  bar.append(hb)
  const sb = document.createElement('button'); sb.type = 'button'; sb.textContent = '⤓ PNG'
  sb.onclick = () => { v.step(false); canvas.toBlob((bl) => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'mathart.png'; a.click() }) }
  bar.append(sb)
  api.home = home
  // ---- 交互
  if (o.panZoom !== false) attachPanZoom(canvas, v.view, () => { v.reset(); kick() }, { filter: o.panFilter })
  if (o.onPointer) o.onPointer(canvas, api)
  const kick = () => { if (raf || !visible) return; raf = requestAnimationFrame(frame) }
  api.kick = kick
  window.addEventListener('resize', () => { dirty = true; kick() })
  function frame(now) {
    raf = 0
    if (!visible) return
    let more = false
    if (playing && o.anim) {
      o.anim.fn((now - t0) / 1000, v.params, api)
      syncFromV(); refreshP()
      v.reset(); v.step(); more = true
      if (o.anim.accumulate) for (let k = 1; k < o.anim.accumulate; k++) v.step()
    } else if (v.points < maxPoints) { v.step(); more = true } else if (dirty) { v.step(false) }
    dirty = false
    if (readout) readout.textContent = (o.readout ? o.readout(api) + ' · ' : '') + '已画 ' + fmtCount(v.points) + ' 个点' + (v.points >= maxPoints ? '（已停止累积）' : '')
    if (ov && o.overlay) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = ov.clientWidth, h = ov.clientHeight
      if (ov.width !== Math.round(w * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr) }
      const c = ov.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h)
      o.overlay(c, v, api, w, h)
    }
    o.onFrame?.(api)
    if (more) kick()
  }
  onVisible(root, (vis) => { visible = vis; if (vis) kick() })
  if (o.autoplay && !TEST) { playing = true; syncPlay() }
  return api
}

// 参数平面地图：点击/拖动选参数，回调 onPick(x, y)
export async function mountLyap(root, o) {
  const canvas = root.querySelector('canvas.map')
  const ov = root.querySelector('canvas.mapov')
  let m
  try { m = await LyapMap.create(canvas, o.sys, o.ix, o.iy, o.view, { iters: TEST ? 120 : o.iters, lmax: o.lmax, dprScale: o.dpr ?? 0.75 }) } catch (e) { showError(canvas, e); return null }
  ;(o.params || o.sys.params || []).forEach((x, i) => { m.params[i] = x })
  let visible = false, raf = 0
  const api = { m, pick: [...(o.pick || [o.view.cx, o.view.cy])], redraw: () => kick() }
  const kick = () => { if (raf || !visible) return; raf = requestAnimationFrame(draw) }
  function draw() {
    raf = 0; if (!visible) return
    m.draw()
    if (ov) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = ov.clientWidth, h = ov.clientHeight
      ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr)
      const c = ov.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0)
      const [x, y] = m.toCss(api.pick[0], api.pick[1])
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 8, 0, 7); c.stroke()
      c.strokeStyle = '#0008'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 10, 0, 7); c.stroke()
      if (o.path) { c.strokeStyle = '#ffffffaa'; c.setLineDash([4, 4]); c.beginPath(); o.path.forEach(([a, b], k) => { const [px, py] = m.toCss(a, b); k ? c.lineTo(px, py) : c.moveTo(px, py) }); c.stroke(); c.setLineDash([]) }
      c.font = '12px sans-serif'; c.fillStyle = '#fff'
      c.fillText(`${o.labels?.[0] || 'x'} = ${api.pick[0].toFixed(3)}   ${o.labels?.[1] || 'y'} = ${api.pick[1].toFixed(3)}`, 8, h - 10)
    }
  }
  api.setPick = (a, b, notify = true) => { api.pick = [a, b]; if (notify) o.onPick?.(a, b); kick() }
  // 左键点击 / 拖动 = 选参数；右键或按住 Shift 拖动 = 平移；滚轮缩放
  let down = false
  canvas.addEventListener('pointerdown', (e) => { if (e.shiftKey || e.button === 2) return; down = true; canvas.setPointerCapture(e.pointerId); const [a, b] = m.toWorld(e.clientX, e.clientY); api.setPick(a, b) })
  canvas.addEventListener('pointermove', (e) => { if (!down) return; const [a, b] = m.toWorld(e.clientX, e.clientY); api.setPick(a, b) })
  canvas.addEventListener('pointerup', () => { down = false })
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  attachPanZoom(canvas, m.view, () => kick(), { filter: (e) => e.shiftKey || e.button === 2 })
  window.addEventListener('resize', () => kick())
  onVisible(root, (vis) => { visible = vis; if (vis) kick() })
  return api
}
