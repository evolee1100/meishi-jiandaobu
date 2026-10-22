/**
 * 👥 饭桌模式的规则（安卓 domain/TableGame.kt）：抽签排顺序、✂️ 每人划一刀（轮次、裁判、撤销）、🙈 暗中出拳的判定。
 * 全部是纯函数：每一步回传新的状态，不改旧的。
 */
import { TABLE } from '../data/constants.ts'
import { AVATARS } from '../data/avatars.ts'
import { codePointLength, ktTrim, takeCodePoints } from './chineseText.ts'
import type { AvatarId, HandId } from './model.ts'
import { ALL_HANDS, beats } from './rps.ts'
import { shuffled, type RandomSource } from './random.ts'

export const MIN_PLAYERS = TABLE.MIN_PLAYERS
export const MAX_PLAYERS = TABLE.MAX_PLAYERS
export const MAX_NAME_LENGTH = TABLE.MAX_NAME_LENGTH
export const SECRET_HANDS_PLACES = TABLE.SECRET_HANDS_PLACES

/** 6 个头像的顺序（🐯 永远第一个）。 */
export const ALL_AVATARS: readonly AvatarId[] = AVATARS.map((a) => a.id)

const AVATAR_BY_ID = new Map(AVATARS.map((a) => [a.id, a]))

export function avatarEmoji(avatar: AvatarId): string {
  return AVATAR_BY_ID.get(avatar)?.emoji ?? ''
}

export function avatarDefaultName(avatar: AvatarId): string {
  return AVATAR_BY_ID.get(avatar)?.name ?? ''
}

/** 一个玩家：头像 + 改过的名字（空的 = 用头像原名「老虎」「熊猫」…）。 */
export interface TablePlayer {
  readonly avatar: AvatarId
  readonly customName: string
}

export function tablePlayer(avatar: AvatarId, customName = ''): TablePlayer {
  return { avatar, customName }
}

/** 名字：改过的，没改用原名。 */
export function playerName(player: TablePlayer): string {
  return player.customName || avatarDefaultName(player.avatar)
}

/** 「🐼 熊猫」= emoji + 空格 + 名字。 */
export function playerLabel(player: TablePlayer): string {
  return `${avatarEmoji(player.avatar)} ${playerName(player)}`
}

/** 抽签：0…N−1 洗牌（Kotlin shuffled），每种顺序机会一样。 */
export function drawOrder(players: number, random: RandomSource): number[] {
  if (!(players >= MIN_PLAYERS && players <= MAX_PLAYERS)) throw new Error('players out of range')
  return shuffled(
    random,
    Array.from({ length: players }, (_, i) => i),
  )
}

/** 刀数 = 店数 − 1（剩下最后一家）。 */
export function cutCount(places: number): number {
  return Math.max(places - 1, 0)
}

/** 每一刀轮到谁（玩家下标）：照抽签顺序，刀比人多就从头再来一轮。 */
export function cutters(order: readonly number[], places: number): number[] {
  return Array.from({ length: cutCount(places) }, (_, i) => order[i % order.length] as number)
}

/** 人比刀多：排在后面的人这次当裁判。 */
export function referees(order: readonly number[], places: number): number[] {
  return order.slice(cutCount(places))
}

/**
 * 清理头像名字：连续空白（空格、tab、换行…，Kotlin 的 \s）换成一个空格、去掉前后空白、最多 6 个字（emoji 算 1 个）。
 */
export function cleanName(raw: string): string {
  const oneLine = ktTrim(raw.replace(/[ \t\n\u000B\f\r]+/g, ' '))
  return codePointLength(oneLine) <= MAX_NAME_LENGTH ? oneLine : takeCodePoints(oneLine, MAX_NAME_LENGTH)
}

// ------------------------------------------------------------------ ✂️ 每人划一刀

export interface VetoGame {
  /** 这一局的店（显示顺序）。 */
  readonly placeIds: readonly string[]
  /** 抽到的顺序（玩家下标）。 */
  readonly order: readonly number[]
  /** 已经划掉的店（按顺序）。 */
  readonly cuts: readonly string[]
}

export function newVetoGame(placeIds: readonly string[], order: readonly number[]): VetoGame {
  return { placeIds: [...placeIds], order: [...order], cuts: [] }
}

export function vetoTurns(game: VetoGame): number[] {
  return cutters(game.order, game.placeIds.length)
}

export function vetoReferees(game: VetoGame): number[] {
  return referees(game.order, game.placeIds.length)
}

export function vetoRemaining(game: VetoGame): string[] {
  return game.placeIds.filter((id) => !game.cuts.includes(id))
}

