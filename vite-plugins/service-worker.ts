import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { build, type Plugin, type ResolvedConfig } from 'vite'

interface ServiceWorkerOptions {
  /** service worker 的源码（相对项目根目录）。 */
  entry: string
  /** 产物里的文件名，网页用 ./sw.js 注册。 */
  fileName?: string
}

/**
 * 打包完网页以后，再单独把 service worker 打成一个不带哈希的 sw.js（放在 dist 根目录），
 * 并把「要预先缓存的文件清单」和「版本号」写进去：
 * - 清单 = dist 里除了 sw.js 以外的所有文件（都是我们自己网站上的静态文件）；
 * - 版本号 = 这些文件内容的哈希，内容一变，用户手机上的旧缓存就会被换掉。
 * 只在 vite build 时运行；开发时（npm run dev）不注册 service worker。
 */
export function serviceWorker({ entry, fileName = 'sw.js' }: ServiceWorkerOptions): Plugin {
  let config: ResolvedConfig | undefined

  return {
    name: 'meishi:service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    // writeBundle 只在网页的文件都成功写进 dist 以后才会调用。
    async writeBundle() {
      if (!config) return
      const outDir = path.resolve(config.root, config.build.outDir)
      const files = (await listFiles(outDir)).filter((file) => file !== fileName && !file.endsWith('.map'))

      const hash = createHash('sha256')
      for (const file of files) {
        hash.update(file)
        hash.update(await readFile(path.join(outDir, file)))
      }
      const version = hash.digest('hex').slice(0, 12)

      await build({
        configFile: false,
        root: config.root,
        mode: config.mode,
        envPrefix: config.envPrefix,
        logLevel: 'warn',
        publicDir: false,
        define: {
          __PRECACHE_MANIFEST__: JSON.stringify(files),
          __SW_VERSION__: JSON.stringify(version),
        },
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          sourcemap: false,
          minify: true,
          lib: {
            entry: path.resolve(config.root, entry),
            formats: ['iife'],
            name: 'meishiServiceWorker',
            fileName: () => fileName,
          },
        },
      })

      config.logger.info(`离线缓存 ${fileName}：版本 ${version}，预先缓存 ${files.length} 个文件`)
    },
  }
}

/** dist 里所有文件的相对路径（用 / 分隔）。 */
async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort()
}
