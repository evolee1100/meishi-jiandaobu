/**
 * 状态层（MainStore）的测试，逐条照搬安卓 MainViewModelTest（第一、二版的功能）。
 * 定位、Google、照片、翻译、时钟、随机数都是假的；「被系统关掉」= 把同一个 sessionStorage 交给新的状态层。
 */
import { describe, expect, it } from 'vitest'
import { isReasonable, isSpecific } from '../domain/cuisine.ts'
import { play } from '../domain/rps.ts'
import { PlacesError } from '../services/placesErrors.ts'
import { deferred, flush, GatedTranslator, seeded, testPlace } from '../test/helpers.ts'
import { Harness, north, NOODLE, rankedShops, results, RICE, shownIds } from '../test/storeHarness.ts'
import { MEAL_MS } from './store.ts'
import { foundCount, hasMore, PHOTO_NONE, PHOTO_PENDING, photoLoaded, resultsView } from './state.ts'

const MINUTE = 60_000
const HOME = { latitude: 3.139, longitude: 101.6869 }

/** 安卓测试的四家店：马来文名、中文名、英文名（类型名也是英文、没有照片）、第四家。 */
function mainPlaces() {
  return [
    testPlace('pelita', { rating: 4.5, reviews: 800, name: 'Restoran Nasi Kandar Pelita' }),
    testPlace('laifoong', { rating: 4.3, reviews: 600, name: '联丰茶室' }),
    testPlace('hutong', { rating: 4.0, reviews: 500, name: 'Lot 10 Hutong', primaryTypeDisplayName: 'Food Court', photoName: null }),
    testPlace('fourth', { rating: 3.5, reviews: 100, name: '第四家' }),
  ]
}

const PELITA_PHOTO = photoLoaded('https://lh3.googleusercontent.com/places/pelita/photos/p1')

/** 安卓 MainViewModelTest 的环境：只看营业中关着（这些测试写在它变成默认之前），翻译要等放行。 */
function setup(options: { places?: ReturnType<typeof mainPlaces>; apiKey?: string } = {}) {
  const translator = new GatedTranslator()
  const h = new Harness({ position: HOME, places: options.places ?? mainPlaces(), translator, openNowOnly: false, apiKey: options.apiKey })
  return { h, translator }
}

describe('状态层：定位与权限（安卓 MainViewModelTest）', () => {
  it('LOCATION-06 已经允许定位时，一打开就定位一次，首页显示已取得位置', async () => {
    const { h } = setup()
    const store = h.store(1)
    await flush()
    expect(store.home.location).toEqual({ kind: 'READY', approximate: false })
    expect(h.location.calls).toBe(1)
  })

  it('LOCATION-07 只允许大概位置也能用：显示「大概位置」那句，照样能搜索', async () => {
    const { h } = setup()
    h.location.level = 'APPROXIMATE'
    const store = h.store(1)
    await flush()
    expect(store.home.location).toEqual({ kind: 'READY', approximate: true })
    store.search(RICE)
    await flush()
    expect(store.ui.kind).toBe('RESULTS')
  })

  it('LOCATION-08 第一次的询问被关掉（没有选不允许）= 暂时没权限、不算挡住；这时搜索显示「需要定位权限」（可以再问）', async () => {
    const { h } = setup()
    h.location.level = 'NONE'
    h.location.answer = 'dismiss'
    const store = h.store(1)
    await flush()
    expect(store.home.location).toEqual({ kind: 'WAITING_PERMISSION' })
    expect(store.home.explainLocation).toBe(true)
    await store.acceptLocationExplanation()
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: false })
    expect(h.location.permanentlyDenied()).toBe(false)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'PERMISSION_NEEDED', permanently: false } })
  })

  it('LOCATION-09 被打断的授权请求不算拒绝', () => {
    const { h } = setup()
    h.location.level = 'NONE'
    h.location.blocked = true
    const store = h.store(1)
    store.onPermissionResult({ granted: false, permanentlyDenied: true, interrupted: true, fix: null })
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: false })
  })

  it('LOCATION-10 浏览器挡住了（网页版的「拒绝两次」）= 永久；搜索显示去设置开启、不搜索；在浏览器设置打开回来 → 自动定位、继续那次搜索', async () => {
    const { h } = setup()
    h.location.level = 'NONE'
    h.location.answer = 'block'
    const store = h.store(1)
    await flush()
    await store.acceptLocationExplanation()
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: true })

    // 之后（重新打开网页）：浏览器直接说不，不再显示说明。
    const later = h.store(1)
    expect(later.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: true })
    expect(later.home.explainLocation).toBe(false)
    expect(later.requestSearch(NOODLE)).toBe('SEARCHING')
    await flush()
    expect(later.ui).toEqual({ kind: 'ERROR', choice: NOODLE, error: { kind: 'PERMISSION_NEEDED', permanently: true } })
    expect(h.searcher.calls).toBe(0)

    // 在浏览器设置里改成允许，回到页面：没有旧的错误页，接着搜那一次。
    h.location.level = 'PRECISE'
    h.location.blocked = false
    later.onResume()
    await flush()
    expect(later.home.location).toEqual({ kind: 'READY', approximate: false })
    expect(results(later).choice).toEqual(NOODLE)
    expect(h.searcher.calls).toBe(1)
  })

  it('LOCATION-11 定位服务关着 → 错误页；回来时还关着就留着；打开后回来自动继续搜索', async () => {
    const { h } = setup()
    h.location.servicesOn = false
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'LOCATION_SERVICES_OFF' } })
    store.onResume()
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'LOCATION_SERVICES_OFF' } })
    h.location.servicesOn = true
    store.onResume()
    await flush()
    expect(results(store).choice).toEqual(RICE)
    expect(h.searcher.calls).toBe(1)
  })

  it('LOCATION-12 拿不到新位置、旧位置超过 10 分钟：显示「拿不到你的位置」、不搜索', async () => {
    const { h } = setup()
    const store = h.store(1)
    await flush()
    h.location.unavailable = true
    h.clock.advance(11 * MINUTE)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'LOCATION_UNAVAILABLE' } })
    expect(h.searcher.calls).toBe(0)
  })

  it('LOCATION-13 拿不到新位置、旧位置 5 分钟内：照样用它搜索', async () => {
    const { h } = setup()
    const store = h.store(1)
    await flush()
    h.location.unavailable = true
    h.clock.advance(5 * MINUTE)
    store.search(RICE)
    await flush()
    expect(store.ui.kind).toBe('RESULTS')
  })

  it('LOCATION-14 用户把手机时钟调回 1 小时、实际过了 3 分钟：位置算旧了、重新定位（用单调时钟）', async () => {
    const { h } = setup()
    const store = h.store(1)
    await flush()
    expect(h.location.calls).toBe(1)
    h.clock.nowMillis -= 60 * MINUTE
    h.clock.elapsedMillis += 3 * MINUTE
    store.search(RICE)
    await flush()
    expect(h.location.calls).toBe(2)
  })
})

