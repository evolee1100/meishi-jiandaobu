import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BUDGET_KB, firstScreenSize } from './lib/first-screen.ts'
import { scanForKeys } from './lib/find-keys.ts'

/**
 * 真的用 vite 打包一次（输出到临时文件夹，不碰 dist），再检查打包结果：
 * 没有任何密钥、全部是相对路径（GitHub Pages 子路径）、首屏 JS 够小。
 * 「密钥只从 localStorage 读」的运行时部分在 src/app/createAppStore.test.ts。
 */

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url))
let outDir = ''

async function allFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries.filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name))
}

beforeAll(async () => {
  outDir = await mkdtemp(path.join(tmpdir(), 'meishi-dist-'))
  // 和 npm run build 一样用正式版（vitest 自己把 NODE_ENV 设成 test，会打出开发版的 React）。
  const nodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await build({
      configFile: path.join(WEB_ROOT, 'vite.config.ts'),
      root: WEB_ROOT,
      mode: 'production',
      logLevel: 'silent',
      build: { outDir, emptyOutDir: true },
    })
  } finally {
    process.env.NODE_ENV = nodeEnv
  }
}, 120_000)

afterAll(async () => {
  if (outDir) await rm(outDir, { recursive: true, force: true })
})

describe('打包结果（安卓 TestToolchainSmokeTest 的网页版 + WEB-01/11/12）', () => {
  it('WEB-01 构建产物（全部文件）里没有任何 Google 密钥（AIza 开头的字串），源代码里也没有', async () => {
    const files = await allFiles(outDir)
    expect(files.length).toBeGreaterThan(3)
    expect(await scanForKeys([outDir])).toEqual([])
    const targets = ['src', 'public', 'index.html', 'scripts', 'e2e', 'vite-plugins', 'vite.config.ts', 'playwright.config.ts'].map((t) => path.join(WEB_ROOT, t))
    expect(await scanForKeys(targets)).toEqual([])
    // 也没有 .env 之类可能被打包进去的密钥文件。
    const rootFiles = await readdir(WEB_ROOT)
    expect(rootFiles.filter((f) => f.startsWith('.env'))).toEqual([])
  })

  it('TOOL-03 安卓构建会生成放内置密钥的字段；网页版相反：打包结果里没有任何「内置密钥」的字段或环境变量', async () => {
    const js = (await allFiles(outDir)).filter((f) => f.endsWith('.js'))
    expect(js.length).toBeGreaterThan(0)
    for (const file of js) {
      const text = await readFile(file, 'utf8')
      expect(text, file).not.toMatch(/PLACES_API_KEY|BuildConfig|VITE_[A-Z_]*KEY|MEISHI_PUBLIC_[A-Z_]*KEY/)
    }
    // 只有 MEISHI_PUBLIC_ 开头的环境变量会被打包（不是默认的 VITE_），所以 .env 里的 VITE_GOOGLE_KEY 不会公开出去。
    const config = await readFile(path.join(WEB_ROOT, 'vite.config.ts'), 'utf8')
    expect(config).toContain("envPrefix: 'MEISHI_PUBLIC_'")
  })

  it('WEB-11 打包用相对路径（Vite base: "./"）：index.html、manifest、离线缓存都不写网站根目录的绝对路径，放在 /<仓库名>/ 子路径下也能打开', async () => {
    const html = await readFile(path.join(outDir, 'index.html'), 'utf8')
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? '')
    expect(refs.length).toBeGreaterThan(3)
    for (const ref of refs) expect(ref, ref).toMatch(/^\.\//)
    const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.webmanifest'), 'utf8')) as {
      start_url: string
      scope: string
      id: string
      icons: { src: string }[]
    }
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
    expect(manifest.id).toBe('./')
    for (const icon of manifest.icons) expect(icon.src.startsWith('/')).toBe(false)
    // 离线缓存在 dist 根目录、用 ./sw.js 注册；预先缓存的清单也都是相对路径。
    const sw = await readFile(path.join(outDir, 'sw.js'), 'utf8')
    expect(sw).toContain('index.html')
    const appJs = (await allFiles(outDir)).filter((f) => f.endsWith('.js') && !f.endsWith('sw.js'))
    const app = (await Promise.all(appJs.map((f) => readFile(f, 'utf8')))).join('\n')
    expect(app).toContain('./sw.js')
  })

  it('WEB-12 首屏 JavaScript gzip 后小于 200KB', () => {
    const size = firstScreenSize(outDir)
    expect(size.jsFiles.length).toBeGreaterThan(0)
    expect(size.jsKb).toBeGreaterThan(0)
    expect(size.jsKb).toBeLessThan(BUDGET_KB)
  })

  it('TOOL-02 测试环境的 JSON 是真的实现（网页版直接用原生 JSON）', () => {
    const text = JSON.stringify({ name: '阿明海南鸡饭', rating: 4.6, open: null, types: ['restaurant'] })
    expect(JSON.parse(text)).toEqual({ name: '阿明海南鸡饭', rating: 4.6, open: null, types: ['restaurant'] })
    expect(() => JSON.parse('{not json')).toThrow(SyntaxError)
  })
})
