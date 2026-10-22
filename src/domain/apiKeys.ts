/**
 * Google 密钥的清理和检查（安卓 data/ApiKeys.kt）。密钥只有 A–Z a–z 0–9 - _（"AIza…"）；
 * 从聊天软件贴过来常带看不见的符号（零宽空格、BOM、方向标记、换行）或中文输入法的全角字。
 */
import { isBlank } from './chineseText.ts'

const KEY_CHAR = /^[A-Za-z0-9_-]$/

function isKeyChar(c: string): boolean {
  return KEY_CHAR.test(c)
}

/** 先 NFKC（全角 → 半角），再只留密钥会有的字。 */
export function cleanApiKey(raw: string): string {
  return [...raw.normalize('NFKC')].filter(isKeyChar).join('')
}

export type ApiKeyProblem = 'NO_API_KEY' | 'INVALID_API_KEY'

/** 为什么不能拿去用：空白 → 没有密钥；有密钥不会有的字 → 格式不对；没问题 → null。 */
export function apiKeyProblem(key: string): ApiKeyProblem | null {
  if (isBlank(key)) return 'NO_API_KEY'
  if (![...key].every(isKeyChar)) return 'INVALID_API_KEY'
  return null
}
