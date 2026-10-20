// 各系统的参数控件定义（页面和全屏实验室共用）
export const ICON_CONTROLS = [
  { i: 0, label: 'a0', min: -4, max: 5, step: 0.0001, digits: 4 },
  { i: 1, label: 'a1', min: -5, max: 3, step: 0.0001, digits: 4 },
  { i: 2, label: 'a2', min: -3, max: 3, step: 0.0001, digits: 4 },
  { i: 3, label: 'a3', min: -5, max: 2, step: 0.0001, digits: 4 },
  { i: 4, label: 'a4', min: -2, max: 2, step: 0.0001, digits: 4 },
  { i: 5, label: 'a5', min: -0.3, max: 0.3, step: 0.0001, digits: 4 },
  { i: 6, label: 'ω', min: -0.5, max: 0.5, step: 0.001, digits: 3 },
  { i: 7, label: 'n', min: 2, max: 12, step: 1 },
  { i: 8, label: 'p', min: 0, max: 30, step: 1 },
]
export const CLIFFORD_CONTROLS = [
  { i: 0, label: 'a', min: -3, max: 3, step: 0.001 }, { i: 1, label: 'b', min: -3, max: 3, step: 0.001 },
  { i: 2, label: 'c', min: -2, max: 2, step: 0.001 }, { i: 3, label: 'd', min: -2, max: 2, step: 0.001 },
]
export const SINCOS_CONTROLS = [
  { i: 0, label: 'a', min: 0, max: 6.2832, step: 0.001 }, { i: 1, label: 'b', min: 0, max: 6.2832, step: 0.001 },
  { i: 2, label: 'm（z 的次数）', min: 2, max: 5, step: 1 },
]
export const LORENZ_CONTROLS = [
  { i: 0, label: 'σ', min: 1, max: 20, step: 0.1, digits: 1 }, { i: 1, label: 'ρ', min: 1, max: 60, step: 0.1, digits: 1 },
  { i: 2, label: 'β', min: 0.5, max: 5, step: 0.01, digits: 2 }, { i: 3, label: '步长 dt', min: 0.001, max: 0.02, step: 0.001 },
  { i: 4, label: '水平转角', min: -3.14, max: 3.14, step: 0.01, digits: 2 }, { i: 5, label: '俯仰角', min: -1.5, max: 1.5, step: 0.01, digits: 2 },
]
export const CLIFFORD_PRESETS = [
  { label: '经典 Clifford（a=−1.4, b=1.6, c=1, d=0.7）', src: 'K', p: [-1.4, 1.6, 1.0, 0.7, 0], view: { cx: 0, cy: 0, scale: 2.1 } },
  { label: '随机搜索 #1', src: 'N', p: [1.759, -1.797, -1.032, -0.886, 0], view: { cx: 0, cy: 0, scale: 2.1 } },
  { label: '随机搜索 #2', src: 'N', p: [-1.651, 1.575, -1.171, -0.699, 0], view: { cx: 0, cy: 0, scale: 2.1 } },
  { label: '随机搜索 #3', src: 'N', p: [1.357, -1.893, 1.014, -1.187, 0], view: { cx: 0, cy: 0, scale: 2.4 } },
  { label: '随机搜索 #4', src: 'N', p: [1.588, 1.949, 0.686, -1.194, 0], view: { cx: 0, cy: 0, scale: 2.4 } },
  { label: 'de Jong（a=1.4, b=−2.3, c=2.4, d=−2.1）', src: 'K', p: [1.4, -2.3, 2.4, -2.1, 1], view: { cx: 0, cy: 0, scale: 2.2 } },
]