describe('状态层：店名机翻、照片', () => {
  it('TRANSLATE-12 结果先显示原名（前 3 家、名次 1–3、一共 4 家），中文名不交给翻译器、英文类型名会翻；翻好后换上中文名和中文类型', async () => {
    const { h, translator } = setup()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    const before = results(store)
    expect(shownIds(store)).toEqual(['pelita', 'laifoong', 'hutong'])
    expect(resultsView(before).items.map((i) => i.rank)).toEqual([1, 2, 3])
    expect(before.ranked).toHaveLength(4)
    expect(resultsView(before).items.every((i) => i.translatedName == null)).toBe(true)
    expect(new Set(translator.calls)).toEqual(new Set(['Restoran Nasi Kandar Pelita', 'Lot 10 Hutong', 'Food Court']))

    translator.gate.resolve()
    await flush()
    const after = resultsView(results(store)).items
    expect(after[0]?.translatedName).toBe('佩利塔扁担饭餐厅')
    expect(after[1]?.translatedName).toBeNull() // 联丰茶室 本来就是中文
    expect(after[2]?.translatedName).toBe('译:Lot 10 Hutong')
    expect(after[2]?.translatedType).toBe('美食广场')
    expect(after[0]?.translatedType).toBeNull() // 「餐厅」本来就是中文
  })

  it('TRANSLATE-13 翻译失败时安静地显示原名，不报错', async () => {
    const { h, translator } = setup()
    translator.fail = true
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    const items = resultsView(results(store)).items
    expect(items).toHaveLength(3)
    expect(items.every((i) => i.translatedName == null && i.translatedType == null)).toBe(true)
  })

  it('RESULTS-05 只为画面上前 3 家里有照片的拿照片（2 张），没照片的显示 emoji', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(h.photos.requested).toEqual(['places/pelita/photos/p1', 'places/laifoong/photos/p1'])
    const items = resultsView(results(store)).items
    expect(items[0]?.photo).toEqual(PELITA_PHOTO)
    expect(items[2]?.photo).toEqual(PHOTO_NONE)
  })
})

