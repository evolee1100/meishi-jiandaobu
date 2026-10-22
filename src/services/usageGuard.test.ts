import { describe, expect, it } from 'vitest'
import { QUOTA } from '../data/constants.ts'
import { QUERIES_PER_SEARCH } from '../domain/searchConfig.ts'
import { MemoryStore } from './storage.ts'
import { billingPeriod, UsageGuard } from './usageGuard.ts'

function setup(iso = '2026-10-15T04:00:00Z') {
  let now = Date.parse(iso)
  const store = new MemoryStore()
  const guard = new UsageGuard(store, () => now)
  return { store, guard, setNow: (value: string) => (now = Date.parse(value)) }
}

describe('六、每月免费额度（用量守卫）', () => {
  it('QUOTA-01 文字搜索和照片分开计数：3 个 + 2 个后，剩 897 和 898', () => {
    const { guard } = setup()
    for (let i = 0; i < 3; i++) expect(guard.tryRecordTextSearch()).toBe(true)
    for (let i = 0; i < 2; i++) expect(guard.tryRecordPhoto()).toBe(true)
    expect(guard.textSearchesUsed()).toBe(3)
    expect(guard.photosUsed()).toBe(2)
    expect(guard.remainingTextSearches()).toBe(897)
    expect(guard.remainingPhotos()).toBe(898)
  })

  it('QUOTA-02 计数存在本机：换一个守卫（重新打开网页）照样读得到', () => {
    const { store, guard } = setup()
    for (let i = 0; i < 4; i++) guard.tryRecordTextSearch()
    expect(new UsageGuard(store, () => Date.parse('2026-10-15T04:00:00Z')).textSearchesUsed()).toBe(4)
    expect(store.get('meishi.text_search_2026-10')).toBe('4')
  })

  it('QUOTA-03 上限 900/900，都比 Google 免费的 1,000 少', () => {
    expect(QUOTA.TEXT_SEARCH_MONTHLY_LIMIT).toBe(900)
    expect(QUOTA.PHOTO_MONTHLY_LIMIT).toBe(900)
    expect(QUOTA.TEXT_SEARCH_MONTHLY_LIMIT).toBeLessThan(QUOTA.GOOGLE_FREE_TEXT_SEARCH)
    expect(QUOTA.PHOTO_MONTHLY_LIMIT).toBeLessThan(QUOTA.GOOGLE_FREE_PHOTOS)
  })

  it('QUOTA-04 用了 898 个后：要 3 个的搜索不够、要 2 个的够，剩余搜索次数是 0', () => {
    const { guard } = setup()
    for (let i = 0; i < 898; i++) expect(guard.tryRecordTextSearch()).toBe(true)
    expect(guard.hasTextSearchBudget(3)).toBe(false)
    expect(guard.hasTextSearchBudget(2)).toBe(true)
    expect(guard.remainingSearchUses(3)).toBe(0)
  })

  it('QUOTA-05 记到 900 个后再记会失败，计数停在 900（照片也一样）', () => {
    const { guard } = setup()
    for (let i = 0; i < 900; i++) expect(guard.tryRecordTextSearch()).toBe(true)
    expect(guard.tryRecordTextSearch()).toBe(false)
    expect(guard.textSearchesUsed()).toBe(900)
    expect(guard.remainingTextSearches()).toBe(0)
    for (let i = 0; i < 900; i++) expect(guard.tryRecordPhoto()).toBe(true)
    expect(guard.tryRecordPhoto()).toBe(false)
    expect(guard.photosUsed()).toBe(900)
  })

  it('QUOTA-06 剩余搜索次数 = 剩余请求 ÷ 3 向下取整：887 → 295', () => {
    const { guard } = setup()
    expect(guard.remainingSearchUses(3)).toBe(300)
    for (let i = 0; i < 13; i++) guard.tryRecordTextSearch()
    expect(guard.remainingTextSearches()).toBe(887)
    expect(guard.remainingSearchUses(3)).toBe(295)
    expect(QUERIES_PER_SEARCH).toBe(3)
    expect(guard.remainingSearchUses()).toBe(295)
  })

  it('QUOTA-07 月份按洛杉矶时间：11 月 1 日 06:00 UTC 还是 10 月，08:00 UTC 才是 11 月', () => {
    const { guard, setNow } = setup()
    setNow('2026-11-01T06:00:00Z')
    expect(guard.currentPeriod()).toBe('2026-10')
    setNow('2026-11-01T08:00:00Z')
    expect(guard.currentPeriod()).toBe('2026-11')
    // 冬令时（太平洋标准时间 -8）也一样：12 月 1 日 07:59 UTC 还是 11 月。
    expect(billingPeriod(Date.parse('2026-12-01T07:59:00Z'))).toBe('2026-11')
    expect(billingPeriod(Date.parse('2026-12-01T08:00:00Z'))).toBe('2026-12')
  })

  it('QUOTA-08 到了新的一个月（洛杉矶时间）计数归零、又有 300 次，旧月份的记录被删掉', () => {
    const { store, guard, setNow } = setup()
    setNow('2026-11-01T06:00:00Z')
    for (let i = 0; i < 900; i++) guard.tryRecordTextSearch()
    guard.tryRecordPhoto()
    expect(guard.hasTextSearchBudget(3)).toBe(false)
    setNow('2026-11-01T09:00:00Z')
    expect(guard.textSearchesUsed()).toBe(0)
    expect(guard.photosUsed()).toBe(0)
    expect(guard.hasTextSearchBudget(3)).toBe(true)
    expect(guard.remainingSearchUses(3)).toBe(300)
    expect(guard.tryRecordTextSearch()).toBe(true)
    expect(guard.textSearchesUsed()).toBe(1)
    expect(store.keys().some((k) => k.endsWith('2026-10'))).toBe(false)
  })

  it('WEB-04 存储写不进去：一笔都记不了，回传 STORAGE（不能发）；每次记之前都重新读存储（别的分页记的也算）', () => {
    const { store, guard } = setup()
    store.broken = true
    expect(guard.record('TEXT_SEARCH')).toBe('STORAGE')
    expect(guard.tryRecordPhoto()).toBe(false)
    store.broken = false
    // 另一个分页在这期间记到了 899：这里重新读，只剩 1 个。
    store.set('meishi.text_search_2026-10', '899')
    expect(guard.record('TEXT_SEARCH')).toBe('OK')
    expect(guard.record('TEXT_SEARCH')).toBe('LIMIT')
  })
})
