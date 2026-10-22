/**
 * 游戏层的阶段（安卓 DuelOverlay.DuelPhase）：选择 → 转 → 揭晓（停一下看谁赢）→ 结果。
 * 阶段只看状态层的那一局（不看画面自己存的），免得旧一局的「播完了」套到新一局。
 */
import type { DuelState } from '../../app/state.ts'
import { DUEL } from '../../data/constants.ts'

export type DuelPhase = 'CHOOSE' | 'SPIN' | 'REVEAL' | 'RESULT'

/** 这一局有转盘（🎡，或投票平票的转盘）。 */
export function hasWheel(duel: DuelState): boolean {
  return duel.mode === 'WHEEL' || (duel.mode === 'VOTE' && duel.wheel != null)
}

/**
 * 一局打开（或出了拳、按了「转！」）时从哪个阶段开始：已经播完的（再显示）直接看结果；
 * 剪刀石头布还没出拳、转盘还没按「转！」→ 选择；饭桌模式自己播过了、投票没平票 → 直接揭晓；其他 → 转。
 */
export function initialPhase(duel: DuelState): DuelPhase {
  if (duel.animationDone) return 'RESULT'
  if (duel.mode === 'ROCK_PAPER_SCISSORS' && duel.userHand == null) return 'CHOOSE'
  if (duel.mode === 'WHEEL' && duel.wheel == null) return 'CHOOSE'
  if (duel.mode === 'VETO' || duel.mode === 'SECRET_HANDS') return 'REVEAL'
  if (duel.mode === 'VOTE' && duel.wheel == null) return 'REVEAL'
  return 'SPIN'
}

/** 停下以后，停多久才进「就这一家吧！」：剪刀石头布 1.5 秒；帮我挑一家、转盘 1 秒；饭桌、投票马上。 */
export function revealMillis(duel: DuelState): number {
  if (duel.mode === 'ROCK_PAPER_SCISSORS') return DUEL.RPS_REVEAL_MS
  if (hasWheel(duel) || duel.mode === 'ROULETTE') return DUEL.ROULETTE_REVEAL_MS
  return 0
}

/** 阶段跟着哪些东西重来：新的一局、出了拳、转盘抽好了。 */
export function phaseKey(duel: DuelState): string {
  const spin = duel.wheel
  return `${duel.round}|${duel.userHand ?? ''}|${spin ? `${spin.target}:${spin.millis}:${spin.offset}` : ''}`
}
