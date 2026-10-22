/**
 * 和 Google 打交道时会出的错（安卓 data/PlacesApi.kt 的 PlacesException）。
 * 网页多一种：STORAGE_BLOCKED（这个浏览器不让网页记东西，为了保证不花钱，真实请求一个都不发）。
 */

export type PlacesErrorKind =
  | 'NO_API_KEY'
  | 'INVALID_API_KEY'
  | 'QUOTA_EXHAUSTED'
  | 'STORAGE_BLOCKED'
  | 'HTTP'
  | 'NETWORK'
  | 'BAD_RESPONSE'

export class PlacesError extends Error {
  readonly kind: PlacesErrorKind
  /** 只有 HTTP 才有：Google 的 HTTP 码（优先用 JSON 里的 error.code）。 */
  readonly code: number | null
  readonly status: string | null
  /** error.details 里第一个有 reason 的。 */
  readonly reason: string | null
  /** Google 原文（error.message；不是 Google 的格式时是回复正文的前 300 个字）。 */
  readonly googleMessage: string | null

  constructor(
    kind: PlacesErrorKind,
    message: string,
    http: { code?: number | null; status?: string | null; reason?: string | null; googleMessage?: string | null } = {},
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'PlacesError'
    this.kind = kind
    this.code = http.code ?? null
    this.status = http.status ?? null
    this.reason = http.reason ?? null
    this.googleMessage = http.googleMessage ?? null
  }

  static noApiKey(): PlacesError {
    return new PlacesError('NO_API_KEY', 'No Places API key')
  }

  static invalidApiKey(): PlacesError {
    return new PlacesError('INVALID_API_KEY', 'API key contains invalid characters')
  }

  static quotaExhausted(): PlacesError {
    return new PlacesError('QUOTA_EXHAUSTED', 'Monthly free quota used up')
  }

  static storageBlocked(): PlacesError {
    return new PlacesError('STORAGE_BLOCKED', 'Local storage is not writable: usage cannot be counted')
  }

  static http(code: number, status: string | null, reason: string | null, googleMessage: string | null): PlacesError {
    return new PlacesError('HTTP', `HTTP ${code} ${status} ${reason}: ${googleMessage}`, { code, status, reason, googleMessage })
  }

  static network(cause?: unknown): PlacesError {
    return new PlacesError('NETWORK', 'Network failure', {}, cause)
  }

  static badResponse(cause?: unknown): PlacesError {
    return new PlacesError('BAD_RESPONSE', 'Unreadable response', {}, cause)
  }
}

export function isPlacesError(error: unknown): error is PlacesError {
  return error instanceof PlacesError
}

/** 用户取消（回首页、新的搜索）：不是错误，安静地停下。 */
export class CancelledError extends Error {
  constructor() {
    super('cancelled')
    this.name = 'CancelledError'
  }
}

export function isCancelled(error: unknown): boolean {
  return error instanceof CancelledError || (error instanceof DOMException && error.name === 'AbortError')
}
