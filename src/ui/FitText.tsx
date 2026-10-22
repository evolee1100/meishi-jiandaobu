/**
 * 一行放得下就一行（安卓 OneLineFitText / 随便挑说明那一行）：放不下先把字一点一点缩小（每次 0.5px，
 * 最小 13px、也不小于原来的 75%），还放不下就用原来的字号换行（不切掉字，1.3 倍字体时整句也看得到；测试 SCREEN-06）。
 * 换行时照「按短句换行」：一个短语整个换到下一行，不会断成「嘛 / 嘛档」。
 */
import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { splitPhrases } from '../domain/phrases.ts'

export const MIN_FIT_PX = 13
/** 最多缩到原来的 75%（安卓 14 → 10.5）。 */
export const MIN_FIT_RATIO = 0.75

export interface FitTextProps extends HTMLAttributes<HTMLSpanElement> {
  readonly text: string
  /** 最小缩到几 px（默认 13）。划刀的两栏小卡、暗中出拳的店名可以再小一点（安卓 12sp / 10sp）。 */
  readonly minPx?: number
  /** 最多缩到原来的几成（默认 0.75）。 */
  readonly minRatio?: number
}

export function FitText({ text, className, minPx = MIN_FIT_PX, minRatio = MIN_FIT_RATIO, ...rest }: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.fontSize = ''
      el.style.whiteSpace = 'nowrap'
      const base = parseFloat(getComputedStyle(el).fontSize)
      if (!Number.isFinite(base)) return
      const smallest = Math.max(minPx, base * minRatio)
      let size = base
      while (el.scrollWidth > el.clientWidth + 0.5 && size - 0.5 >= smallest) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
      if (el.scrollWidth > el.clientWidth + 0.5) {
        // 缩了还放不下：用原来的字号换行（整句都看得到，比挤成小字好读）
        el.style.fontSize = ''
        el.style.whiteSpace = 'normal'
      }
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth
        fit()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, minPx, minRatio])

  return (
    <span ref={ref} className={className ? `fit-text ${className}` : 'fit-text'} {...rest}>
      {splitPhrases(text).map((phrase, index) => (
        <span key={index} className="phrase">
          {phrase}
        </span>
      ))}
    </span>
  )
}
