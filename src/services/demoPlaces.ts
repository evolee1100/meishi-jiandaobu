/**
 * 🧪 演示模式（安卓 data/DemoPlaces.kt）：36 家假店围着你的位置摆，营业时间跟着手机时间开关，
 * 不用密钥、不上网、不扣免费次数、不拿照片、不下载翻译。店名的「机翻」用内置对照表。
 */
import { DEMO_FAKE_DELAY_MS, DEMO_SHOPS, demoLocation, type DemoShop } from '../data/demoShops.ts'
import { haversineMeters } from '../domain/geo.ts'
import type { NameTranslator } from '../domain/localizer.ts'
import type { LatLng, Place, SearchChoice } from '../domain/model.ts'
import { canGoAt, fromPeriods, nextTimes, statusClockOf } from '../domain/openingHours.ts'
import { isEatery } from '../domain/ranking.ts'
import { rankedFor } from '../domain/searchConfig.ts'
import type { ZonedTime } from '../domain/time.ts'
import { CancelledError } from './placesErrors.ts'
import type { PlacesClient, SearchOutcome } from './placesRepository.ts'

export { DEMO_REFERENCE_CENTER, DEMO_FAKE_DELAY_MS } from '../data/demoShops.ts'

function serves(shop: DemoShop, choice: SearchChoice): boolean {
  return (
    (choice.cuisine === 'ANY' || shop.cuisines.includes(choice.cuisine)) &&
    (choice.meal === 'ANY' || (shop.meals as readonly string[]).includes(choice.meal))
  )
}

function toPlace(shop: DemoShop, center: LatLng, now: ZonedTime): Place {
  const location = demoLocation(center, shop.placement)
  const periods = shop.periods
  const next = periods ? nextTimes(periods, now) : null
  return {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    location,
    distanceMeters: haversineMeters(center, location),
    rating: shop.rating,
    userRatingCount: shop.reviews,
    priceLevel: null,
    priceRange: shop.priceRm
      ? { start: { currencyCode: 'MYR', units: shop.priceRm[0] }, end: { currencyCode: 'MYR', units: shop.priceRm[1] } }
      : null,
    openNow: periods ? fromPeriods(periods, now)?.kind === 'OPEN' : null,
    businessStatus: 'OPERATIONAL',
    photoName: null,
    photoAuthor: null,
    googleMapsUri: null,
    primaryType: shop.primaryType,
    primaryTypeDisplayName: shop.typeName,
    types: [...shop.types],
    placeholderEmoji: shop.emoji,
    openingHours: periods && next ? { periods, nextOpenMillis: next.nextOpenMillis, nextCloseMillis: next.nextCloseMillis } : null,
  }
}

/** 全部 36 家（顺序固定，id demo_01…demo_36），围着 center 摆，营业状态按 now 算。 */
export function allDemoPlaces(center: LatLng, now: ZonedTime): Place[] {
  return DEMO_SHOPS.map((shop) => toPlace(shop, center, now))
}

/** 演示搜索：菜系对得上（不限都算）、饭/面对得上（都可以都算）、距离 ≤ 范围、是吃饭的地方。 */
export function searchDemoPlaces(choice: SearchChoice, center: LatLng, radiusMeters: number, now: ZonedTime): Place[] {
  const places: Place[] = []
  for (const shop of DEMO_SHOPS) {
    if (!serves(shop, choice)) continue
    const place = toPlace(shop, center, now)
    if (place.distanceMeters <= radiusMeters && isEatery(place.types, place.primaryType)) places.push(place)
  }
  return places
}

/**
 * 这个组合的演示搜索里，现在「能去」的有几家（经过和画面一样的菜系过滤和排名）。
 * 演示的店都在手机里，不用搜索就知道：随便挑只摇至少 2 家能去的组合，「就它了」以后一定能接着玩。
 */
export function demoReachableCount(choice: SearchChoice, center: LatLng, radiusMeters: number, now: ZonedTime): number {
  const clock = statusClockOf(now.epochMillis, now.zone)
  return rankedFor(choice, searchDemoPlaces(choice, center, radiusMeters, now)).filter((p) => canGoAt(p, clock)).length
}

const CHINESE_NAMES = new Map(DEMO_SHOPS.map((shop) => [shop.name, shop.chineseName]))

/** 内置的「机翻」中文名；本来就是中文的、不是演示店 → null。 */
export function demoChineseName(name: string): string | null {
  return CHINESE_NAMES.get(name.trim()) ?? null
}

/** 演示店的翻译器：查对照表，绝不联网。 */
export const demoNameTranslator: NameTranslator = {
  async translateToChinese(text: string): Promise<string> {
    const chinese = demoChineseName(text)
    if (chinese == null) throw new Error('not a demo shop: ' + text)
    return chinese
  },
  close() {},
}

/** 等一下（演示搜索故意等 600 毫秒，让人看到加载页）；被取消就抛 CancelledError。 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new CancelledError())
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new CancelledError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export interface DemoPlacesClientOptions {
  /** 手机现在的时间（假店照它开关门）。 */
  now: () => ZonedTime
  delayMs?: number
  delay?: (ms: number, signal?: AbortSignal) => Promise<void>
}

/** 演示用的「Google」：从不碰网络、密钥、额度。 */
export class DemoPlacesClient implements PlacesClient {
  private readonly now: () => ZonedTime
  private readonly delayMs: number
  private readonly delay: (ms: number, signal?: AbortSignal) => Promise<void>

  constructor(options: DemoPlacesClientOptions) {
    this.now = options.now
    this.delayMs = options.delayMs ?? DEMO_FAKE_DELAY_MS
    this.delay = options.delay ?? sleep
  }

  async search(choice: SearchChoice, center: LatLng, radiusMeters: number, signal?: AbortSignal): Promise<SearchOutcome> {
    await this.delay(this.delayMs, signal)
    if (signal?.aborted) throw new CancelledError()
    return { places: searchDemoPlaces(choice, center, radiusMeters, this.now()), failures: [] }
  }

  async photoUri(): Promise<string | null> {
    return null
  }
}
