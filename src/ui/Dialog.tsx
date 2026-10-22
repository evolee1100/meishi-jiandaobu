/**
 * 对话框（安卓 Dialog / AlertDialog 的网页版）：盖住整个画面，读屏知道是对话框（role="dialog" + aria-modal），
 * 打开时焦点进去、关掉时回到原来的按钮；后面的画面不能点、不能用 Tab 走到（inert）。
 * 内容太高（手机横屏、字体放大）时，整个对话框可以上下滑，按钮永远滑得到。
 * 返回键 / Esc 由 App 统一处理（照功能清单 2.4 只关一层）。
 */
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

let openCount = 0

function setBackgroundInert(inert: boolean): void {
  const root = document.getElementById('root')
  if (root) root.inert = inert
  document.documentElement.classList.toggle('has-dialog', inert)
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export interface DialogProps {
  /** 标题元素的 id（读屏念对话框名字）。 */
  readonly labelledBy?: string
  readonly label?: string
  /** 点对话框外面（安卓：点窗口外 = 关掉）。不给 = 点外面没反应。 */
  readonly onDismiss?: () => void
  readonly className?: string
  /** 放在外层（scrim）上的 class，例如横屏改两栏时用。 */
  readonly scrimClassName?: string
  readonly children: ReactNode
  /** 打开时先把焦点放在哪个元素上（选择器）；默认对话框本身。 */
  readonly initialFocus?: string
  readonly testId?: string
}

export function Dialog({ labelledBy, label, onDismiss, className, scrimClassName, children, initialFocus, testId }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    openCount++
    if (openCount === 1) setBackgroundInert(true)
    const panel = panelRef.current
    const target = (initialFocus ? panel?.querySelector<HTMLElement>(initialFocus) : null) ?? panel
    target?.focus({ preventScroll: true })
    return () => {
      openCount = Math.max(openCount - 1, 0)
      if (openCount === 0) setBackgroundInert(false)
      if (previous && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const first = items[0] as HTMLElement
    const last = items[items.length - 1] as HTMLElement
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className={scrimClassName ? `scrim ${scrimClassName}` : 'scrim'}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        className={className ? `dialog ${className}` : 'dialog'}
        onKeyDown={onKeyDown}
        data-testid={testId}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
