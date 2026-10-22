/**
 * 直接从浏览器呼叫 Places API (New) 的 REST 接口（安卓 data/PlacesApi.kt + UsageCountingInterceptor.kt）。
 *
 * 只会发两种收费请求：
 *   1. 文字搜索 POST https://places.googleapis.com/v1/places:searchText
 *      （请求头只有 Content-Type、X-Goog-Api-Key、X-Goog-FieldMask；不带安卓的 X-Android-*）
 *   2. 照片 GET https://places.googleapis.com/v1/{照片名}/media?maxWidthPx=800&skipHttpRedirect=true&key=…
 *      （密钥放网址参数：没有自订请求头 = 简单请求，不用多一次预检；回 JSON 的 photoUri）
 *
 * 每一个请求在调用 fetch 的前一刻先在用量守卫记一笔（先写进 localStorage 再发；写不进去就不发），
 * 不管之后成功、失败、超时、被取消都算。fetch 本身不会自动重发，这里也绝不重发。
 */
import { PLACES_API } from '../data/constants.ts'
import { apiKeyProblem } from '../domain/apiKeys.ts'
import { ktTrim } from '../domain/chineseText.ts'
import type { GeoBounds } from '../domain/model.ts'
import { FIELD_MASK } from '../domain/searchConfig.ts'
import { CancelledError, PlacesError } from './placesErrors.ts'
import type { BillableRequest, UsageGuard } from './usageGuard.ts'

/** navigator.locks 里用到的那一点（好几个分页同时开着时，让「读-比-写」一个一个来）。 */
export interface LockLike {
  request<T>(name: string, callback: () => T | Promise<T>): Promise<T>
}

export interface PlacesApiOptions {
  /** 用户自己贴的密钥（只从本机存储读）。 */
  apiKey: () => string
  usageGuard: UsageGuard
  /** 测试注入模拟的 fetch；默认用浏览器的。 */
  fetch?: typeof fetch
  baseUrl?: string
  /** 整个请求最多等多久（安卓 25 秒）。 */
  timeoutMs?: number
  /** 默认用 navigator.locks（有的话）。 */
  locks?: LockLike | null
}

export interface BuiltRequest {
  readonly url: string
  readonly init: {
    method: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: string
    credentials: RequestCredentials
  }
  readonly kind: BillableRequest
}

export const USAGE_LOCK_NAME = 'meishi-usage'

function defaultLocks(): LockLike | null {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks
  if (!locks || typeof locks.request !== 'function') return null
  return {
    request: <T>(name: string, callback: () => T | Promise<T>) =>
      locks.request(name, async () => callback()) as Promise<T>,
  }
}

/** 几个 AbortSignal 合成一个（AbortSignal.any 不一定有）。 */
function anySignal(signals: readonly (AbortSignal | undefined)[]): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => s != null)
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any
  if (typeof anyFn === 'function') return anyFn(list)
  const controller = new AbortController()
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}