describe('状态层：结果缓存（同一个组合 + 范围、10 分钟内、200 米内不再花钱）', () => {
  it('RESULTS-06 3 分钟后、移动 100 米、同一个组合和范围：重新定位、但直接用缓存（标「刚刚搜过」），不搜索、不拿照片、翻译也带着', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    store.backToHome()
    const locationCalls = h.location.calls
    h.clock.advance(3 * MINUTE) // 位置 2 分钟后算旧：真的重新定位（往北 100 米）
    h.location.position = north(HOME, 100)
    store.search(RICE)
    await flush()
    expect(h.location.calls).toBe(locationCalls + 1)
    const cached = results(store)
    expect(cached.fromCache).toBe(true)
    expect(h.searcher.calls).toBe(1)
    expect(h.photos.requested).toHaveLength(2)
    expect(resultsView(cached).items[0]?.translatedName).toBe('佩利塔扁担饭餐厅')
  })

  it('RESULTS-07 移动 150 米用缓存，250 米（离第一次搜索的位置）重新搜索', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    h.clock.advance(3 * MINUTE)
    h.location.position = north(HOME, 150)
    store.search(RICE)
    await flush()
    expect(results(store).fromCache).toBe(true)
    expect(h.searcher.calls).toBe(1)
    h.clock.advance(3 * MINUTE) // 离第一次搜索还不到 10 分钟
    h.location.position = north(HOME, 250)
    store.search(RICE)
    await flush()
    expect(results(store).fromCache).toBe(false)
    expect(h.searcher.calls).toBe(2)
  })

  it('RESULTS-08 部分关键词失败的结果照样显示（标「有一部分搜索没成功」），但不进缓存；网络好了再搜是完整的才缓存', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    h.searcher.failures = [PlacesError.network(new Error('timeout'))]
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(results(store).partial).toBe(true)
    h.searcher.failures = []
    store.backToHome()
    store.search(RICE)
    await flush()
    expect(h.searcher.calls).toBe(2)
    expect(results(store).partial).toBe(false)
    expect(results(store).fromCache).toBe(false)
    store.backToHome()
    store.search(RICE)
    await flush()
    expect(h.searcher.calls).toBe(2)
    expect(results(store).fromCache).toBe(true)
  })

  it('RESULTS-09 照片还在拿时回首页改搜吃面（同一家也在）：两边都等同一个请求、拿到后都填上、只请求一次；回到吃饭用缓存，照片已在', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const gate = deferred()
    h.photos.gate = gate.promise
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(resultsView(results(store)).items[0]?.photo).toEqual({ kind: 'LOADING' })
    store.backToHome()
    store.search(NOODLE)
    await flush()
    expect(resultsView(results(store)).items[0]?.photo).toEqual({ kind: 'LOADING' })
    gate.resolve()
    await flush()
    expect(resultsView(results(store)).items[0]?.photo).toEqual(PELITA_PHOTO)
    expect(h.photos.requested).toEqual(['places/pelita/photos/p1', 'places/laifoong/photos/p1'])
    store.backToHome()
    store.search(RICE)
    await flush()
    expect(results(store).fromCache).toBe(true)
    expect(resultsView(results(store)).items[0]?.photo).toEqual(PELITA_PHOTO)
    expect(h.photos.requested).toHaveLength(2)
  })

  it('RESULTS-10 换饭/面、换范围、移动 330 米、过 11 分钟都重新搜索；同一家的照片整次打开只请求一次', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(h.searcher.calls).toBe(1)
    store.search(NOODLE)
    await flush()
    expect(h.searcher.calls).toBe(2)
    store.onRadiusChange(2)
    store.search(RICE)
    await flush()
    expect(h.searcher.calls).toBe(3)
    h.location.position = north(HOME, 330)
    h.clock.advance(3 * MINUTE)
    store.search(RICE)
    await flush()
    expect(h.searcher.calls).toBe(4)
    h.clock.advance(11 * MINUTE)
    store.search(RICE)
    await flush()
    expect(h.searcher.calls).toBe(5)
    expect(results(store).fromCache).toBe(false)
    expect(new Set(h.photos.requested).size).toBe(h.photos.requested.length)
  })

  it('RESULTS-13 缓存按 菜系 + 饭/面/都可以 + 范围 区分：5 个不同组合都搜索，同一个组合用缓存，换范围再搜', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    const japaneseNoodle = { cuisine: 'JAPANESE', meal: 'NOODLE' } as const
    for (const choice of [japaneseNoodle, { cuisine: 'JAPANESE', meal: 'RICE' } as const, { cuisine: 'CHINESE', meal: 'NOODLE' } as const, NOODLE, { cuisine: 'JAPANESE', meal: 'ANY' } as const]) {
      store.search(choice)
      await flush()
      expect(results(store).fromCache, JSON.stringify(choice)).toBe(false)
    }
    expect(h.searcher.calls).toBe(5)
    store.search(japaneseNoodle)
    await flush()
    expect(results(store).fromCache).toBe(true)
    expect(results(store).choice).toEqual(japaneseNoodle)
    expect(h.searcher.calls).toBe(5)
    store.onRadiusChange(3)
    store.search(japaneseNoodle)
    await flush()
    expect(h.searcher.calls).toBe(6)
    expect(h.searcher.choices.at(-1)).toEqual(japaneseNoodle)
  })
})

