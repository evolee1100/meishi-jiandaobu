/**
 * 永远免费（安卓 FreeOfChargeTest、FreeOfChargeRound3Test、FreeOfChargeRound5Test、DemoModeTest）：
 * 用真的请求层（PlacesApi + GooglePlacesClient）接模拟的 Google 服务器，经过状态层整轮玩一遍，数到底有几个请求到了「Google」。
 * 绝不连真的网络、绝不用真的密钥。
 */
import { describe, expect, it } from 'vitest'
import { PLACES_API } from '../data/constants.ts'
import { allChoices } from '../domain/cuisine.ts'
import type { MealId } from '../domain/model.ts'
import { clockZoned } from '../domain/openingHours.ts'
import { vetoRemaining } from '../domain/table.ts'
import { FIELD_MASK, QUERIES_PER_SEARCH, queriesFor } from '../domain/searchConfig.ts'
import { demoChineseName } from '../services/demoPlaces.ts'
import { PlacesApi } from '../services/placesApi.ts'
import { GooglePlacesClient } from '../services/placesRepository.ts'
import { flush, klMillis, PrefixTranslator } from '../test/helpers.ts'
import { mockGoogle, type MockServer, type RecordedRequest } from '../test/mockFetch.ts'
import { CHINESE_RICE, Harness, PETALING, placeAt, results, searched, shownIds } from '../test/storeHarness.ts'
import type { MainStore } from './store.ts'
import { hasMore, isUnresolved, resultsItems, resultsView, statusOf } from './state.ts'
import { shareVote } from './texts.ts'

const MINUTE = 60_000
const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText'
const PHOTO_URL = /^https:\/\/places\.googleapis\.com\/v1\/places\/[^/?]+\/photos\/[^/?]+\/media\?maxWidthPx=800&skipHttpRedirect=true&key=[^&]+$/

/** 只有这两种收费请求：POST 文字搜索、GET 照片 media（maxWidthPx=800、skipHttpRedirect=true）。 */
function isBillableKind(request: RecordedRequest): boolean {
  if (request.method === 'POST' && request.url === SEARCH_TEXT_URL) return true
  return request.method === 'GET' && PHOTO_URL.test(request.url)
}

/** 第三、五版的「Google」：六家店——休息、营业、不明、营业（22:00 关）、休息、营业，每家都有照片。 */
function sixPlaces(center = PETALING): string {
  return [false, true, null, true, false, true]
    .map((open, index) => {
      const i = index + 1
      const hours =
        open == null
          ? ''
          : open
            ? ',"currentOpeningHours":{"openNow":true,"nextCloseTime":"2026-10-06T14:00:00Z"}'
            : ',"currentOpeningHours":{"openNow":false,"nextOpenTime":"2026-10-06T23:00:00Z"}'
      return `{"id":"real${i}","displayName":{"text":"真店${i}"},"location":{"latitude":${center.latitude + i * 0.001},"longitude":${center.longitude}},"rating":4.${9 - i},"userRatingCount":${1000 - 50 * i},"types":["chinese_restaurant","restaurant","food"],"primaryType":"chinese_restaurant","photos":[{"name":"places/real${i}/photos/p1"}]${hours}}`
    })
    .join(',')
}

/** 演示测试的「Google」：四家看起来很真的店，每家都有照片。 */
function fourPlaces(center = PETALING): string {
  return [1, 2, 3, 4]
    .map(
      (i) =>
        `{"id":"real${i}","displayName":{"text":"真店${i}"},"location":{"latitude":${center.latitude + i * 0.001},"longitude":${center.longitude}},"rating":4.${i + 2},"userRatingCount":${100 * i},"types":["restaurant","food"],"primaryType":"restaurant","photos":[{"name":"places/real${i}/photos/p1"}]}`,
    )
    .join(',')
}

function google(places: string): MockServer {
  return mockGoogle((request) =>
    request.url.includes('/media?') ? { body: '{"photoUri":"https://lh3.googleusercontent.com/x"}' } : { body: `{"places":[${places}]}` },
  )
}

