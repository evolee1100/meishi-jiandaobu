/**
 * 状态层：第三版（安卓 MainViewModelRound3Test）——休息的店不会赢、营业时间、❤️ 候选篮、愿赌服输、救援卡、吃过的记录。
 * 时间从 2026 年 10 月 6 日（星期二）12:30 吉隆坡开始；只看营业中和真的设置一样默认开着。
 */
import { describe, expect, it } from 'vitest'
import { clockZoned, isClosed, isClosingSoon, weeklyPeriod } from '../domain/openingHours.ts'
import { pickOne } from '../domain/random.ts'
import { ALL_HANDS, lineVerdict, verdictOf } from '../domain/rps.ts'
import { flush, KL, seeded, testPlace } from '../test/helpers.ts'
import { CHINESE_RICE, Harness, placeAt, results, searched, shops, shownIds, times } from '../test/storeHarness.ts'
import { MEAL_MS } from './store.ts'
import { displayRank, duelOutcome, hasMore, planDuel, reachableCount, resultItem, resultsView, statusOf } from './state.ts'
import { visitText } from './texts.ts'

const MINUTE = 60_000
const HOT_POT_NOODLE = { cuisine: 'HOT_POT', meal: 'NOODLE' } as const

/** 第三版的店：p1…pN，好的在前（每家差 0.05 星）。 */
function shops3(open: readonly (boolean | null)[]) {
  return shops(open, 0.05)
}

function setup() {
  return new Harness({ openNowOnly: true })
}

