/**
 * 状态层：第四版（安卓 MainViewModelRound4Test）——演示一直玩得下去、「显示全部」只这一次、走到前会关门的店、
 * 跨搜索的愿赌服输、吃过的记录按餐数（演示店不算）、❤️ 跨过被丢掉的分页、浏览器挡住定位、时钟走动不重复翻译。
 */
import { describe, expect, it } from 'vitest'
import { isClosed, weeklyPeriod } from '../domain/openingHours.ts'
import type { Place } from '../domain/model.ts'
import { DEMO_REFERENCE_CENTER, demoReachableCount } from '../services/demoPlaces.ts'
import { FailingTranslator, flush, testPlace } from '../test/helpers.ts'
import { CHINESE_RICE, Harness, placeAt, results, searched, shops, shownIds, times } from '../test/storeHarness.ts'
import { MIN_PLACES, canGo, closesBeforeArrival, foundCount, planDuel, reachableCount, resultItem, resultsView, statusOf } from './state.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const HOME = DEMO_REFERENCE_CENTER
const ANY_ANY = { cuisine: 'ANY', meal: 'ANY' } as const
const HOT_POT_NOODLE = { cuisine: 'HOT_POT', meal: 'NOODLE' } as const

function setup(options: { demoMode?: boolean } = {}) {
  const translator = new FailingTranslator()
  const h = new Harness({ position: HOME, translator, openNowOnly: true, demoMode: options.demoMode ?? false })
  return { h, translator }
}

/** 阿明海南鸡饭：1,092 米外（走路 18 分钟），每天 10:00–21:00。 */
function chickenRice(h: Harness): Place {
  return {
    ...testPlace('ahming', { rating: 4.95, reviews: 1240, distanceMeters: 1092 }),
    openNow: true,
    openingHours: {
      periods: [0, 1, 2, 3, 4, 5, 6].map((d) => weeklyPeriod(d, 10, 0, d, 21, 0)),
      nextOpenMillis: null,
      nextCloseMillis: h.clock.todayAt(21),
    },
  }
}

