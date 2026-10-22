/**
 * 固定在最下面的底栏（首页的「吃饭 / 吃面 / 都可以」、结果页的「换 3 家 / 猜拳」…）：怎么滑都在，
 * 让开手机底部的横条（安全区）；电脑上跟着主栏宽度置中。
 * 把自己的高度写进 CSS 变量 --bottom-bar-h，内容区在下面留同样的空位，提示条也放在它上面。
 * 上面的内容还没滑到底时，底栏上缘有一点阴影（表示上面还有东西）。
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

const HEIGHT_VAR = '--bottom-bar-h'

export interface BottomBarProps {
  readonly children: ReactNode
  readonly className?: string
  readonly label?: string
  /**
   * 固定在最下面（默认）。false = 不固定（例如手机横屏时结果页的按钮改成右边一栏）：不占底下的空位，
   * --bottom-bar-h 是 0。
   */
  readonly floating?: boolean
}

export function BottomBar({ children, className, label, floating = true }: BottomBarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [moreAbove, setMoreAbove] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el || !floating) {
      root.style.setProperty(HEIGHT_VAR, '0px')
      return
    }
    const publish = () => root.style.setProperty(HEIGHT_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.setProperty(HEIGHT_VAR, '0px')
    }
  }, [floating])

  useEffect(() => {
    const update = () => {
      const root = document.documentElement
      setMoreAbove(root.scrollHeight - (window.scrollY + window.innerHeight) > 2)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    observer?.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`bottom-bar${floating ? '' : ' bottom-bar--inline'}${floating && moreAbove ? ' bottom-bar--raised' : ''}${className ? ' ' + className : ''}`}
      role="region"
      aria-label={label}
    >
      <div className="bottom-bar__inner">{children}</div>
    </div>
  )
}
