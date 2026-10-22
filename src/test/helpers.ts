/**
 * 单元测试共用的小工具：假店、假时钟、假定位、假 Google、假翻译器，和「等一下让 Promise 跑完」。
 * 时间一律用吉隆坡时区（不依赖跑测试那台电脑的时区）。
 */
import traditionalRaw from '../../scripts/data/traditional-chinese-chars.txt?raw'
import { KotlinRandom } from '../data/kotlinRandom.ts'
import type { NameTranslator } from '../domain/localizer.ts'
import { makePlace, type LatLng, type Place, type SearchChoice } from '../domain/model.ts'
import { epochFromLocal, localFields, type ZonedTime } from '../domain/time.ts'
import type { LocationResult, LocationSource, PermissionAnswer, PermissionLevel } from '../services/location.ts'
import type { PlacesClient, SearchOutcome } from '../services/placesRepository.ts'

export const KL = 'Asia/Kuala_Lumpur'

/** 2026 年 10 月某日（6 日是星期二）吉隆坡时间。 */
export function klMillis(day: number, hour: number, minute = 0, month = 10, year = 2026): number {
  return epochFromLocal(KL, year, month, day, hour, minute)
}

export function klAt(day: number, hour: number, minute = 0, month = 10): ZonedTime {
  return { epochMillis: klMillis(day, hour, minute, month), zone: KL }
}

/** 测试店（和安卓 TestPlaces.testPlace 一样的预设值）。 */
export function testPlace(
  id: string,
  options: {
    rating?: number | null
    reviews?: number | null
    distanceMeters?: number
    businessStatus?: string | null
    name?: string
    photoName?: string | null
    primaryTypeDisplayName?: string | null
    location?: LatLng
  } = {},
): Place {
  return makePlace({
    id,
    name: options.name ?? `店 ${id}`,
    address: 'Jalan Ampang, Kuala Lumpur',
    location: options.location ?? { latitude: 3.139, longitude: 101.6869 },
    distanceMeters: options.distanceMeters ?? 300,
    rating: options.rating === undefined ? 4.2 : options.rating,
    userRatingCount: options.reviews === undefined ? 100 : options.reviews,
    businessStatus: options.businessStatus === undefined ? 'OPERATIONAL' : options.businessStatus,
    photoName: options.photoName === undefined ? `places/${id}/photos/p1` : options.photoName,
    primaryType: 'restaurant',
    primaryTypeDisplayName: options.primaryTypeDisplayName === undefined ? '餐厅' : options.primaryTypeDisplayName,
    types: ['restaurant', 'food', 'point_of_interest', 'establishment'],
  })
}

/** 让所有已经可以继续的 Promise 跑完（假的定位、Google、翻译都是马上回答的）。 */
export async function flush(rounds = 300): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve()
}

/** Kotlin 的 Random(seed)。 */
export function seeded(seed: number | bigint): KotlinRandom {
  return new KotlinRandom(seed)
}

// ------------------------------------------------------------------ 时钟

/** 墙上时钟 + 单调时钟，一起往前走（安卓测试的 nowMillis / elapsedMillis）。 */
export class TestClock {
  nowMillis: number
  elapsedMillis = 5 * 60 * 60_000
  readonly zone: string

  constructor(nowMillis: number, zone = KL) {
    this.nowMillis = nowMillis
    this.zone = zone
  }

  advance(millis: number): void {
    this.nowMillis += millis
    this.elapsedMillis += millis
  }

  /** 跳到当天（或 plusDays 天后）的某个钟点。 */
  setTime(hour: number, minute = 0, plusDays = 0): void {
    const f = localFields(this.nowMillis, this.zone)
    const date = new Date(Date.UTC(f.year, f.month - 1, f.day + plusDays))
    const target = epochFromLocal(this.zone, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute)
    this.advance(target - this.nowMillis)
  }

  /** 当天某个钟点的毫秒。 */
  todayAt(hour: number, minute = 0): number {
    const f = localFields(this.nowMillis, this.zone)
    return epochFromLocal(this.zone, f.year, f.month, f.day, hour, minute)
  }

  zoned(): ZonedTime {
    return { epochMillis: this.nowMillis, zone: this.zone }
  }

  readonly now = (): number => this.nowMillis
  readonly elapsed = (): number => this.elapsedMillis
  readonly zoneFn = (): string => this.zone
}

// ------------------------------------------------------------------ 假定位

export class FakeLocation implements LocationSource {
  level: PermissionLevel = 'PRECISE'
  /** 浏览器挡住了（Permissions API 说 denied）。 */
  blocked = false
  servicesOn = true
  unavailable = false
  position: LatLng
  calls = 0
  /** requestPermission 时用户怎么回答：'allow' | 'dismiss' | 'block'。 */
  answer: 'allow' | 'dismiss' | 'block' = 'allow'
  private readonly clock: TestClock
  private readonly listeners = new Set<() => void>()

