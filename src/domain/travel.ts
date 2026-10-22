/**
 * 走路几分钟、过去要多久（安卓 domain/MapsLinks.kt 的 Walking / Travel）。都在手机里按直线距离估算。
 */
import { WALKING } from '../data/constants.ts'

/** 往上取整、至少 1；取整前先减 1e-9（520 米：8.45 → 9；800 米：刚好 13 → 13，不会因为小数误差变 14）。 */
export function wholeMinutes(exact: number): number {
  return Math.max(Math.ceil(Math.max(exact, 0) - 1e-9), 1)
}

/** 走路几分钟（直线 × 1.3 ÷ 80 米/分钟）；超过 2 公里 → null（只写距离）。 */
export function walkingMinutes(distanceMeters: number): number | null {
  if (distanceMeters > WALKING.MAX_METERS) return null
  return wholeMinutes((distanceMeters * WALKING.DETOUR_FACTOR) / WALKING.METERS_PER_MINUTE)
}

/** 过去要多久：2 公里内走路；更远按城里开车 ÷ 333 米/分钟再加 5 分钟找车位。 */
export function travelMinutes(distanceMeters: number): number {
  return (
    walkingMinutes(distanceMeters) ??
    wholeMinutes((distanceMeters * WALKING.DETOUR_FACTOR) / WALKING.RIDE_METERS_PER_MINUTE) + WALKING.PARKING_MINUTES
  )
}

/** 走路去的（2 公里内）。 */
export function isOnFoot(distanceMeters: number): boolean {
  return walkingMinutes(distanceMeters) != null
}
