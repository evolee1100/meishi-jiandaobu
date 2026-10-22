/**
 * 距离、搜索范围矩形、距离和公里数的写法（安卓 domain/Geo.kt）。
 * 数字一律用 javaFormat 的 formatFixed（和 Java 的 %.1f 一样四舍五入），不能用 JS 的 toFixed。
 */
import { GEO } from '../data/constants.ts'
import { formatFixed } from '../data/javaFormat.ts'
import type { GeoBounds, LatLng } from './model.ts'

export const EARTH_RADIUS_METERS = GEO.EARTH_RADIUS_METERS
const METERS_PER_DEGREE_LAT = GEO.METERS_PER_DEGREE_LAT

/** 不换行空格：数字和单位永远在同一行。 */
export const NBSP = ' '
/** 「公⁠里」：两个字之间有看不见的字连接符，不会被拆到两行。 */
export const KM = '公⁠里'

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** 两点之间的直线距离（haversine，米）。 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)
  const dLat = lat2 - lat1
  const dLng = toRadians(b.longitude - a.longitude)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(Math.max(h, 0), 1)))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 包住半径圆的正方形（Google 的 locationRestriction 只收矩形）：西南角 low、东北角 high。
 * 角落离中心约 1.41 倍半径，所以搜到的店还要再按圆形过滤。
 */
export function boundsAround(center: LatLng, radiusMeters: number): GeoBounds {
  const dLat = radiusMeters / METERS_PER_DEGREE_LAT
  const cosLat = Math.max(Math.cos(toRadians(center.latitude)), 0.01)
  const dLng = radiusMeters / (METERS_PER_DEGREE_LAT * cosLat)
  return {
    low: {
      latitude: clamp(center.latitude - dLat, -90, 90),
      longitude: clamp(center.longitude - dLng, -180, 180),
    },
    high: {
      latitude: clamp(center.latitude + dLat, -90, 90),
      longitude: clamp(center.longitude + dLng, -180, 180),
    },
  }
}

/** Kotlin 的 roundToInt()（= Math.round：.5 往正无限大那边进）。 */
export function roundToInt(value: number): number {
  return Math.round(value)
}

/** 「350 米」（1 公里以下，四舍五入到 10 米、最少 10 米），否则「1.2 公里」。 */
export function formatDistance(meters: number): string {
  const roundedTo10 = Math.max(roundToInt(meters / 10) * 10, 10)
  if (roundedTo10 < 1000) return `${roundedTo10}${NBSP}米`
  return `${formatFixed(meters / 1000, 1)}${NBSP}${KM}`
}

/** 范围的公里数：「1.5」「0.5」，整数不写「.0」（「3」「1」「5」）。 */
export function formatKm(km: number): string {
  const tenths = roundToInt(Math.fround(km) * 10)
  return tenths % 10 === 0 ? String(tenths / 10) : formatFixed(tenths / 10, 1)
}
