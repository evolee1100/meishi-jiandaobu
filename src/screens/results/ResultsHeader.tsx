/**
 * 结果页的表头（安卓 ResultsScreen.ResultsHeader，功能清单 11.2）：
 * 「🤝 这一餐已经定了：…　看一看」细条 → 大标题（只在「・」后面换行）→ 副标题（一行放得下才用「 · 」连）+「扩大到 3 公里（用 1 次）」
 * → ♻️ 刚刚搜过 → ⚠️ 部分失败 + 重新搜索 → 「只看营业中」开关块 +「📤 发到群里投票」（按宽度：并排写全 / 并排写短 / 上下两行）。
 */
import { mealWinnerName, resultsView, type MealDecision, type ResultsState } from '../../app/state.ts'
import { expandRangeLabel, resultsSubtitle, resultsTitleParts, text } from '../../app/texts.ts'
import { PREFIXES, SEPARATORS } from '../../data/uiLiterals.ts'
import { PhraseText } from '../../ui/PhraseText.tsx'
import { SeparatedFlow, type FlowPiece } from '../../ui/SeparatedFlow.tsx'

export interface ResultsHeaderProps {
  readonly results: ResultsState
  /** 画面上那个世界（演示 / 真实）的这一餐（定了才有）。 */
  readonly meal: MealDecision | null
  /** 现在的演示开关（扩大范围要不要扣次数，看的是现在）。 */
  readonly demoMode: boolean
  readonly onShowMeal: () => void
  readonly onExpand: () => void
  readonly onSearchAgain: () => void
  readonly onOpenNowOnly: (on: boolean) => void
  readonly onShareVote: () => void
}

export function ResultsHeader(props: ResultsHeaderProps) {
  const { results, meal } = props
  const view = resultsView(results)
  const segments = resultsTitleParts(view, results.choice)
  const subtitle = resultsSubtitle(results)
  const expand = expandRangeLabel(results.radiusKm, props.demoMode)
  const hidden = results.openNowOnly ? view.hiddenClosed : 0

  const subtitlePieces: FlowPiece[] = [
    { key: 'found', node: <PhraseText className="results-subtitle__text" text={subtitle.found} /> },
    { key: 'range', node: <PhraseText className="results-subtitle__text" text={subtitle.range} />, before: 'dot' },
  ]
  if (expand) {
    subtitlePieces.push({
      key: 'expand',
      before: 'gap',
      node: (
        <button type="button" className="btn btn--text results-expand" onClick={props.onExpand}>
          <PhraseText text={expand} />
        </button>
      ),
    })
  }

  return (
    <header className="results-head">
      {meal && (
        <button type="button" className="meal-strip" onClick={props.onShowMeal}>
          <span className="meal-strip__text">{text('meal_banner', mealWinnerName(meal))}</span>
          <span className="meal-strip__look">{text('meal_banner_look')}</span>
        </button>
      )}
      <h2 className="results-title">
        {segments.map((segment, index) => (
          <span key={index} className="results-title__seg">
            {index < segments.length - 1 ? segment + SEPARATORS.choice : segment}
          </span>
        ))}
      </h2>
      <SeparatedFlow className="results-subtitle" pieces={subtitlePieces} />
      {results.fromCache && <PhraseText as="p" className="results-note results-note--cached" text={PREFIXES.cached + text('results_cached')} />}
      {results.partial && (
        <div className="results-partial">
          <PhraseText as="p" className="results-note results-note--partial" text={PREFIXES.partial + text('results_partial')} />
          <button type="button" className="btn btn--text results-partial__again" onClick={props.onSearchAgain}>
            {text('search_again')}
          </button>
        </div>
      )}
      <div className="results-tools">
        <button
          type="button"
          role="switch"
          aria-checked={results.openNowOnly}
          className="open-toggle"
          onClick={() => props.onOpenNowOnly(!results.openNowOnly)}
        >
          <span className="open-toggle__text">
            <span className="open-toggle__title">{text('open_only')}</span>
            {hidden > 0 && (
              <>
                <PhraseText className="open-toggle__hidden open-toggle__hidden--full" text={text('open_only_hidden', hidden)} />
                <span className="open-toggle__hidden open-toggle__hidden--short">{text('open_only_hidden_short', hidden)}</span>
              </>
            )}
          </span>
          <span className="switch" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn--tonal share-vote"
          aria-label={text('share_vote_button')}
          disabled={view.items.length === 0}
          onClick={props.onShareVote}
        >
          <span className="share-vote__full">{text('share_vote_button')}</span>
          <span className="share-vote__short" aria-hidden="true">
            {text('share_vote_short')}
          </span>
        </button>
      </div>
    </header>
  )
}

