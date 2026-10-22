/**
 * 按短句换行（安卓 ui/PhraseText.kt 的 Phrases.split）：中文每两个字之间都能断行，所以先把句子切成短语，
 * 一个短语整个换到下一行，只有比整行还宽时才在里面断。画面用它排版；读屏和分享用 stripBreaks 去掉隐形的断点。
 */
import { ktTrim } from './chineseText.ts'

/** 零宽空格：可以在这里换行（没有标点的句子标出停顿）。永远不显示、不念出来。 */
export const BREAK = '​'

/** 这些后面（连同后面的空格）可以换行。 */
const BREAK_AFTER = '，。！？：；、）·'

/** 这些不能放在行首（「）：」「！」」不拆开）。 */
const NO_LINE_START = '，。！？：；、）」』…·'

/** 「（」前面至少要有这么多字，才可以从「（」开新行（「我（App）：」不拆）。 */
const MIN_BEFORE_PAREN = 4

export function splitPhrases(text: string): string[] {
  const phrases: string[] = []
  let current = ''
  let i = 0
  while (i < text.length) {
    const c = text.charAt(i)
    if (c === BREAK) {
      if (current.length > 0) phrases.push(current)
      current = ''
      i++
      continue
    }
    if (c === '（' && ktTrim(current).length >= MIN_BEFORE_PAREN) {
      phrases.push(current)
      current = ''
    }
    current += c
    i++
    if (BREAK_AFTER.includes(c)) {
      while (i < text.length && text.charAt(i) === ' ') current += text.charAt(i++)
      if (i < text.length && !NO_LINE_START.includes(text.charAt(i))) {
        phrases.push(current)
        current = ''
      }
    }
  }
  if (current.length > 0) phrases.push(current)
  return phrases
}

/** 给读屏和普通显示用：去掉隐形断点。 */
export function stripBreaks(text: string): string {
  return text.split(BREAK).join('')
}

/** 分享出去的纯文字：不换行空格 → 普通空格，字连接符、零宽空格都去掉（聊天软件里只会捣乱）。 */
export function cleanForShare(text: string): string {
  return text.replace(/ /g, ' ').replace(/⁠/g, '').replace(/​/g, '')
}
