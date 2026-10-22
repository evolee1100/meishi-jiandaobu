/**
 * 🎲 帮我挑一家（安卓 DuelOverlay.RouletteBoard，功能清单 12.6）：两家轮流亮灯，停在哪家就吃哪家。
 * 一打开就由状态层决定好停在哪家；这里等 0.3 秒，亮灯从第 0 格转到 SpinPlan.target(0, 2, 赢家, 6 圈)，
 * 1.5–1.9 秒、越来越慢（EaseOutQuart）；亮的那张放大一点、主色框，暗的变淡；停下震一下，写「停在这一家！」，
 * 赢的那张跳两下、右上角 🏆。减少动画：等 0.3 秒直接停在结果。
 */
import { useEffect, useRef, useState } from 'react'
import { rankIn, statusOf, type DuelState, type ResultItem, type ResultsState } from '../../app/state.ts'
import { choiceEmoji, shortName, text } from '../../app/texts.ts'
import { DUEL } from '../../data/constants.ts'
import { formatFixed } from '../../data/javaFormat.ts'
import { GAME_SYMBOLS, PREFIXES, SEPARATORS } from '../../data/uiLiterals.ts'
import { formatDistance } from '../../domain/geo.ts'
import { spinTarget } from '../../domain/spin.ts'
import { floorMod } from '../../domain/time.ts'
import { easeOutQuart } from '../../lib/easing.ts'
import { PlaceThumb } from '../results/PlaceParts.tsx'
import { GameHeading, SkippedNote, SmallRank, useWinnerBounce } from './GameParts.tsx'
import type { DuelPhase } from './phase.ts'

export interface RouletteBoardProps {
  readonly duel: DuelState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly phase: DuelPhase
  readonly twoPane: boolean
  readonly reducedMotion: boolean
  /** 灯停下了（震一下、进「揭晓」）。 */
  readonly onStopped: () => void
}

export function RouletteBoard({ duel, places, results, phase, twoPane, reducedMotion, onStopped }: RouletteBoardProps) {
  const stopped = phase === 'REVEAL' || phase === 'RESULT'
  const winner = duel.winnerIndex ?? 0
  const [lit, setLit] = useState(stopped ? winner : 0)
  const onStoppedRef = useRef(onStopped)
  onStoppedRef.current = onStopped
  const started = useRef(false)

  useEffect(() => {
    if (phase !== 'SPIN' || started.current) return
    started.current = true
    const target = spinTarget(0, places.length, winner, DUEL.ROULETTE_REEL_LOOPS)
    let frame = 0
    let startedAt = 0
    const finish = () => {
      setLit(winner)
      onStoppedRef.current()
    }
    const step = () => {
      const t = Math.min((performance.now() - startedAt) / duel.spinMillis, 1)
      const position = target * easeOutQuart(t)
      setLit(floorMod(Math.floor(position), places.length))
      if (t < 1) frame = requestAnimationFrame(step)
      else finish()
    }
    const timer = setTimeout(() => {
      if (reducedMotion) {
        finish()
        return
      }
      startedAt = performance.now()
      frame = requestAnimationFrame(step)
    }, DUEL.ROULETTE_START_DELAY_MS)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
    // 每一局只转一次
  }, [phase, duel.round])

  const shownLit = stopped ? winner : lit
  const title = text(duel.fromBasket ? 'roulette_title_basket' : 'roulette_title')
  const rule = text('roulette_rule')
  const cards = (
    <div className="roulette-cards">
      {places.map((item, index) => (
        <RouletteCard
          key={item.place.id}
          item={item}
          rank={rankIn(results, duel, item.place.id)}
          hoursUnknown={statusOf(results, item.place).kind === 'UNKNOWN'}
          emoji={item.place.placeholderEmoji ?? choiceEmoji(results.choice)}
          lit={index === shownLit}
          winner={stopped && index === shownLit}
        />
      ))}
    </div>
  )
  const status = (
    <div className="game-status" aria-live="polite">
      {stopped && <p className="game-status__stop">{text('roulette_stop')}</p>}
    </div>
  )
  if (twoPane) {
    return (
      <div className="game-panes game-panes--wide-end">
        <div className="game-pane game-pane--start">
          <GameHeading title={title} rule={rule} small id="game-title" />
          <SkippedNote duel={duel} results={results} />
          {status}
        </div>
        <div className="game-pane game-pane--end">{cards}</div>
      </div>
    )
  }
  return (
    <>
      <GameHeading title={title} rule={rule} id="game-title" />
      <SkippedNote duel={duel} results={results} />
      {cards}
      {status}
    </>
  )
}

function RouletteCard({
  item,
  rank,
  hoursUnknown,
  emoji,
  lit,
  winner,
}: {
  readonly item: ResultItem
  readonly rank: number
  readonly hoursUnknown: boolean
  readonly emoji: string
  readonly lit: boolean
  readonly winner: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useWinnerBounce(ref, winner)
  const place = item.place
  const facts = [place.rating != null ? `${PREFIXES.rating}${formatFixed(place.rating, 1)}` : null, formatDistance(place.distanceMeters)]
    .filter((piece): piece is string => piece != null)
    .join(SEPARATORS.dot)
  return (
    <div ref={ref} className={`roulette-card${lit ? ' is-lit' : ''}${winner ? ' is-winner' : ''}`} aria-current={lit ? 'true' : undefined}>
      <div className="roulette-card__thumb">
        <PlaceThumb item={item} emoji={emoji} />
      </div>
      <SmallRank rank={rank} />
      <p className="roulette-card__name">{shortName(item)}</p>
      <p className="roulette-card__facts">{facts}</p>
      <p className="roulette-card__rank">{text('duel_rank', rank)}</p>
      {hoursUnknown && <p className="roulette-card__unknown">{text('open_unknown')}</p>}
      {winner && (
        <span className="roulette-card__cup" aria-hidden="true">
          {GAME_SYMBOLS.winnerCup}
        </span>
      )}
    </div>
  )
}
