/**
 * 状态层（MainStore）的测试架子：和安卓 MainViewModel 测试一样，把定位、Google、照片、翻译、时钟、随机数都换成假的。
 * 「被系统关掉再回来」= 把同一个 session 存储交给新的 MainStore（网页：分页被丢掉再载入）。
 */
import { ChineseLocalizer } from '../domain/localizer.ts'
import type { NameTranslator } from '../domain/localizer.ts'
import type { LatLng, Place, SearchChoice } from '../domain/model.ts'
import { DemoPlacesClient } from '../services/demoPlaces.ts'
import { MemoryGameStore, type GameStore } from '../services/gameStore.ts'
import type { LocationSource } from '../services/location.ts'
import type { PlacesClient } from '../services/placesRepository.ts'
import { MemorySettings } from '../services/settings.ts'
import { MemoryStore, type KeyValueStore } from '../services/storage.ts'
import { UsageGuard } from '../services/usageGuard.ts'
import { MemoryVisitStore, type VisitStore } from '../services/visitStore.ts'
import { MainStore } from '../app/store.ts'
import { resultsItems, type ResultsState } from '../app/state.ts'
import { FakeLocation, FakePhotos, FakeSearcher, flush, KL, klMillis, PrefixTranslator, seeded, TestClock, testPlace } from './helpers.ts'

/** 用量守卫用的固定时钟（2026-10-15，洛杉矶也是 10 月）。 */
export const GUARD_NOW = Date.parse('2026-10-15T04:00:00Z')

export const RICE: SearchChoice = { cuisine: 'ANY', meal: 'RICE' }
export const NOODLE: SearchChoice = { cuisine: 'ANY', meal: 'NOODLE' }
export const CHINESE_RICE: SearchChoice = { cuisine: 'CHINESE', meal: 'RICE' }
export const ANY_ANY: SearchChoice = { cuisine: 'ANY', meal: 'ANY' }

/** 茨厂街。 */
export const PETALING: LatLng = { latitude: 3.144, longitude: 101.6979 }

export interface HarnessOptions {
  /** 起始时间（默认 2026-10-06 星期二 12:30 吉隆坡）。 */
  startMillis?: number
  position?: LatLng
  places?: Place[]
  translator?: NameTranslator
  openNowOnly?: boolean
  apiKey?: string
  demoMode?: boolean
  phoneSeed?: bigint | number
}

export class Harness {
  readonly clock: TestClock
  readonly location: FakeLocation
  readonly searcher: FakeSearcher
  readonly photos = new FakePhotos()
  translator: NameTranslator
  readonly settings: MemorySettings
  readonly guardStore = new MemoryStore()
  readonly guard: UsageGuard
  readonly visits: VisitStore = new MemoryVisitStore()
  readonly games: GameStore
  /** 最近一个状态层用的 sessionStorage（afterProcessDeath() 默认复制它）。 */
  session: KeyValueStore = new MemoryStore()
  /** 演示的假「Google」。 */
  readonly demo: PlacesClient
  places: PlacesClient | null = null
  /** 换成别的定位来源（例如用假的 navigator 做的 BrowserLocationSource）。 */
  locationSource: LocationSource | null = null
  /** localStorage 写得进去吗（假装隐私模式时设成 () => false）。 */
  storageWritable: (() => boolean) | undefined = undefined

  constructor(options: HarnessOptions = {}) {
    this.clock = new TestClock(options.startMillis ?? klMillis(6, 12, 30))
    this.location = new FakeLocation(this.clock, options.position ?? PETALING)
    this.searcher = new FakeSearcher(options.places ?? [])
    this.translator = options.translator ?? new PrefixTranslator()
    this.settings = new MemorySettings({
      apiKeyOverride: options.apiKey ?? 'test-key-1234',
      openNowOnly: options.openNowOnly ?? true,
      demoMode: options.demoMode ?? false,
    })
    this.guard = new UsageGuard(this.guardStore, () => GUARD_NOW)
    this.games = new MemoryGameStore(options.phoneSeed ?? 1234)
    this.demo = new DemoPlacesClient({ now: () => this.clock.zoned(), delayMs: 0 })
  }

  /**
   * 一个新的状态层。session 不给 = 新开的分页（sessionStorage 是空的，和安卓测试的 viewModel() 一样）；
   * 给 afterProcessDeath() 的复制品 = 同一个分页被丢掉再载入（安卓的 viewModel(savedState.afterProcessDeath())）。
   * localStorage 里的东西（设置、用量、吃过的记录、这一餐）是同一个架子共用的。
   */
  store(seed = 5, session: KeyValueStore = new MemoryStore()): MainStore {
    this.session = session
    return new MainStore({
      location: this.locationSource ?? this.location,
      places: this.places ?? this.searcher,
      photos: this.places ?? this.photos,
      localizer: new ChineseLocalizer(this.translator),
      usageGuard: this.guard,
      settings: this.settings,
      session,
      now: this.clock.now,
      elapsed: this.clock.elapsed,
      zone: () => KL,
      random: seeded(seed),
      demoPlaces: this.demo,
      visitStore: this.visits,
      gameStore: this.games,
      storageWritable: this.storageWritable,
    })
  }

  /** 安卓的 savedState.afterProcessDeath()：复制一份 session 内容给新的状态层（默认是最近一个状态层的）。 */
  afterProcessDeath(session: KeyValueStore = this.session): KeyValueStore {
    const copy = new MemoryStore()
    for (const key of session.keys()) {
      const value = session.get(key)
      if (value != null) copy.set(key, value)
    }
    return copy
  }
}

export function results(store: MainStore): ResultsState {
  const ui = store.ui
  if (ui.kind !== 'RESULTS') throw new Error('不是结果页：' + JSON.stringify(ui).slice(0, 300))
  return ui
}

export function shownIds(store: MainStore): string[] {
  return resultsItems(results(store)).map((item) => item.place.id)
}

/** 画面上这一页第 index 家（没有就报错）。 */
export function placeAt(store: MainStore, index: number): Place {
  const item = resultsItems(results(store))[index]
  if (!item) throw new Error(`这一页没有第 ${index + 1} 家`)
  return item.place
}

export async function searched(store: MainStore, choice: SearchChoice = CHINESE_RICE): Promise<void> {
  store.search(choice)
  await flush()
}

/** p1…pN，最好的在前；true 营业中、false 休息中、null 不明（照 Google 搜索时说的）。 */
export function shops(open: readonly (boolean | null)[], step = 0.01): Place[] {
  return open.map((isOpen, index) => ({ ...testPlace(`p${index + 1}`, { rating: 4.9 - index * step, reviews: 500 }), openNow: isOpen }))
}

export function times<T>(n: number, value: T): T[] {
  return Array.from({ length: n }, () => value)
}

/** 从 from 往北走 meters 米的点（1 纬度约 111,195 米）。 */
export function north(from: LatLng, meters: number): LatLng {
  return { latitude: from.latitude + meters / 111_195, longitude: from.longitude }
}

/** 安卓 MainViewModelTest 的 ranked(n)：p1…pN，好的在前；closed 的 openNow = false，unknown 的 = null，其他营业中。 */
export function rankedShops(n: number, closed: readonly number[] = [], unknown: readonly number[] = []): Place[] {
  return Array.from({ length: n }, (_, k) => {
    const i = k + 1
    return { ...testPlace(`p${i}`, { rating: 4.9 - i * 0.1, reviews: 500 }), openNow: closed.includes(i) ? false : unknown.includes(i) ? null : true }
  })
}