describe('状态层：第四版（MainViewModelRound4Test）', () => {
  it('DEMO-25 演示模式在 2:00、2:30、5:00、7:49、15:30、19:03、20:58 各摇 60 次都只摇到有 2 家以上能去的组合；就它了搜出来一定有游戏；0 个请求', async () => {
    const { h } = setup({ demoMode: true })
    const store = h.store(4)
    await flush() // 先拿位置
    for (const [hour, minute] of [[2, 0], [2, 30], [5, 0], [7, 49], [15, 30], [19, 3], [20, 58]] as const) {
      h.clock.setTime(hour, minute, 1)
      store.openRandomPick()
      for (let i = 0; i < 60; i++) {
        const pick = store.home.randomPick?.choice
        if (!pick) throw new Error('没有对话框')
        const count = demoReachableCount(pick, HOME, h.settings.radiusKm * 1000, h.clock.zoned())
        expect(count, `${JSON.stringify(pick)} ${hour}:${minute}`).toBeGreaterThanOrEqual(MIN_PLACES)
        store.rerollRandomPick()
      }
      // 就它了 → 搜索 → 有游戏，不是救援卡（只看营业中开着）。
      const choice = store.acceptRandomPick()
      if (!choice) throw new Error('没有结果')
      await searched(store, choice)
      expect(reachableCount(results(store)), JSON.stringify(choice)).toBeGreaterThanOrEqual(MIN_PLACES)
      expect(planDuel(results(store)).mode).not.toBeNull()
      store.backToHome()
    }
    expect(h.searcher.calls).toBe(0)
    expect(h.guard.textSearchesUsed()).toBe(0)
  })

  it('DEMO-26 凌晨 2 点火锅·面至少 2 家能去；换个菜系再摇 100 次都不是火锅、都至少 2 家能去', async () => {
    const { h } = setup({ demoMode: true })
    h.clock.setTime(2, 0, 1)
    const store = h.store(4)
    await searched(store, HOT_POT_NOODLE)
    expect(reachableCount(results(store))).toBeGreaterThanOrEqual(2)
    store.rescueReroll()
    for (let i = 0; i < 100; i++) {
      const pick = store.home.randomPick?.choice
      if (!pick) throw new Error('没有对话框')
      expect(pick.cuisine).not.toBe('HOT_POT')
      expect(demoReachableCount(pick, HOME, 1500, h.clock.zoned()), JSON.stringify(pick)).toBeGreaterThanOrEqual(2)
      store.rerollRandomPick()
    }
  })

  it('RESULTS-03 显示全部店只是这一次：设置还是只看营业中，重新打开网页再搜又隐藏休息中的；只有自己拨开关才记住', async () => {
    const { h } = setup()
    h.searcher.places = shops([true, false, false, true, false])
    const store = h.store(4)
    h.settings.openNowOnly = true
    await searched(store, HOT_POT_NOODLE)
    store.showClosedToo()
    expect(results(store).openNowOnly).toBe(false)
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    expect(h.settings.openNowOnly).toBe(true)

    const later = h.store(4) // 半夜再打开：休息的店照样藏起来
    h.clock.advance(11 * MINUTE)
    await searched(later, ANY_ANY)
    expect(results(later).openNowOnly).toBe(true)
    expect(shownIds(later)).toEqual(['p1', 'p4'])
    later.setOpenNowOnly(false) // 只有开关本身会记住
    expect(h.settings.openNowOnly).toBe(false)
  })

  it('HOURS-20 20:58 鸡饭还有 2 分钟、走 18 分钟：照样列出（快关门）、但来不及 → 不进猜拳（变帮我挑一家、记跳过）、不能圈；隔天 20:20 就能进猜拳', async () => {
    const { h } = setup()
    h.clock.setTime(20, 58)
    h.searcher.places = [chickenRice(h), ...shops([true, true])]
    const store = h.store(4)
    await searched(store)
    const r = results(store)
    const first = placeAt(store, 0)
    expect(first.id).toBe('ahming') // 照样列出（「⏰ 还有 2 分钟关门」）
    expect(isClosed(statusOf(r, first))).toBe(false)
    expect(closesBeforeArrival(r, first)).toBe(true)
    expect(canGo(r, first)).toBe(false)
    expect(reachableCount(r)).toBe(2)

    store.openDuel()
    expect(store.duel?.mode).toBe('ROULETTE')
    expect(store.duel?.placeIds).toEqual(['p1', 'p2'])
    expect(store.duel?.skippedIds).toEqual(['ahming'])
    store.closeDuel()
    expect(store.toggleBasket('ahming')).toBe('TOO_LATE')
    expect(results(store).basket).toEqual([])

    // 隔天 20:20：还有 40 分钟，走过去（18）再点菜（20）来得及。
    h.clock.setTime(20, 20, 1)
    h.searcher.places = [chickenRice(h), ...shops([true, true])]
    await searched(store)
    expect(canGo(results(store), placeAt(store, 0))).toBe(true)
    store.openDuel()
    expect(store.duel?.mode).toBe('ROCK_PAPER_SCISSORS')
    expect(store.duel?.placeIds).toContain('ahming')
  })

  it('MEAL-02 演示 7:49：猜拳、不服、再猜 → 反悔用完；回首页再按都可以 → 同一个结果、反悔还是 0、不服没反应', async () => {
    const { h } = setup({ demoMode: true })
    h.clock.setTime(7, 49)
    const store = h.store(4)
    await searched(store, ANY_ANY)
    store.openDuel()
    expect(store.duel?.mode).toBe('ROCK_PAPER_SCISSORS')
    store.playHand('ROCK')
    store.duelAgain()
    store.playHand('PAPER')
    const decided = store.duel
    if (!decided) throw new Error('没有游戏')
    expect(decided.regretsLeft).toBe(0)

    // 按两次返回（游戏、列表），再按「都可以」。
    store.closeDuel()
    store.backToHome()
    await searched(store, ANY_ANY)
    store.openDuel()
    expect(store.duel?.round).toBe(decided.round)
    expect(store.duel?.winnerIndex).toBe(decided.winnerIndex)
    expect(store.duel?.regretsLeft).toBe(0)
    store.duelAgain()
    expect(store.duel?.round).toBe(decided.round) // 没有可以反悔的
  })

  it('VISIT-09 10 分钟内导航 3 家（加连按）只算 1 餐、只留最后一家，没有连吃提醒；中餐不被少给', async () => {
    const { h } = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(4)
    await searched(store)
    for (let i = 0; i < 3; i++) {
      store.onNavigate(placeAt(store, i))
      h.clock.advance(3 * MINUTE)
    }
    store.onNavigate(placeAt(store, 2)) // 再连按一下
    expect(store.home.streakCuisine).toBeNull()
    expect(store.home.visitCount).toBe(1)
    expect(h.visits.load().map((v) => v.placeId)).toEqual(['p3'])
    store.openRandomPick()
    expect(store.home.randomPick?.lessLikely).toEqual([])
  })

  it('VISIT-10 旧版本存下的演示记录启动时被清掉；演示模式下导航演示店只记在演示记录（演示里也能连吃提醒）；关掉演示后真实记录、提醒、随便挑都不受影响，重新打开也一样', async () => {
    const { h } = setup({ demoMode: true })
    const now = h.clock.nowMillis
    h.visits.save([
      { placeId: 'demo_01', cuisine: 'CHINESE', atMillis: now - HOUR },
      { placeId: 'ChIJreal', cuisine: 'MALAY', atMillis: now - 26 * HOUR },
    ])
    const store = h.store(4)
    expect(h.visits.load().map((v) => v.placeId)).toEqual(['ChIJreal']) // 启动时清掉
    expect(store.home.visitCount).toBe(0) // 演示记录从空的开始

    await searched(store, { cuisine: 'CHINESE', meal: 'ANY' })
    for (let i = 0; i < 3; i++) {
      store.onNavigate(placeAt(store, i))
      h.clock.advance(5 * HOUR)
    }
    expect(store.home.streakCuisine).toBe('CHINESE')
    expect([...store.lastVisits.keys()].every((id) => id.startsWith('demo_'))).toBe(true)

    store.backToHome()
    store.setDemoMode(false)
    expect(store.home.streakCuisine).toBeNull()
    expect(h.visits.load().some((v) => v.placeId.startsWith('demo_'))).toBe(false)
    expect(store.home.visitCount).toBe(1)
    expect([...store.lastVisits.keys()].some((id) => id.startsWith('demo_'))).toBe(false)
    store.openRandomPick()
    expect(store.home.randomPick?.lessLikely).toEqual([])
    store.dismissRandomPick()

    expect(h.store(4).home.streakCuisine).toBeNull() // 重新打开：还是干净的
  })

  it('DEMO-27 演示结果时关掉演示 → 回首页、不扣次数；真实结果时打开演示，按扩大范围 → 搜演示店（不扣次数）', async () => {
    const { h } = setup({ demoMode: true })
    const store = h.store(4)
    await searched(store, HOT_POT_NOODLE)
    expect(results(store).isDemo).toBe(true)
    store.setDemoMode(false)
    expect(store.ui).toEqual({ kind: 'HOME' })
    expect(h.searcher.calls).toBe(0)
    expect(h.guard.textSearchesUsed()).toBe(0)

    h.searcher.places = shops([true, true, true])
    await searched(store)
    expect(h.searcher.calls).toBe(1)
    store.setDemoMode(true)
    expect(results(store).isDemo).toBe(false)
    store.expandRadius()
    await flush()
    expect(results(store).isDemo).toBe(true)
    expect(results(store).radiusKm).toBe(3)
    expect(h.searcher.calls).toBe(1)
  })

  it('RESTORE-01 圈了第 2 和第 35 名，被系统关掉后两家都回来（第 35 名的卡片也在）、一共找到 40 家；能帮我挑一家、能取消；新开网页圈第 2 家时又提示一次', async () => {
    const { h } = setup()
    h.settings.openNowOnly = false
    h.searcher.places = shops(times(40, true))
    const store = h.store(4)
    await searched(store)
    store.toggleBasket('p2')
    for (let i = 0; i < 11; i++) store.nextPage() // 第 34–36 名
    expect(store.toggleBasket('p35')).toBe('ADDED_TABLE_HINT') // 第 2 家说一次

    const restored = h.store(4, h.afterProcessDeath())
    await flush()
    const r = results(restored)
    expect(r.basket).toEqual(['p2', 'p35'])
    expect(resultItem(r, 'p35')).not.toBeNull()
    expect(foundCount(r)).toBe(40)
    const plan = planDuel(r)
    expect(plan.mode).toBe('ROULETTE')
    expect(plan.candidateIds).toEqual(['p2', 'p35'])
    expect(restored.toggleBasket('p35')).toBe('REMOVED')
    expect(restored.toggleBasket('p3')).toBe('ADDED_TABLE_HINT') // 新打开的网页再说一次
    expect(h.searcher.calls).toBe(1)
  })

  it('LOCATION-05 浏览器已经挡住定位（网页版的「拒绝过、系统不再给说明」）→ 不再弹「好，去允许」，首页卡片直接写怎么在浏览器打开；还没问过、已允许都不算挡住', async () => {
    const { h } = setup()
    h.location.level = 'NONE'
    const store = h.store(4)
    expect(store.home.location).toEqual({ kind: 'WAITING_PERMISSION' })
    // 还可以问：先显示自己的说明，再让浏览器问。
    expect(store.checkPermanentLocationDenial()).toBe(false)
    expect(store.home.location).toEqual({ kind: 'WAITING_PERMISSION' })
    // 浏览器挡住了：说明的窗口不会再来。
    h.location.blocked = true
    expect(store.checkPermanentLocationDenial()).toBe(true)
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: true })
    expect(store.askForLocation()).toBe('BLOCKED')
    expect(store.requestSearch(CHINESE_RICE)).toBe('SEARCHING')
    await flush()
    expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'PERMISSION_NEEDED', permanently: true } })
    // 第一次打开（没挡住）、或已经允许：都不算。
    h.location.blocked = false
    expect(h.store(4).checkPermanentLocationDenial()).toBe(false)
    h.location.level = 'PRECISE'
    h.location.blocked = true
    expect(h.store(4).checkPermanentLocationDenial()).toBe(false)
  })

  it('TRANSLATE-11 翻译失败的店名，时钟每分钟走都不再拿去翻；只有因为别的店关门而新出现在画面上的店才翻一次', async () => {
    const { h, translator } = setup()
    h.clock.setTime(12, 30)
    const closesSoon: Place = {
      ...testPlace('soon', { rating: 4.99, reviews: 900, name: 'Restoran Closing Soon' }),
      openNow: true,
      openingHours: { periods: [], nextOpenMillis: null, nextCloseMillis: h.clock.todayAt(12, 40) },
    }
    h.searcher.places = [
      closesSoon,
      ...['Kedai Satu', 'Kedai Dua', 'Kedai Tiga'].map((name, i) => ({
        ...testPlace(`k${i}`, { rating: 4.8 - i * 0.1, reviews: 500, name, primaryTypeDisplayName: '餐厅' }),
        openNow: true,
      })),
    ]
    const store = h.store(4)
    await searched(store)
    expect(shownIds(store)).toEqual(['soon', 'k0', 'k1'])
    expect(translator.calls).toEqual(['Restoran Closing Soon', 'Kedai Satu', 'Kedai Dua'])

    for (let i = 0; i < 5; i++) {
      h.clock.advance(MINUTE)
      store.onClockTick()
      await flush()
    }
    expect(translator.calls).toHaveLength(3)

    // 12:41：第一家关门了、被藏起来；只有新出现在画面上的那家拿去翻。
    h.clock.setTime(12, 41)
    store.onClockTick()
    await flush()
    expect(shownIds(store)).toEqual(['k0', 'k1', 'k2'])
    expect(translator.calls).toEqual(['Restoran Closing Soon', 'Kedai Satu', 'Kedai Dua', 'Kedai Tiga'])
    expect(resultsView(results(store)).items.every((i) => i.translatedName == null)).toBe(true)
    expect(h.searcher.calls).toBe(1)
  })
})
