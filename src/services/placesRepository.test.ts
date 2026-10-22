import { describe, expect, it } from 'vitest'
import { ALL_CUISINES, ALL_MEALS } from '../domain/cuisine.ts'
import { formatPrice } from '../domain/priceFormat.ts'
import { isEatery } from '../domain/ranking.ts'
import { queriesFor } from '../domain/searchConfig.ts'
import type { LatLng, SearchChoice } from '../domain/model.ts'
import { TEXT_SEARCH_KL } from '../test/fixtures/sampleResponses.ts'
import { mockGoogle, TEST_KEY, type MockAnswer, type RecordedRequest } from '../test/mockFetch.ts'
import { PlacesApi } from './placesApi.ts'
import { PlacesError } from './placesErrors.ts'
import { GooglePlacesClient, mergeQueryResults, mostInformativeFailure, toPlace } from './placesRepository.ts'
import { MemoryStore } from './storage.ts'
import { UsageGuard } from './usageGuard.ts'

const NOW = Date.parse('2026-10-15T04:00:00Z')
const parse = (json: string) => (JSON.parse(json) as { places?: unknown[] }).places ?? []

describe('四、读懂 Google 的回复', () => {
  const response = parse(TEXT_SEARCH_KL)
  const center: LatLng = { latitude: 3.1478, longitude: 101.7 }

  it('PARSE-01 样本回复的 6 家全部读出、顺序不变，不认识的字段被忽略', () => {
    expect(response.map((p) => (p as { id: string }).id)).toEqual([
      'ChIJnasiKandarPelita001', 'ChIJkopitiamLaiFoong002', 'ChIJfoodCourt003', 'ChIJriceWholesaler004', 'ChIJhotel005', 'ChIJnoRating006',
    ])
    expect(response.map((p) => toPlace(p, center)).every((p) => p != null)).toBe(true)
  })

  it('PARSE-02 字段齐全的一家：名字、星数、评价数、价钱、营业中、照片、类型都读对；短地址优先；作者；距离', () => {
    const place = toPlace(response[0], center)
    expect(place).not.toBeNull()
    if (!place) return
    expect(place.name).toBe('Restoran Nasi Kandar Pelita')
    expect(place.rating).toBeCloseTo(4.1, 9)
    expect(place.userRatingCount).toBe(12873)
    expect(place.priceLevel).toBe('INEXPENSIVE')
    expect(place.priceRange).toEqual({ start: { currencyCode: 'MYR', units: 10 }, end: { currencyCode: 'MYR', units: 20 } })
    expect(formatPrice(place.priceRange, place.priceLevel)).toBe('RM10–20')
    expect(place.openNow).toBe(true)
    expect(place.businessStatus).toBe('OPERATIONAL')
    expect(place.photoName).toBe('places/ChIJnasiKandarPelita001/photos/AUc7tXPhoto001')
    expect(place.photoAuthor).toBe('Ahmad Faizal')
    expect(place.primaryTypeDisplayName).toBe('印度餐厅')
    expect(place.types).toContain('halal_restaurant')
    expect(place.address).toBe('149, Jalan Ampang, Kuala Lumpur')
    expect(place.distanceMeters).toBeGreaterThanOrEqual(1500)
    expect(place.distanceMeters).toBeLessThanOrEqual(2500)
    expect(place.openingHours?.periods).toEqual([[0, null]])
  })

  it('PARSE-03 缺字段不会出错：没价钱等级、只有 openNow、没照片、只有长地址、只有起价、没营业资料、没评分、暂停营业', () => {
    const kopitiam = toPlace(response[1], center)!
    expect(kopitiam.name).toBe('联丰茶室')
    expect(kopitiam.priceLevel).toBeNull()
    expect(formatPrice(kopitiam.priceRange, kopitiam.priceLevel)).toBe('RM1–10')
    expect(kopitiam.openNow).toBe(false)
    expect(kopitiam.photoName).toBeNull()
    expect(kopitiam.openingHours).toBeNull()

    const foodCourt = toPlace(response[2], center)!
    expect(foodCourt.address).toBe('Lot 10 Hutong, 50 Jalan Sultan Ismail, Bukit Bintang, 50250 Kuala Lumpur')
    expect(formatPrice(foodCourt.priceRange, foodCourt.priceLevel)).toBe('RM15 以上')
    expect(foodCourt.openNow).toBeNull()
    expect(foodCourt.primaryTypeDisplayName).toBe('Food Court')

    const unrated = toPlace(response[5], center)!
    expect(unrated.rating).toBeNull()
    expect(unrated.userRatingCount).toBeNull()
    expect(unrated.address).toBeNull()
    expect(unrated.primaryType).toBeNull()
    expect(unrated.businessStatus).toBe('CLOSED_TEMPORARILY')
  })

  it('PARSE-04 吃饭地方的过滤留下嘛嘛档、咖啡店、美食中心、没评分的档口，去掉米行和酒店', () => {
    const kept = response
      .map((p) => toPlace(p, center))
      .filter((p) => p != null && isEatery(p.types, p.primaryType))
      .map((p) => p!.id)
    expect(kept).toEqual(['ChIJnasiKandarPelita001', 'ChIJkopitiamLaiFoong002', 'ChIJfoodCourt003', 'ChIJnoRating006'])
  })

  it('PARSE-05 缺 id、店名或坐标的店直接跳过', () => {
    const places = parse('{"places":[{"id":"a"},{"id":"b","displayName":{"text":"X"}},{"displayName":{"text":"Y"},"location":{"latitude":1,"longitude":2}},{"id":"c","displayName":{"text":"   "},"location":{"latitude":1,"longitude":2}}]}')
    expect(places.map((p) => toPlace(p, center)).filter((p) => p != null)).toEqual([])
  })

  it('PARSE-06 空回复 = 没有店；只有币种没有 units 的价钱算 0（RM0–8）；units 是数字也行；rating 和 photos 为 null 不出错', () => {
    expect(parse('{}')).toEqual([])
    const place = toPlace(
      parse('{"places":[{"id":"z","displayName":{"text":"Z"},"location":{"latitude":1,"longitude":2},"priceRange":{"startPrice":{"currencyCode":"MYR"},"endPrice":{"currencyCode":"MYR","units":8}},"rating":null,"photos":null}]}')[0],
      center,
    )!
    expect(formatPrice(place.priceRange, null)).toBe('RM0–8')
    expect(place.rating).toBeNull()
    expect(place.photoName).toBeNull()
  })

  it('PARSE-07 Google 错误信封读出 code 403、status、details 里的 reason 和 @type', () => {
    const body = '{"error":{"code":403,"message":"Requests from this Android client application <empty> are blocked.","status":"PERMISSION_DENIED","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_ANDROID_APP_BLOCKED","domain":"googleapis.com","metadata":{"service":"places.googleapis.com"}}]}}'
    const raw = JSON.parse(body) as { error: { details: { '@type': string }[] } }
    expect(raw.error.details[0]?.['@type']).toBe('type.googleapis.com/google.rpc.ErrorInfo')
    const api = new PlacesApi({ apiKey: () => TEST_KEY, usageGuard: new UsageGuard(new MemoryStore(), () => NOW), locks: null })
    const error = api.parseError(403, body)
    expect(error.code).toBe(403)
    expect(error.status).toBe('PERMISSION_DENIED')
    expect(error.reason).toBe('API_KEY_ANDROID_APP_BLOCKED')
  })
})

