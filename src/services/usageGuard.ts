/**
 * 用量守卫（安卓 data/UsageGuard.kt）：每一个真正要发给 Google 的收费请求，在发出去之前先在本机记一笔
 * （成功、失败、超时、被取消都算），本月到 900 个就一个都不发。月份按美国洛杉矶时间（Google 按太平洋时间结账）。
 *
 * 网页版另外：localStorage 写不进去（隐私模式、被封锁）→ 不能保证不超额，就不发（回传 STORAGE）。
 * 每次记一笔前都重新读 localStorage（可能好几个分页同时开着），不用记在内存里的数。
 */
import { QUOTA } from '../data/constants.ts'
import { localFields } from '../domain/time.ts'
import { KEY_PREFIX, readInt, type KeyValueStore } from './storage.ts'

export const TEXT_SEARCH_MONTHLY_LIMIT = QUOTA.TEXT_SEARCH_MONTHLY_LIMIT
export const PHOTO_MONTHLY_LIMIT = QUOTA.PHOTO_MONTHLY_LIMIT
export const SEARCHES_PER_MONTH = QUOTA.SEARCHES_PER_MONTH
export const BILLING_ZONE = QUOTA.BILLING_ZONE

const TEXT_PREFIX = KEY_PREFIX + 'text_search_'
const PHOTO_PREFIX = KEY_PREFIX + 'photo_'

export type BillableRequest = 'TEXT_SEARCH' | 'PHOTO'

/** 记一笔的结果：记好了可以发 / 本月用完 / 存储写不进去（都不能发）。 */
export type RecordResult = 'OK' | 'LIMIT' | 'STORAGE'

/** 洛杉矶时间的「2026-10」。 */
export function billingPeriod(epochMillis: number): string {
  const f = localFields(epochMillis, BILLING_ZONE)
  return `${String(f.year).padStart(4, '0')}-${String(f.month).padStart(2, '0')}`
}

export class UsageGuard {
  private readonly store: KeyValueStore
  private readonly now: () => number
  private readonly textLimit: number
  private readonly photoLimit: number

  constructor(
    store: KeyValueStore,
    now: () => number = Date.now,
    textLimit: number = TEXT_SEARCH_MONTHLY_LIMIT,
    photoLimit: number = PHOTO_MONTHLY_LIMIT,
  ) {
    this.store = store
    this.now = now
    this.textLimit = textLimit
    this.photoLimit = photoLimit
  }

  currentPeriod(): string {
    return billingPeriod(this.now())
  }

  textSearchesUsed(): number {
    return Math.max(readInt(this.store, TEXT_PREFIX + this.currentPeriod(), 0), 0)
  }

  photosUsed(): number {
    return Math.max(readInt(this.store, PHOTO_PREFIX + this.currentPeriod(), 0), 0)
  }

  remainingTextSearches(): number {
    return Math.max(this.textLimit - this.textSearchesUsed(), 0)
  }

  remainingPhotos(): number {
    return Math.max(this.photoLimit - this.photosUsed(), 0)
  }

  /** 要 n 个文字搜索请求的搜索放不放得下。 */
  hasTextSearchBudget(requests: number): boolean {
    return this.remainingTextSearches() >= requests
  }

  /** 本月还可以搜索几次 = ⌊剩下的文字搜索请求 ÷ 3⌋。 */
  remainingSearchUses(queriesPerSearch: number = QUOTA.QUERIES_PER_SEARCH): number {
    return Math.floor(this.remainingTextSearches() / Math.max(queriesPerSearch, 1))
  }

  /** 发一个文字搜索请求之前记一笔；false = 不能发。 */
  tryRecordTextSearch(): boolean {
    return this.record('TEXT_SEARCH') === 'OK'
  }

  /** 发一个照片请求之前记一笔；false = 不能发。 */
  tryRecordPhoto(): boolean {
    return this.record('PHOTO') === 'OK'
  }

  /** 先读（每次都重新读 localStorage）→ 比上限 → 写回去（写不进去就不发）→ 删掉别的月份。 */
  record(kind: BillableRequest): RecordResult {
    const period = this.currentPeriod()
    const prefix = kind === 'TEXT_SEARCH' ? TEXT_PREFIX : PHOTO_PREFIX
    const limit = kind === 'TEXT_SEARCH' ? this.textLimit : this.photoLimit
    const key = prefix + period
    const used = Math.max(readInt(this.store, key, 0), 0)
    if (used >= limit) return 'LIMIT'
    if (!this.store.set(key, String(used + 1))) return 'STORAGE'
    this.pruneOldPeriods(period)
    return 'OK'
  }

  /** 只留这个月的两个键。 */
  private pruneOldPeriods(current: string): void {
    for (const key of this.store.keys()) {
      if ((key.startsWith(TEXT_PREFIX) || key.startsWith(PHOTO_PREFIX)) && !key.endsWith(current)) this.store.remove(key)
    }
  }
}