  constructor(clock: TestClock, position: LatLng = { latitude: 3.139, longitude: 101.6869 }) {
    this.clock = clock
    this.position = position
  }

  permissionLevel(): PermissionLevel {
    return this.level
  }

  permanentlyDenied(): boolean {
    return this.level === 'NONE' && this.blocked
  }

  locationServicesEnabled(): boolean {
    return this.servicesOn
  }

  async currentLocation(): Promise<LocationResult> {
    this.calls++
    if (this.level === 'NONE') return { kind: 'NO_PERMISSION' }
    if (!this.servicesOn) return { kind: 'SERVICES_OFF' }
    if (this.unavailable) return { kind: 'UNAVAILABLE' }
    return {
      kind: 'SUCCESS',
      fix: { latLng: this.position, elapsedMillis: this.clock.elapsedMillis, approximate: this.level === 'APPROXIMATE' },
    }
  }

  async requestPermission(): Promise<PermissionAnswer> {
    if (this.answer === 'allow') {
      this.level = 'PRECISE'
      this.blocked = false
      return {
        granted: true,
        permanentlyDenied: false,
        interrupted: false,
        fix: { latLng: this.position, elapsedMillis: this.clock.elapsedMillis, approximate: false },
      }
    }
    if (this.answer === 'block') this.blocked = true
    return { granted: false, permanentlyDenied: this.blocked, interrupted: false, fix: null }
  }

  onPermissionChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 假装浏览器发了 change 事件。 */
  firePermissionChange(): void {
    for (const listener of [...this.listeners]) listener()
  }
}

// ------------------------------------------------------------------ 假 Google

export class FakeSearcher implements PlacesClient {
  places: Place[]
  calls = 0
  readonly choices: SearchChoice[] = []
  readonly radii: number[] = []
  error: unknown = null
  failures: unknown[] = []

  constructor(places: Place[] = []) {
    this.places = places
  }

  async search(choice: SearchChoice, _center: LatLng, radiusMeters: number): Promise<SearchOutcome> {
    this.calls++
    this.choices.push(choice)
    this.radii.push(radiusMeters)
    if (this.error) throw this.error
    return { places: this.places, failures: this.failures }
  }

  async photoUri(): Promise<string | null> {
    throw new Error('photos go through FakePhotos')
  }
}

export class FakePhotos {
  readonly requested: string[] = []
  /** 有值时，照片请求要等它 resolve 才回答（「还在拿」）。 */
  gate: Promise<void> | null = null
  get calls(): number {
    return this.requested.length
  }

  async photoUri(photoName: string): Promise<string | null> {
    this.requested.push(photoName)
    if (this.gate) await this.gate
    return `https://lh3.googleusercontent.com/${photoName}`
  }
}

/** 可以自己决定什么时候放行的 Promise（Kotlin 的 CompletableDeferred）。 */
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** 翻译要等 gate 放行：测试看得到「先显示原名」的那一刻。 */
export class GatedTranslator implements NameTranslator {
  readonly gate = deferred()
  readonly calls: string[] = []
  fail = false

  async translateToChinese(text: string): Promise<string> {
    this.calls.push(text)
    await this.gate.promise
    if (this.fail) throw new Error('model download failed')
    if (text === 'Restoran Nasi Kandar Pelita') return '佩利塔扁担饭餐厅'
    if (text === 'Food Court') return '美食广场'
    return `译:${text}`
  }

  close(): void {}
}

/** 马上翻好：「译」+ 原文。 */
export class PrefixTranslator implements NameTranslator {
  readonly calls: string[] = []
  closed = false
  private readonly prefix: string

  constructor(prefix = '译') {
    this.prefix = prefix
  }

  async translateToChinese(text: string): Promise<string> {
    this.calls.push(text)
    return `${this.prefix}${text}`
  }

  close(): void {
    this.closed = true
  }
}

/** 永远失败（像模型下载失败）。 */
export class FailingTranslator implements NameTranslator {
  readonly calls: string[] = []

  async translateToChinese(text: string): Promise<string> {
    this.calls.push(text)
    throw new Error('model download failed')
  }

  close(): void {}
}

// ------------------------------------------------------------------ 繁体字

const TRADITIONAL = new Set<string>()
for (const line of traditionalRaw.split('\n')) {
  if (line.startsWith('#')) continue
  for (const ch of line.trim()) TRADITIONAL.add(ch)
}

export const TRADITIONAL_CHAR_COUNT = TRADITIONAL.size

/** 找出繁体字（每个只列一次，按出现顺序）。 */
export function findTraditional(text: string): string[] {
  return [...new Set([...text].filter((c) => TRADITIONAL.has(c)))]
}

/** 不换行空格看起来就是空格。 */
export function plain(text: string): string {
  return text.replace(/ /g, ' ').replace(/​/g, '').replace(/⁠/g, '')
}