describe('状态层：分页被丢掉再载入（安卓：被系统关掉）', () => {
  it('RESTORE-04 被系统关掉后结果原样回来；再搜同一个组合用缓存，照片也在，不再请求', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    const shown = results(store)
    h.clock.advance(4 * MINUTE)
    const restored = h.store(1, h.afterProcessDeath())
    await flush()
    expect(restored.ui).toEqual(shown)
    restored.backToHome()
    restored.search(RICE)
    await flush()
    expect(results(restored).fromCache).toBe(true)
    expect(resultsView(results(restored)).items[0]?.photo).toEqual(PELITA_PHOTO)
    expect(h.searcher.calls).toBe(1)
    expect(h.photos.requested).toHaveLength(2)
  })

  it('RESTORE-05 被关掉 11 分钟后：画面上的结果还在，但缓存过期，再搜会重新搜索', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    h.clock.advance(11 * MINUTE)
    const restored = h.store(1, h.afterProcessDeath())
    await flush()
    expect(restored.ui).toEqual(results(store))
    restored.backToHome()
    restored.search(RICE)
    await flush()
    expect(results(restored).fromCache).toBe(false)
    expect(h.searcher.calls).toBe(2)
  })

  it('RESTORE-06 在首页时被关掉：恢复后还是首页', async () => {
    const { h } = setup()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    store.backToHome()
    const restored = h.store(1, h.afterProcessDeath())
    await flush()
    expect(restored.ui).toEqual({ kind: 'HOME' })
  })

  it('RESTORE-07 45 家结果被关掉后只留 30 家，但仍记得一共 45 家、在第 2 页、只看营业中；翻到最后是第 28–30 名；再被关掉还是 45；缓存也一样裁剪', async () => {
    const { h, translator } = setup({ places: Array.from({ length: 45 }, (_, k) => testPlace(`p${k + 1}`, { rating: 4.95 - (k + 1) * 0.01, reviews: 400 })) })
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(results(store).ranked).toHaveLength(45)
    expect(foundCount(results(store))).toBe(45)
    expect(results(store).trimmedCount).toBe(0)
    store.setOpenNowOnly(true) // testPlace 的营业时间不明：一家都不藏
    store.nextPage()

    const restored = h.store(1, h.afterProcessDeath())
    await flush()
    const r = results(restored)
    expect(r.ranked).toHaveLength(30)
    expect(r.trimmedCount).toBe(15)
    expect(foundCount(r)).toBe(45) // 「从 45 家里」，不是 30
    expect(r.page).toBe(1)
    expect(r.openNowOnly).toBe(true)
    expect(shownIds(restored)).toEqual(['p4', 'p5', 'p6'])
    while (hasMore(resultsView(results(restored)))) restored.nextPage()
    expect(shownIds(restored)).toEqual(['p28', 'p29', 'p30'])
    expect(resultsView(results(restored)).total).toBe(30)
    expect(results(restored).trimmedCount).toBe(15)

    const again = h.store(1, h.afterProcessDeath())
    await flush()
    expect(foundCount(results(again))).toBe(45)
    again.backToHome()
    again.search(RICE)
    await flush()
    expect(results(again).fromCache).toBe(true)
    expect(foundCount(results(again))).toBe(45)
    expect(h.searcher.calls).toBe(1)
  })
})

