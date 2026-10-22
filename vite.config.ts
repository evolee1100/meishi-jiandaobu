import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { serviceWorker } from './vite-plugins/service-worker.ts'

export default defineConfig({
  // 网页会放在 GitHub Pages 的子路径（https://<用户名>.github.io/<仓库名>/），
  // 所以所有文件都用相对路径，不管仓库叫什么名字都能打开。
  base: './',

  // 只有这个前缀的环境变量才会被写进网页。故意不用默认的 VITE_，
  // 免得有人在 .env 里放了 VITE_GOOGLE_KEY 之类的东西，被打包进去公开出去。
  // 用户的 Google 密钥只能存在用户自己浏览器的 localStorage 里。
  envPrefix: 'MEISHI_PUBLIC_',

  plugins: [react(), serviceWorker({ entry: 'src/sw/sw.ts' })],

  build: {
    outDir: 'dist',
    // 不生成 source map：发布出去的东西越少越好，也不会泄露源码路径。
    sourcemap: false,
  },

  // 端口固定（strictPort：被占用就报错，不会自己换到别的端口）。
  // 4173 是这台电脑上另一个项目在用的，绝对不要用、也不要去关它；预览用 5180–5189。
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5180,
    strictPort: true,
  },

  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
        },
      },
    ],
  },
})
