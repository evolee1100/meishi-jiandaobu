/**
 * 几段字中间夹「 · 」（安卓 SeparatedFlow，功能清单 26.3）：店卡的评分行、价钱营业行。
 * 一段放不下就整段换到下一行，**分隔符只画在同一行的两段中间**，换行的那一段前面不留「·」，行尾也不会剩一个点。
 *
 * 做法：先把每段（连同它前面的分隔符）排好、量每段在第几行；换到新一行的那段，把分隔符拿掉，并在它前面放一个
 * 「强制换行」（flex 里一个占满整行、高度 0 的格子）。这样拿掉分隔符以后它也不会跳回上一行（不会来回跳）。
 * 宽度变了（转屏、字体放大）就重新量一次。读屏照样整句念（分隔符是普通的字）。
 */
import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react'

export interface FlowPiece {
  readonly key: string
  readonly node: ReactNode
  /** 这一段前面用什么分开：dot = 「 · 」，gap = 空一点（「营业中 开到…」）。第一段不用。 */
  readonly before?: 'dot' | 'gap'
}

export function SeparatedFlow({ pieces, className }: { readonly pieces: readonly FlowPiece[]; readonly className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const flow = ref.current
    if (!flow) return
    const layout = () => {
      const items = [...flow.querySelectorAll<HTMLElement>(':scope > .sep-flow__piece')]
      // 先全部恢复成「每段都带分隔符、没有强制换行」再量
      for (const item of items) item.classList.remove('is-line-start')
      for (const br of flow.querySelectorAll<HTMLElement>(':scope > .sep-flow__break')) br.classList.remove('is-on')
      // 换到新的一行 = 这一段整个在上一段的下面（同一行的段垂直置中，高矮不同也会上下重叠）
      const starts: HTMLElement[] = []
      let previousBottom = Number.NEGATIVE_INFINITY
      items.forEach((item, index) => {
        const box = item.getBoundingClientRect()
        if (index > 0 && box.top >= previousBottom - 1) starts.push(item)
        previousBottom = box.bottom
      })
      for (const item of starts) {
        item.classList.add('is-line-start')
        const br = item.previousElementSibling
        if (br instanceof HTMLElement && br.classList.contains('sep-flow__break')) br.classList.add('is-on')
      }
    }
    layout()
    if (typeof ResizeObserver === 'undefined') return
    let width = flow.clientWidth
    const observer = new ResizeObserver(() => {
      if (flow.clientWidth === width) return
      width = flow.clientWidth
      layout()
    })
    observer.observe(flow)
    return () => observer.disconnect()
  })

  return (
    <div ref={ref} className={className ? `sep-flow ${className}` : 'sep-flow'}>
      {pieces.map((piece, index) => (
        <Fragment key={piece.key}>
          {index > 0 && <span className="sep-flow__break" aria-hidden="true" />}
          <span className="sep-flow__piece">
            {index > 0 && <span className={`sep-flow__sep sep-flow__sep--${piece.before ?? 'dot'}`}>{piece.before === 'gap' ? ' ' : ' · '}</span>}
            {piece.node}
          </span>
        </Fragment>
      ))}
    </div>
  )
}