export function vetoIsFinished(game: VetoGame): boolean {
  return vetoRemaining(game).length <= 1
}

/** 轮到谁（玩家下标）；结束了 → null。 */
export function vetoCurrentPlayer(game: VetoGame): number | null {
  if (vetoIsFinished(game)) return null
  return vetoTurns(game)[game.cuts.length] ?? null
}

/** 只剩两家：「最后一刀！」。 */
export function vetoIsLastCut(game: VetoGame): boolean {
  return vetoRemaining(game).length === 2
}

/** 剩下的那一家（结束了才有）。 */
export function vetoWinner(game: VetoGame): string | null {
  const remaining = vetoRemaining(game)
  return remaining.length === 1 ? (remaining[0] as string) : null
}

/** 第 index 刀是谁划的。 */
export function vetoCutterOf(game: VetoGame, index: number): number {
  const who = vetoTurns(game)[index]
  if (who == null) throw new Error('没有第 ' + index + ' 刀')
  return who
}

/** 划掉一家；划过的、不在这局的、已经结束了 → 原样不变。 */
export function vetoCut(game: VetoGame, placeId: string): VetoGame {
  if (vetoIsFinished(game) || !vetoRemaining(game).includes(placeId)) return game
  return { ...game, cuts: [...game.cuts, placeId] }
}

/** 收回最后一刀。 */
export function vetoUndo(game: VetoGame): VetoGame {
  if (game.cuts.length === 0) return game
  return { ...game, cuts: game.cuts.slice(0, -1) }
}

// ------------------------------------------------------------------ 🙈 暗中出拳

export type SecretVerdict =
  /** 全部一样：「全体心有灵犀！」。 */
  | { readonly kind: 'ALL_SAME'; readonly hand: HandId }
  /** 两种手势：照猜拳规则。 */
  | { readonly kind: 'TWO_KINDS'; readonly winner: HandId; readonly loser: HandId }
  /** 三种都有：数人头，最多的那种赢。 */
  | { readonly kind: 'MAJORITY'; readonly hand: HandId; readonly count: number }
  /** 三种都有、最多的并列（2:2:1、2:2:2）：转盘在并列的那几家里决定。 */
  | { readonly kind: 'TIE'; readonly tiedHands: readonly HandId[]; readonly count: number }

/** 赢的手势；打平要转盘时 → null。 */
export function secretWinningHand(verdict: SecretVerdict): HandId | null {
  switch (verdict.kind) {
    case 'ALL_SAME':
      return verdict.hand
    case 'TWO_KINDS':
      return verdict.winner
    case 'MAJORITY':
      return verdict.hand
    case 'TIE':
      return null
  }
}

/** 判定（出的顺序不影响结果；App 不出拳）。 */
export function judgeSecretHands(hands: readonly HandId[]): SecretVerdict {
  if (hands.length === 0) throw new Error('no hands')
  const counts = ALL_HANDS.map((hand) => ({ hand, count: hands.filter((h) => h === hand).length })).filter((c) => c.count > 0)
  if (counts.length === 1) return { kind: 'ALL_SAME', hand: (counts[0] as { hand: HandId }).hand }
  if (counts.length === 2) {
    const a = (counts[0] as { hand: HandId }).hand
    const b = (counts[1] as { hand: HandId }).hand
    return beats(a, b) ? { kind: 'TWO_KINDS', winner: a, loser: b } : { kind: 'TWO_KINDS', winner: b, loser: a }
  }
  const most = Math.max(...counts.map((c) => c.count))
  const top = ALL_HANDS.filter((hand) => counts.some((c) => c.hand === hand && c.count === most))
  if (top.length === 1) return { kind: 'MAJORITY', hand: top[0] as HandId, count: most }
  return { kind: 'TIE', tiedHands: top, count: most }
}

/** 一局饭桌怎么玩的（跟结果放在一起）：玩家、拿手机的顺序、每一刀（✂️）或每人的手势（🙈，翻牌后才有）。 */
export interface TableOutcome {
  readonly players: readonly TablePlayer[]
  readonly order: readonly number[]
  readonly cuts: readonly string[]
  /** 按玩家下标；全部翻开后才有。 */
  readonly hands: readonly HandId[]
}

/** 第 index 刀是谁划的（玩家）。 */
export function outcomeCutter(outcome: TableOutcome, index: number, places: number): TablePlayer {
  const who = cutters(outcome.order, places)[index]
  const player = who == null ? undefined : outcome.players[who]
  if (!player) throw new Error('没有第 ' + index + ' 刀')
  return player
}
