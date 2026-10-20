// WebGPU 通用封装：设备、画布尺寸、可见性、控件、工具栏、全屏
let devicePromise
export function getDevice() {
  if (!devicePromise) {
    devicePromise = (async () => {
      if (!navigator.gpu) throw new Error('当前浏览器不支持 WebGPU（请使用较新的 Chrome / Edge / Safari）')
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
      if (!adapter) throw new Error('没有可用的 WebGPU 适配器')
      const lim = adapter.limits
      return adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: Math.min(lim.maxStorageBufferBindingSize, 256 * 1024 * 1024),
          maxBufferSize: Math.min(lim.maxBufferSize, 256 * 1024 * 1024),
        },
      })
    })()
  }
  return devicePromise
}

export function showError(el, e) {
  console.error(e)
  const d = document.createElement('div')
  d.className = 'err'
  d.textContent = String(e.message || e)
  el.replaceWith(d)
}

export function fitCanvas(canvas, dprScale = 1, maxSide = 2048) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * dprScale
  let w = Math.max(2, Math.round(canvas.clientWidth * dpr))
  let h = Math.max(2, Math.round(canvas.clientHeight * dpr))
  const k = Math.min(1, maxSide / Math.max(w, h))
  w = Math.round(w * k); h = Math.round(h * k)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
    return true
  }
  return false
}

export function compile(device, code, label) {
  const module = device.createShaderModule({ code, label })
  module.getCompilationInfo?.().then((info) => {
    for (const m of info.messages) if (m.type === 'error') console.error('WGSL', label, m.lineNum, m.message)
  })
  return module
}

export const FULLSCREEN_VS = /* wgsl */ `
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(q[i], 0.0, 1.0);
}
`

// 一个全屏三角形 + 一个 uniform buffer 的最小渲染器（用于参数地图、复平面着色等“每个像素算一遍”的画面）
export class FullscreenPass {
  constructor(device, canvas, code, floats) {
    this.device = device
    this.canvas = canvas
    this.ctx = canvas.getContext('webgpu')
    this.format = navigator.gpu.getPreferredCanvasFormat()
    this.ctx.configure({ device, format: this.format, alphaMode: 'opaque' })
    this.u = new Float32Array(floats)
    this.buf = device.createBuffer({ size: Math.ceil(floats / 4) * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const module = compile(device, FULLSCREEN_VS + code, 'fullscreen')
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    })
    this.bind = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.buf } }],
    })
  }
  draw() {
    this.device.queue.writeBuffer(this.buf, 0, this.u)
    const enc = this.device.createCommandEncoder()
    const pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
    })
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bind)
    pass.draw(3)
    pass.end()
    this.device.queue.submit([enc.finish()])
  }
}

// 只在元素出现在视口里时才逐帧渲染，省 GPU
export function onVisible(el, cb) {
  const io = new IntersectionObserver((es) => { for (const e of es) cb(e.isIntersecting) }, { rootMargin: '120px' })
  io.observe(el)
}

// 声明式控件：{ key, label, type: 'range'|'check'|'select'|'button', min, max, step, options, digits, onClick }
export function buildControls(host, params, defs, onChange) {
  const refresh = []
  for (const d of defs) {
    if (d.type === 'sep') { const s = document.createElement('div'); s.className = 'sep'; s.textContent = d.label || ''; host.append(s); continue }
    if (d.type === 'button') {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = d.label
      b.onclick = () => d.onClick(b); host.append(b); continue
    }
    const lab = document.createElement('label')
    if (d.type === 'check') {
      const inp = document.createElement('input')
      inp.type = 'checkbox'
      inp.checked = !!params[d.key]
      inp.oninput = () => { params[d.key] = inp.checked ? 1 : 0; onChange(d.key) }
      lab.append(inp, document.createTextNode(d.label))
      refresh.push(() => { inp.checked = !!params[d.key] })
    } else if (d.type === 'select') {
      const sel = document.createElement('select')
      for (const [v, t] of d.options) {
        const o = document.createElement('option')
        o.value = v
        o.textContent = t
        sel.append(o)
      }
      sel.value = params[d.key]
      sel.oninput = () => { params[d.key] = isNaN(Number(sel.value)) ? sel.value : Number(sel.value); onChange(d.key) }
      lab.append(document.createTextNode(d.label), sel)
      refresh.push(() => { sel.value = params[d.key] })
    } else {
      const inp = document.createElement('input')
      inp.type = 'range'
      inp.min = d.min
      inp.max = d.max
      inp.step = d.step ?? 0.01
      inp.value = params[d.key]
      const out = document.createElement('output')
      const fmt = () => { out.textContent = Number(params[d.key]).toFixed(d.digits ?? (Number(inp.step) >= 1 ? 0 : 3)) }
      fmt()
      inp.oninput = () => { params[d.key] = Number(inp.value); fmt(); onChange(d.key) }
      lab.append(document.createTextNode(d.label), inp, out)
      refresh.push(() => { inp.value = params[d.key]; fmt() })
    }
    host.append(lab)
  }
  return () => refresh.forEach((f) => f())
}

