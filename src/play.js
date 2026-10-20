import { nav, buildControls } from './gpu.js'
import { mountDensity } from './demo.js'
import { ICON, ICON_PRESETS, CLIFFORD, SINCOS, LORENZ, IFS, IFS_PRESETS, ifsParams, CIFS, CIFS_PRESETS, ROOTS } from './systems.js'
import { ICON_CONTROLS, CLIFFORD_CONTROLS, CLIFFORD_PRESETS, SINCOS_CONTROLS, LORENZ_CONTROLS } from './defs.js'

nav('play.html')
const SYSTEMS = {
  icon: { label: '对称吸引子（扩展 Field–Golubitsky）', sys: ICON, controls: ICON_CONTROLS, presets: ICON_PRESETS.map((p) => ({ ...p, view: { cx: 0, cy: 0, scale: p.scale } })) },
  clifford: { label: 'Clifford / de Jong', sys: CLIFFORD, controls: CLIFFORD_CONTROLS, presets: CLIFFORD_PRESETS },
  sincos: { label: 'sin·cos(zᵐ)', sys: SINCOS, controls: SINCOS_CONTROLS, presets: [[3.614, 4.722], [3.551, 4.495], [0.428, 1.322], [3.664, 5.125], [3.893, 3.853]].map((ab, k) => ({ label: `(a, b) = (${ab[0]}, ${ab[1]})`, src: 'F', p: [...ab, 2], view: { cx: -0.05, cy: 0, scale: 1.1 }, look: { mode: 1 } })) },
  lorenz: { label: '洛伦兹', sys: LORENZ, controls: LORENZ_CONTROLS, presets: [{ label: '经典 σ=10, ρ=28, β=8/3', src: 'K', p: [10, 28, 8 / 3, 0.006, 0.6, 0.15], view: { cx: 0, cy: 0, scale: 30 }, look: { gamma: 2.2, lo: 0.3 } }] },
  ifs: { label: '迭代函数系统', sys: IFS, controls: [{ i: 25, label: '记忆规则', type: 'check' }], presets: Object.values(IFS_PRESETS).map((pr) => ({ label: pr.label, src: 'K', p: ifsParams(pr), view: pr.view, look: { mode: 1 } })) },
  cifs: { label: '两个复数映射（火焰 / 线团）', sys: CIFS, controls: [{ i: 20, label: '折回', type: 'select', options: [[0, '无（飞出就重启）'], [1, '正弦折叠'], [2, '反演'], [3, 'z/(1+|z|)']] }, ...[0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => ({ i, label: `映射${i < 10 ? 1 : 2} ${'ABCD'[Math.floor((i % 10) / 2)]} ${i % 2 ? '虚' : '实'}`, min: -3, max: 3, step: 0.001 }))], presets: Object.values(CIFS_PRESETS).map((pr) => ({ label: pr.label, src: 'N', p: pr.p, view: pr.view, look: { mode: 2 } })) },
  roots: { label: '多项式的根', sys: ROOTS, threads: 8192, iters: 2, controls: [{ i: 0, label: '模式', type: 'select', options: [[0, 'Conradi 环面多项式'], [1, 'Littlewood ±1'], [2, '波希米亚矩阵']] }, { i: 1, label: '相位 φ', min: 0, max: 6.2832, step: 0.001 }, { i: 2, label: 'Littlewood 次数', min: 4, max: 24, step: 1 }, { i: 3, label: '矩阵 n', min: 2, max: 6, step: 1 }, { i: 4, label: '矩阵元素', type: 'select', options: [[0, '{−1,0,1}'], [1, '{0,1}'], [2, '{−1,1}']] }],
    presets: [{ label: 'Conradi 的 16 次环面多项式', src: 'C', p: [0, 0, 18, 5, 0], view: { cx: 0, cy: 0, scale: 1.4 }, look: { mode: 1, lo: 0 } }, { label: 'Littlewood 18 次', src: 'K', p: [1, 0, 18, 5, 0], view: { cx: 0, cy: 0, scale: 1.55 }, look: { mode: 0, lo: 0, palette: 'magma' } }, { label: '波希米亚 5×5 {−1,0,1}', src: 'K', p: [2, 0, 18, 5, 0], view: { cx: 0, cy: 0, scale: 4.6 }, look: { mode: 0, lo: 0, palette: 'magma' } }] },
}

const stage = document.getElementById('stage'), panel = document.querySelector('.panel')
const sel = { s: new URLSearchParams(location.search).get('s') || 'icon' }
buildControls(panel.querySelector('.ctl.sys'), sel, [{ key: 's', label: '系统', type: 'select', options: Object.entries(SYSTEMS).map(([k, v]) => [k, v.label]) }], () => {
  const u = new URL(location.href); u.searchParams.set('s', sel.s); location.href = u.toString()
})
const S = SYSTEMS[sel.s] || SYSTEMS.icon
const pr0 = S.presets[0]
const api = await mountDensity(stage, {
  sys: S.sys, params: pr0.p, view: pr0.view, look: { ...(pr0.look || {}), palette: pr0.palette || pr0.look?.palette || 'ice' }, src: pr0.src,
  threads: S.threads, iters: S.iters, maxPoints: 1.5e9, ui: panel,
  controls: S.controls, presets: S.presets,
  lookControls: ['mode', 'palette', 'gamma', 'lo', 'exposure', 'glow', 'relief', 'unwrap', 'hueShift', 'linear'],
})
