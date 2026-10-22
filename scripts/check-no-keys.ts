/**
 * 发布前检查：构建产物里绝不能有像 Google 密钥的字符串（AIza 开头）。
 * 用户的密钥只存在用户自己浏览器的 localStorage 里，不能写进源代码或网页文件。
 * 用法：node scripts/check-no-keys.ts dist [别的文件夹……]
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { scanForKeys } from './lib/find-keys.ts'

const targets = process.argv.slice(2)
if (targets.length === 0) targets.push('dist')

for (const target of targets) {
  if (!existsSync(target)) {
    console.error(`❌ 找不到 ${target}，请先运行 npm run build`)
    process.exit(1)
  }
}

const findings = await scanForKeys(targets)
if (findings.length > 0) {
  console.error('❌ 发现像 Google 密钥的字符串，不能发布！')
  for (const finding of findings) {
    console.error(`   ${path.relative(process.cwd(), finding.file)} 第 ${finding.line} 行：${finding.masked}`)
  }
  console.error('   密钥只能由用户自己在设置里填，存在他自己的浏览器里。请删掉以后重新构建。')
  process.exit(1)
}

console.log(`✅ 没有发现 Google 密钥（检查了 ${targets.join('、')}）`)
