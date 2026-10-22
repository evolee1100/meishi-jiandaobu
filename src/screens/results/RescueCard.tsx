/**
 * 救援卡（安卓 ResultsScreen.RescueCard，功能清单 11.4）：整份结果里现在能去的不到 2 家时，给三条继续玩的路，
 * 从不叫人「晚点再来」。只有「🔍 扩大到 X 公里再找」会搜索，按钮下面先写清楚会不会用次数（看现在的演示开关）。
 */
import { type ResultsState } from '../../app/state.ts'
import { rescueTitle, searchCostNote, text } from '../../app/texts.ts'
import { formatKm } from '../../domain/geo.ts'
import { largerRadius } from '../../domain/radius.ts'
import { PhraseText } from '../../ui/PhraseText.tsx'

export interface RescueCardProps {
  readonly results: ResultsState
  /** 被只看营业中藏起来的家数。 */
  readonly hiddenClosed: number
  readonly demoMode: boolean
  readonly onReroll: () => void
  readonly onExpand: () => void
  readonly onShowAll: () => void
}

export function RescueCard({ results, hiddenClosed, demoMode, onReroll, onExpand, onShowAll }: RescueCardProps) {
  const title = rescueTitle(results)
  if (title == null) return null
  const larger = largerRadius(results.radiusKm)
  return (
    <section className="rescue-card" aria-live="polite">
      <PhraseText as="h3" className="rescue-card__title" text={title} />
      <button type="button" className="btn btn--filled btn--block btn--tall" onClick={onReroll}>
        {text('rescue_reroll')}
      </button>
      <p className="rescue-card__note">{text('rescue_reroll_note')}</p>
      {larger != null && (
        <>
          <button type="button" className="btn btn--outlined btn--block btn--tall rescue-card__expand" onClick={onExpand}>
            <PhraseText text={text('rescue_expand', formatKm(larger))} />
          </button>
          <p className="rescue-card__note">{searchCostNote(demoMode)}</p>
        </>
      )}
      {results.openNowOnly && hiddenClosed > 0 && (
        <button type="button" className="btn btn--text rescue-card__all" onClick={onShowAll}>
          {text('rescue_show_all')}
        </button>
      )}
    </section>
  )
}
