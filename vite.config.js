import { defineConfig } from 'vite'
import { resolve } from 'path'

// 页面：总览、三集对应的讲解页、全屏实验室
const pages = ['index', 'roots', 'iterate', 'variations', 'play']

export default defineConfig({
  // CI 里设置 VITE_BASE_URL=https://cos-sh.tiye.me/<owner>/<repo>/ ，让 js/css 走 CDN；本地开发时为 "/"。
  // 页面之间的链接全部是相对路径，所以也能部署在服务器子目录下。
  base: process.env.VITE_BASE_URL || '/',
  server: { port: Number(process.env.PORT) || 5173 },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(__dirname, `${p}.html`)])),
    },
  },
})
