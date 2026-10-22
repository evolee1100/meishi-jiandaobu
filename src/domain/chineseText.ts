/**
 * 店名是不是中文、要不要机翻、像不像马来文（安卓 domain/ChineseText.kt、MalayHints.kt），
 * 以及照搬 Kotlin 的空白规则（Kotlin 的 trim / isBlank / \s 和 JS 不完全一样）。
 */
import { MALAY_WORDS } from '../data/foodTypes.ts'

const HAN = /\p{Script=Han}/u
const LETTER = /\p{L}/u

/** 至少有一个汉字（包括扩展区的 𠮷）。 */
export function containsCjk(text: string | null | undefined): boolean {
  if (!text) return false
  return HAN.test(text)
}

/**
 * Kotlin 的 Char.isWhitespace()：Unicode 的空白（Zs / Zl / Zp）加上 \t \n \u000B \f \r \u001C–\u001F。
 * （和 JS 的 trim 差在：Kotlin 不把 ﻿ 当空白，但把 \u001C–\u001F 当空白。）
 */
const KOTLIN_WHITESPACE = /[\p{Zs}\p{Zl}\p{Zp}\t\n\u000B\f\r\u001C-\u001F]/u
const KOTLIN_TRIM = /^[\p{Zs}\p{Zl}\p{Zp}\t\n\u000B\f\r\u001C-\u001F]+|[\p{Zs}\p{Zl}\p{Zp}\t\n\u000B\f\r\u001C-\u001F]+$/gu

export function isKotlinWhitespace(char: string): boolean {
  return KOTLIN_WHITESPACE.test(char)
}

/** Kotlin String.trim()。 */
export function ktTrim(text: string): string {
  return text.replace(KOTLIN_TRIM, '')
}

/** Kotlin isNullOrBlank()。 */
export function isBlank(text: string | null | undefined): boolean {
  return text == null || ktTrim(text).length === 0
}

/** 有字母、而且一个汉字都没有，才需要机翻（中文、纯数字符号、空白都不翻）。 */
export function needsTranslation(text: string | null | undefined): boolean {
  if (isBlank(text)) return false
  const value = text as string
  return !containsCjk(value) && LETTER.test(value)
}

const MALAY = new Set(MALAY_WORDS)

/** 店名里有典型的马来词（整个词才算：Mile High Cafe 的 Mi 不算）。 */
export function looksMalay(text: string | null | undefined): boolean {
  if (isBlank(text)) return false
  return (text as string)
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .some((word) => MALAY.has(word))
}

/** 按 Unicode 码位数（emoji 算 1 个字），不是 UTF-16 长度。 */
export function codePointLength(text: string): number {
  let count = 0
  for (const _ of text) count++
  return count
}

/** 取前 n 个码位。 */
export function takeCodePoints(text: string, n: number): string {
  let out = ''
  let count = 0
  for (const ch of text) {
    if (count >= n) break
    out += ch
    count++
  }
  return out
}
