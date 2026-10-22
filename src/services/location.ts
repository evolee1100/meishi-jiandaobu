/**
 * 定位（安卓 data/LocationProvider.kt 的接口部分）：状态层只认这个接口，测试换成假的。
 * 位置新旧一律用单调时钟（网页 performance.now()）算，调手机时间不影响。
 */
import { LOCATION } from '../data/constants.ts'
import type { LatLng } from '../domain/model.ts'

export type PermissionLevel = 'NONE' | 'APPROXIMATE' | 'PRECISE'

export interface LocationFix {
  readonly latLng: LatLng
  /** 拿到位置的时刻，单调时钟（毫秒；网页 performance.now()）。 */
  readonly elapsedMillis: number
  /** 只有大概位置（模糊定位）。 */
  readonly approximate: boolean
}

export type LocationResult =
  | { readonly kind: 'SUCCESS'; readonly fix: LocationFix }
  | { readonly kind: 'NO_PERMISSION' }
  | { readonly kind: 'SERVICES_OFF' }
  | { readonly kind: 'UNAVAILABLE' }

/** 拿不到新位置时，10 分钟内的旧位置还能用（更旧的不用，免得在别处找店）。 */
export const FALLBACK_MAX_AGE_MS = LOCATION.FALLBACK_MAX_AGE_MS
/** 2 分钟内拿过的位置直接用。 */
export const REUSE_MAX_AGE_MS = LOCATION.REUSE_MAX_AGE_MS

/** 位置的年龄在 0…maxAge 之间（「未来」的位置永远不算新鲜）。 */
export function isAgeWithin(fixElapsedMillis: number, maxAgeMillis: number, nowElapsedMillis: number): boolean {
  const age = nowElapsedMillis - fixElapsedMillis
  return age >= 0 && age <= maxAgeMillis
}

export function isFixWithin(fix: LocationFix, maxAgeMillis: number, nowElapsedMillis: number): boolean {
  return isAgeWithin(fix.elapsedMillis, maxAgeMillis, nowElapsedMillis)
}

/** 用户回答浏览器的定位询问以后（网页版的 PermissionRequestResult）。 */
export interface PermissionAnswer {
  readonly granted: boolean
  /** 浏览器挡住了（Permissions API 说 denied）：不会再问，只能去浏览器设置里打开。 */
  readonly permanentlyDenied: boolean
  /** 没有回答（例如分页被切走，浏览器自己收起了询问）。 */
  readonly interrupted: boolean
  /** 允许了而且已经拿到位置（网页的询问就是一次定位）。 */
  readonly fix: LocationFix | null
}

export interface LocationSource {
  /** 现在有没有定位权限（同步：浏览器的权限状态已经先查好、记着）。 */
  permissionLevel(): PermissionLevel
  /** 浏览器挡住了定位（网页版的「永久拒绝」）。 */
  permanentlyDenied(): boolean
  /** 手机的定位服务开着（网页分不出来，永远 true）。 */
  locationServicesEnabled(): boolean
  currentLocation(): Promise<LocationResult>
  /** 让浏览器问用户（按了「好，去允许」以后才调用）。 */
  requestPermission(): Promise<PermissionAnswer>
  /** 重新查一次权限（回到页面时）。 */
  refreshPermission?(): Promise<void>
  /** 权限变了（Permissions API 的 change 事件）。回传取消订阅的函数。 */
  onPermissionChange?(listener: () => void): () => void
}