describe('状态层：错误归类、换密钥后重试', () => {
  it('ERROR-01 没有密钥 → 错误页、不搜索；保存密钥后自动重新搜索', async () => {
    const { h } = setup({ apiKey: '' })
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'NO_API_KEY' } })
    expect(h.searcher.calls).toBe(0)
    store.saveApiKey('new-key-5678')
    await flush()
    expect(store.home.apiKeySource).toBe('IN_APP')
    expect(results(store).choice).toEqual(RICE)
    expect(h.searcher.calls).toBe(1)
  })

  it('ERROR-02 密钥有零宽空格 →「API 密钥格式不对」、不搜索', async () => {
    const { h } = setup({ apiKey: 'test​key' })
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'INVALID_API_KEY' } })
    expect(h.searcher.calls).toBe(0)
  })

  it('ERROR-03 密钥限制对不上（403）后：保存同一个密钥不重试，保存不同的密钥自动重试', async () => {
    const { h } = setup()
    h.searcher.error = PlacesError.http(403, 'PERMISSION_DENIED', 'API_KEY_ANDROID_APP_BLOCKED', 'blocked')
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({
      kind: 'ERROR',
      choice: RICE,
      error: { kind: 'HTTP', code: 403, status: 'PERMISSION_DENIED', reason: 'API_KEY_ANDROID_APP_BLOCKED', googleMessage: 'blocked' },
    })
    store.saveApiKey('test-key-1234') // 没变
    await flush()
    expect(h.searcher.calls).toBe(1)
    h.searcher.error = null
    store.saveApiKey('fixed-key-5678')
    await flush()
    expect(h.searcher.calls).toBe(2)
    expect(results(store).choice).toEqual(RICE)
  })

  it('ERROR-04 网络错误时保存新密钥不会重试', async () => {
    const { h } = setup()
    h.searcher.error = PlacesError.network(new Error('offline'))
    const store = h.store(1)
    store.search(RICE)
    await flush()
    store.saveApiKey('other-key-5678')
    await flush()
    expect(h.searcher.calls).toBe(1)
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'NETWORK' } })
  })

  it('ERROR-05 额度用完、Google 403、网络断了分别变成对应的错误页；按重试重新搜索', async () => {
    const { h } = setup()
    const store = h.store(1)
    h.searcher.error = PlacesError.quotaExhausted()
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'QUOTA_EXHAUSTED' } })
    h.searcher.error = PlacesError.http(403, 'PERMISSION_DENIED', 'API_KEY_ANDROID_APP_BLOCKED', 'blocked')
    store.retry()
    await flush()
    expect(store.ui).toEqual({
      kind: 'ERROR',
      choice: RICE,
      error: { kind: 'HTTP', code: 403, status: 'PERMISSION_DENIED', reason: 'API_KEY_ANDROID_APP_BLOCKED', googleMessage: 'blocked' },
    })
    h.searcher.error = PlacesError.network(new Error('offline'))
    store.retry()
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'NETWORK' } })
    expect(h.searcher.calls).toBe(3)
  })

  it('ERROR-06 没有店但有关键词失败：显示失败原因（网络 / Google 503）让人重试，而不是说附近没有；全部成功都是空的才说「附近没找到」并建议扩大到 3 公里', async () => {
    const { h } = setup({ places: [] })
    h.searcher.failures = [PlacesError.network(new Error('timeout')), PlacesError.network(new Error('timeout'))]
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'NETWORK' } })
    h.searcher.failures = [PlacesError.http(503, 'UNAVAILABLE', null, 'try later')]
    store.retry()
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'HTTP', code: 503, status: 'UNAVAILABLE', reason: null, googleMessage: 'try later' } })
    h.searcher.failures = []
    store.retry()
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'NO_RESULTS', radiusKm: 1.5, largerRadiusKm: 3 } })
  })

  it('ERROR-07 1.5 公里没找到 → 建议 3 公里；按 5 公里再找还是没有 → 不再建议（已经最大），5 公里被记住', async () => {
    const { h } = setup({ places: [] })
    const store = h.store(1)
    store.search(NOODLE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: NOODLE, error: { kind: 'NO_RESULTS', radiusKm: 1.5, largerRadiusKm: 3 } })
    store.searchWithRadius(5)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: NOODLE, error: { kind: 'NO_RESULTS', radiusKm: 5, largerRadiusKm: null } })
    expect(h.settings.radiusKm).toBe(5)
  })

  it('ERROR-08 越南餐+面没找到 →「换成不限再找」搜不限+面，格子也变成不限', async () => {
    const { h } = setup({ places: [] })
    const store = h.store(1)
    const vietNoodle = { cuisine: 'VIETNAMESE', meal: 'NOODLE' } as const
    store.selectCuisine('VIETNAMESE')
    store.search(vietNoodle)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: vietNoodle, error: { kind: 'NO_RESULTS', radiusKm: 1.5, largerRadiusKm: 3 } })
    store.searchAnyCuisine()
    await flush()
    expect(h.searcher.choices.at(-1)).toEqual(NOODLE)
    expect(store.home.selectedCuisine).toBe('ANY')
  })
})

