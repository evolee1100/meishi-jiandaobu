/**
 * 跟着手机 / 浏览器设定变的小工具：减少动画、媒体查询、字体倍数。
 */
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

function query(media: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(media) : null
}

/** 媒体查询现在成不成立（会跟着变）。 */
export function useMediaQuery(media: string): boolean {
  const [matches, setMatches] = useState(() => query(media)?.matches ?? false)
  useEffect(() => {
    const list = query(media)
    if (!list) return
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener?.('change', update)
    return () => list.removeEventListener?.('change', update)
  }, [media])
  return matches
}

/** 用户开了「减少动画」（安卓的「关掉动画」）。 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** 触屏手机（手指点）：摇一摇提示只在这种设备上显示。 */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)')
}

/** 用户把字调大了几倍（安卓 fontScale）：根字号 ÷ 16。 */
export function fontScale(): number {
  if (typeof document === 'undefined') return 1
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(size) && size > 0 ? size / 16 : 1
}

/** 等两帧（新排好的版面画出来以后）再做事。 */
export function afterTwoFrames(action: () => void): () => void {
  if (typeof requestAnimationFrame !== 'function') {
    const timer = setTimeout(action, 32)
    return () => clearTimeout(timer)
  }
  let second = 0
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(action)
  })
  return () => {
    cancelAnimationFrame(first)
    cancelAnimationFrame(second)
  }
}

/**
 * 把一个元素的实际高度写进 CSS 变量（例如 --topbar-height：大字时标题栏变高，下面固定的演示条跟着让开）。
 * 元素不在了就设回 0。
 */
export function usePublishedHeight(ref: RefObject<HTMLElement | null>, variable: string): void {
  useLayoutEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el) return
    const publish = () => root.style.setProperty(variable, `${Math.ceil(el.getBoundingClientRect().height)}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.setProperty(variable, '0px')
    }
  }, [ref, variable])
}