describe('状态层：第三版（MainViewModelRound3Test）', () => {
  it('RESULTS-01 只看营业中默认开（隐藏 2 家休息中的）；来回开关不搜索、不拿照片；关掉后重新打开网页再搜还是关的', async () => {
    const h = setup()
    h.searcher.places = shops3([false, true, true, null, true, false])
    const store = h.store(7)
    await searched(store)
    expect(results(store).openNowOnly).toBe(true)
    expect(shownIds(store)).toEqual(['p2', 'p3', 'p4'])
    expect(resultsView(results(store)).hiddenClosed).toBe(2)
    const photosBefore = h.photos.calls

    store.setOpenNowOnly(false)
    await flush()
    expect(h.settings.openNowOnly).toBe(false)
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    store.setOpenNowOnly(true)
    store.setOpenNowOnly(false)
    await flush()
    expect(h.searcher.calls).toBe(1)
    expect(h.photos.calls).toBe(photosBefore)

    // 关掉网页再打开：还是关的。
    const later = h.store(7)
    h.clock.advance(11 * MINUTE)
    await searched(later)
    expect(results(later).openNowOnly).toBe(false)
    expect(shownIds(later)).toEqual(['p1', 'p2', 'p3'])
  })

  it('DUEL-10 随机的店和开关各跑 1,000 局猜拳和 1,000 局帮我挑一家：赢家、候选都不是休息中的店，被跳过的都是休息中的', async () => {
    const data = seeded(2026)
    const h = setup()
    const store = h.store(7)
    let rps = 0
    let roulette = 0
    let tries = 0
    while ((rps < 1000 || roulette < 1000) && tries++ < 20_000) {
      // 每次都是新的搜索（不用缓存）、新的一餐（愿赌服输：一餐只定一局）。
      h.clock.advance(MEAL_MS + MINUTE)
      h.searcher.places = shops3(Array.from({ length: data.nextInt(2, 10) }, () => pickOne(data, [true, false, null])))
      h.settings.openNowOnly = data.nextBoolean()
      await searched(store)
      if (data.nextBoolean()) store.nextPage()
      store.openDuel()
      const opened = store.duel
      if (!opened) continue
      if (opened.mode === 'ROCK_PAPER_SCISSORS') {
        store.playHand(pickOne(data, ALL_HANDS))
        rps++
      } else {
        roulette++
      }
      const decided = store.duel
      if (!decided || decided.winnerIndex == null) throw new Error('没有赢家')
      const r = results(store)
      const status = (id: string) => {
        const item = resultItem(r, id)
        if (!item) throw new Error('不在结果里：' + id)
        return statusOf(r, item.place)
      }
      expect(isClosed(status(decided.placeIds[decided.winnerIndex] as string))).toBe(false)
      expect(decided.placeIds.every((id) => !isClosed(status(id)))).toBe(true)
      expect(decided.skippedIds.every((id) => isClosed(status(id)))).toBe(true)
      store.closeDuel()
    }
    expect(rps).toBeGreaterThanOrEqual(1000)
    expect(roulette).toBeGreaterThanOrEqual(1000)
  })

  it('DUEL-11 这一页 1 家在休息 → 用另外 2 家帮我挑一家、记下跳过的那家、台词是帮我挑一家组；下一页只有 1 家能去 → 没有游戏；都不搜索', async () => {
    const h = setup()
    h.settings.openNowOnly = false
    h.searcher.places = shops3([true, false, null, false, false, true])
    const store = h.store(7)
    await searched(store)
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    expect(planDuel(results(store)).mode).toBe('ROULETTE')
    store.openDuel()
    const duel = store.duel
    expect(duel?.mode).toBe('ROULETTE')
    expect(duel?.placeIds).toEqual(['p1', 'p3'])
    expect(duel?.skippedIds).toEqual(['p2'])
    expect([0, 1]).toContain(duel?.winnerIndex)
    expect(lineVerdict(duel?.line ?? '')).toBe('ROULETTE')

    store.closeDuel()
    store.nextPage() // p4 休息、p5 休息、p6 营业
    expect(planDuel(results(store)).mode).toBeNull()
    store.openDuel()
    expect(store.duel).toBeNull()
    expect(h.searcher.calls).toBe(1)
  })

  it('HOURS-19 9:50 搜、10:05 时钟走一格：10 点关门的店变休息中（明天 7:00 开）并被隐藏，隐藏数 1，不搜索', async () => {
    const h = setup()
    h.clock.setTime(9, 50)
    const closesAtTen = {
      ...testPlace('early', { rating: 4.8, reviews: 900 }),
      openNow: true,
      openingHours: {
        periods: [0, 1, 2, 3, 4, 5, 6].map((d) => weeklyPeriod(d, 7, 0, d, 10, 0)),
        nextOpenMillis: null,
        nextCloseMillis: h.clock.todayAt(10),
      },
    }
    h.searcher.places = [closesAtTen, ...shops3([true, true, true]).map((p) => ({ ...p, id: 'o' + p.id }))]
    const store = h.store(7)
    await searched(store)
    const before = results(store)
    expect(shownIds(store)).toContain('early')
    const zonedBefore = clockZoned(before.clock)
    if (!zonedBefore) throw new Error('没有时钟')
    expect(isClosingSoon(statusOf(before, closesAtTen), zonedBefore)).toBe(true)

    h.clock.setTime(10, 5)
    store.onClockTick()
    const after = results(store)
    const tomorrowSeven = h.clock.todayAt(7) + 24 * 60 * MINUTE
    expect(statusOf(after, closesAtTen)).toEqual({ kind: 'CLOSED', opensAt: { epochMillis: tomorrowSeven, zone: KL } })
    expect(shownIds(store)).not.toContain('early')
    expect(resultsView(after).hiddenClosed).toBe(1)
    expect(h.searcher.calls).toBe(1)
  })

  it('RESULTS-02 救援卡：全部休息时能去 0 家；换个菜系再摇不摇火锅、摇 300 次不搜索；显示全部店只改这一次、设置不变；扩大到 3 公里搜 1 次并记住、再扩大到 5 公里、5 公里后不再扩大', async () => {
    const h = setup()
    h.searcher.places = shops3([false, false])
    const store = h.store(7)
    await searched(store, HOT_POT_NOODLE)
    const r = results(store)
    expect(reachableCount(r)).toBe(0)
    expect(resultsView(r).items).toHaveLength(0)
    const photosBefore = h.photos.calls

    store.rescueReroll()
    expect(store.home.randomPick?.excludedCuisine).toBe('HOT_POT')
    for (let i = 0; i < 300; i++) {
      expect(store.home.randomPick?.choice.cuisine).not.toBe('HOT_POT')
      store.rerollRandomPick()
    }
    store.dismissRandomPick()
    store.showClosedToo()
    await flush()
    expect(shownIds(store)).toEqual(['p1', 'p2'])
    expect(results(store).openNowOnly).toBe(false)
    expect(h.settings.openNowOnly).toBe(true)
    expect(h.searcher.calls).toBe(1)
    expect(h.photos.calls).toBe(photosBefore)

    store.expandRadius()
    await flush()
    expect(h.searcher.calls).toBe(2)
    expect(h.searcher.radii.at(-1)).toBeCloseTo(3000, 1)
    expect(h.settings.radiusKm).toBe(3)
    expect(results(store).choice).toEqual(HOT_POT_NOODLE)
    store.expandRadius()
    await flush()
    expect(h.searcher.radii.at(-1)).toBeCloseTo(5000, 1)
    store.expandRadius() // 已经 5 公里：什么都不做
    await flush()
    expect(h.searcher.calls).toBe(3)
  })

  it('PICK-17 凌晨 2 点是宵夜；摇 5 次后「刚才摇到」只留最近 3 个、新的在前、不含当前；点回去马上显示（不转）、当前那个进历史；点不在历史里的没反应；重新打开对话框历史是空的', () => {
    const h = setup()
    h.clock.setTime(2, 0)
    const store = h.store(7)
    store.openRandomPick()
    expect(store.home.randomPick?.dayPart).toBe('SUPPER')
    const seen = [store.home.randomPick?.choice]
    for (let i = 0; i < 5; i++) {
      store.rerollRandomPick()
      seen.push(store.home.randomPick?.choice)
    }
    const state = store.home.randomPick
    if (!state) throw new Error('没有对话框')
    expect(state.history).toHaveLength(3)
    expect(state.history).not.toContainEqual(state.choice)
    expect(state.history[0]).toEqual(seen[seen.length - 2]) // 新的在前

    const earlier = state.history[1]
    if (!earlier) throw new Error('没有历史')
    store.returnToEarlierPick(earlier)
    const back = store.home.randomPick
    if (!back) throw new Error('没有对话框')
    expect(back.choice).toEqual(earlier)
    expect(back.settled).toBe(true) // 马上显示，不转
    expect(back.history).not.toContainEqual(earlier)
    expect(back.history).toContainEqual(state.choice)
    expect(back.history).toHaveLength(3)
    const korean = { cuisine: 'KOREAN', meal: 'NOODLE' } as const
    store.returnToEarlierPick(back.history.some((c) => c.cuisine === korean.cuisine && c.meal === korean.meal) ? back.choice : korean)
    expect(store.home.randomPick?.choice).toEqual(back.choice) // 不在历史里：没反应
    expect(h.searcher.calls).toBe(0)

    store.dismissRandomPick()
    store.openRandomPick()
    expect(store.home.randomPick?.history).toEqual([])
  })

  it('MEAL-01 一餐只能不服一次：回到列表再开同一组是同一个结果（不重置也不用掉）；用完后不服没反应；换一页直接显示锁定的结果、不问；回首页同一个按钮再搜还是愿赌服输；3 个钟头后新的一餐重新有 1 次', async () => {
    const h = setup()
    h.settings.openNowOnly = false
    h.searcher.places = shops3(times(6, true))
    const store = h.store(7)
    await searched(store)
    store.openDuel()
    store.playHand('ROCK')
    const first = store.duel
    if (!first) throw new Error('没有游戏')
    expect(first.regretsLeft).toBe(1)
    expect(first.line).not.toBeNull()
    expect(lineVerdict(first.line ?? '')).toBe(verdictOf(duelOutcome(first)))

    // 回到列表再打开：同一个结果，不服还在（没重置、也没用掉）。
    store.onDuelAnimationDone(first.round)
    store.closeDuel()
    store.openDuel()
    const again = store.duel
    expect(again?.round).toBe(first.round)
    expect(again?.winnerIndex).toBe(first.winnerIndex)
    expect(again?.animationDone).toBe(true)
    expect(again?.regretsLeft).toBe(1)

    store.duelAgain() // 不服！再来一局
    const second = store.duel
    expect(second?.round).toBeGreaterThan(first.round)
    expect(second?.userHand).toBeNull()
    expect(second?.regretsLeft).toBe(0)
    store.playHand('PAPER')
    const decided = store.duel
    if (!decided) throw new Error('没有游戏')
    store.duelAgain() // 用完了：没反应
    expect(store.duel).toBe(decided)

    store.closeDuel()
    store.openDuel() // 同一组店：愿赌服输，定了的结果
    expect(store.duel?.round).toBe(decided.round)
    expect(store.duel?.regretsLeft).toBe(0)
    store.duelAgain()
    expect(store.duel?.round).toBe(decided.round)

    // 另一组店（下一页）：反悔用完了，不开新局，显示定了的结果、锁住。
    store.closeDuel()
    store.nextPage()
    store.openDuel()
    const other = store.duel
    expect(other?.round).toBe(decided.round)
    expect(other?.locked).toBe(true)
    expect(other?.regretsLeft).toBe(0)
    expect(store.mealPrompt).toBeNull()

    store.closeDuel()
    store.firstPage()
    store.openDuel()
    expect(store.duel?.round).toBe(decided.round)
    expect(store.duel?.winnerIndex).toBe(decided.winnerIndex)
    expect(store.duel?.regretsLeft).toBe(0)

    // 回首页再按同一个按钮：同样的店，还是愿赌服输。
    store.closeDuel()
    h.clock.advance(11 * MINUTE)
    await searched(store)
    store.openDuel()
    expect(store.duel?.round).toBe(decided.round)
    expect(store.duel?.winnerIndex).toBe(decided.winnerIndex)
    expect(store.duel?.regretsLeft).toBe(0)

    // 几个钟头后的另一餐：重新来过。
    store.closeDuel()
    h.clock.advance(MEAL_MS + MINUTE)
    await searched(store)
    store.openDuel()
    expect(store.duel?.regretsLeft).toBe(1)
    expect(store.duel?.userHand).toBeNull()
    expect(h.searcher.calls).toBe(3)
  })

  it('BASKET-01 跨页圈第 2、8 名 → 帮我挑一家就用这两家；第 2 家时提示一次；再圈第 7 名 → 先问反悔 → 用这 3 家猜拳；第 10 名休息中不能圈；换页、开关都不丢；被关掉后还在、能取消；重新搜索清空', async () => {
    const h = setup()
    h.searcher.places = shops3([...times(9, true), false])
    const store = h.store(7)
    await searched(store)
    expect(store.toggleBasket('p2')).toBe('ADDED')
    store.nextPage()
    store.nextPage()
    expect(shownIds(store)).toEqual(['p7', 'p8', 'p9'])
    expect(store.toggleBasket('p8')).toBe('ADDED_TABLE_HINT') // 第 2 家说一次「几个人一起吃？…」
    expect(results(store).basket).toEqual(['p2', 'p8'])

    store.openDuel()
    const roulette = store.duel
    expect(roulette?.mode).toBe('ROULETTE')
    expect(roulette?.fromBasket).toBe(true)
    expect(roulette?.placeIds).toEqual(['p2', 'p8'])
    expect(displayRank(results(store), 'p2')).toBe(2)
    expect(displayRank(results(store), 'p8')).toBe(8)
    store.closeDuel()

    expect(store.toggleBasket('p7')).toBe('ADDED')
    // 帮我挑一家已经定了这一餐：3 家是新的一局，先问。
    store.openDuel()
    expect(store.mealPrompt).not.toBeNull()
    store.confirmMealRegret()
    const rps = store.duel
    expect(rps?.mode).toBe('ROCK_PAPER_SCISSORS')
    expect(rps?.placeIds).toEqual(['p2', 'p8', 'p7'])
    store.playHand('SCISSORS')
    expect(['p2', 'p8', 'p7']).toContain(store.duel?.placeIds[store.duel?.winnerIndex ?? -1])
    store.closeDuel()

    // 最多 6 家；休息中的永远不能圈。
    expect(store.toggleBasket('p9')).toBe('ADDED')
    expect(store.toggleBasket('p9')).toBe('REMOVED')
    h.settings.openNowOnly = false
    store.setOpenNowOnly(false)
    while (hasMore(resultsView(results(store)))) store.nextPage()
    expect(store.toggleBasket('p10')).toBe('CLOSED')
    expect(results(store).basket).toEqual(['p2', 'p8', 'p7']) // 换页、开关都没丢

    // 在后台被丢掉（例如在 Google 地图里）：还在。
    const restored = h.store(7, h.afterProcessDeath())
    await flush()
    expect(results(restored).basket).toEqual(['p2', 'p8', 'p7'])
    expect(restored.toggleBasket('p8')).toBe('REMOVED')
    expect(results(restored).basket).toEqual(['p2', 'p7'])

    expect(h.searcher.calls).toBe(1)
    h.clock.advance(11 * MINUTE)
    await searched(restored)
    expect(results(restored).basket).toEqual([])
    restored.clearBasket()
    expect(h.searcher.calls).toBe(2)
  })

  it('HOME-02 从地图 10 分钟回来还在结果页；超过 3 小时又换了时段回首页；宵夜 21:00 到 00:30 不回；被关掉后到晚餐打开也回首页；隔天同一时段（超过 12 小时）也回首页', async () => {
    const h = setup()
    h.clock.setTime(12, 30)
    h.searcher.places = shops3([true, true, true])
    const store = h.store(7)
    await searched(store)
    h.clock.advance(10 * MINUTE) // 从 Google 地图回来
    store.onResume()
    expect(store.ui.kind).toBe('RESULTS')
    h.clock.setTime(15, 40) // 超过 3 小时，而且下午茶是另一餐
    store.onResume()
    expect(store.ui).toEqual({ kind: 'HOME' })
    expect(h.searcher.calls).toBe(1)

    // 同一餐里过了 3 小时（宵夜 21:00 → 00:30）：留着。
    h.clock.setTime(21, 0)
    await searched(store)
    h.clock.setTime(0, 30, 1)
    store.onResume()
    expect(store.ui.kind).toBe('RESULTS')

    // 午餐的结果被丢掉以后到晚餐才打开：也回首页。
    h.clock.setTime(12, 0)
    const lunch = h.store(7)
    h.clock.advance(11 * MINUTE)
    await searched(lunch)
    h.clock.setTime(19, 30)
    const restored = h.store(7, h.afterProcessDeath())
    await flush()
    restored.onResume()
    expect(restored.ui).toEqual({ kind: 'HOME' })

    // 昨天的午餐到今天午餐再看（同一个时段，隔了 24 小时）：另一餐，回首页。
    h.clock.setTime(12, 30, 1)
    await searched(restored)
    expect(restored.ui.kind).toBe('RESULTS')
    h.clock.setTime(12, 20, 1)
    restored.onResume()
    expect(restored.ui).toEqual({ kind: 'HOME' })
  })

  it('HOME-03 四个范围大按钮一按马上生效并记住，不搜索', () => {
    const h = setup()
    const store = h.store(7)
    store.setRadius(0.5)
    expect(store.home.radiusKm).toBe(0.5)
    expect(h.settings.radiusKm).toBe(0.5)
    expect(h.searcher.calls).toBe(0)
  })

  it('VISIT-07 中午导航 p1：记下编号、中餐、时间；晚上再搜，卡片写「👣 今天中午去过」，隔天「昨天去过」、3 天后「3 天前去过」；中餐不被少给', async () => {
    const h = setup()
    h.clock.setTime(12, 30)
    h.searcher.places = shops3([true, true, true])
    const store = h.store(7)
    await searched(store)
    store.onNavigate(placeAt(store, 0))
    const saved = h.visits.load()
    expect(saved).toEqual([{ placeId: 'p1', cuisine: 'CHINESE', atMillis: h.clock.nowMillis }])

    h.clock.setTime(19, 30)
    const dinner = h.store(7) // 晚上再打开
    await searched(dinner, { cuisine: 'ANY', meal: 'ANY' })
    const visitedAt = dinner.lastVisits.get('p1')
    if (visitedAt == null) throw new Error('没有记录')
    const now = h.clock.nowMillis
    expect(visitText(visitedAt, now, KL)).toBe('👣 今天中午去过')
    expect(visitText(visitedAt, now + 24 * 3_600_000, KL)).toBe('👣 昨天去过')
    expect(visitText(visitedAt, now + 3 * 24 * 3_600_000, KL)).toBe('👣 3 天前去过')

    // 第五版：中餐永远不被少给（华人一天三餐都可能吃），况且午餐已经是 7 个钟头前。
    dinner.openRandomPick()
    expect(dinner.home.randomPick?.lessLikely).toEqual([])
    expect(h.searcher.calls).toBe(2)
  })

  it('VISIT-08 午餐、晚餐、隔天午餐都导航中餐 → 出现连吃提醒、3 笔；点提醒打开随便挑、100 次都不摇中餐；清除记录后提醒、去过、存储都清空', async () => {
    const h = setup()
    h.searcher.places = shops3([true, true, true])
    const store = h.store(7)
    await searched(store)
    store.onNavigate(placeAt(store, 0))
    h.clock.setTime(19, 30)
    store.onNavigate(placeAt(store, 1))
    expect(store.home.streakCuisine).toBeNull()
    h.clock.setTime(12, 30, 1)
    store.onNavigate(placeAt(store, 2))
    expect(store.home.streakCuisine).toBe('CHINESE')
    expect(store.home.visitCount).toBe(3)

    store.openRandomPick('CHINESE')
    for (let i = 0; i < 100; i++) {
      expect(store.home.randomPick?.choice.cuisine).not.toBe('CHINESE')
      store.rerollRandomPick()
    }
    store.dismissRandomPick()

    store.clearVisits()
    expect(store.home.streakCuisine).toBeNull()
    expect(store.home.visitCount).toBe(0)
    expect(store.lastVisits.size).toBe(0)
    expect(h.visits.load()).toEqual([])
    expect(h.searcher.calls).toBe(1)
  })

  it('DEMO-24 首页黑条关掉演示 → 出现撤销；按撤销恢复演示、撤销消失；再按没反应；8 秒到了撤销消失、演示保持关；都不搜索', async () => {
    const h = setup()
    h.settings.demoMode = true
    const store = h.store(7)
    store.turnOffDemoFromBanner()
    expect(h.settings.demoMode).toBe(false)
    expect(store.home.demoUndo).toBe(true)
    store.undoDemoOff()
    expect(h.settings.demoMode).toBe(true)
    expect(store.home.demoMode).toBe(true)
    expect(store.home.demoUndo).toBe(false)
    store.undoDemoOff() // 没有可以撤销的了
    expect(h.settings.demoMode).toBe(true)
    await flush()
    expect(h.searcher.calls).toBe(0)
    expect(h.guard.textSearchesUsed()).toBe(0)

    store.turnOffDemoFromBanner()
    store.dismissDemoUndo() // 8 秒到了（画面负责计时）
    expect(store.home.demoUndo).toBe(false)
    expect(h.settings.demoMode).toBe(false)
  })

  it('LOCATION-04 在自己的定位说明按「先不要」= 暂时没允许（不是被浏览器挡住），之后还可以再问', () => {
    const h = setup()
    h.location.level = 'NONE'
    const store = h.store(7)
    expect(store.home.location).toEqual({ kind: 'WAITING_PERMISSION' })
    expect(store.home.explainLocation).toBe(true)
    store.declineLocationExplanation()
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: false })
    expect(store.home.explainLocation).toBe(false)
    expect(h.location.permanentlyDenied()).toBe(false)
    // 还可以再问：再按吃饭会再显示说明。
    expect(store.requestSearch(CHINESE_RICE)).toBe('EXPLAINING')
    expect(store.home.explainLocation).toBe(true)
  })
})
