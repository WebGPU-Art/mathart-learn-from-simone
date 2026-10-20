// 8 段颜色带（从暗到亮）。paper/ink 用于浅色“纸面”模式
export const PALETTES = {
  ice: { name: '冰蓝', stops: ['#05060f', '#071a33', '#0b3a66', '#0a6aa0', '#2a9fd6', '#6fd0f5', '#c8f0ff', '#ffffff'] },
  fire: { name: '火焰', stops: ['#07040a', '#2a0610', '#5e0f1a', '#a3202a', '#d9502a', '#f08a2e', '#ffd27a', '#fffbe8'] },
  magma: { name: '岩浆', stops: ['#000004', '#1d1147', '#51127c', '#822681', '#b73779', '#e75263', '#fc8961', '#fcfdbf'] },
  pink: { name: '玫红', stops: ['#0a0410', '#2a0830', '#4a0e4e', '#7c1866', '#b0277a', '#f06aa0', '#ffbfdc', '#ffffff'] },
  teal: { name: '青铜', stops: ['#061015', '#0b2730', '#13505e', '#1f8796', '#5fc0c8', '#cfeee6', '#f6d39a', '#e27b2c'] },
  bone: { name: '骨白', stops: ['#0d0f14', '#1d222c', '#343c4a', '#566070', '#828c9c', '#b2bac6', '#dde2ea', '#ffffff'] },
  aurora: { name: '极光', stops: ['#03060a', '#062a2a', '#0b5a4a', '#1d9a6a', '#7ed36a', '#e8f07a', '#ffd6f0', '#ffffff'] },
}
export const PALETTE_OPTIONS = Object.entries(PALETTES).map(([k, v]) => [k, v.name])
