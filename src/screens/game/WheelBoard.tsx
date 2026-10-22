/**
 * 🎡 幸运大转盘（安卓 DuelOverlay.WheelBoard，功能清单 12.7）：圈了 4–6 家能去的，每家一格，中间按「转！」。
 * 投票平票也用它：标题「平票！App 来当判官 ⚖️」、规则是票数，只在打平的几家里转、没有中间的钮（自己转）。
 * 下面一行：「转！ 👆」→「转啊转…」→「停在这一家！」（读屏会念）。
 */
import { type DuelState, type ResultItem, type ResultsState, wheelIndices } from '../../app/state.ts'
import { choiceEmoji, shortName, text, votePieces } from '../../app/texts.ts'
import { GAME_SYMBOLS } from '../../data/uiLiterals.ts'
import { voteMarkersOf } from '../../domain/vote.ts'
import { GameHeading, SkippedNote } from './GameParts.tsx'
import { LuckyWheel, type WheelSegment } from './LuckyWheel.tsx'
import type { DuelPhase } from './phase.ts'

export interface WheelBoardProps {
  readonly duel: DuelState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly phase: DuelPhase
  readonly twoPane: boolean
  readonly reducedMotion: boolean
  readonly onSpin: () => void
  /** 转盘停好了（进「揭晓」）。 */
  readonly onStopped: () => void
}

export function WheelBoard({ duel, places, results, phase, twoPane, reducedMotion, onSpin, onStopped }: WheelBoardProps) {
  const vote = duel.mode === 'VOTE'
  const title = vote ? text('vote_tie_title') : text('wheel_title_basket', places.length)
  const rule = vote ? (duel.vote ? votePieces(voteMarkersOf(duel.vote), duel.vote.counts) : '') : text('wheel_rule')
  const segments: WheelSegment[] = wheelIndices(duel).map((index) => {
    const item = places[index]
    return { emoji: item?.place.placeholderEmoji ?? choiceEmoji(results.choice), label: item ? shortName(item) : '' }
  })
  const canSpin = phase === 'CHOOSE'
  const wheel = (
    <LuckyWheel
      segments={segments}
      spin={duel.wheel}
      play={phase === 'SPIN'}
      reducedMotion={reducedMotion}
      onStopped={() => {
        if (phase === 'SPIN') onStopped()
      }}
      // 投票平票自己转：没有中间的「转！」，名字有更多地方
      hub={!vote}
      center={
        vote ? null : (
          <button type="button" className="wheel-spin-btn" disabled={!canSpin} aria-label={text('wheel_spin_a11y')} onClick={onSpin}>
            <span aria-hidden="true">{text('wheel_spin')}</span>
          </button>
        )
      }
      description={title}
      maxSize={twoPane ? 260 : 340}
      className="game-wheel"
      testId="duel-wheel"
    />
  )
  const status = (
    <div className="game-status" aria-live="polite">
      {phase === 'REVEAL' || phase === 'RESULT' ? (
        <p className="game-status__stop">{text('wheel_stop')}</p>
      ) : phase === 'SPIN' ? (
        <p className="game-status__spinning">{text('wheel_spinning')}</p>
      ) : (
        <p className="game-status__hint">{text('wheel_spin') + GAME_SYMBOLS.spinHintSuffix}</p>
      )}
    </div>
  )
  if (twoPane) {
    return (
      <div className="game-panes">
        <div className="game-pane game-pane--start">
          <GameHeading title={title} rule={rule} small id="game-title" />
          <SkippedNote duel={duel} results={results} />
          {status}
        </div>
        <div className="game-pane game-pane--end">{wheel}</div>
      </div>
    )
  }
  return (
    <>
      <GameHeading title={title} rule={rule} id="game-title" />
      <SkippedNote duel={duel} results={results} />
      {wheel}
      {status}
    </>
  )
}
