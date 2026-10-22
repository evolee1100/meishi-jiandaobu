import androidConfigRaw from '../test/golden/androidConfig.json?raw'
import { describe, expect, it } from 'vitest'
import { PLACES_API } from '../data/constants.ts'
import { boundsAround } from '../domain/geo.ts'
import { FIELD_MASK } from '../domain/searchConfig.ts'
import { TEXT_SEARCH_KL } from '../test/fixtures/sampleResponses.ts'
import { mockGoogle, TEST_KEY, type MockAnswer, type RecordedRequest } from '../test/mockFetch.ts'
import { PlacesApi } from './placesApi.ts'
import { PlacesError } from './placesErrors.ts'
import { MemoryStore } from './storage.ts'
import { UsageGuard } from './usageGuard.ts'

const center = { latitude: 3.139, longitude: 101.6869 }
const NOW = Date.parse('2026-10-15T04:00:00Z')

function setup(handler?: (r: RecordedRequest) => MockAnswer, key = TEST_KEY) {
  const server = mockGoogle(handler)
  const store = new MemoryStore()
  const guard = new UsageGuard(store, () => NOW)
  let apiKey = key
  const api = new PlacesApi({ apiKey: () => apiKey, usageGuard: guard, fetch: server.fetch, locks: null })
  return { server, store, guard, api, setKey: (k: string) => (apiKey = k) }
}

async function caught(promise: Promise<unknown>): Promise<PlacesError> {
  try {
    await promise
  } catch (e) {
    if (e instanceof PlacesError) return e
    throw e
  }
  throw new Error('expected an exception')
}

const bounds = () => boundsAround(center, 1000)

