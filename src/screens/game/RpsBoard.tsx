/**
 * ✊✌️🖐️ 一个人和 App 剪刀石头布（安卓 DuelOverlay.RockPaperScissorsBoard，功能清单 12.5）。
 * 一个手势代表一家店：✊ = 第 1 家、✌️ = 第 2 家、🖐️ = 第 3 家；你先出，App 随机出，赢的手势代表的店就是今天吃的。
 *
 * - App 的手：等你出拳时是 ❓；出了拳 → 老虎机卷轴 ✊✌️🖐️ 越转越慢（1.5–2 秒、至少 5 圈），整个圆左右抖；
 *   停下 → 一下子放大到 1.45 倍再弹回来，手机震一下；
 * - 下面「VS」→ 停了以后换成大字判定「你出 ✊，我出 ✌️ → 石头赢！」/「…→ 心有灵犀！」；
 * - 你的三个手势：卡上写手势名、店名、第几家（营业时间不明时「营业时间不明，小心白走」）；
 *   出了以后选的那张放大一点、其他变淡；揭晓后赢的那张跳两下、右上角 🏆；
 * - 还没出拳时下面有「👥 几个人一起？改用饭桌模式，人人都有份」。
 * App 出什么、赢家、台词在按下去那一刻就由状态层决定好了，这里只是把动画播到那个结果。卷轴用 Web Animations。
 */
import { useLayoutEffect, useRef } from 'react'
import { duelOutcome, rankIn, statusOf, type DuelState, type ResultItem, type ResultsState } from '../../app/state.ts'
import { decisionVerdict, shortName, text } from '../../app/texts.ts'
import { DUEL } from '../../data/constants.ts'
import { GAME_SYMBOLS } from '../../data/uiLiterals.ts'
import type { HandId } from '../../domain/model.ts'
import { ALL_HANDS, handEmoji, handForPlaceIndex, handName, placeIndexOf } from '../../domain/rps.ts'
import { spinTarget } from '../../domain/spin.ts'
import { floorMod } from '../../domain/time.ts'
import { onAnimationDone, playAnimation } from '../../lib/motion.ts'
import { PhraseText } from '../../ui/PhraseText.tsx'
import { GameHeading, SmallRank, useWinnerBounce } from './GameParts.tsx'
import type { DuelPhase } from './phase.ts'

export interface RpsBoardProps {
  readonly duel: DuelState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly phase: DuelPhase
  readonly compact: boolean
  readonly twoPane: boolean
  readonly onPlayHand: (hand: HandId) => void
  /** App 的手停下了（震一下、进「揭晓」）。 */
  readonly onHandStopped: () => void
  readonly onSwitchToTable: () => void
}

export function RpsBoard({ duel, places, results, phase, compact, twoPane, onPlayHand, onHandStopped, onSwitchToTable }: RpsBoardProps) {
  const title = text(duel.fromBasket ? 'duel_title_basket' : 'duel_title')
  const rule = text('duel_rule')
  // 饭桌模式用现在列表上的店：之前那次搜索的局不给切换。
  const canSwitch = phase === 'CHOOSE' && places.every((item) => results.ranked.some((r) => r.place.id === item.place.id))
  const handSize = twoPane ? 76 : compact ? 96 : 112
  const app = (
    <>
      <AppHand round={duel.round} phase={phase} appHand={duel.appHand} millis={duel.spinMillis} size={handSize} onStopped={onHandStopped} />
      <AppHandStatus duel={duel} places={places} results={results} phase={phase} />
    </>
  )
  const hands = (
    <>
      <UserHands duel={duel} places={places} results={results} phase={phase} onPlayHand={onPlayHand} />
      {canSwitch && (
        <button type="button" className="btn btn--tonal btn--block game-switch-table" onClick={onSwitchToTable}>
          <PhraseText text={text('duel_switch_table')} />
        </button>
      )}
    </>
  )
  if (twoPane) {
    return (
      <div className="game-panes game-panes--wide-end">
        <div className="game-pane game-pane--start">
          <GameHeading title={title} rule={rule} small id="game-title" />
          {app}
        </div>
        <div className="game-pane game-pane--end">{hands}</div>
      </div>
    )
  }
  return (
    <>
      <GameHeading title={title} rule={rule} id="game-title" />
      {app}
      {hands}
    </>
  )
}