describe('状态层：首页', () => {
  it('HOME-04 用了 13 个请求，首页显示还可以搜索 295 次', () => {
    const { h } = setup()
    for (let i = 0; i < 13; i++) h.guard.tryRecordTextSearch()
    expect(h.store(1).home.remainingSearches).toBe(295)
  })

  it('HOME-05 搜索途中回首页：搜索取消、不发请求', async () => {
    const { h } = setup()
    const store = h.store(1)
    store.search(RICE)
    store.backToHome()
    await flush()
    expect(store.ui).toEqual({ kind: 'HOME' })
    expect(h.searcher.calls).toBe(0)
  })

  it('HOME-06 选的菜系从结果页回来还记得，重新打开网页是不限', async () => {
    const { h } = setup()
    const store = h.store(1)
    expect(store.home.selectedCuisine).toBe('ANY')
    store.selectCuisine('KOREAN')
    store.search({ cuisine: 'KOREAN', meal: 'RICE' })
    await flush()
    store.backToHome()
    expect(store.home.selectedCuisine).toBe('KOREAN')
    expect(h.store(1).home.selectedCuisine).toBe('ANY') // 新开的分页
  })

  it('HOME-07 问候按手机时间（7:45 早餐）；网页一直开到 21:05 回到前台变成宵夜', () => {
    const { h } = setup()
    h.clock.setTime(7, 45)
    const store = h.store(1)
    expect(store.home.dayPart).toBe('BREAKFAST')
    h.clock.setTime(21, 5)
    store.onResume()
    expect(store.home.dayPart).toBe('SUPPER')
  })
})

describe('状态层：换 3 家、只看营业中（不花钱）', () => {
  it('RESULTS-11 换 3 家：第 4–6 名、第 7–8 名（没有更多）、回到前 3 名；只给新出现的拿照片（一共 8 张、不重复）；从不重新搜索', async () => {
    const { h, translator } = setup({ places: rankedShops(8) })
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    expect(h.photos.requested).toHaveLength(3)
    store.nextPage()
    await flush()
    expect(shownIds(store)).toEqual(['p4', 'p5', 'p6'])
    expect(resultsView(results(store)).items.map((i) => i.rank)).toEqual([4, 5, 6])
    expect(h.photos.requested).toHaveLength(6)
    store.nextPage()
    await flush()
    expect(shownIds(store)).toEqual(['p7', 'p8'])
    expect(hasMore(resultsView(results(store)))).toBe(false)
    store.nextPage() // 没有更多：不动
    expect(shownIds(store)).toEqual(['p7', 'p8'])
    store.firstPage()
    await flush()
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    expect(h.photos.requested).toHaveLength(8)
    expect(new Set(h.photos.requested).size).toBe(8)
    expect(h.searcher.calls).toBe(1)
  })

  it('RESULTS-12 在第 2 页打开只看营业中 → 回到第 1 页、显示 p2 p4 p5（不明的 p2 保留）、名次 1–3、隐藏 3 家；下一页 p7 p8 p9；下次搜索还开着；关掉恢复', async () => {
    const { h, translator } = setup({ places: rankedShops(9, [1, 3, 6], [2]) })
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    store.nextPage()
    store.setOpenNowOnly(true)
    expect(results(store).page).toBe(0)
    expect(shownIds(store)).toEqual(['p2', 'p4', 'p5'])
    expect(resultsView(results(store)).items.map((i) => i.rank)).toEqual([1, 2, 3])
    expect(resultsView(results(store)).hiddenClosed).toBe(3)
    store.nextPage()
    expect(shownIds(store)).toEqual(['p7', 'p8', 'p9'])
    expect(hasMore(resultsView(results(store)))).toBe(false)
    store.backToHome()
    store.search(NOODLE)
    await flush()
    expect(results(store).openNowOnly).toBe(true)
    expect(shownIds(store)).toEqual(['p2', 'p4', 'p5'])
    store.setOpenNowOnly(false)
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    expect(h.searcher.calls).toBe(2)
  })

  it('RESULTS-14 打开只看营业中露出来的店不拿照片（保留 emoji，已知的照片照样显示）；关掉也不拿；之后换页才给新出现的拿；从不重复请求', async () => {
    const { h, translator } = setup({ places: rankedShops(8, [1, 2]) })
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(h.photos.requested).toHaveLength(3)
    store.setOpenNowOnly(true)
    await flush()
    expect(shownIds(store)).toEqual(['p3', 'p4', 'p5'])
    expect(h.photos.requested).toHaveLength(3)
    const items = resultsView(results(store)).items
    expect(items[0]?.photo).toEqual(photoLoaded('https://lh3.googleusercontent.com/places/p3/photos/p1'))
    expect(items.slice(1).map((i) => i.photo)).toEqual([PHOTO_PENDING, PHOTO_PENDING])
    store.setOpenNowOnly(false)
    await flush()
    expect(h.photos.requested).toHaveLength(3)
    store.setOpenNowOnly(true)
    store.nextPage()
    await flush()
    expect(shownIds(store)).toEqual(['p6', 'p7', 'p8'])
    expect(h.photos.requested).toHaveLength(6)
    store.firstPage()
    await flush()
    expect(h.photos.requested).toHaveLength(8) // 现在才给 p4、p5 拿
    expect(new Set(h.photos.requested).size).toBe(8)
    expect(h.searcher.calls).toBe(1)
  })

  it('RANK-20 搜日本餐时只留标成日本餐类型的 3 家（去掉 4.8★ 的咖啡店）；不限时 4 家都在', async () => {
    const typed = (id: string, rating: number, type: string) => ({ ...testPlace(id, { rating, reviews: 300 }), primaryType: type, types: [type, 'restaurant', 'food'] })
    const { h, translator } = setup({
      places: [typed('kopitiam', 4.8, 'coffee_shop'), typed('ramen', 4.3, 'ramen_restaurant'), typed('sushi', 4.2, 'sushi_restaurant'), typed('izakaya', 4.0, 'japanese_izakaya_restaurant')],
    })
    translator.gate.resolve()
    const store = h.store(1)
    store.search({ cuisine: 'JAPANESE', meal: 'ANY' })
    await flush()
    expect(results(store).ranked.map((i) => i.place.id)).toEqual(['ramen', 'sushi', 'izakaya'])
    store.search({ cuisine: 'ANY', meal: 'ANY' })
    await flush()
    expect(results(store).ranked).toHaveLength(4)
  })
})