/** 架子换成真的请求层：密钥只从设置（= localStorage）读，用量记在架子的用量存储里。 */
function wireReal(h: Harness, server: MockServer): void {
  const apiKey = () => h.settings.effectiveApiKey()
  const api = new PlacesApi({ apiKey, usageGuard: h.guard, fetch: server.fetch, locks: null })
  h.places = new GooglePlacesClient({ api, usageGuard: h.guard, apiKey, usageStore: h.guardStore })
}

function allPhotosResolved(store: MainStore): boolean {
  return store.ui.kind === 'RESULTS' && resultsItems(store.ui).every((i) => i.photo.kind !== 'LOADING')
}

describe('三十一、永远免费：整轮新功能一个请求都不多发', () => {
  it('FREE-01 发给 Google 的 FIELD_MASK 和安卓一字不差（多一个字段都可能更贵）', () => {
    expect(FIELD_MASK).toBe(
      'places.id,places.displayName,places.shortFormattedAddress,places.formattedAddress,places.location,' +
        'places.rating,places.userRatingCount,places.priceLevel,places.priceRange,places.currentOpeningHours,' +
        'places.businessStatus,places.photos,places.googleMapsUri,places.primaryType,' +
        'places.primaryTypeDisplayName,places.types',
    )
    expect(PLACES_API.FIELD_MASK).toBe(FIELD_MASK)
  })

  it('FREE-02 用真的请求层 + 假 Google 服务器：只看营业中、时间流逝重算、猜拳、不服、候选篮跨页、救援骰子、刚才摇到、吃过的记录、分享文字都 0 个请求；只有「扩大到 3 公里」多 1 次搜索（3 个请求），照片已知不再拿', async () => {
    const server = google(sixPlaces())
    const h = new Harness({ startMillis: klMillis(6, 19, 30), translator: new PrefixTranslator(), openNowOnly: true })
    wireReal(h, server)
    const store = h.store(3)
    await searched(store, CHINESE_RICE)
    expect(allPhotosResolved(store)).toBe(true)
    // 每家都在画面上出现过一次（照片照常按翻页规则拿）。
    store.nextPage()
    await flush()
    store.firstPage()
    await flush()
    expect(results(store).openNowOnly).toBe(true)
    const requests = server.requests.length
    const textUsed = h.guard.textSearchesUsed()
    const photosUsed = h.guard.photosUsed()
    expect(textUsed).toBe(3)
    expect(requests).toBe(textUsed + photosUsed)

    // 只看营业中开开关关、时间走了重算营业状态。
    for (let i = 0; i < 3; i++) {
      store.setOpenNowOnly(false)
      store.setOpenNowOnly(true)
    }
    h.clock.advance(40 * MINUTE) // 20:10
    store.onClockTick()
    // 剪刀石头布 / 帮我挑一家、不服、再打开。
    store.openDuel()
    store.playHand('ROCK')
    if (store.duel) store.onDuelAnimationDone(store.duel.round)
    store.duelAgain()
    store.playHand('PAPER')
    store.closeDuel()
    store.openDuel()
    store.closeDuel()
    // ❤️ 跨页，再用圈的店玩。
    store.toggleBasket(placeAt(store, 0).id)
    store.nextPage()
    store.toggleBasket(placeAt(store, 0).id)
    store.firstPage()
    store.openDuel()
    store.closeDuel()
    store.clearBasket()
    // 救援骰子、刚才摇到、吃过的记录、分享文字。
    store.rescueReroll()
    for (let i = 0; i < 10; i++) store.rerollRandomPick()
    const earlier = store.home.randomPick?.history[0]
    if (earlier) store.returnToEarlierPick(earlier)
    store.dismissRandomPick()
    store.onNavigate(placeAt(store, 0))
    store.clearVisits()
    const r = results(store)
    const now = clockZoned(r.clock)
    if (!now) throw new Error('没有时钟')
    const items = resultsItems(r)
    expect(shareVote(items, items.map((i) => statusOf(r, i.place)), now, false).trim()).not.toBe('')
    await flush()

    expect(server.requests).toHaveLength(requests)
    expect(h.guard.textSearchesUsed()).toBe(textUsed)
    expect(h.guard.photosUsed()).toBe(photosUsed)

    // 🔍 扩大到 3 公里再找：多一次搜索（3 个请求），按钮上写清楚的。
    store.expandRadius()
    await flush()
    expect(results(store).radiusKm).toBe(3)
    expect(allPhotosResolved(store)).toBe(true)
    expect(h.guard.textSearchesUsed()).toBe(textUsed + 3)
    expect(h.guard.photosUsed()).toBe(photosUsed) // 同样的店：照片早就知道了
    expect(server.requests.every(isBillableKind)).toBe(true)
  })

  it('FREE-03 用真的请求层：猜拳、任务卡、谁来做、饭桌模式（暗中出拳、划一刀）、反悔询问、大家都同意重来、看一看、6 家转盘、清空撤销、计票板、饭签、摇一摇全部 0 个请求；「照签去找」= 1 次搜索', async () => {
    const server = google(sixPlaces())
    const h = new Harness({ startMillis: klMillis(6, 19, 30), translator: new PrefixTranslator(), openNowOnly: true, phoneSeed: 20261004 })
    wireReal(h, server)
    const store = h.store(3)
    await searched(store, CHINESE_RICE)
    store.nextPage()
    await flush()
    store.firstPage()
    await flush()
    const requests = server.requests.length
    const textUsed = h.guard.textSearchesUsed()
    const photosUsed = h.guard.photosUsed()
    expect(textUsed).toBe(3)

    // 剪刀石头布 → 定了；任务卡和谁来做；📊 今天。
    store.openDuel()
    store.playHand('ROCK')
    store.drawTaskCard()
    store.spinTaskWheel(4)
    store.onTaskWheelStopped()
    // 👥 饭桌模式：✂️ 和 🙈，问了（愿赌服输）也确定了，之后被拒绝。
    store.closeDuel()
    for (const item of resultsItems(results(store))) store.toggleBasket(item.place.id)
    store.openTable()
    if (store.mealPrompt) store.confirmMealRegret()
    store.setTablePlayers(3)
    store.renameAvatar('PANDA', '阿德')
    store.startSecretHands()
    for (let i = 0; i < 3; i++) {
      store.secretTakePhone()
      store.secretChoose('PAPER')
      store.secretPass()
    }
    store.secretReveal()
    store.showTableResult()
    store.closeDuel()
    store.openTable() // 反悔用完：显示定了的结果、锁住
    store.agreeToRestart()
    store.startVeto()
    const remainingFirst = () => {
      const veto = store.table?.veto
      return veto ? (vetoRemaining(veto)[0] ?? '') : ''
    }
    for (let i = 0; i < 2; i++) store.cutPlace(remainingFirst())
    store.undoCut()
    store.cutPlace(remainingFirst())
    store.finishVeto()
    store.closeDuel()
    store.showMealDecision()
    store.closeDuel()
    // ❤️ 六家和转盘，清空和撤销。
    store.nextPage()
    for (const item of resultsItems(results(store))) store.toggleBasket(item.place.id)
    store.clearBasket()
    store.undoClearBasket()
    store.openDuel()
    store.agreeToRestart()
    store.spinWheel()
    store.closeDuel()
    // 📊 计票板。
    store.startVoteCount(results(store).basket)
    for (let i = 0; i < 3; i++) store.changeVote(0, true)
    store.finishVote()
    store.closeDuel()
    // 📜 饭签、📳。
    store.backToHome()
    store.drawFortune()
    store.onShake(35)
    store.dismissRandomPick()
    await flush()
    expect(server.requests).toHaveLength(requests)
    expect(h.guard.textSearchesUsed()).toBe(textUsed)
    expect(h.guard.photosUsed()).toBe(photosUsed)

    // 照签去找：一次搜索，和吃饭 / 吃面一样（过了 10 分钟不用缓存，万一签上也是中餐・饭）。
    h.clock.advance(11 * MINUTE)
    const choice = store.acceptFortune()
    if (!choice) throw new Error('没有饭签')
    store.search(choice)
    await flush()
    const queries = queriesFor(choice).length
    expect(queries).toBeLessThanOrEqual(QUERIES_PER_SEARCH)
    expect(h.guard.textSearchesUsed()).toBe(textUsed + queries)
    expect(server.requests.every(isBillableKind)).toBe(true)
  })

  it('WEB-02 整个网页只会向 Google 发两种收费请求：POST …/v1/places:searchText 和 GET …/v1/{照片}/media?maxWidthPx=800&skipHttpRedirect=true；演示模式一个都没有', async () => {
    const server = google(sixPlaces())
    const h = new Harness({ startMillis: klMillis(6, 19, 30), openNowOnly: false })
    wireReal(h, server)
    const store = h.store(3)
    for (const meal of ['RICE', 'NOODLE', 'ANY'] as MealId[]) {
      h.clock.advance(11 * MINUTE)
      await searched(store, { cuisine: 'CHINESE', meal })
      while (hasMore(resultsView(results(store)))) {
        store.nextPage()
        await flush()
      }
      store.openDuel()
      store.playHand('ROCK')
      store.closeDuel()
      store.expandRadius()
      await flush()
    }
    expect(server.requests.length).toBeGreaterThan(0)
    const strange = server.requests.filter((r) => !isBillableKind(r))
    expect(strange).toEqual([])
    // 照片每家最多一次：同一张照片的网址不会出现两次。
    const photoPaths = server.photoRequests().map((r) => new URL(r.url).pathname)
    expect(new Set(photoPaths).size).toBe(photoPaths.length)

    // 演示模式：一个请求都没有。
    const before = server.requests.length
    store.setDemoMode(true)
    for (const choice of allChoices()) {
      await searched(store, choice)
      store.openDuel()
      store.playHand('PAPER')
      store.closeDuel()
      store.expandRadius()
      await flush()
    }
    expect(server.requests).toHaveLength(before)
  })

  it('永远免费：经过状态层，39 个组合每次搜索最多 3 个文字搜索请求，发几个就记几个', async () => {
    const server = google(sixPlaces())
    const h = new Harness({ openNowOnly: false })
    wireReal(h, server)
    const store = h.store(3)
    let total = 0
    for (const choice of allChoices()) {
      h.clock.advance(11 * MINUTE) // 不用缓存：每次都真的搜
      const before = server.textQueries().length
      await searched(store, choice)
      const sent = server.textQueries().slice(before)
      expect(sent.length, JSON.stringify(choice)).toBeLessThanOrEqual(QUERIES_PER_SEARCH)
      expect(sent.length).toBeGreaterThanOrEqual(1)
      expect(sent).toEqual([...queriesFor(choice)])
      total += sent.length
    }
    expect(h.guard.textSearchesUsed()).toBe(total)
    expect(server.textQueries()).toHaveLength(total)
  })

  it('永远免费：本月额度用完（剩下的不够一次完整搜索）一个请求都不发，首页说用完了；照片额度用完不再拿照片、显示 emoji', async () => {
    const server = google(sixPlaces())
    const h = new Harness({ openNowOnly: false })
    wireReal(h, server)
    for (let i = 0; i < 898; i++) h.guard.tryRecordTextSearch() // 只剩 2 个：不够一次（一律按 3 个算）
    const store = h.store(3)
    expect(store.home.remainingSearches).toBe(0)
    await searched(store, { cuisine: 'VEGETARIAN', meal: 'ANY' }) // 只有 2 个关键词的组合也一样不发
    expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'QUOTA_EXHAUSTED' } })
    expect(server.requests).toHaveLength(0)
    expect(h.guard.textSearchesUsed()).toBe(898)

    // 文字搜索还够、照片用完了：搜得到，但一张照片都不拿。
    const h2 = new Harness({ openNowOnly: false })
    const server2 = google(sixPlaces())
    wireReal(h2, server2)
    for (let i = 0; i < 900; i++) h2.guard.tryRecordPhoto()
    const store2 = h2.store(3)
    await searched(store2, CHINESE_RICE)
    expect(store2.ui.kind).toBe('RESULTS')
    expect(server2.photoRequests()).toHaveLength(0)
    expect(resultsItems(results(store2)).every((i) => !isUnresolved(i.photo) && i.photo.kind === 'NONE')).toBe(true)
    expect(h2.guard.photosUsed()).toBe(900)
  })

  it('WEB-04（状态层）localStorage 写不进去：真实搜索一个请求都不发、显示 STORAGE_BLOCKED；演示模式照样能玩，0 个请求', async () => {
    const server = google(sixPlaces())
    const h = new Harness({ openNowOnly: false })
    wireReal(h, server)
    h.storageWritable = () => false
    const store = h.store(3)
    expect(store.home.storageBlocked).toBe(true)
    await searched(store, CHINESE_RICE)
    expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'STORAGE_BLOCKED' } })
    expect(server.requests).toHaveLength(0)
    store.setDemoMode(true) // 错误页上打开演示：马上用假店重搜
    await flush()
    expect(results(store).isDemo).toBe(true)
    expect(shownIds(store).every((id) => id.startsWith('demo_'))).toBe(true)
    expect(server.requests).toHaveLength(0)
  })
})