/** 「我（App）：等你先出拳哦…」→「我出什么呢…」→「我出 ✌️ 剪刀！」；下面「VS」，停了以后换成判定（读屏会念）。 */
function AppHandStatus({ duel, places, results, phase }: { readonly duel: DuelState; readonly places: readonly ResultItem[]; readonly results: ResultsState; readonly phase: DuelPhase }) {
  const appHand = duel.appHand
  const revealed = phase === 'REVEAL' || phase === 'RESULT'
  const line =
    phase === 'CHOOSE' || appHand == null
      ? text('duel_app_waiting')
      : phase === 'SPIN'
        ? text('duel_app_thinking')
        : text('duel_app_shown', handEmoji(appHand), handName(appHand))
  return (
    <>
      <p className="app-hand-status" aria-live="polite">
        {line}
      </p>
      <div className="vs-box" aria-live="polite">
        {revealed && duelOutcome(duel) ? (
          <PhraseText key="verdict" className="vs-box__verdict" text={decisionVerdict(duel, places, (id) => rankIn(results, duel, id))} />
        ) : (
          <span key="vs" className="vs-box__vs">
            {text('duel_vs')}
          </span>
        )}
      </div>
    </>
  )
}

/**
 * App 的手：一个圆（等你出拳时 ❓）。转的时候是一条 ✊✌️🖐️ 的长卷轴往上滑、越来越慢（Web Animations，
 * EaseOutQuart），上下邻居越远越淡；停下弹一下（1.45 → 1，弹簧）。
 */
