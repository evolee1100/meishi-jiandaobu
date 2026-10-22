/**
 * 首屏大小检查：打开网页时马上要下载的 JavaScript（gzip 压缩后）不能超过 200KB，
 * 马来西亚的手机网络也要打开得快。超过了构建就失败，请先想办法减肥（拆分、换轻一点的写法）。
 * 用法：node scripts/check-size.ts dist
 */
import { BUDGET_KB, firstScreenSize } from './lib/first-screen.ts'

const distDir = process.argv[2] ?? 'dist'

let size
try {
  size = firstScreenSize(distDir)
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

console.log(`📦 首屏 JavaScript：${size.jsKb.toFixed(1)}KB（gzip，上限 ${BUDGET_KB}KB，${size.jsFiles.length} 个文件）`)
console.log(`🎨 首屏 CSS：${size.cssKb.toFixed(1)}KB（gzip）`)

if (size.jsFiles.length === 0) {
  console.error('❌ index.html 里找不到 JavaScript，构建可能出错了')
  process.exit(1)
}
if (size.jsKb > BUDGET_KB) {
  console.error(`❌ 首屏 JavaScript 超过 ${BUDGET_KB}KB 了，手机打开会变慢。请把不是马上要用的部分改成按需加载。`)
  process.exit(1)
}