describe('二十八、🧪 演示模式：一个请求都不发（安卓 DemoModeTest，真的请求层 + 假 Google）', () => {
  function demoSetup(options: { demoMode?: boolean; apiKey?: string } = {}) {
    const server = google(fourPlaces())
    const translator = new PrefixTranslator()
    const h = new Harness({ translator, openNowOnly: false, demoMode: options.demoMode ?? true, apiKey: options.apiKey })
    wireReal(h, server)
    return { h, server, translator }
  }

  it('DEMO-19 演示模式下 39 个组合逐一搜索、换页、开关只看营业中、猜拳：假 Google 服务器收到 0 个请求、翻译器 0 次、额度不变、不需要密钥、演示店都没有照片', async () => {
    const { h, server, translator } = demoSetup({ apiKey: '' })
    const store = h.store(8)
    expect(store.home.demoMode).toBe(true)
    const remaining = store.home.remainingSearches
    for (const choice of allChoices()) {
      await searched(store, choice)
      const ui = store.ui
      expect(ui.kind, JSON.stringify(choice)).toBe('RESULTS')
      if (ui.kind !== 'RESULTS') continue
      expect(ui.isDemo).toBe(true)
      expect(ui.ranked.every((i) => i.place.id.startsWith('demo_') && i.photo.kind === 'NONE')).toBe(true)
      while (hasMore(resultsView(results(store)))) store.nextPage()
      store.setOpenNowOnly(true)
      store.openDuel()
      store.playHand('PAPER')
      store.setOpenNowOnly(false)
      await flush()
    }
    expect(server.requests).toHaveLength(0)
    expect(translator.calls).toEqual([]) // 也不用浏览器翻译
    expect(h.guard.textSearchesUsed()).toBe(0)
    expect(h.guard.photosUsed()).toBe(0)
    expect(store.home.remainingSearches).toBe(remaining)
  })

  it('DEMO-20 演示结果照样排名（阿明鸡饭排在青莲素食前面），英文/马来文店名用内置中文名（每页都翻，至少 10 家），中餐+饭有 3 家、越南餐 2 家，0 个请求', async () => {
    const { h, server, translator } = demoSetup()
    const store = h.store(8)
    await searched(store, { cuisine: 'ANY', meal: 'ANY' })
    const all = results(store)
    expect(all.ranked.length).toBeGreaterThanOrEqual(10)
    const names = all.ranked.map((i) => i.place.name)
    expect(names.indexOf('阿明海南鸡饭')).toBeLessThan(names.indexOf('Green Lotus Vegetarian'))
    let foreign = 0
    for (;;) {
      for (const item of resultsItems(results(store)).filter((i) => ![...i.place.name].some((c) => (c.codePointAt(0) ?? 0) > 0x2e80))) {
        foreign++
        expect(item.translatedName, item.place.name).toBe(demoChineseName(item.place.name))
      }
      if (!hasMore(resultsView(results(store)))) break
      store.nextPage()
      await flush()
    }
    expect(foreign).toBeGreaterThanOrEqual(10)
    expect(results(store).ranked.find((i) => i.place.name === 'Sakura Ramen House')?.translatedName).toBe('樱花拉面屋')

    await searched(store, CHINESE_RICE)
    expect(resultsItems(results(store))).toHaveLength(3)
    await searched(store, { cuisine: 'VIETNAMESE', meal: 'ANY' })
    expect(resultsItems(results(store))).toHaveLength(2)
    expect(server.requests).toHaveLength(0)
    expect(translator.calls).toEqual([])
  })

  it('DEMO-21 关掉演示：演示结果的画面回到首页、不自动搜索；再搜就是真店（3 个文字搜索 + 3 张照片）；再开演示，同一个组合给演示店而不是缓存的真店', async () => {
    const { h, server } = demoSetup()
    const store = h.store(8)
    const rice = { cuisine: 'ANY', meal: 'RICE' } as const
    await searched(store, rice)
    expect(results(store).isDemo).toBe(true)
    expect(server.requests).toHaveLength(0)

    store.setDemoMode(false)
    expect(h.settings.demoMode).toBe(false)
    expect(store.ui).toEqual({ kind: 'HOME' })
    expect(server.requests).toHaveLength(0)
    await searched(store, rice)
    expect(allPhotosResolved(store)).toBe(true)
    expect(results(store).isDemo).toBe(false)
    expect(shownIds(store)).toEqual(['real4', 'real3', 'real2'])
    expect(h.guard.textSearchesUsed()).toBe(3)
    expect(server.requests).toHaveLength(3 + 3) // 3 个文字搜索 + 3 张照片

    store.setDemoMode(true)
    await searched(store, rice)
    expect(results(store).isDemo).toBe(true)
    expect(results(store).fromCache).toBe(false)
    expect(server.requests).toHaveLength(6)
  })

  it('DEMO-22 画面上是真店时打开演示：换页出现的新店不拿照片（显示 emoji）、不翻译；关掉演示后才补拿那张照片', async () => {
    const { h, server, translator } = demoSetup({ demoMode: false })
    const store = h.store(8)
    await searched(store, { cuisine: 'ANY', meal: 'RICE' })
    expect(allPhotosResolved(store)).toBe(true)
    expect(server.requests).toHaveLength(3 + 3)
    const photosBefore = h.guard.photosUsed()
    const translationsBefore = translator.calls.length

    store.setDemoMode(true)
    store.nextPage()
    await flush()
    const shown = resultsItems(results(store))
    expect(shown).toHaveLength(1)
    expect(shown[0]?.place.id.startsWith('demo_')).toBe(false)
    expect(shown[0]?.photo).toEqual({ kind: 'PENDING' }) // emoji，没有转圈、没有请求
    expect(server.requests).toHaveLength(6)
    expect(h.guard.photosUsed()).toBe(photosBefore)
    expect(translator.calls).toHaveLength(translationsBefore)

    store.setDemoMode(false)
    await flush()
    expect(resultsItems(results(store))[0]?.photo.kind).toBe('LOADED')
    expect(server.requests).toHaveLength(7)
    expect(h.guard.textSearchesUsed()).toBe(3)
  })

  it('DEMO-23 在「没有密钥」错误页打开演示：自动用演示店重新搜同一个组合，0 个请求', async () => {
    const { h, server } = demoSetup({ demoMode: false, apiKey: '' })
    const store = h.store(8)
    const noodle = { cuisine: 'ANY', meal: 'NOODLE' } as const
    await searched(store, noodle)
    expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'NO_API_KEY' } })
    store.setDemoMode(true)
    await flush()
    expect(results(store).isDemo).toBe(true)
    expect(results(store).choice).toEqual(noodle)
    expect(server.requests).toHaveLength(0)
  })
})