describe('五、一次搜索：多关键词并发、合并、过滤、额度检查', () => {
  const center: LatLng = { latitude: 3.139, longitude: 101.6869 }

  function placeJson(id: string, lat: number, lng: number, types = ['restaurant', 'food'], primary = 'restaurant') {
    return { id, displayName: { text: id }, location: { latitude: lat, longitude: lng }, rating: 4.2, userRatingCount: 120, types, primaryType: primary }
  }

  /** 按 textQuery 回答；没设的一律 500。照片一律给网址。 */
  function setup(options: { key?: string; answers?: Record<string, unknown[]>; guard?: UsageGuard; store?: MemoryStore } = {}) {
    const answers = options.answers ?? {}
    const server = mockGoogle((request: RecordedRequest): MockAnswer => {
      if (request.url.includes('/media?maxWidthPx=800&skipHttpRedirect=true')) return { body: '{"photoUri":"https://lh3.googleusercontent.com/p=w800"}' }
      const query = (JSON.parse(request.body ?? '{}') as { textQuery: string }).textQuery
      const places = answers[query]
      return places ? { body: JSON.stringify({ places }) } : { status: 500, body: '{"error":{"code":500,"message":"Internal error","status":"INTERNAL"}}' }
    })
    const store = options.store ?? new MemoryStore()
    const guard = options.guard ?? new UsageGuard(store, () => NOW)
    const key = options.key ?? TEST_KEY
    const api = new PlacesApi({ apiKey: () => key, usageGuard: guard, fetch: server.fetch, locks: null })
    const repo = new GooglePlacesClient({ api, usageGuard: guard, apiKey: () => key, usageStore: store })
    return { server, guard, repo, store }
  }

  function answerEveryQuery(): Record<string, unknown[]> {
    const answers: Record<string, unknown[]> = {}
    for (const cuisine of ALL_CUISINES) for (const meal of ALL_MEALS) for (const q of queriesFor({ cuisine, meal })) answers[q] = []
    return answers
  }

  async function failure(promise: Promise<unknown>): Promise<PlacesError> {
    try {
      await promise
    } catch (e) {
      if (e instanceof PlacesError) return e
      throw e
    }
    throw new Error('expected an exception')
  }

  it('REPO-01 「不限+饭」三个关键词同时发，一个失败（500）照样合并另外两个并去重，记下 1 个失败，3 个都计数', async () => {
    const a = placeJson('A', 3.142, 101.6869)
    const b = placeJson('B', 3.139, 101.692)
    const c = placeJson('C', 3.135, 101.6869)
    const { server, guard, repo } = setup({ answers: { 饭: [a, b], nasi: [b, c] } })
    const outcome = await repo.search({ cuisine: 'ANY', meal: 'RICE' }, center, 1500)
    expect(outcome.places.map((p) => p.id)).toEqual(['A', 'B', 'C'])
    expect(outcome.failures).toHaveLength(1)
    expect((outcome.failures[0] as PlacesError).code).toBe(500)
    expect(server.requests).toHaveLength(3)
    expect(guard.textSearchesUsed()).toBe(3)
  })

  it('REPO-02 「不限+面」发出的正好是 面、noodle restaurant、mee', async () => {
    const { server, repo } = setup({ answers: { 面: [], 'noodle restaurant': [], mee: [] } })
    await repo.search({ cuisine: 'ANY', meal: 'NOODLE' }, center, 1000)
    expect(new Set(server.textQueries())).toEqual(new Set(['面', 'noodle restaurant', 'mee']))
  })

  it('REPO-03 「日本餐+面」发出的正好是 拉面、ramen、udon', async () => {
    const { server, repo } = setup({ answers: answerEveryQuery() })
    await repo.search({ cuisine: 'JAPANESE', meal: 'NOODLE' }, center, 1000)
    expect(new Set(server.textQueries())).toEqual(new Set(['拉面', 'ramen', 'udon']))
  })

  it('REPO-04 「不限+都可以」发出的正好是 餐厅、restaurant、kedai makan', async () => {
    const { server, repo } = setup({ answers: answerEveryQuery() })
    await repo.search({ cuisine: 'ANY', meal: 'ANY' }, center, 1000)
    expect(new Set(server.textQueries())).toEqual(new Set(['餐厅', 'restaurant', 'kedai makan']))
  })

  it('REPO-05 只有 2 个关键词的组合（素食+都可以）只发 2 个、记 2 个', async () => {
    const { server, guard, repo } = setup({ answers: answerEveryQuery() })
    await repo.search({ cuisine: 'VEGETARIAN', meal: 'ANY' }, center, 1000)
    expect(server.requests).toHaveLength(2)
    expect(guard.textSearchesUsed()).toBe(2)
  })

  it('REPO-06 39 个组合逐一搜索，每次 1–3 个请求，从不超过 3 个；总数和计数一致', async () => {
    const { server, guard, repo } = setup({ answers: answerEveryQuery() })
    let sent = 0
    for (const cuisine of ALL_CUISINES) {
      for (const meal of ALL_MEALS) {
        await repo.search({ cuisine, meal }, center, 1000)
        const now = server.requests.length
        expect(now - sent, `${cuisine}/${meal}`).toBeGreaterThanOrEqual(1)
        expect(now - sent, `${cuisine}/${meal}`).toBeLessThanOrEqual(3)
        sent = now
      }
    }
    expect(guard.textSearchesUsed()).toBe(sent)
  })

  it('REPO-07 矩形角落里但圆形范围外的店、杂货店、酒店都被去掉，只剩范围内的餐厅', async () => {
    const { repo } = setup({
      answers: {
        饭: [
          placeJson('inside', 3.14, 101.6869),
          placeJson('corner', 3.15, 101.6979),
          placeJson('grocer', 3.1395, 101.687, ['grocery_store', 'food', 'store'], 'grocery_store'),
          placeJson('hotel', 3.1395, 101.6871, ['hotel', 'lodging', 'restaurant'], 'hotel'),
        ],
        'rice restaurant': [],
        nasi: [],
      },
    })
    const outcome = await repo.search({ cuisine: 'ANY', meal: 'RICE' }, center, 1500)
    expect(outcome.places.map((p) => p.id)).toEqual(['inside'])
    expect(outcome.failures).toHaveLength(0)
  })

  it('REPO-08 全部关键词都失败时，报 Google 的错误（500 + 原文）', async () => {
    const { repo } = setup()
    const e = await failure(repo.search({ cuisine: 'ANY', meal: 'RICE' }, center, 1500))
    expect(e.kind).toBe('HTTP')
    expect(e.code).toBe(500)
    expect(e.googleMessage).toBe('Internal error')
  })

  it('REPO-09 本月只剩 2 个请求（不够一次完整搜索）：一个都不发，报额度用完', async () => {
    const { server, guard, repo } = setup()
    for (let i = 0; i < 898; i++) guard.tryRecordTextSearch()
    expect((await failure(repo.search({ cuisine: 'ANY', meal: 'NOODLE' }, center, 1500))).kind).toBe('QUOTA_EXHAUSTED')
    expect(server.requests).toHaveLength(0)
    expect(guard.textSearchesUsed()).toBe(898)
  })

  it('REPO-10 只剩 2 个请求时，就算只要 2 个关键词的组合（素食+饭）也不发', async () => {
    const { server, guard, repo } = setup({ answers: answerEveryQuery() })
    for (let i = 0; i < 898; i++) guard.tryRecordTextSearch()
    expect(guard.remainingSearchUses()).toBe(0)
    const vegetarianRice: SearchChoice = { cuisine: 'VEGETARIAN', meal: 'RICE' }
    expect(queriesFor(vegetarianRice)).toHaveLength(2)
    expect((await failure(repo.search(vegetarianRice, center, 1500))).kind).toBe('QUOTA_EXHAUSTED')
    expect(server.requests).toHaveLength(0)
    expect(guard.textSearchesUsed()).toBe(898)
  })

  it('REPO-11 没有密钥：不发、不计数', async () => {
    const { server, guard, repo } = setup({ key: '' })
    expect((await failure(repo.search({ cuisine: 'ANY', meal: 'RICE' }, center, 1500))).kind).toBe('NO_API_KEY')
    expect(server.requests).toHaveLength(0)
    expect(guard.textSearchesUsed()).toBe(0)
  })

  it('REPO-12 密钥有 BOM 或空格：搜索报格式不对，照片返回空，一个请求都不发、不计数', async () => {
    const bom = setup({ key: '﻿testkey' })
    expect((await failure(bom.repo.search({ cuisine: 'ANY', meal: 'RICE' }, center, 1500))).kind).toBe('INVALID_API_KEY')
    const spaced = setup({ key: 'test key', guard: bom.guard })
    expect(await spaced.repo.photoUri('places/A/photos/1')).toBeNull()
    expect(bom.server.requests.length + spaced.server.requests.length).toBe(0)
    expect(bom.guard.textSearchesUsed()).toBe(0)
    expect(bom.guard.photosUsed()).toBe(0)
  })

  it('REPO-13 照片请求计数；照片额度用完后直接返回空（显示 emoji），不再发请求', async () => {
    const { server, guard, repo } = setup()
    expect(await repo.photoUri('places/A/photos/1')).toBe('https://lh3.googleusercontent.com/p=w800')
    expect(guard.photosUsed()).toBe(1)
    for (let i = 0; i < 899; i++) guard.tryRecordPhoto()
    expect(await repo.photoUri('places/A/photos/2')).toBeNull()
    expect(server.requests).toHaveLength(1)
  })

  it('REPO-14 合并时按第一次出现的顺序去重、没有 id 的丢掉；有成功的就忽略失败', () => {
    const merged = mergeQueryResults([
      { ok: true, value: [{ id: '1' }, { id: '2' }] },
      { ok: false, error: PlacesError.network() },
      { ok: true, value: [{ id: '2' }, { id: '3' }, { id: null }] },
    ])
    expect(merged.map((d) => (d as { id: string }).id)).toEqual(['1', '2', '3'])
  })

  it('REPO-15 全部失败时，优先报 Google 的 HTTP 错误，而不是网络错误', () => {
    const http = PlacesError.http(403, 'PERMISSION_DENIED', 'API_KEY_SERVICE_BLOCKED', 'blocked')
    expect(() =>
      mergeQueryResults([
        { ok: false, error: PlacesError.network() },
        { ok: false, error: http },
        { ok: false, error: PlacesError.network() },
      ]),
    ).toThrow(http)
  })

  it('REPO-16 错误优先级：额度用完 > Google 的 HTTP 错误 > 其他（第一个）', () => {
    const network = PlacesError.network()
    const http = PlacesError.http(500, 'INTERNAL', null, 'x')
    const quota = PlacesError.quotaExhausted()
    expect(mostInformativeFailure([network, http, quota])).toBe(quota)
    expect(mostInformativeFailure([network, http])).toBe(http)
    expect(mostInformativeFailure([network])).toBe(network)
  })

  it('REPO-17 全部成功但都是空的、或没有任何结果：合并后是空的', () => {
    expect(mergeQueryResults([{ ok: true, value: [] }])).toEqual([])
    expect(mergeQueryResults([])).toEqual([])
  })

  it('WEB-04 存储写不进去：真实搜索一个请求都不发（报 STORAGE_BLOCKED）', async () => {
    const store = new MemoryStore()
    const { server, repo } = setup({ store, answers: answerEveryQuery() })
    store.broken = true
    expect((await failure(repo.search({ cuisine: 'ANY', meal: 'RICE' }, center, 1500))).kind).toBe('STORAGE_BLOCKED')
    expect(server.requests).toHaveLength(0)
  })
})
