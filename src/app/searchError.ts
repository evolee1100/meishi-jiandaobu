/**
 * 搜索出错时画面要知道的事（安卓 ui/UiState.kt 的 SearchError / HttpProblem / mightBeFixedByNewKey）。
 * 网页多认一个 reason：API_KEY_HTTP_REFERRER_BLOCKED（网站限制里没有这个网址），多一种错：存储被挡。
 */
import { classifyHttp } from '../data/errors.ts'
import { isPlacesError } from '../services/placesErrors.ts'

export type HttpProblem =
  | 'KEY_INVALID'
  | 'ANDROID_APP_BLOCKED'
  /** 网页专属：密钥限制了网站，可是这个网址不在名单里。 */
  | 'REFERRER_BLOCKED'
  | 'SERVICE_BLOCKED'
  | 'SERVICE_DISABLED'
  /** 结算账号用不了（试用结束后这是正常的、免费的结局）：重试永远没用。 */
  | 'BILLING'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'OTHER'

export type SearchError =
  | { readonly kind: 'NO_API_KEY' }
  | { readonly kind: 'INVALID_API_KEY' }
  | { readonly kind: 'QUOTA_EXHAUSTED' }
  /** 网页专属：这个浏览器不让网页记东西，为了保证不花钱，真实搜索先停用。 */
  | { readonly kind: 'STORAGE_BLOCKED' }
  | { readonly kind: 'PERMISSION_NEEDED'; readonly permanently: boolean }
  | { readonly kind: 'LOCATION_SERVICES_OFF' }
  | { readonly kind: 'LOCATION_UNAVAILABLE' }
  | { readonly kind: 'NETWORK' }
  | {
      readonly kind: 'HTTP'
      readonly code: number
      readonly status: string | null
      readonly reason: string | null
      readonly googleMessage: string | null
    }
  | { readonly kind: 'BAD_RESPONSE' }
  /** 附近没找到；largerRadiusKm 是建议扩大到多少（已经最大 = null）。 */
  | { readonly kind: 'NO_RESULTS'; readonly radiusKm: number; readonly largerRadiusKm: number | null }

/** Google 错误的种类：先看 reason，再看 HTTP 码。 */
export function httpProblem(code: number, status: string | null, reason: string | null, googleMessage: string | null): HttpProblem {
  if (reason === 'API_KEY_HTTP_REFERRER_BLOCKED') return 'REFERRER_BLOCKED'
  return classifyHttp(code, status, reason, googleMessage)
}

export function problemOf(error: Extract<SearchError, { kind: 'HTTP' }>): HttpProblem {
  return httpProblem(error.code, error.status, error.reason, error.googleMessage)
}

/** 定位的问题：换别的搜索来源也修不好。 */
export function isLocationProblem(error: SearchError): boolean {
  return error.kind === 'PERMISSION_NEEDED' || error.kind === 'LOCATION_SERVICES_OFF' || error.kind === 'LOCATION_UNAVAILABLE'
}

/** 换了新密钥可能修得好（保存新密钥后马上重搜）：没有密钥、格式不对、Google 4xx（但不是 429 太多）。 */
export function mightBeFixedByNewKey(error: SearchError): boolean {
  if (error.kind === 'NO_API_KEY' || error.kind === 'INVALID_API_KEY') return true
  if (error.kind === 'HTTP') return error.code >= 400 && error.code <= 499 && problemOf(error) !== 'RATE_LIMITED'
  return false
}

/** 请求层的错 → 画面的错（看不懂的一律当「读取结果时出错了」）。 */
export function toSearchError(error: unknown): SearchError {
  if (!isPlacesError(error)) return { kind: 'BAD_RESPONSE' }
  switch (error.kind) {
    case 'NO_API_KEY':
      return { kind: 'NO_API_KEY' }
    case 'INVALID_API_KEY':
      return { kind: 'INVALID_API_KEY' }
    case 'QUOTA_EXHAUSTED':
      return { kind: 'QUOTA_EXHAUSTED' }
    case 'STORAGE_BLOCKED':
      return { kind: 'STORAGE_BLOCKED' }
    case 'HTTP':
      return { kind: 'HTTP', code: error.code ?? 0, status: error.status, reason: error.reason, googleMessage: error.googleMessage }
    case 'NETWORK':
      return { kind: 'NETWORK' }
    case 'BAD_RESPONSE':
      return { kind: 'BAD_RESPONSE' }
  }
}
