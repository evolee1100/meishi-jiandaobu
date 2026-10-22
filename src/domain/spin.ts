/**
 * 卷轴停在哪（安卓 domain/SpinPlan.kt）和 🎡 转盘（domain/Wheel.kt）：结果先决定好，画面只是转到那个结果上。
 */
import { WHEEL } from '../data/constants.ts'
import { GAME_SYMBOLS } from '../data/uiLiterals.ts'
import { codePointLength, takeCodePoints } from './chineseText.ts'
import { nextInRange, type RandomSource } from './random.ts'
import { floorMod } from './time.ts'

/**
 * 卷轴的目标位置：「≥ 现在 + 圈数 × 格数、而且 mod 格数 = 目标」的最小整数。
 * 例：从 0、3 格、目标 2、5 圈 → 17。
 */
export function spinTarget(currentPos: number, itemCount: number, targetIndex: number, loops: number): number {
  if (!(itemCount > 0)) throw new Error('itemCount must be positive')
  if (!(targetIndex >= 0 && targetIndex < itemCount)) throw new Error('targetIndex out of range')
  if (loops < 0) throw new Error('loops must not be negative')
  const earliest = currentPos + loops * itemCount
  return earliest + floorMod(targetIndex - earliest, itemCount)
}

/** 转盘停在哪：先抽好的格子、转多久、格子里偏多少（−0.35 … 0.35 格，永远不停在线上）。 */
export interface WheelSpin {
  readonly target: number
  readonly segments: number
  readonly millis: number
  readonly offset: number
}

export const WHEEL_SPIN_MS = WHEEL.SPIN_MS
export const WHEEL_LOOPS = WHEEL.LOOPS
const MAX_OFFSET = Math.fround(WHEEL.MAX_OFFSET)

/** 每格一样机会（随机顺序：格子 nextInt(格数) → 时长 → 偏移 nextFloat）。 */
export function wheelSpin(random: RandomSource, segments: number, millis: readonly [number, number] = WHEEL_SPIN_MS): WheelSpin {
  if (segments < 1) throw new Error('no segments')
  const target = random.nextInt(segments)
  const ms = nextInRange(random, millis)
  const offset = Math.fround(Math.fround(Math.fround(random.nextFloat() * 2) - 1) * MAX_OFFSET)
  return { target, segments, millis: ms, offset }
}

/** 一样转，但停在别处定好的格子。 */
export function wheelSpinTo(random: RandomSource, target: number, segments: number, millis: readonly [number, number] = WHEEL_SPIN_MS): WheelSpin {
  return { ...wheelSpin(random, segments, millis), target }
}

export function segmentDegrees(segments: number): number {
  return Math.fround(360 / segments)
}

/** 转盘顺时针转了 rotation 度以后，指针指着第几格。 */
export function segmentAt(rotation: number, segments: number): number {
  const atPointer = (((-Math.fround(rotation)) % 360) + 360) % 360
  const index = Math.floor(atPointer / segmentDegrees(segments))
  return Math.min(Math.max(index, 0), segments - 1)
}

/** 停下的角度：从 current 起至少转 loops 圈，再让指针落在目标格（加偏移）。 */
export function stopRotation(current: number, spin: WheelSpin, loops = WHEEL_LOOPS): number {
  const f = Math.fround
  const seg = segmentDegrees(spin.segments)
  const wanted = f(-f(f(f(spin.target + 0.5) + spin.offset) * seg))
  const earliest = f(f(current) + f(loops * 360))
  const delta = f(f(f(f(wanted - earliest) % 360) + 360) % 360)
  return f(earliest + delta)
}

/** 转盘格子上的名字：最多 n 个字（按码位），多了截掉加「…」（店名 5 个字，谁来做 6 个字）。 */
export function shortWheelLabel(name: string, chars: number = WHEEL.LABEL_CHARS): string {
  return codePointLength(name) <= chars ? name : takeCodePoints(name, chars) + GAME_SYMBOLS.ellipsis
}
