import { nav, addFullscreenAll } from './gpu.js'
import { mountDensity } from './demo.js'
import { ICON, ICON_PRESETS } from './systems.js'

nav('index.html')
const C2 = ICON_PRESETS.find((p) => p.id === 'C2')
mountDensity(document.getElementById('hero'), {
  sys: ICON, params: C2.p, view: { cx: 0, cy: 0, scale: 0.82 }, look: { palette: 'fire', glow: 0.35 }, src: 'C', iters: 96,
  lookControls: false,
  anim: { label: '动画', fn: (t, p) => { p[6] = 0.12 * Math.sin(t * 0.25) }, accumulate: 2 },
  autoplay: true,
})
addFullscreenAll()
