/**
 * ✊✌️🖐️ 剪刀石头布、🎲 帮我挑一家、台词（安卓 domain/RockPaperScissors.kt）。
 * 一个手势代表一家店：✊ = 第 1 家、✌️ = 第 2 家、🖐️ = 第 3 家。
 */
import { DUEL } from '../data/constants.ts'
import { DUEL_LINES, VEGETARIAN_TYPES } from '../data/duelLines.ts'
import { HANDS } from '../data/avatars.ts'
import type { DuelVerdictId, HandId, Place } from './model.ts'
import { nextInRange, pickOne, type RandomSource } from './random.ts'

/** ✊、✌️、🖐️ 的顺序（安卓 Hand.entries）。 */
export const ALL_HANDS: readonly HandId[] = HANDS.map((h) => h.id)

const HAND_BY_ID = new Map(HANDS.map((h) => [h.id, h]))

export function handEmoji(hand: HandId): string {
  return HAND_BY_ID.get(hand)?.emoji ?? ''
}

/** 「石头」「剪刀」「布」。 */
export function handName(hand: HandId): string {
  return HAND_BY_ID.get(hand)?.name ?? ''
}

/** 石头赢剪刀，剪刀赢布，布赢石头。 */
export function beats(hand: HandId, other: HandId): boolean {
  switch (hand) {
    case 'ROCK':
      return other === 'SCISSORS'
    case 'SCISSORS':
      return other === 'PAPER'
    case 'PAPER':
      return other === 'ROCK'
  }
}

/** 代表第 index 家（0 起）的手势。 */
export function handForPlaceIndex(index: number): HandId {
  const hand = ALL_HANDS[index]
  if (hand == null) throw new Error('没有第 ' + index + ' 个手势')
  return hand
}

/** 这个手势代表第几家（0 起）。 */
export function placeIndexOf(hand: HandId): number {
  return ALL_HANDS.indexOf(hand)
}

/** 一局：你出 user、App 出 app。赢的手势代表的店就是今天吃的；平手 = 两人出的那家。 */
export interface DuelOutcome {
  readonly user: HandId
  readonly app: HandId
}

export function isTie(outcome: DuelOutcome): boolean {
  return outcome.user === outcome.app
}

export function winningHand(outcome: DuelOutcome): HandId {
  return isTie(outcome) || beats(outcome.user, outcome.app) ? outcome.user : outcome.app
}

export function winnerIndexOf(outcome: DuelOutcome): number {
  return placeIndexOf(winningHand(outcome))
}

export function judge(user: HandId, app: HandId): DuelOutcome {
  return { user, app }
}

/** App 随机出一个手势（random.nextInt(3)）。 */
export function play(user: HandId, random: RandomSource): DuelOutcome {
  return judge(user, pickOne(random, ALL_HANDS))
}

/** 帮我挑一家：0 或 1，一样机会。 */
export function pickOfTwo(random: RandomSource): number {
  return random.nextInt(2)
}

export const RPS_SPIN_MS = DUEL.RPS_SPIN_MS
export const ROULETTE_SPIN_MS = DUEL.ROULETTE_SPIN_MS

/** 转多久（两端都含）。 */
export function spinMillis(random: RandomSource, range: readonly [number, number]): number {
  return nextInRange(random, range)
}

/** 这一局对用户来说怎么定的：赢、输、平手、帮我挑一家（转盘也算）、大家一起定（饭桌、投票）。 */
export function verdictOf(outcome: DuelOutcome | null): DuelVerdictId {
  if (outcome == null) return 'ROULETTE'
  if (isTie(outcome)) return 'TIE'
  if (beats(outcome.user, outcome.app)) return 'WIN'
  return 'LOSE'
}

export type DuelLineId = (typeof DUEL_LINES)[number]['id']

const LINE_BY_ID = new Map(DUEL_LINES.map((l) => [l.id, l]))

export function lineVerdict(line: string): DuelVerdictId | null {
  return LINE_BY_ID.get(line)?.verdict ?? null
}

export function lineText(line: string): string {
  return LINE_BY_ID.get(line)?.text ?? ''
}

/**
 * 抽一句台词：输了而且赢的是素食店 → 一定是「乖乖去吃素吧 🥦」；否则在这一组里平均抽（不含那句）。
 * 「剩下的就是缘分 🍀」只给 ✂️ 每人划一刀（leftAfterCuts）。
 */
export function pickLine(
  verdict: DuelVerdictId,
  random: RandomSource,
  winnerIsVegetarian = false,
  leftAfterCuts = true,
): string {
  if (verdict === 'LOSE' && winnerIsVegetarian) return 'LOSE_VEGETARIAN'
  const lines = DUEL_LINES.filter(
    (l) => l.verdict === verdict && l.id !== 'LOSE_VEGETARIAN' && (leftAfterCuts || l.id !== 'TABLE_2'),
  )
  return pickOne(random, lines).id
}

const VEGETARIAN = new Set(VEGETARIAN_TYPES)

/** 素食店（primaryType 或 types 有 vegetarian_restaurant / vegan_restaurant）。 */
export function isVegetarian(place: Place): boolean {
  return (place.primaryType != null && VEGETARIAN.has(place.primaryType)) || place.types.some((t) => VEGETARIAN.has(t))
}
