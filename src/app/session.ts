/**
 * 「分页被丢掉再载入」时要回来的东西（安卓 SavedStateHandle 的 SavedSession），存在 sessionStorage：
 * 画面上的结果、最近的结果缓存、这一餐的决定。读不懂（别的版本存的、被改坏）→ 当没有。
 */
import { ALL_CUISINES, ALL_MEALS } from '../domain/cuisine.ts'
import type { LatLng, OpeningHours, Place, SearchChoice, WeeklyPeriod } from '../domain/model.ts'
import type { MealDecision, ResultItem, ResultsState } from './state.ts'

export const SESSION_KEY = 'meishi.session'
export const SESSION_VERSION = 1

export interface CachedResults {
  readonly center: LatLng
  readonly timeMillis: number
  readonly results: ResultsState
}

export interface SavedSession {
  readonly v: number
  readonly shown: ResultsState | null
  readonly cache: readonly CachedResults[]
  readonly meal: MealDecision | null
  readonly demoMeal: MealDecision | null
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

const CUISINES = new Set<string>(ALL_CUISINES)
const MEALS = new Set<string>(ALL_MEALS)

function isChoice(value: unknown): value is SearchChoice {
  return isObj(value) && CUISINES.has(String(value.cuisine)) && MEALS.has(String(value.meal))
}

function isLatLng(value: unknown): value is LatLng {
  return isObj(value) && typeof value.latitude === 'number' && typeof value.longitude === 'number'
}

/** 一家店：必填的字段要对；旧版本少了的可选字段补成「没有」（例如没有营业时间）。 */
function normalizePlace(value: unknown): Place | null {
  if (!isObj(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || !isLatLng(value.location)) return null
  if (typeof value.distanceMeters !== 'number') return null
  const orNull = <T>(v: unknown, check: (x: unknown) => boolean): T | null => (v != null && check(v) ? (v as T) : null)
  const isStr = (x: unknown) => typeof x === 'string'
  const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
  return {
    id: value.id,
    name: value.name,
    address: orNull<string>(value.address, isStr),
    location: { latitude: value.location.latitude, longitude: value.location.longitude },
    distanceMeters: value.distanceMeters,
    rating: orNull<number>(value.rating, isNum),
    userRatingCount: orNull<number>(value.userRatingCount, isNum),
    priceLevel: orNull<Place['priceLevel']>(value.priceLevel, isStr),
    priceRange: orNull<Place['priceRange']>(value.priceRange, isObj),
    openNow: typeof value.openNow === 'boolean' ? value.openNow : null,
    businessStatus: orNull<string>(value.businessStatus, isStr),
    photoName: orNull<string>(value.photoName, isStr),
    photoAuthor: orNull<string>(value.photoAuthor, isStr),
    googleMapsUri: orNull<string>(value.googleMapsUri, isStr),
    primaryType: orNull<string>(value.primaryType, isStr),
    primaryTypeDisplayName: orNull<string>(value.primaryTypeDisplayName, isStr),
    types: Array.isArray(value.types) ? value.types.filter(isStr).map(String) : [],
    placeholderEmoji: orNull<string>(value.placeholderEmoji, isStr),
    openingHours: normalizeHours(value.openingHours),
  }
}

function isPeriod(value: unknown): value is WeeklyPeriod {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    (value[1] === null || typeof value[1] === 'number')
  )
}

function normalizeHours(value: unknown): OpeningHours | null {
  if (!isObj(value)) return null
  const periods = Array.isArray(value.periods) ? value.periods.filter(isPeriod) : []
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return { periods, nextOpenMillis: num(value.nextOpenMillis), nextCloseMillis: num(value.nextCloseMillis) }
}

function normalizeItem(value: unknown): ResultItem | null {
  if (!isObj(value) || typeof value.rank !== 'number') return null
  const place = normalizePlace(value.place)
  if (!place || !isObj(value.photo) || typeof value.photo.kind !== 'string') return null
  const photo = value.photo as unknown as ResultItem['photo']
  if (photo.kind === 'LOADED' && typeof (photo as { url?: unknown }).url !== 'string') return null
  if (!['PENDING', 'LOADING', 'LOADED', 'NONE'].includes(photo.kind)) return null
  return {
    rank: value.rank,
    place,
    photo,
    translatedName: typeof value.translatedName === 'string' ? value.translatedName : null,
    translatedType: typeof value.translatedType === 'string' ? value.translatedType : null,
  }
}

function normalizeItems(value: unknown): ResultItem[] | null {
  if (!Array.isArray(value)) return null
  const items: ResultItem[] = []
  for (const entry of value) {
    const item = normalizeItem(entry)
    if (!item) return null
    items.push(item)
  }
  return items
}

const strings = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null

export function normalizeResults(value: unknown): ResultsState | null {
  if (!isObj(value) || value.kind !== 'RESULTS' || !isChoice(value.choice) || typeof value.radiusKm !== 'number') return null
  const ranked = normalizeItems(value.ranked)
  const basket = strings(value.basket ?? [])
  const cleared = strings(value.clearedBasket ?? [])
  if (!ranked || !basket || !cleared) return null
  const clock = isObj(value.clock) && typeof value.clock.epochMillis === 'number' && typeof value.clock.zoneId === 'string'
    ? { epochMillis: value.clock.epochMillis, zoneId: value.clock.zoneId }
    : { epochMillis: 0, zoneId: '' }
  const vote = isObj(value.vote) && strings(value.vote.placeIds) && Array.isArray(value.vote.counts)
    ? { placeIds: value.vote.placeIds as string[], counts: (value.vote.counts as unknown[]).map((c) => (typeof c === 'number' ? c : 0)) }
    : null
  return {
    kind: 'RESULTS',
    choice: { cuisine: value.choice.cuisine, meal: value.choice.meal },
    radiusKm: value.radiusKm,
    ranked,
    page: typeof value.page === 'number' ? value.page : 0,
    openNowOnly: value.openNowOnly === true,
    partial: value.partial === true,
    fromCache: value.fromCache === true,
    isDemo: value.isDemo === true,
    trimmedCount: typeof value.trimmedCount === 'number' ? value.trimmedCount : 0,
    basket,
    clearedBasket: cleared,
    vote,
    clock,
    shownAtMillis: typeof value.shownAtMillis === 'number' ? value.shownAtMillis : 0,
    dayPart: typeof value.dayPart === 'string' ? (value.dayPart as ResultsState['dayPart']) : null,
  }
}

/** 这一餐的决定（也用在 localStorage 的 meal_decision）。 */
export function normalizeMeal(value: unknown): MealDecision | null {
  if (!isObj(value) || typeof value.decidedAtMillis !== 'number' || typeof value.regretsLeft !== 'number') return null
  if (typeof value.isDemo !== 'boolean' || !isObj(value.duel)) return null
  const duel = value.duel
  if (typeof duel.round !== 'number' || !strings(duel.placeIds) || typeof duel.mode !== 'string') return null
  const items = normalizeItems(value.items)
  if (!items) return null
  const snapshot = normalizeItems(duel.snapshot ?? []) ?? []
  return {
    decidedAtMillis: value.decidedAtMillis,
    regretsLeft: value.regretsLeft,
    isDemo: value.isDemo,
    duel: { ...(duel as unknown as MealDecision['duel']), snapshot, choice: isChoice(duel.choice) ? duel.choice : null },
    items,
  }
}

export function parseSavedSession(json: string): SavedSession | null {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return null
  }
  if (!isObj(value) || value.v !== SESSION_VERSION) return null
  const shown = value.shown == null ? null : normalizeResults(value.shown)
  if (value.shown != null && !shown) return null
  const cache: CachedResults[] = []
  if (Array.isArray(value.cache)) {
    for (const entry of value.cache) {
      if (!isObj(entry) || !isLatLng(entry.center) || typeof entry.timeMillis !== 'number') return null
      const results = normalizeResults(entry.results)
      if (!results) return null
      cache.push({ center: entry.center, timeMillis: entry.timeMillis, results })
    }
  }
  return {
    v: SESSION_VERSION,
    shown,
    cache,
    meal: value.meal == null ? null : normalizeMeal(value.meal),
    demoMeal: value.demoMeal == null ? null : normalizeMeal(value.demoMeal),
  }
}

/** 进程（分页）不会带着请求一起回来：「正在拿」的照片改回「还没拿」；结果里已经没有的店从 ❤️、撤销里去掉；计票缺店就整个丢掉。 */
export function withoutRunningRequests(session: SavedSession): SavedSession {
  const reset = (results: ResultsState): ResultsState => {
    const present = new Set(results.ranked.map((item) => item.place.id))
    return {
      ...results,
      ranked: results.ranked.map((item) => (item.photo.kind === 'LOADING' ? { ...item, photo: { kind: 'PENDING' } } : item)),
      basket: results.basket.filter((id) => present.has(id)),
      clearedBasket: results.clearedBasket.filter((id) => present.has(id)),
      vote: results.vote && results.vote.placeIds.every((id) => present.has(id)) ? results.vote : null,
    }
  }
  return {
    ...session,
    shown: session.shown ? reset(session.shown) : null,
    cache: session.cache.map((c) => ({ ...c, results: reset(c.results) })),
  }
}