function encodePath(name: string): string {
  return name
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export class PlacesApi {
  private readonly apiKey: () => string
  private readonly guard: UsageGuard
  private readonly fetchImpl: typeof fetch
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly locks: LockLike | null

  constructor(options: PlacesApiOptions) {
    this.apiKey = options.apiKey
    this.guard = options.usageGuard
    this.fetchImpl = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
    this.baseUrl = options.baseUrl ?? PLACES_API.BASE_URL
    this.timeoutMs = options.timeoutMs ?? PLACES_API.CALL_TIMEOUT_MS
    this.locks = options.locks === undefined ? defaultLocks() : options.locks
  }

  /** 密钥能用就回传（去掉前后空白）；没有 / 格式不对 → 抛错，什么都没发、什么都没记。 */
  private usableKey(): string {
    const key = ktTrim(this.apiKey())
    const problem = apiKeyProblem(key)
    if (problem === 'NO_API_KEY') throw PlacesError.noApiKey()
    if (problem === 'INVALID_API_KEY') throw PlacesError.invalidApiKey()
    return key
  }

  buildSearchTextRequest(query: string, bounds: GeoBounds): BuiltRequest {
    const key = this.usableKey()
    const body = {
      textQuery: query,
      languageCode: PLACES_API.LANGUAGE_CODE,
      regionCode: PLACES_API.REGION_CODE,
      pageSize: PLACES_API.PAGE_SIZE,
      locationRestriction: {
        rectangle: {
          low: { latitude: bounds.low.latitude, longitude: bounds.low.longitude },
          high: { latitude: bounds.high.latitude, longitude: bounds.high.longitude },
        },
      },
    }
    return {
      url: this.baseUrl + PLACES_API.SEARCH_TEXT_PATH,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
        credentials: 'omit',
      },
      kind: 'TEXT_SEARCH',
    }
  }

  buildPhotoMediaRequest(photoName: string, maxWidthPx: number = PLACES_API.PHOTO_MAX_WIDTH_PX): BuiltRequest {
    const key = this.usableKey()
    const url =
      `${this.baseUrl}v1/${encodePath(photoName)}/media` +
      `?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true&key=${encodeURIComponent(key)}`
    return { url, init: { method: 'GET', credentials: 'omit' }, kind: 'PHOTO' }
  }

  /** 一个文字搜索请求（永远不翻页）。回传 Google 的 places 数组（没有结果时回复是 {}，当成空数组）。 */
  async searchText(query: string, bounds: GeoBounds, signal?: AbortSignal): Promise<unknown[]> {
    const text = await this.execute(this.buildSearchTextRequest(query, bounds), signal)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      throw PlacesError.badResponse(e)
    }
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) throw PlacesError.badResponse()
    const places = (parsed as { places?: unknown }).places
    if (places == null) return []
    if (!Array.isArray(places)) throw PlacesError.badResponse()
    return places
  }

  /** 照片的短期网址（googleusercontent）；回复里没有网址 → null。 */
  async fetchPhotoUri(photoName: string, signal?: AbortSignal): Promise<string | null> {
    const text = await this.execute(this.buildPhotoMediaRequest(photoName), signal)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      throw PlacesError.badResponse(e)
    }
    if (typeof parsed !== 'object' || parsed == null) throw PlacesError.badResponse()
    const uri = (parsed as { photoUri?: unknown }).photoUri
    return typeof uri === 'string' && uri.trim() ? uri : null
  }

  /** 记一笔（必要时用锁，免得好几个分页同时数）。 */
  private async record(kind: BillableRequest): Promise<void> {
    const run = () => this.guard.record(kind)
    const result = this.locks ? await this.locks.request(USAGE_LOCK_NAME, run) : run()
    if (result === 'LIMIT') throw PlacesError.quotaExhausted()
    if (result === 'STORAGE') throw PlacesError.storageBlocked()
  }

  private async execute(request: BuiltRequest, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new CancelledError()
    await this.record(request.kind)
    if (signal?.aborted) throw new CancelledError() // 已经记了一笔，但还没发：不发了（多记一笔不会多花钱）
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), this.timeoutMs)
    let response: Response
    try {
      // 记好一笔之后紧接着发：中间不做别的事。
      response = await this.fetchImpl(request.url, { ...request.init, signal: anySignal([signal, timeout.signal]) })
    } catch (e) {
      clearTimeout(timer)
      if (signal?.aborted) throw new CancelledError()
      throw PlacesError.network(e)
    }
    let text: string
    try {
      text = await response.text()
    } catch (e) {
      clearTimeout(timer)
      if (signal?.aborted) throw new CancelledError()
      throw PlacesError.network(e)
    }
    clearTimeout(timer)
    if (!response.ok) throw this.parseError(response.status, text)
    return text
  }

  /**
   * Google 的错误（google.rpc.Status）读成 HTTP 码、status、reason（details 里第一个有 reason 的）、原文；
   * 不是 Google 的格式：原文 = 回复正文去前后空白的前 300 个字。
   */
  parseError(httpCode: number, body: string): PlacesError {
    let error: Record<string, unknown> | null = null
    try {
      const parsed: unknown = JSON.parse(body)
      if (typeof parsed === 'object' && parsed != null) {
        const inner = (parsed as { error?: unknown }).error
        if (typeof inner === 'object' && inner != null) error = inner as Record<string, unknown>
      }
    } catch {
      error = null
    }
    const code = typeof error?.code === 'number' && Number.isInteger(error.code) ? error.code : httpCode
    const status = typeof error?.status === 'string' ? error.status : null
    let reason: string | null = null
    if (Array.isArray(error?.details)) {
      for (const detail of error.details as unknown[]) {
        const r = typeof detail === 'object' && detail != null ? (detail as { reason?: unknown }).reason : null
        if (typeof r === 'string') {
          reason = r
          break
        }
      }
    }
    const message = typeof error?.message === 'string' && error.message.trim() ? error.message : null
    const trimmed = body.trim().slice(0, 300)
    const googleMessage = message ?? (error == null && trimmed ? trimmed : null)
    return PlacesError.http(code, status, reason, googleMessage)
  }
}
