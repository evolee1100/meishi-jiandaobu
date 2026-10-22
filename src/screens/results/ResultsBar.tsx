/**
 * 结果页的底栏（安卓 ResultsScreen.ResultsBottomBar，功能清单 11.8）：固定在下面，怎么滑都在。从上到下：
 * 提示条（3 秒）→「已清空 5 家　撤销」（8 秒）→ ❤️ 一行（只有一行：已圈几家 + 👥 饭桌模式 + 清空）→
 * 一排两个按钮：左边翻页（换 3 家 / 剩下 2 家 / 回到前 3 名，占 34%），右边决定按钮（猜拳 / 帮我挑一家 / 转盘，占 66%）
 * 或「这一页能去的店不到 2 家」。手机横屏（很矮）变成右边一栏（宽 280），游戏按钮在最下面，拇指按得到。
 * 底栏上的东西一个请求都不发。
 */
import { useEffect, useState, type ReactNode } from 'react'
import { type DuelPlan, type ResultsState } from '../../app/state.ts'
import { basketRowText, decideButton, text } from '../../app/texts.ts'
import { RESULTS } from '../../data/constants.ts'
import { BottomBar } from '../../ui/BottomBar.tsx'
import { PhraseText } from '../../ui/PhraseText.tsx'

/** 出现 / 收起有一点滑动（CSS）；收起时还显示原来的字，滑完才拿掉。 */
function useMounted(open: boolean, ms = 260): boolean {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const timer = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(timer)
  }, [open, ms])
  return mounted || open
}

function SlideRow({ open, children, className }: { readonly open: boolean; readonly children: ReactNode; readonly className?: string }) {
  if (!useMounted(open)) return null
  return (
    <div className={`slide-row${open ? ' is-open' : ''}${className ? ' ' + className : ''}`} inert={!open}>
      <div className="slide-row__inner">{children}</div>
    </div>
  )
}

/** 提示条：反色底，读屏会念；只在底栏里，永远不盖按钮。 */
function NoticeRow({ notice }: { readonly notice: string | null }) {
  const [last, setLast] = useState(notice)
  useEffect(() => {
    if (notice != null) setLast(notice)
  }, [notice])
  return (
    <div className="bar-notice-holder" aria-live="polite" aria-atomic="true">
      <SlideRow open={notice != null}>
        <div className="bar-notice">
          <PhraseText text={notice ?? last ?? ''} />
        </div>
      </SlideRow>
    </div>
  )
}

/** 「已清空 5 家　撤销」：8 秒后自己收起。 */
function BasketUndoRow({ cleared, onUndo, onDismiss }: { readonly cleared: readonly string[]; readonly onUndo: () => void; readonly onDismiss: () => void }) {
  const [shown, setShown] = useState(cleared.length)
  useEffect(() => {
    if (cleared.length === 0) return
    setShown(cleared.length)
    const timer = setTimeout(onDismiss, RESULTS.BASKET_UNDO_MS)
    return () => clearTimeout(timer)
    // 只看清空了哪几家（每次清空是新的一组）
  }, [cleared])
  return (
    <div aria-live="polite">
      <SlideRow open={cleared.length > 0}>
        <div className="bar-undo">
          <span className="bar-undo__text">{text('basket_cleared', cleared.length > 0 ? cleared.length : shown)}</span>
          <button type="button" className="bar-undo__btn" onClick={onUndo}>
            {text('basket_undo')}
          </button>
        </div>
      </SlideRow>
    </div>
  )
}

/** ❤️ 一行（只有一行，放不下就「…」，第三张卡的名字和星数才不会被挡住）。 */
function BasketRow({ results, onClear, onOpenTable }: { readonly results: ResultsState; readonly onClear: () => void; readonly onOpenTable: () => void }) {
  const label = basketRowText(results)
  if (label == null) return null
  return (
    <div className="basket-row">
      <span className="basket-row__text">{label}</span>
      {results.basket.length >= RESULTS.MIN_TABLE_BASKET && (
        <button type="button" className="btn btn--tonal basket-row__table" onClick={onOpenTable}>
          {text('basket_table')}
        </button>
      )}
      <button type="button" className="btn btn--text basket-row__clear" onClick={onClear}>
        {text('basket_clear')}
      </button>
    </div>
  )
}

/** 决定按钮：横向渐层、白色粗体；「这一页 3 家」时左边一个每 4 秒摇两下的 ✊。 */
function DecideButton({ plan, showFist, onClick }: { readonly plan: DuelPlan; readonly showFist: boolean; readonly onClick: () => void }) {
  const decide = decideButton(plan)
  return (
    <button type="button" className="decide-btn" onClick={onClick}>
      {decide.wobblyFist && showFist && (
        <span className="decide-btn__fist" aria-hidden="true">
          ✊
        </span>
      )}
      <PhraseText className="decide-btn__text" text={decide.label} />
    </button>
  )
}

export interface ResultsBarProps {
  readonly results: ResultsState
  readonly plan: DuelPlan
  /** 翻页按钮（没有就是 null）。 */
  readonly page: { readonly label: string; readonly onClick: () => void } | null
  /** 有救援卡时不显示「这一页能去的店不到 2 家」。 */
  readonly rescue: boolean
  readonly pageHasItems: boolean
  readonly notice: string | null
  /** 窄屏大字：不摇 ✊，字有整个按钮的宽。 */
  readonly tight: boolean
  /** 手机横屏：右边一栏。 */
  readonly side: boolean
  readonly onDecide: () => void
  readonly onClearBasket: () => void
  readonly onOpenTable: () => void
  readonly onUndoClear: () => void
  readonly onDismissUndo: () => void
}

export function ResultsBar(props: ResultsBarProps) {
  const { results, plan, page, notice } = props
  const canDecide = plan.mode != null
  const hint = !canDecide && !props.rescue && props.pageHasItems
  const basket = results.basket.length > 0
  const empty = page == null && !canDecide && !hint && !basket && results.clearedBasket.length === 0 && notice == null
  if (empty) return null
  const withBasket = basket ? ' is-with-basket' : ''
  return (
    <BottomBar className={`results-bar${props.side ? ' results-bar--side' : ''}`} floating={!props.side}>
      <NoticeRow notice={notice} />
      <BasketUndoRow cleared={results.clearedBasket} onUndo={props.onUndoClear} onDismiss={props.onDismissUndo} />
      {basket && <BasketRow results={results} onClear={props.onClearBasket} onOpenTable={props.onOpenTable} />}
      {(page != null || canDecide || hint) && (
        <div className={`results-bar__row${withBasket}`}>
          {page && (
            <button type="button" className={`btn btn--tonal page-btn${canDecide || hint ? ' page-btn--half' : ''}`} onClick={page.onClick}>
              <PhraseText text={page.label} />
            </button>
          )}
          {canDecide && <DecideButton plan={plan} showFist={!props.tight} onClick={props.onDecide} />}
          {hint && (
            <div className="decide-hint">
              <PhraseText text={decideButton(plan).label} />
            </div>
          )}
        </div>
      )}
    </BottomBar>
  )
}