describe('状态层：剪刀石头布、帮我挑一家、随便挑（在手机里决定）', () => {
  it('DUEL-12 3 家 → 剪刀石头布，用画面上的 3 家；出拳那一刻就决定 App 的手和赢家（同种子可重现）、转 1.5–2 秒；一局只能出一次；不服开新的一局；关掉还在列表；不搜索', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(3)
    store.search(RICE)
    await flush()
    const shown = shownIds(store)
    store.openDuel()
    const opened = store.duel
    expect(opened?.mode).toBe('ROCK_PAPER_SCISSORS')
    expect(opened?.placeIds).toEqual(shown)
    expect(opened?.userHand).toBeNull()
    expect(opened?.winnerIndex).toBeNull()

    store.playHand('ROCK')
    const played = store.duel
    const expected = play('ROCK', seeded(3)) // 同一个种子，同一只手
    expect(played?.userHand).toBe('ROCK')
    expect(played?.appHand).toBe(expected.app)
    expect(played?.spinMillis).toBeGreaterThanOrEqual(1500)
    expect(played?.spinMillis).toBeLessThanOrEqual(2000)
    store.playHand('PAPER') // 一局只出一次
    expect(store.duel).toBe(played)

    store.duelAgain()
    const again = store.duel
    expect(again?.round).toBeGreaterThan(played?.round ?? 0)
    expect(again?.userHand).toBeNull()
    expect(again?.placeIds).toEqual(shown)
    store.closeDuel()
    expect(store.duel).toBeNull()
    expect(store.ui.kind).toBe('RESULTS')
    expect(h.searcher.calls).toBe(1)
  })

  it('DUEL-13 最后一页剩 2 家 → 帮我挑一家（开局就定赢家、亮灯 1.5–1.9 秒、出拳没用、不服再来）；新的搜索关掉游戏；只有 1 家 → 没有游戏', async () => {
    const { h, translator } = setup({ places: rankedShops(5) })
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    store.nextPage()
    store.openDuel()
    const roulette = store.duel
    expect(roulette?.mode).toBe('ROULETTE')
    expect(roulette?.placeIds).toEqual(['p4', 'p5'])
    expect([0, 1]).toContain(roulette?.winnerIndex)
    expect(roulette?.spinMillis).toBeGreaterThanOrEqual(1500)
    expect(roulette?.spinMillis).toBeLessThanOrEqual(1900)
    store.playHand('ROCK') // 帮我挑一家没有出拳
    expect(store.duel).toBe(roulette)
    store.duelAgain()
    expect(store.duel?.round).toBeGreaterThan(roulette?.round ?? 0)
    expect([0, 1]).toContain(store.duel?.winnerIndex)

    h.searcher.places = rankedShops(1)
    store.search(NOODLE)
    expect(store.duel).toBeNull()
    await flush()
    store.openDuel()
    expect(store.duel).toBeNull()
  })

  it('PICK-20 随便挑一打开就决定（具体菜系、合理），再摇 30 次每次都变、round 变；关掉不搜索；就它了选好格子、关掉对话框，之后才搜那一个组合', async () => {
    const { h } = setup()
    const store = h.store(1)
    store.openRandomPick()
    const first = store.home.randomPick
    expect(first && isSpecific(first.choice.cuisine)).toBe(true)
    expect(first && isReasonable(first.choice)).toBe(true)
    for (let i = 0; i < 30; i++) {
      const before = store.home.randomPick
      store.rerollRandomPick()
      const after = store.home.randomPick
      expect(after?.round).toBeGreaterThan(before?.round ?? 0)
      expect(after?.choice).not.toEqual(before?.choice)
      expect(after && isReasonable(after.choice)).toBe(true)
    }
    store.dismissRandomPick()
    expect(store.home.randomPick).toBeNull()
    await flush()
    expect(h.searcher.calls).toBe(0)

    store.openRandomPick()
    const pick = store.home.randomPick?.choice
    expect(store.acceptRandomPick()).toEqual(pick)
    expect(store.home.randomPick).toBeNull()
    expect(store.home.selectedCuisine).toBe(pick?.cuisine)
    expect(h.searcher.calls).toBe(0)
    if (pick) store.search(pick) // 画面接着做的事（先过定位权限）
    await flush()
    expect(h.searcher.choices).toEqual([pick])
  })

  it('DUEL-14 旧的一局晚到的「演完了」被忽略；演完的一局再显示直接跳到结果；不服的新一局从头演；随便挑同理；被关掉后游戏层和对话框都不恢复，但这一餐的决定在；下一餐从头开始', async () => {
    const { h, translator } = setup()
    translator.gate.resolve()
    const store = h.store(1)
    store.search(RICE)
    await flush()
    store.openDuel()
    store.playHand('SCISSORS')
    const played = store.duel
    if (!played) throw new Error('no duel')
    expect(played.animationDone).toBe(false)
    store.onDuelAnimationDone(played.round - 1) // 旧的一局晚到：不理
    expect(store.duel?.animationDone).toBe(false)
    store.onDuelAnimationDone(played.round)
    expect(store.duel?.animationDone).toBe(true)
    store.duelAgain()
    expect(store.duel?.animationDone).toBe(false)
    expect(store.duel?.userHand).toBeNull()

    store.backToHome()
    store.openRandomPick()
    const draw = store.home.randomPick
    if (!draw) throw new Error('no pick')
    expect(draw.settled).toBe(false)
    store.onRandomPickSettled(draw.round)
    expect(store.home.randomPick?.settled).toBe(true)
    store.rerollRandomPick()
    expect(store.home.randomPick?.settled).toBe(false)
    store.onRandomPickSettled(draw.round) // 旧的一轮：不理
    expect(store.home.randomPick?.settled).toBe(false)

    const restored = h.store(1, h.afterProcessDeath())
    await flush()
    expect(restored.duel).toBeNull()
    expect(restored.home.randomPick).toBeNull()
    restored.search(RICE)
    await flush()
    restored.openDuel()
    expect(restored.duel?.round).toBe(played.round)
    expect(restored.duel?.animationDone).toBe(true)

    restored.closeDuel()
    h.clock.advance(MEAL_MS + MINUTE)
    restored.search(RICE)
    await flush()
    restored.openDuel()
    expect(restored.duel?.animationDone).toBe(false)
    expect(restored.duel?.userHand).toBeNull()
  })
})

