/**
 * 一次搜索（安卓 data/PlacesRepository.kt）：这个组合的 1–3 个关键词同时发、每个单独成败；
 * 有成功的就按关键词顺序合并去重，全部失败才报最有用的错；再只留圆形范围内、吃饭的地方。
 * 发之前先确定本月还放得下一整次搜索（一律按 3 个算）：首页说「已用完」就真的一个都不发。
 */
import { QUERIES_PER_SEARCH, queriesFor } from '../domain/searchConfig.ts'
import { boundsAround, haversineMeters } from '../domain/geo.ts'
import { ktTrim } from '../domain/chineseText.ts'
import { apiKeyProblem } from '../domain/apiKeys.ts'
import { isEmptyHours, weeklyPeriod } from '../domain/openingHours.ts'
import { priceLevelFromApi } from '../domain/priceFormat.ts'
import { isEatery } from '../domain/ranking.ts'
import type { LatLng, Money, OpeningHours, Place, PriceRange, SearchChoice, WeeklyPeriod } from '../domain/model.ts'
import { PlacesApi } from './placesApi.ts'
import { CancelledError, isCancelled, PlacesError } from './placesErrors.ts'
import type { UsageGuard } from './usageGuard.ts'
import { isWritable, type KeyValueStore } from './storage.ts'

/** 找到的店 + 失败了哪些关键词（永远不会全部失败：全部失败会直接抛错）。 */
export interface SearchOutcome {
  readonly places: Place[]
  readonly failures: unknown[]
}

/** 真实和演示共用的接口：搜附近的店、拿照片网址（安卓 PlaceSearcher + PhotoResolver）。 */
export interface PlacesClient {
  search(choice: SearchChoice, center: LatLng, radiusMeters: number, signal?: AbortSignal): Promise<SearchOutcome>
  /** 照片网址；额度用完、出错、演示 → null（显示 emoji）。 */
  photoUri(photoName: string, signal?: AbortSignal): Promise<string | null>
}

type Settled = { ok: true; value: unknown[] } | { ok: false; error: unknown }

/** 最有用的那个错：额度用完 > Google 的 HTTP 错误 > 第一个。（网页：存储被挡和额度用完一样优先。） */
export function mostInformativeFailure(failures: readonly unknown[]): unknown {
  const kindOf = (e: unknown) => (e instanceof PlacesError ? e.kind : null)
  return (
    failures.find((e) => kindOf(e) === 'QUOTA_EXHAUSTED' || kindOf(e) === 'STORAGE_BLOCKED') ??
    failures.find((e) => kindOf(e) === 'HTTP') ??
    failures[0]
  )
}

/** 合并：全部失败 → 抛出最有用的错；否则按关键词顺序串起来，同一个店 id 只留第一次，没有 id 的丢掉。 */
export function mergeQueryResults(results: readonly Settled[]): unknown[] {
  if (results.length > 0 && results.every((r) => !r.ok)) {
    throw mostInformativeFailure(results.map((r) => (r.ok ? null : r.error)))
  }
  const seen = new Set<string>()
  const merged: unknown[] = []
  for (const result of results) {
    if (!result.ok) continue
    for (const dto of result.value) {
      const id = typeof dto === 'object' && dto != null ? (dto as { id?: unknown }).id : undefined
      if (typeof id !== 'string' || seen.has(id)) continue
      seen.add(id)
      merged.push(dto)
    }
  }
  return merged
}

// ------------------------------------------------------------------ 读懂 Google 的回复

function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value != null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function int(value: unknown): number | null {
  const n = num(value)
  return n != null && Number.isInteger(n) ? n : null
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** RFC 3339（「2026-10-04T14:00:00Z」，带小数秒或时区都行）→ 毫秒；读不懂 → null。 */
export function parseTimestamp(text: string | null | undefined): number | null {
  if (text == null || ktTrim(text) === '') return null
  const value = ktTrim(text)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i.test(value)) return null
  const millis = Date.parse(value.toUpperCase())
  return Number.isFinite(millis) ? millis : null
}

/** proto3 会省略 0：只有币种没有 units = 0；units 是字符串（"10"）或数字都读得懂。 */
function toMoney(value: unknown): Money | null {
  const money = obj(value)
  if (!money) return null
  const currencyCode = str(money.currencyCode)
  const units = money.units
  let parsed: number | null = null
  if (typeof units === 'string' && /^\s*-?\d+\s*$/.test(units)) parsed = Number(units.trim())
  else if (typeof units === 'number' && Number.isInteger(units)) parsed = units
  if (parsed != null) return { currencyCode, units: parsed }
  return currencyCode != null ? { currencyCode, units: 0 } : null
}

function toPriceRange(value: unknown): PriceRange | null {
  const range = obj(value)
  if (!range) return null
  const start = toMoney(range.startPrice)
  const end = toMoney(range.endPrice)
  return start == null && end == null ? null : { start, end }
}

/** proto3 省略的 day / hour / minute 当 0（星期日、半夜）。 */
function point(value: unknown): { day: number; hour: number; minute: number } | null {
  const p = obj(value)
  if (!p) return null
  return { day: int(p.day) ?? 0, hour: int(p.hour) ?? 0, minute: int(p.minute) ?? 0 }
}

