import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 界面和说明书只能用简体字。这个测试把网页项目里所有文字文件都扫一遍，
 * 发现繁体字就失败，并说出在哪个文件第几行。
 * 繁体字表在 scripts/data/traditional-chinese-chars.txt（从安卓版复制过来）。
 */

const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url))
const CHARS_FILE = path.join(WEB_ROOT, 'scripts/data/traditional-chinese-chars.txt')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', 'screenshots', '.vite', '.git'])
const SKIP_FILES = new Set([CHARS_FILE, path.join(WEB_ROOT, 'package-lock.json')])
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.json', '.webmanifest', '.md', '.svg', '.txt'])

function loadTraditionalChars(): Set<string> {
  const chars = new Set<string>()
  for (const line of readFileSync(CHARS_FILE, 'utf8').split('\n')) {
    if (line.startsWith('#')) continue
    for (const char of line.trim()) chars.add(char)
  }
  return chars
}

function textFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...textFiles(full))
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name)) && !SKIP_FILES.has(full)) {
      files.push(full)
    }
  }
  return files
}

function findTraditional(text: string, traditional: Set<string>): string[] {
  return [...new Set([...text].filter((char) => traditional.has(char)))]
}

describe('只用简体字', () => {
  const traditional = loadTraditionalChars()

  it('繁体字表读得到', () => {
    expect(traditional.size).toBeGreaterThan(1000)
    // 繁体的「面、还、饭」用 \u 写，免得这个文件自己被抓到。
    expect(findTraditional('今天吃\u9EB5\u9084是吃\u98EF', traditional)).toEqual(['\u9EB5', '\u9084', '\u98EF'])
    expect(findTraditional('今天吃面还是吃饭', traditional)).toEqual([])
  })

  it('网页项目里的所有文字文件都没有繁体字', () => {
    const problems: string[] = []
    for (const file of textFiles(WEB_ROOT)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const found = findTraditional(line, traditional)
          if (found.length > 0) {
            problems.push(`${path.relative(WEB_ROOT, file)} 第 ${index + 1} 行：${found.join(' ')}`)
          }
        })
    }
    expect(problems).toEqual([])
  })
})