describe('三、向 Google 发请求（格式、计数、不重发）', () => {
  it('API-01 文字搜索：POST /v1/places:searchText，带密钥头、FIELD_MASK 头、JSON；请求体只有该有的字段（WEB-05 只有三个请求头）', async () => {
    const { server, api } = setup(() => ({ body: TEXT_SEARCH_KL }))
    const b = boundsAround(center, 1500)
    const places = await api.searchText('nasi', b)
    expect(places).toHaveLength(6)
    const request = server.requests[0] as RecordedRequest
    expect(request.method).toBe('POST')
    expect(request.url).toBe('https://places.googleapis.com/v1/places:searchText')
    expect(request.headers['X-Goog-Api-Key']).toBe(TEST_KEY)
    expect(request.headers['X-Goog-FieldMask']).toBe(FIELD_MASK)
    expect(request.headers['Content-Type']?.startsWith('application/json')).toBe(true)
    // 网页版只送三个请求头（没有安卓的 X-Android-Package / X-Android-Cert）。
    expect(Object.keys(request.headers).sort()).toEqual(['Content-Type', 'X-Goog-Api-Key', 'X-Goog-FieldMask'])
    const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>
    expect(body.textQuery).toBe('nasi')
    expect(body.languageCode).toBe('zh-CN')
    expect(body.regionCode).toBe('MY')
    expect(body.pageSize).toBe(20)
    const rect = (body.locationRestriction as { rectangle: { low: typeof center; high: typeof center } }).rectangle
    expect(rect.low.latitude).toBeCloseTo(b.low.latitude, 9)
    expect(rect.low.longitude).toBeCloseTo(b.low.longitude, 9)
    expect(rect.high.latitude).toBeCloseTo(b.high.latitude, 9)
    expect(rect.high.longitude).toBeCloseTo(b.high.longitude, 9)
    for (const absent of PLACES_API.FORBIDDEN_BODY_FIELDS) expect(body, absent).not.toHaveProperty(absent)
    expect(Object.keys(body).sort()).toEqual(['languageCode', 'locationRestriction', 'pageSize', 'regionCode', 'textQuery'])
  })

  it('WEB-05 请求头只有 X-Goog-Api-Key、X-Goog-FieldMask、Content-Type（不带安卓的 X-Android-Package / X-Android-Cert）；照片请求没有自订请求头；FIELD_MASK 和安卓导出的一字不差', async () => {
    const { server, api } = setup((r) => (r.url.includes('/media?') ? { body: '{"photoUri":"https://lh3.googleusercontent.com/a"}' } : { body: '{}' }))
    await api.searchText('云吞面', bounds())
    await api.fetchPhotoUri('places/A/photos/1')
    const [search, photo] = server.requests as [RecordedRequest, RecordedRequest]
    expect(Object.keys(search.headers).sort()).toEqual(['Content-Type', 'X-Goog-Api-Key', 'X-Goog-FieldMask'])
    expect(Object.keys(search.headers).some((h) => h.toLowerCase().startsWith('x-android'))).toBe(false)
    expect(search.headers['X-Goog-FieldMask']).toBe((JSON.parse(androidConfigRaw) as { fieldMask: string }).fieldMask)
    expect(Object.keys(photo.headers)).toEqual([]) // 简单请求：不用多一次预检
    expect(server.requests).toHaveLength(2)
  })

  it('API-02 FIELD_MASK 没有空格、都以 places. 开头、没有 places.*、没有翻页字段、没有贵的字段，必需的一个不少', () => {
    const fields = FIELD_MASK.split(',')
    expect(FIELD_MASK).not.toContain(' ')
    expect(fields.every((f) => f.startsWith('places.'))).toBe(true)
    expect(fields).not.toContain('places.*')
    expect(fields.some((f) => f.includes('nextPageToken'))).toBe(false)
    for (const prefix of PLACES_API.FORBIDDEN_FIELD_PREFIXES) expect(fields.some((f) => f.startsWith('places.' + prefix))).toBe(false)
    for (const needed of ['places.id', 'places.displayName', 'places.location', 'places.rating', 'places.userRatingCount', 'places.priceRange', 'places.priceLevel', 'places.currentOpeningHours', 'places.businessStatus', 'places.photos', 'places.types', 'places.primaryTypeDisplayName']) {
      expect(fields).toContain(needed)
    }
  })

  it('API-03 照片：GET /v1/{照片名}/media?maxWidthPx=800&skipHttpRedirect=true，回来的 photoUri 原样交给画面（密钥放网址参数：没有自订请求头，不用预检）', async () => {
    const { server, api } = setup(() => ({ body: '{"name":"places/ChIJabc/photos/AUc7xyz/media","photoUri":"https://lh3.googleusercontent.com/places/abc=w800"}' }))
    const uri = await api.fetchPhotoUri('places/ChIJabc/photos/AUc7xyz')
    expect(uri).toBe('https://lh3.googleusercontent.com/places/abc=w800')
    const request = server.requests[0] as RecordedRequest
    expect(request.method).toBe('GET')
    const url = new URL(request.url)
    expect(url.origin + url.pathname).toBe('https://places.googleapis.com/v1/places/ChIJabc/photos/AUc7xyz/media')
    expect(url.searchParams.get('maxWidthPx')).toBe('800')
    expect(url.searchParams.get('skipHttpRedirect')).toBe('true')
    expect(url.searchParams.get('key')).toBe(TEST_KEY)
    expect(Object.keys(request.headers)).toEqual([])
  })

  it('API-04 Google 的错误 JSON（403 SERVICE_DISABLED）读成 code、status、reason、原文', async () => {
    const { api } = setup(() => ({
      status: 403,
      body: '{"error":{"code":403,"message":"Places API (New) has not been used in project 123 before or it is disabled.","status":"PERMISSION_DENIED","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"SERVICE_DISABLED"}]}}',
    }))
    const e = await caught(api.searchText('面', bounds()))
    expect(e.kind).toBe('HTTP')
    expect(e.code).toBe(403)
    expect(e.status).toBe('PERMISSION_DENIED')
    expect(e.reason).toBe('SERVICE_DISABLED')
    expect(e.googleMessage?.startsWith('Places API (New) has not been used')).toBe(true)
  })

  it('API-05 不是 JSON 的错误正文（502 Bad Gateway）原样当成 Google 原文，reason 为空', async () => {
    const { api } = setup(() => ({ status: 502, body: 'Bad Gateway' }))
    const e = await caught(api.searchText('mee', bounds()))
    expect(e.code).toBe(502)
    expect(e.reason).toBeNull()
    expect(e.googleMessage).toBe('Bad Gateway')
  })

  it('API-06 连不上服务器（fetch 抛错，例如被 CORS 挡住）=「网络」错误', async () => {
    const { api } = setup(() => 'NETWORK_ERROR')
    expect((await caught(api.searchText('饭', bounds()))).kind).toBe('NETWORK')
  })

  it('API-07 200 但正文不是 JSON =「读取结果时出错」', async () => {
    const { api } = setup(() => ({ body: '<html>not json</html>' }))
    expect((await caught(api.searchText('饭', bounds()))).kind).toBe('BAD_RESPONSE')
  })

  it('API-08 没有密钥：一个请求都不发就报「没有密钥」', async () => {
    const { server, api } = setup(undefined, '  ')
    expect((await caught(api.searchText('饭', bounds()))).kind).toBe('NO_API_KEY')
    expect(server.requests).toHaveLength(0)
  })

  it('API-09 网页版不带安卓的 X-Android-Package / X-Android-Cert（网站限制靠浏览器自己送的来源网址）', () => {
    const { api } = setup()
    const built = api.buildSearchTextRequest('饭', boundsAround(center, 500))
    expect(built.init.headers).not.toHaveProperty('X-Android-Package')
    expect(built.init.headers).not.toHaveProperty('X-Android-Cert')
    expect(built.init.credentials).toBe('omit')
  })

  it('API-10 每一个真正发出去的请求都记一笔：成功、500 失败都算（2 个文字搜索 + 1 个照片）', async () => {
    const answers: MockAnswer[] = [{ body: '{"places":[]}' }, { status: 500, body: '{"error":{"code":500,"message":"x","status":"INTERNAL"}}' }, { body: '{"photoUri":"https://lh3.googleusercontent.com/a"}' }]
    const { api, guard } = setup(() => answers.shift() as MockAnswer)
    await api.searchText('饭', bounds())
    expect((await caught(api.searchText('面', bounds()))).kind).toBe('HTTP')
    await api.fetchPhotoUri('places/A/photos/1')
    expect(guard.textSearchesUsed()).toBe(2)
    expect(guard.photosUsed()).toBe(1)
  })

  it('API-11 请求发出去后连接断了：不自动重发，报网络错误，收到 2 个、也记 2 个', async () => {
    const answers: MockAnswer[] = [{ body: '{"places":[]}' }, 'NETWORK_ERROR', { body: '{"places":[]}' }]
    const { server, api, guard } = setup(() => answers.shift() as MockAnswer)
    await api.searchText('饭', bounds())
    expect((await caught(api.searchText('面', bounds()))).kind).toBe('NETWORK')
    expect(server.requests).toHaveLength(2)
    expect(guard.textSearchesUsed()).toBe(2)
  })

  it('API-12 fetch 不会自己重发（503 也不重发）；每调用一次 fetch 都先记一笔：服务器收到几个就记几个', async () => {
    const answers: MockAnswer[] = [{ status: 503, body: '' }, { body: '{"places":[]}' }]
    const { server, api, guard } = setup(() => answers.shift() as MockAnswer)
    expect((await caught(api.searchText('饭', bounds()))).code).toBe(503)
    expect(server.requests).toHaveLength(1)
    expect(guard.textSearchesUsed()).toBe(server.requests.length)
  })

  it('API-13 408 超时不自动重发，只发 1 个、记 1 个', async () => {
    const answers: MockAnswer[] = [{ status: 408, body: '' }, { body: '{"places":[]}' }]
    const { server, api, guard } = setup(() => answers.shift() as MockAnswer)
    expect((await caught(api.searchText('饭', bounds()))).code).toBe(408)
    expect(server.requests).toHaveLength(1)
    expect(guard.textSearchesUsed()).toBe(1)
  })

  it('API-14 本月 900 个用完后，文字搜索和照片都报「额度用完」，一个请求都不发，计数停在 900', async () => {
    const { server, api, guard } = setup(() => ({ body: '{}' }))
    for (let i = 0; i < 900; i++) guard.tryRecordTextSearch()
    for (let i = 0; i < 900; i++) guard.tryRecordPhoto()
    expect((await caught(api.searchText('饭', bounds()))).kind).toBe('QUOTA_EXHAUSTED')
    expect((await caught(api.fetchPhotoUri('places/A/photos/1'))).kind).toBe('QUOTA_EXHAUSTED')
    expect(server.requests).toHaveLength(0)
    expect(guard.textSearchesUsed()).toBe(900)
    expect(guard.photosUsed()).toBe(900)
  })

  it('API-15 密钥里有零宽空格：不发、不计数，直接报「格式不对」', async () => {
    const { server, api, guard } = setup(undefined, 'test​key')
    expect((await caught(api.searchText('饭', bounds()))).kind).toBe('INVALID_API_KEY')
    expect(server.requests).toHaveLength(0)
    expect(guard.textSearchesUsed()).toBe(0)
  })

  it('WEB-03 调用 fetch 的那一刻用量已经写进存储；写不进就不发；超时、被取消也照样算，从不重发', async () => {
    let seenAtSend = -1
    const { store, guard, api } = setup((request) => {
      if (request.url.endsWith('searchText')) seenAtSend = guard.textSearchesUsed()
      return { body: '{}' }
    })
    await api.searchText('饭', bounds())
    expect(seenAtSend).toBe(1) // 发的时候已经记好了
    // 存储写不进去：一个都不发。
    store.broken = true
    expect((await caught(api.searchText('饭', bounds()))).kind).toBe('STORAGE_BLOCKED')
    store.broken = false

    // 超时：算一次、报网络错误、不重发。
    const slow = mockGoogle(() => 'HANG')
    const slowGuard = new UsageGuard(new MemoryStore(), () => NOW)
    const slowApi = new PlacesApi({ apiKey: () => TEST_KEY, usageGuard: slowGuard, fetch: slow.fetch, locks: null, timeoutMs: 5 })
    expect((await caught(slowApi.searchText('饭', bounds()))).kind).toBe('NETWORK')
    expect(slow.requests).toHaveLength(1)
    expect(slowGuard.textSearchesUsed()).toBe(1)

    // 被取消（回首页）：已经发出去的照样算。
    const controller = new AbortController()
    const pending = slowApi.searchText('面', bounds(), controller.signal)
    controller.abort()
    await expect(pending).rejects.toThrow()
    expect(slowGuard.textSearchesUsed()).toBe(2)
  })

  it('WEB-03 好几个分页同时开着：有 navigator.locks 时「读-比-写」排队一个一个来', async () => {
    const order: string[] = []
    const locks = {
      async request<T>(name: string, callback: () => T | Promise<T>): Promise<T> {
        order.push('lock:' + name)
        return callback()
      },
    }
    const server = mockGoogle(() => {
      order.push('fetch')
      return { body: '{}' }
    })
    const guard = new UsageGuard(new MemoryStore(), () => NOW)
    const api = new PlacesApi({ apiKey: () => TEST_KEY, usageGuard: guard, fetch: server.fetch, locks })
    await api.searchText('饭', bounds())
    expect(order).toEqual(['lock:meishi-usage', 'fetch'])
  })

  it('TOOL-01 测试工具：模拟的 fetch + 原生 JSON 能跑通一次请求和解析', async () => {
    const server = mockGoogle(() => ({ body: '{"name":"牛肉面","rating":4.7}' }))
    const response = await server.fetch('https://example.test/places')
    expect(JSON.parse(await response.text())).toEqual({ name: '牛肉面', rating: 4.7 })
    expect(server.requests[0]?.url).toBe('https://example.test/places')
  })
})