function AppHand({
  round,
  phase,
  appHand,
  millis,
  size,
  onStopped,
}: {
  readonly round: number
  readonly phase: DuelPhase
  readonly appHand: HandId | null
  readonly millis: number
  readonly size: number
  readonly onStopped: () => void
}) {
  const circleRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const onStoppedRef = useRef(onStopped)
  onStoppedRef.current = onStopped
  const stopped = phase === 'REVEAL' || phase === 'RESULT'
  const target = appHand == null ? 0 : spinTarget(0, ALL_HANDS.length, placeIndexOf(appHand), DUEL.RPS_REEL_LOOPS)
  // 卷轴上的格子：第 -1 格（上面的邻居）到第 target + 1 格（下面的邻居）
  const cells = target + 3
  const shiftFor = (k: number) => `translateY(${(-(k + 1) / cells) * 100}%)`
  const spun = useRef(false)

  // 转：从第 0 格转到第 target 格；转完叫 onStopped（减少动画：马上转完）。
  useLayoutEffect(() => {
    if (phase !== 'SPIN' || appHand == null || spun.current) return
    spun.current = true
    const strip = stripRef.current
    const animation = strip
      ? playAnimation(strip, [{ transform: shiftFor(0) }, { transform: shiftFor(target) }], {
          duration: millis,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          fill: 'forwards',
        })
      : null
    if (!animation) {
      onStoppedRef.current()
      return
    }
    return onAnimationDone(animation, () => onStoppedRef.current())
    // 每一局只转一次（这个画面跟着那一局）
  }, [phase, appHand, round])

  // 停下：弹一下（一下子放大到 1.45 倍，再像弹簧一样回到 1）。
  const popped = useRef(stopped)
  useLayoutEffect(() => {
    if (!stopped || popped.current) return
    popped.current = true
    const circle = circleRef.current
    if (!circle) return
    playAnimation(
      circle,
      [
        { transform: 'scale(1.45)', offset: 0 },
        { transform: 'scale(0.86)', offset: 0.3 },
        { transform: 'scale(1.08)', offset: 0.55 },
        { transform: 'scale(0.97)', offset: 0.78 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: 650, easing: 'ease-out' },
    )
  }, [stopped])

  return (
    <div
      ref={circleRef}
      className={`app-hand${phase === 'SPIN' ? ' is-spinning' : ''}${stopped ? ' is-stopped' : ''}`}
      style={{ ['--hand-size' as string]: `${size}px` }}
      aria-hidden="true"
    >
      {phase === 'CHOOSE' || appHand == null ? (
        <span className="app-hand__emoji">{GAME_SYMBOLS.unknownHand}</span>
      ) : (
        <div className="app-hand__window">
          <div
            ref={stripRef}
            className="app-hand__strip"
            style={{ height: `${cells * 100}%`, transform: shiftFor(stopped ? target : 0) }}
          >
            {Array.from({ length: cells }, (_, i) => (
              <span key={i} className="app-hand__cell" style={{ height: `${100 / cells}%` }}>
                {handEmoji(ALL_HANDS[floorMod(i - 1, ALL_HANDS.length)] as HandId)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 你的三个手势，一个代表一家；还没出拳时下面「👆 点一个手势出拳」。 */
function UserHands({
  duel,
  places,
  results,
  phase,
  onPlayHand,
}: {
  readonly duel: DuelState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly phase: DuelPhase
  readonly onPlayHand: (hand: HandId) => void
}) {
  const revealed = phase === 'REVEAL' || phase === 'RESULT'
  const winnerIndex = revealed ? duel.winnerIndex : null
  return (
    <>
      <div className="hand-cards">
        {places.map((item, index) => {
          const hand = handForPlaceIndex(index)
          const chosen = hand === duel.userHand
          const opacity = winnerIndex != null ? (index === winnerIndex ? 1 : 0.35) : phase === 'SPIN' ? (chosen ? 1 : 0.45) : 1
          return (
            <HandCard
              key={item.place.id}
              hand={hand}
              item={item}
              rank={rankIn(results, duel, item.place.id)}
              hoursUnknown={statusOf(results, item.place).kind === 'UNKNOWN'}
              chosen={chosen}
              winner={index === winnerIndex}
              opacity={opacity}
              enabled={phase === 'CHOOSE'}
              onClick={() => onPlayHand(hand)}
            />
          )
        })}
      </div>
      {phase === 'CHOOSE' && <p className="hand-hint">{text('duel_pick_hint')}</p>}
    </>
  )
}

function HandCard({
  hand,
  item,
  rank,
  hoursUnknown,
  chosen,
  winner,
  opacity,
  enabled,
  onClick,
}: {
  readonly hand: HandId
  readonly item: ResultItem
  readonly rank: number
  readonly hoursUnknown: boolean
  readonly chosen: boolean
  readonly winner: boolean
  readonly opacity: number
  readonly enabled: boolean
  readonly onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  useWinnerBounce(ref, winner)
  const name = shortName(item)
  return (
    <button
      ref={ref}
      type="button"
      className={`hand-card${chosen ? ' is-chosen' : ''}${winner ? ' is-winner' : ''}`}
      style={{ opacity }}
      disabled={!enabled}
      aria-label={text('duel_hand_a11y', handName(hand), rank, name)}
      onClick={onClick}
    >
      <SmallRank rank={rank} className="hand-card__rank" />
      {winner && (
        <span className="hand-card__cup" aria-hidden="true">
          {GAME_SYMBOLS.winnerCup}
        </span>
      )}
      <span className="hand-card__emoji" aria-hidden="true">
        {handEmoji(hand)}
      </span>
      <span className="hand-card__hand">{handName(hand)}</span>
      <span className="hand-card__name">{name}</span>
      <span className="hand-card__rank-text">{text('duel_rank', rank)}</span>
      {hoursUnknown && <PhraseText className="hand-card__unknown" text={text('open_unknown_careful')} />}
    </button>
  )
}
