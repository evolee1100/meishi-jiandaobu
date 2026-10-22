/**
 * 游戏画面共用的小零件（安卓 DuelOverlay.kt 的 DuelHeading、SkippedNote、SmallRank，和赢家「跳两下」）。
 */
import { useLayoutEffect, type RefObject } from 'react'
import { statusOf, type DuelState, type ResultItem, type ResultsState } from '../../app/state.ts'
import { shortName, skippedNotes } from '../../app/texts.ts'
import { GAME_SYMBOLS } from '../../data/uiLiterals.ts'
import { isClosed } from '../../domain/openingHours.ts'
import { playAnimation } from '../../lib/motion.ts'
import { PhraseText } from '../../ui/PhraseText.tsx'

/** 游戏顶上的标题（最粗、主色）和规则（灰），都按短句换行；双栏时小一号。 */
export function GameHeading({ title, rule, small = false, id }: { readonly title: string; readonly rule: string; readonly small?: boolean; readonly id?: string }) {
  return (
    <div className={`game-heading${small ? ' game-heading--small' : ''}`}>
      <PhraseText as="h2" id={id} className="game-heading__title" text={title} />
      {rule !== '' && <PhraseText as="p" className="game-heading__rule" text={rule} />}
    </div>
  )
}

/**
 * 「😴 已跳过休息中的『麻辣火锅坊』」「😴 已跳过快关门、过去来不及的『阿明海南鸡饭』」（帮我挑一家、转盘才有）。
 * 是哪一种按现在的时间判断。
 */
export function SkippedNote({ duel, results }: { readonly duel: DuelState; readonly results: ResultsState }) {
  if (duel.skippedIds.length === 0) return null
  const items = duel.skippedIds
    .map((id) => results.ranked.find((item) => item.place.id === id) ?? null)
    .filter((item): item is ResultItem => item != null)
  const closed = items.filter((item) => isClosed(statusOf(results, item.place))).map(shortName)
  const late = items.filter((item) => !isClosed(statusOf(results, item.place))).map(shortName)
  const lines = skippedNotes({ closed, late })
  if (lines.length === 0) return null
  return (
    <div className="skipped-note">
      {lines.map((line) => (
        <PhraseText key={line} as="p" className="skipped-note__line" text={line} />
      ))}
    </div>
  )
}

/** 🥇🥈🥉，第 4 名起是一个小圆圈里的数字（读屏不念，名次另外念）。 */
export function SmallRank({ rank, className }: { readonly rank: number; readonly className?: string }) {
  const medal = GAME_SYMBOLS.medals[rank - 1]
  return medal ? (
    <span className={`small-rank small-rank--medal${className ? ' ' + className : ''}`} aria-hidden="true">
      {medal}
    </span>
  ) : (
    <span className={`small-rank${className ? ' ' + className : ''}`} aria-hidden="true">
      {rank}
    </span>
  )
}

/** 赢的那张卡跳两下（600 毫秒：150 到 1.1、300 回 1、450 到 1.1、600 回 1）。减少动画时不跳。 */
export function useWinnerBounce(ref: RefObject<HTMLElement | null>, winner: boolean): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!winner || !el) return
    const animation = playAnimation(
      el,
      [
        { transform: 'scale(1)', offset: 0 },
        { transform: 'scale(1.1)', offset: 0.25 },
        { transform: 'scale(1)', offset: 0.5 },
        { transform: 'scale(1.1)', offset: 0.75 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: 600, easing: 'ease-in-out' },
    )
    return () => animation?.cancel()
  }, [ref, winner])
}
