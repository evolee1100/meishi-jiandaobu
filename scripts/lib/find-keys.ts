import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

/**
 * 像 Google 密钥的字符串：AIza 后面跟着 10 个以上的密钥字符。
 * 真正的密钥是 AIza + 35 个字符；只写「AIza」四个字母（例如检查用户输入格式的规则）不算。
 */
export const KEY_PATTERN = /AIza[0-9A-Za-z_-]{10,}/g

export interface KeyFinding {
  file: string
  line: number
  /** 只显示开头几个字，免得在日志里再泄露一次。 */
  masked: string
}

export function findKeyLikeStrings(text: string): string[] {
  return [...text.matchAll(KEY_PATTERN)].map((match) => match[0])
}

export function maskKey(key: string): string {
  return `${key.slice(0, 6)}…（共 ${key.length} 个字符）`
}

const SKIP_DIRS = new Set(['node_modules', '.git'])

/** 检查文件或文件夹（会往里找所有文件，包括图片之类的二进制文件）。 */
export async function scanForKeys(targets: string[]): Promise<KeyFinding[]> {
  const findings: KeyFinding[] = []
  for (const target of targets) {
    for (const file of await listFiles(target)) {
      // latin1：任何字节都能读，二进制文件里藏着的密钥也找得到。
      const text = (await readFile(file)).toString('latin1')
      for (const match of text.matchAll(KEY_PATTERN)) {
        const line = text.slice(0, match.index).split('\n').length
        findings.push({ file, line, masked: maskKey(match[0]) })
      }
    }
  }
  return findings
}

async function listFiles(target: string): Promise<string[]> {
  const info = await stat(target)
  if (info.isFile()) return [target]
  const files: string[] = []
  for (const entry of await readdir(target, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(target, entry.name)
    if (entry.isDirectory()) files.push(...(await listFiles(full)))
    else if (entry.isFile()) files.push(full)
  }
  return files
}
