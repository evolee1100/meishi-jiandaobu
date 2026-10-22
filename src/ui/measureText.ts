/**
 * 量一段字画出来有多宽（像素），给转盘格子上的字决定字号用。用一个不放进页面的 canvas 量，不会让页面重新排版。
 * 测试环境（jsdom）没有 canvas：用「每个字一个字号宽、英文字母和空格半个」估算。
 */
import { codePointLength } from '../domain/chineseText.ts'

let context: CanvasRenderingContext2D | null | undefined

function canvasContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context
  context = null
  if (typeof document === 'undefined' || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))) return context
  try {
    context = document.createElement('canvas').getContext('2d')
  } catch {
    context = null
  }
  return context
}

/** 没有 canvas 时的估算：汉字、emoji 一个字号宽，英文、数字、空格半个。 */
export function estimateTextWidth(text: string, px: number): number {
  let width = 0
  for (const char of text) width += /[\x20-\x7e]/.test(char) ? px * 0.55 : px
  return width || codePointLength(text) * px
}

/** 粗体、某个字号、某种字体的字有多宽。 */
export function measureTextWidth(text: string, px: number, fontFamily: string, weight = 700): number {
  const ctx = canvasContext()
  if (!ctx) return estimateTextWidth(text, px)
  ctx.font = `${weight} ${px}px ${fontFamily}`
  return ctx.measureText(text).width
}