const PAGES = [['index.html', '总览'], ['roots.html', '①方程的根'], ['iterate.html', '②迭代'], ['variations.html', '③番外：变奏'], ['play.html', '全屏实验室']]
export function nav(active) {
  const el = document.createElement('nav')
  el.className = 'top'
  el.innerHTML = '<b>数学图案 · 跟 Simone 学</b>' + PAGES.map(([h, t]) => `<a href="./${h}" class="${h === active ? 'on' : ''}">${t}</a>`).join('') +
    '<span class="sp"></span><a href="https://github.com/WebGPU-Art/mathart-learn-from-simon" target="_blank" rel="noopener">GitHub</a>'
  document.body.prepend(el)
}

// 每个 demo 右上角的小工具栏
export function getToolbar(root) {
  const host = root.querySelector('.stack.main') || root.querySelector('.stack') || root.querySelector('canvas')?.parentElement || root
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
  let bar = host.querySelector(':scope > .tools')
  if (!bar) {
    bar = document.createElement('div')
    bar.className = 'tools'
    host.append(bar)
  }
  return bar
}

export function addFullscreen(root) {
  const req = root.requestFullscreen || root.webkitRequestFullscreen
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'fsbtn'
  const cur = () => document.fullscreenElement || document.webkitFullscreenElement
  const isFull = () => cur() === root || root.classList.contains('fs-fake')
  const sync = () => { btn.textContent = isFull() ? '✕ 退出全屏' : '⛶ 全屏' }
  const notify = () => { sync(); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))) }
  const fake = (on) => {
    root.classList.toggle('fs-fake', on)
    document.documentElement.classList.toggle('fs-lock', document.querySelector('.fs-fake') !== null)
    notify()
  }
  btn.onclick = async () => {
    if (root.classList.contains('fs-fake')) return fake(false)
    if (cur() === root) return (document.exitFullscreen || document.webkitExitFullscreen).call(document)
    try {
      if (!req) throw new Error('unsupported')
      await req.call(root)
    } catch {
      fake(true)
    }
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('fs-fake')) fake(false) })
  document.addEventListener('fullscreenchange', notify)
  document.addEventListener('webkitfullscreenchange', notify)
  sync()
  getToolbar(root).append(btn)
}
export function addFullscreenAll(selector = '.demo') {
  document.querySelectorAll(selector).forEach((el) => { if (el.querySelector('canvas')) addFullscreen(el) })
}

// 来源角标：C = 参数来自 Conradi，F = 公式来自 Conradi，N = 本项目探索
export function badge(kind) {
  const t = { C: ['Conradi 参数', 'c'], F: ['公式来自 Conradi', 'f'], N: ['本项目探索', 'n'], K: ['经典', 'k'] }[kind]
  return `<span class="badge ${t[1]}">${t[0]}</span>`
}

// 简单的 2D canvas 助手
export function ctx2d(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr)
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
  const c = canvas.getContext('2d')
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  return [c, canvas.clientWidth, canvas.clientHeight]
}

// 等比例的复平面视图：center + 半高 scale，支持拖动/滚轮
export function attachPanZoom(canvas, view, onChange, opts = {}) {
  let drag = null
  canvas.addEventListener('pointerdown', (e) => {
    if (opts.filter && !opts.filter(e)) return
    drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy }
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return
    const r = canvas.getBoundingClientRect()
    const k = (2 * view.scale) / r.height
    view.cx = drag.cx - (e.clientX - drag.x) * k
    view.cy = drag.cy + (e.clientY - drag.y) * k
    onChange()
  })
  const end = () => { drag = null }
  canvas.addEventListener('pointerup', end)
  canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const r = canvas.getBoundingClientRect()
    const asp = r.width / r.height
    const qx = (e.clientX - r.left) / r.width * 2 - 1, qy = 1 - (e.clientY - r.top) / r.height * 2
    const wx = view.cx + qx * asp * view.scale, wy = view.cy + qy * view.scale
    const f = Math.exp(e.deltaY * 0.0015)
    view.scale *= f
    view.cx = wx - qx * asp * view.scale
    view.cy = wy - qy * view.scale
    onChange()
  }, { passive: false })
}
