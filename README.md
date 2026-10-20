# 数学图案 · 跟 Simone 学

三集视频《数学图案是怎么画出来的》（上集《方程的根会跳舞》、下集《一个规则反复套用》、番外《对称吸引子的变奏》）里用到的所有技巧的 WebGPU 交互版。灵感来自 [Simone Conradi](https://x.com/S_Conradi) 公开发布的数学可视化作品；所有画面都是按同样的数学重新计算、重新渲染的，不是他的原图。

- `index.html`：总览
- `roots.html`：① 复数乘法、根的轨迹、Littlewood 根云、复平面着色与辐角原理、2×2 特征值、波希米亚矩阵
- `iterate.html`：② 蛛网图与分岔、点密度的四步渲染、Clifford 吸引子与参数地图、对称从哪里来、洛伦兹、混沌游戏、IFS
- `variations.html`：③ Conradi 扩展对称吸引子（花边项、a5/z̄）、悬崖边的参数、ω 打破镜像、三到十二重、方向上色/浮雕/纸面/饰带、sin·cos(z²) 参数地图、环面根云、两个复数映射
- `play.html`：全屏实验室，所有系统和上色方式

每个画面左下角有来源角标：粉色 = 参数读自 Conradi 公开图片上的标注；橙色 = 公式来自他、参数本项目自己找；蓝色 = 本项目探索；灰色 = 文献中的经典例子。

## 代码结构

- `src/density.js`：通用点密度渲染器。compute shader 里几万条轨道并行迭代，`atomicAdd` 计数并累加跳跃方向；片元着色器取对数、截断、伽马、调色板，支持色相 / 双色 / 纸面 / 浮雕 / 辉光 / 极坐标展开。另有 `LyapMap`：每个像素一组参数的李雅普诺夫地图。
- `src/systems.js`：各系统的 WGSL 片段（扩展对称吸引子、Clifford/de Jong、sin·cos(zᵐ)、洛伦兹 RK4、仿射 IFS、两个复数映射、多项式根云：Aberth 法 + Faddeev–LeVerrier）。
- `src/demo.js`：把渲染器挂到页面上的交互 demo（控件、预设、平移缩放、动画、导出 PNG）。
- `src/roots.js`、`src/iterate.js`、`src/variations.js`、`src/play.js`：各页面。

需要支持 WebGPU 的浏览器（新版 Chrome / Edge / Safari）。

```bash
yarn
yarn dev
```

推送到 `main` 后由 `.github/workflows/upload.yaml` 构建并上传（静态资源走 COS CDN，页面 rsync 到服务器）。
