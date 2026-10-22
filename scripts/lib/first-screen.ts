import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

/** 首屏 JavaScript（gzip 后）的上限：马来西亚的手机网络也要打开得快。 */
export const BUDGET_KB = 200

export interface FirstScreenSize {
  /** 打开网页马上要下载的 JS 文件（module 脚本 + modulepreload），相对 dist。 */
  jsFiles: string[]
  cssFiles: string[]
  /** gzip（level 9）后的 KB。 */
  jsKb: number
  cssKb: number
}

function attributeValues(html: string, tagPattern: RegExp, attribute: string): string[] {
  const values: string[] = []
  for (const [tag] of html.matchAll(tagPattern)) {
    const value = new RegExp(`${attribute}="([^"]+)"`).exec(tag)?.[1]
    if (value) values.push(value)
  }
  return values
}

/** 读 dist/index.html，算出首屏要下载的 JS / CSS 有多大（gzip 后）。找不到 index.html 就抛错。 */
export function firstScreenSize(distDir: string): FirstScreenSize {
  const htmlPath = path.join(distDir, 'index.html')
  if (!existsSync(htmlPath)) throw new Error(`找不到 ${htmlPath}，请先运行 npm run build`)
  const html = readFileSync(htmlPath, 'utf8')
  const jsFiles = [
    ...attributeValues(html, /<script\b[^>]*type="module"[^>]*>/g, 'src'),
    ...attributeValues(html, /<link\b[^>]*rel="modulepreload"[^>]*>/g, 'href'),
  ]
  const cssFiles = attributeValues(html, /<link\b[^>]*rel="stylesheet"[^>]*>/g, 'href')
  const gzipKb = (file: string) => gzipSync(readFileSync(path.join(distDir, file.replace(/^\.\//, ''))), { level: 9 }).length / 1024
  return {
    jsFiles,
    cssFiles,
    jsKb: jsFiles.reduce((sum, file) => sum + gzipKb(file), 0),
    cssKb: cssFiles.reduce((sum, file) => sum + gzipKb(file), 0),
  }
}
