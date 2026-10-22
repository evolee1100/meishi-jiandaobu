import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findKeyLikeStrings, maskKey, scanForKeys } from './lib/find-keys.ts'

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url))

// 测试用的假密钥：拆开来写，源码里不会出现一整串像密钥的字。
const FAKE_KEY = ['AI', 'za', 'Sy', 'X'.repeat(33)].join('')

describe('密钥检查', () => {
  it('认得出像 Google 密钥的字符串', () => {
    expect(findKeyLikeStrings(`const k = "${FAKE_KEY}"`)).toEqual([FAKE_KEY])
    expect(findKeyLikeStrings(`fetch("https://x.test/?key=${FAKE_KEY}&q=1")`)).toEqual([FAKE_KEY])
  })

  it('只有「AIza」几个字（例如检查用户输入格式的规则）不算', () => {
    expect(findKeyLikeStrings('if (!key.startsWith("AIza")) showError()')).toEqual([])
    expect(findKeyLikeStrings('/^AIza[0-9A-Za-z_-]{35}$/')).toEqual([])
  })

  it('报告里不会把整串密钥再印出来', () => {
    expect(maskKey(FAKE_KEY)).not.toContain(FAKE_KEY.slice(6))
  })

  it('能在文件夹里找到藏起来的密钥，并说出文件和行号', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'meishi-keys-'))
    try {
      await writeFile(path.join(dir, 'ok.js'), 'console.log("没有密钥")\n')
      await writeFile(path.join(dir, 'bad.js'), `\n\nconst k="${FAKE_KEY}"\n`)
      const findings = await scanForKeys([dir])
      expect(findings).toHaveLength(1)
      expect(findings[0]?.file).toBe(path.join(dir, 'bad.js'))
      expect(findings[0]?.line).toBe(3)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('网页源码里没有任何密钥（src、public、index.html、e2e、scripts）', async () => {
    const targets = ['src', 'public', 'index.html', 'e2e', 'scripts', 'vite.config.ts', 'playwright.config.ts'].map(
      (target) => path.join(WEB_ROOT, target),
    )
    expect(await scanForKeys(targets)).toEqual([])
  })
})
