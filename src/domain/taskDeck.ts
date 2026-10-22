/**
 * 🃏 饭桌任务卡、🎯 谁来做、📊 今天的战绩（安卓 domain/TaskDeck.kt）。
 */
import { FREE_PASS, FREE_PASS_CHANCE, FREE_PASS_TEXT, TASK_CARDS, TASK_DECK_SIZE } from '../data/taskCards.ts'
import type { DuelVerdictId } from './model.ts'
import type { RandomSource } from './random.ts'
import type { WheelSpin } from './spin.ts'
import type { TablePlayer } from './table.ts'

export { FREE_PASS, TASK_DECK_SIZE } from '../data/taskCards.ts'

/** 抽一张：先掷 [0,1) 小数 < 0.05 → 免死金牌，否则 24 张里平均抽一张（下标）。 */
export function drawTaskCard(random: RandomSource): number {
  return random.nextDouble() < FREE_PASS_CHANCE ? FREE_PASS : random.nextInt(TASK_DECK_SIZE)
}

/** 卡上的字。 */
export function taskCardText(card: number): string {
  if (card === FREE_PASS) return FREE_PASS_TEXT
  const found = TASK_CARDS[card]
  if (!found) throw new Error('没有这张任务卡：' + card)
  return found.text
}

/** 这一局抽到的卡，和（转了「谁来做」以后）谁来做。 */
export interface TaskDraw {
  readonly card: number
  /** 转盘上的人（饭桌的玩家，或用户说的几个人）。 */
  readonly players: readonly TablePlayer[]
  /** 谁来做的转盘；还没转是 null。 */
  readonly spin: WheelSpin | null
  /** 转盘在画面上停好了（再显示时直接停在结果）。 */
  readonly spun: boolean
}

export function taskDraw(card: number, players: readonly TablePlayer[] = [], spin: WheelSpin | null = null, spun = false): TaskDraw {
  return { card, players: [...players], spin, spun }
}

export function isFreePass(task: TaskDraw): boolean {
  return task.card === FREE_PASS
}

/** 转好了以后谁来做。 */
export function taskAssignee(task: TaskDraw): TablePlayer | null {
  if (!task.spin) return null
  return task.players[task.spin.target] ?? null
}

/** 今天和 App 猜拳的战绩（只数一个人和 App 猜拳；按本机日期，第二天从 0 开始）。 */
export interface DayStats {
  readonly day: string
  readonly wins: number
  readonly losses: number
  readonly ties: number
}

export const EMPTY_DAY_STATS: DayStats = { day: '', wins: 0, losses: 0, ties: 0 }

export function dayStatsIsEmpty(stats: DayStats): boolean {
  return stats.wins + stats.losses + stats.ties === 0
}

/** 今天（ISO 日期）的战绩：不是今天的就从 0 开始。 */
export function dayStatsOn(stats: DayStats, today: string): DayStats {
  return stats.day === today ? stats : { day: today, wins: 0, losses: 0, ties: 0 }
}

/** 又和 App 猜了一局。帮我挑一家、转盘、饭桌不算。 */
export function recordDayStats(stats: DayStats, today: string, verdict: DuelVerdictId): DayStats {
  const current = dayStatsOn(stats, today)
  switch (verdict) {
    case 'WIN':
      return { ...current, wins: current.wins + 1 }
    case 'LOSE':
      return { ...current, losses: current.losses + 1 }
    case 'TIE':
      return { ...current, ties: current.ties + 1 }
    default:
      return current
  }
}