describe('状态层：设置与演示开关', () => {
  it('SETTINGS-05 没有密钥的错误页：开演示保存 → 用演示店重新搜；关演示并保存新密钥 → 回首页、不自动搜索；之后保存密钥修好密钥错误照常自动重搜真店', async () => {
    const { h } = setup({ apiKey: '' })
    const store = h.store(1)
    store.search(RICE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: RICE, error: { kind: 'NO_API_KEY' } })

    store.saveSettings('', true)
    await flush()
    expect(h.settings.demoMode).toBe(true)
    expect(store.home.demoMode).toBe(true)
    expect(results(store).isDemo).toBe(true)
    expect(h.searcher.calls).toBe(0)

    store.saveSettings('new-key-5678', false)
    await flush()
    expect(h.settings.demoMode).toBe(false)
    expect(h.settings.apiKeyOverride).toBe('new-key-5678')
    expect(store.ui).toEqual({ kind: 'HOME' })
    expect(h.searcher.calls).toBe(0)

    h.settings.apiKeyOverride = ''
    store.search(NOODLE)
    await flush()
    expect(store.ui).toEqual({ kind: 'ERROR', choice: NOODLE, error: { kind: 'NO_API_KEY' } })
    store.saveSettings('fixed-key-5678', false)
    await flush()
    expect(results(store).choice).toEqual(NOODLE)
    expect(results(store).isDemo).toBe(false)
    expect(h.searcher.calls).toBe(1)
  })

  it('DEMO-28 首页黑条的关掉：马上关、回首页、不搜索', () => {
    const h = new Harness({ demoMode: true })
    const store = h.store(1)
    expect(store.home.demoMode).toBe(true)
    store.setDemoMode(false)
    expect(h.settings.demoMode).toBe(false)
    expect(store.home.demoMode).toBe(false)
    expect(store.ui).toEqual({ kind: 'HOME' })
    expect(h.searcher.calls).toBe(0)
  })
})
