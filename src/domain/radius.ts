/**
 * 搜索范围（安卓 data/Prefs.kt 的 RadiusOptions）：0.5–5 公里，每格 0.5；默认 1.5；四个大按钮 0.5 / 1.5 / 3 / 5。
 * 安卓用 Float 存，这里用 Math.fround 照算（0.5 的倍数在 Float 里都是准的）。
 */
import { RADIUS } from '../data/constants.ts'

export const MIN_KM = RADIUS.MIN_KM
export const MAX_KM = RADIUS.MAX_KM
export const STEP_KM = RADIUS.STEP_KM
export const DEFAULT_KM = RADIUS.DEFAULT_KM
export const QUICK_KM: readonly number[] = RADIUS.QUICK_KM

/** 滑杆的停点数（两端之间）。 */
export const SLIDER_STEPS = Math.round((MAX_KM - MIN_KM) / STEP_KM) - 1

/** 除以 0.5 四舍五入再乘回去，再夹在 0.5–5 之间。 */
export function snapRadius(km: number): number {
  if (!Number.isFinite(km)) return DEFAULT_KM
  const snapped = Math.fround(Math.round(Math.fround(Math.fround(km) / STEP_KM)) * STEP_KM)
  return Math.min(Math.max(snapped, MIN_KM), MAX_KM)
}

/** 「扩大范围」= 两倍、最多 5、按 0.5 取整；已经 5 公里 → null。 */
export function largerRadius(km: number): number | null {
  if (km >= MAX_KM) return null
  return snapRadius(Math.min(Math.fround(km * 2), MAX_KM))
}