/** currentOpeningHours → 每周时段 + 下次开门 / 关门；除了 openNow 什么都没有 → null。 */
export function toOpeningHours(value: unknown): OpeningHours | null {
  const hours = obj(value)
  if (!hours) return null
  const periods: WeeklyPeriod[] = []
  if (Array.isArray(hours.periods)) {
    for (const period of hours.periods) {
      const p = obj(period)
      const openPoint = point(p?.open)
      if (!openPoint) continue
      const closePoint = point(p?.close)
      periods.push(weeklyPeriod(openPoint.day, openPoint.hour, openPoint.minute, closePoint?.day ?? null, closePoint?.hour ?? null, closePoint?.minute ?? null))
    }
  }
  const result: OpeningHours = {
    periods,
    nextOpenMillis: parseTimestamp(str(hours.nextOpenTime)),
    nextCloseMillis: parseTimestamp(str(hours.nextCloseTime)),
  }
  return isEmptyHours(result) ? null : result
}

/** 一家 Google 的店 → 我们的「店」；缺 id、店名或坐标 → null（丢掉）。 */
export function toPlace(dto: unknown, center: LatLng): Place | null {
  const d = obj(dto)
  if (!d) return null
  const id = str(d.id)
  if (id == null) return null
  const nameRaw = str(obj(d.displayName)?.text)
  const name = nameRaw == null ? null : ktTrim(nameRaw)
  if (!name) return null
  const loc = obj(d.location)
  if (!loc) return null
  const location: LatLng = { latitude: num(loc.latitude) ?? 0, longitude: num(loc.longitude) ?? 0 }
  const photos = Array.isArray(d.photos) ? d.photos.map(obj) : []
  const firstPhoto = photos.find((p) => {
    const n = str(p?.name)
    return n != null && ktTrim(n) !== ''
  })
  const firstAuthor = Array.isArray(firstPhoto?.authorAttributions) ? obj(firstPhoto.authorAttributions[0]) : null
  const short = str(d.shortFormattedAddress)
  const opening = obj(d.currentOpeningHours)
  const typeName = str(obj(d.primaryTypeDisplayName)?.text)
  const openNow = opening?.openNow
  return {
    id,
    name,
    address: short != null && ktTrim(short) !== '' ? short : str(d.formattedAddress),
    location,
    distanceMeters: haversineMeters(center, location),
    rating: num(d.rating),
    userRatingCount: int(d.userRatingCount),
    priceLevel: priceLevelFromApi(str(d.priceLevel)),
    priceRange: toPriceRange(d.priceRange),
    openNow: typeof openNow === 'boolean' ? openNow : null,
    businessStatus: str(d.businessStatus),
    photoName: firstPhoto ? str(firstPhoto.name) : null,
    photoAuthor: firstAuthor ? str(firstAuthor.displayName) : null,
    googleMapsUri: str(d.googleMapsUri),
    primaryType: str(d.primaryType),
    primaryTypeDisplayName: typeName != null && ktTrim(typeName) !== '' ? typeName : null,
    types: strings(d.types),
    placeholderEmoji: null,
    openingHours: toOpeningHours(d.currentOpeningHours),
  }
}

// ------------------------------------------------------------------ 真实的 Google

export interface GooglePlacesClientOptions {
  api: PlacesApi
  usageGuard: UsageGuard
  apiKey: () => string
  /** 用量计数存在哪（用来先确认写得进去）；不给就不先检查。 */
  usageStore?: KeyValueStore
}

export class GooglePlacesClient implements PlacesClient {
  private readonly api: PlacesApi
  private readonly guard: UsageGuard
  private readonly apiKey: () => string
  private readonly usageStore: KeyValueStore | undefined

  constructor(options: GooglePlacesClientOptions) {
    this.api = options.api
    this.guard = options.usageGuard
    this.apiKey = options.apiKey
    this.usageStore = options.usageStore
  }

  private requireUsableKey(): void {
    const problem = apiKeyProblem(this.apiKey())
    if (problem === 'NO_API_KEY') throw PlacesError.noApiKey()
    if (problem === 'INVALID_API_KEY') throw PlacesError.invalidApiKey()
  }

  async search(choice: SearchChoice, center: LatLng, radiusMeters: number, signal?: AbortSignal): Promise<SearchOutcome> {
    this.requireUsableKey()
    const queries = queriesFor(choice)
    if (this.usageStore && !isWritable(this.usageStore)) throw PlacesError.storageBlocked()
    if (!this.guard.hasTextSearchBudget(QUERIES_PER_SEARCH)) throw PlacesError.quotaExhausted()
    if (signal?.aborted) throw new CancelledError()

    const bounds = boundsAround(center, radiusMeters)
    // 全部同时发（每个在 fetch 前一刻记一笔，JS 一次只做一件事，所以计数是一个一个加的）。
    const results: Settled[] = await Promise.all(
      queries.map((query) =>
        this.api.searchText(query, bounds, signal).then(
          (value): Settled => ({ ok: true, value }),
          (error: unknown): Settled => ({ ok: false, error }),
        ),
      ),
    )
    if (signal?.aborted || results.some((r) => !r.ok && isCancelled(r.error))) throw new CancelledError()
    const merged = mergeQueryResults(results)
    const places = merged
      .map((dto) => toPlace(dto, center))
      .filter((p): p is Place => p != null)
      .filter((p) => p.distanceMeters <= radiusMeters)
      .filter((p) => isEatery(p.types, p.primaryType))
    return { places, failures: results.flatMap((r) => (r.ok ? [] : [r.error])) }
  }

  /** 画面上的店的照片；没有密钥、额度用完、出错 → null，不重试。 */
  async photoUri(photoName: string, signal?: AbortSignal): Promise<string | null> {
    if (apiKeyProblem(this.apiKey()) != null) return null
    if (this.guard.remainingPhotos() <= 0) return null
    try {
      return await this.api.fetchPhotoUri(photoName, signal)
    } catch (e) {
      if (isCancelled(e)) throw e
      return null
    }
  }
}
