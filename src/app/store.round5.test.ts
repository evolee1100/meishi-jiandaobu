/**
 * 状态层：第五版（安卓 MainViewModelRound5Test）——👥 饭桌模式（✂️ 每人划一刀、🙈 暗中出拳）、❤️ 六家和 🎡 转盘、
 * 一餐一次的愿赌服输、🃏 任务卡、📊 计票板、📜 今日饭签、📳 摇一摇和小修正。全部在手机里，不发请求。
 */
import { describe, expect, it } from 'vitest'
import { fortuneChoice, fortuneIndexFor } from '../domain/fortune.ts'
import type { HandId, Place } from '../domain/model.ts'
import { weeklyPeriod } from '../domain/openingHours.ts'
import { lineVerdict } from '../domain/rps.ts'
import { ALL_AVATARS, judgeSecretHands, vetoCurrentPlayer, vetoIsFinished, vetoIsLastCut, vetoReferees, vetoTurns } from '../domain/table.ts'
import { isFreePass, taskAssignee } from '../domain/taskDeck.ts'
import { localEpochDay } from '../domain/time.ts'
import { DEMO_REFERENCE_CENTER } from '../services/demoPlaces.ts'
import { flush, KL, klMillis, testPlace } from '../test/helpers.ts'
import { Harness, results, searched, shops, shownIds, times } from '../test/storeHarness.ts'
import type { MainStore } from './store.ts'
import { MEAL_MS } from './store.ts'
import {
  allowsRegret,
  displayRank,
  isNight,
  mealWinnerName,
  planDuel,
  resultItem,
  secretCurrentPlayer,
  secretPossible,
  tableInProgress,
  type DuelState,
  type TableState,
} from './state.ts'

const MINUTE = 60_000
const ANY_ANY = { cuisine: 'ANY', meal: 'ANY' } as const
const JAPANESE_ANY = { cuisine: 'JAPANESE', meal: 'ANY' } as const

function setup() {
  return new Harness({ position: DEMO_REFERENCE_CENTER, openNowOnly: true, phoneSeed: 1234 })
}

/** 在这一页玩一局剪刀石头布，回传定下来的那一局。 */
function decideOnPage(store: MainStore, hand: HandId = 'ROCK'): DuelState {
  store.openDuel()
  store.playHand(hand)
  const duel = store.duel
  if (!duel) throw new Error('没有游戏')
  return duel
}

function duelOf(store: MainStore): DuelState {
  const duel = store.duel
  if (!duel) throw new Error('没有游戏')
  return duel
}

function tableOf(store: MainStore): TableState {
  const table = store.table
  if (!table) throw new Error('没有饭桌')
  return table
}

function winnerId(duel: DuelState): string | undefined {
  return duel.winnerIndex == null ? undefined : duel.placeIds[duel.winnerIndex]
}

/** 阿明海南鸡饭：1,092 米外（走路 18 分钟），每天 10:00–21:00。 */
function chickenRice(h: Harness): Place {
  return {
    ...testPlace('ahming', { rating: 4.95, reviews: 1240, distanceMeters: 1092 }),
    openNow: true,
    openingHours: { periods: [0, 1, 2, 3, 4, 5, 6].map((d) => weeklyPeriod(d, 10, 0, d, 21, 0)), nextOpenMillis: null, nextCloseMillis: h.clock.todayAt(21) },
  }
}

describe('状态层：❤️ 六家和 🎡 转盘', () => {
  it('BASKET-02 圈 2 家帮我挑一家、3 家猜拳、4 家起转盘；最多 6 家，第 7 家提示圈满；转盘 6 格、转之前没有赢家、按转后赢家就是转盘目标、台词用帮我挑一家组、再按转不变；不搜索、不拿照片', async () => {
    const h = setup()
    h.searcher.places = shops(times(10, true))
    const store = h.store(5)
    await searched(store)
    expect(store.toggleBasket('p1')).toBe('ADDED')
    expect(store.toggleBasket('p2')).toBe('ADDED_TABLE_HINT')
    expect(planDuel(results(store)).mode).toBe('ROULETTE')
    store.toggleBasket('p3')
    expect(planDuel(results(store)).mode).toBe('ROCK_PAPER_SCISSORS')
    store.nextPage()
    store.toggleBasket('p4')
    expect(planDuel(results(store)).mode).toBe('WHEEL')
    store.toggleBasket('p5')
    store.nextPage()
    expect(store.toggleBasket('p9')).toBe('ADDED')
    expect(store.toggleBasket('p8')).toBe('FULL')
    expect(results(store).basket).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p9'])
    await flush()
    const photoCalls = h.photos.calls

    store.openDuel()
    const wheel = duelOf(store)
    expect(wheel.mode).toBe('WHEEL')
    expect(wheel.placeIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p9'])
    expect(wheel.winnerIndex).toBeNull() // 按「转！」之前什么都没定
    store.spinWheel()
    const spun = duelOf(store)
    expect(spun.winnerIndex).toBe(spun.wheel?.target)
    expect(spun.wheel?.segments).toBe(6)
    expect(lineVerdict(spun.line ?? '')).toBe('ROULETTE') // 帮我挑一家那组（「命运选中了它 ✨」）
    store.spinWheel() // 再按「转！」不变
    expect(store.duel).toBe(spun)
    await flush()
    expect(h.searcher.calls).toBe(1)
    expect(h.photos.calls).toBe(photoCalls)
  })

  it('RESTORE-03 圈 6 家（含第 35 名）被系统关掉后都回来，还是转盘', async () => {
    const h = setup()
    h.settings.openNowOnly = false
    h.searcher.places = shops(times(40, true))
    const store = h.store(5)
    await searched(store)
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) store.toggleBasket(id)
    for (let i = 0; i < 11; i++) store.nextPage() // 第 34–36 名
    expect(store.toggleBasket('p35')).toBe('ADDED')
    const restored = h.store(5, h.afterProcessDeath())
    await flush()
    expect(results(restored).basket).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p35'])
    expect(resultItem(results(restored), 'p35')).not.toBeNull()
    expect(planDuel(results(restored)).mode).toBe('WHEEL')
    expect(h.searcher.calls).toBe(1)
  })

  it('BASKET-03 清空 5 家（跨页、顺序 p3 p1 p2 p5 p4）→ 撤销全部回来、顺序不变；撤销后再按没用；8 秒过了不能撤销；清空后再圈一家，撤销也失效', async () => {
    const h = setup()
    h.searcher.places = shops(times(9, true))
    const store = h.store(5)
    await searched(store)
    for (const id of ['p3', 'p1', 'p2']) store.toggleBasket(id)
    store.nextPage()
    for (const id of ['p5', 'p4']) store.toggleBasket(id)
    store.clearBasket()
    expect(results(store).basket).toEqual([])
    expect(results(store).clearedBasket).toEqual(['p3', 'p1', 'p2', 'p5', 'p4'])
    store.undoClearBasket()
    expect(results(store).basket).toEqual(['p3', 'p1', 'p2', 'p5', 'p4'])
    expect(results(store).clearedBasket).toEqual([])
    store.undoClearBasket() // 没有可以撤销的了
    expect(results(store).basket).toHaveLength(5)
    // 又清空，8 秒到了（画面让它消失）：真的没了。
    store.clearBasket()
    store.dismissBasketUndo()
    store.undoClearBasket()
    expect(results(store).basket).toEqual([])
    // 再圈一家也会让撤销消失。
    store.toggleBasket('p1')
    store.clearBasket()
    store.toggleBasket('p2')
    store.undoClearBasket()
    expect(results(store).basket).toEqual(['p2'])
  })
})

describe('状态层：🤝 愿赌服输（一餐一次）', () => {
  it('MEAL-10 六种「回去再玩」任意两种组合（36 种）：第一种用掉唯一的反悔（同一组重新搜索除外），第二种永远不开新局、不问、只显示刚才的结果', async () => {
    const h = setup()
    h.searcher.places = shops(times(12, true))
    const ways: [string, (store: MainStore) => Promise<void>][] = [
      ['不服', async (s) => s.duelAgain()],
      ['另一组店', async (s) => {
        s.closeDuel()
        s.nextPage()
        s.openDuel()
      }],
      ['清空重圈', async (s) => {
        s.closeDuel()
        s.clearBasket()
        for (const id of ['p1', 'p5', 'p9']) s.toggleBasket(id)
        s.openDuel()
      }],
      ['同一组重新搜索', async (s) => {
        s.closeDuel()
        s.backToHome()
        h.clock.advance(11 * MINUTE)
        await searched(s)
        s.firstPage()
        s.openDuel()
      }],
      ['换菜系', async (s) => {
        s.closeDuel()
        s.backToHome()
        await searched(s, { cuisine: 'MALAY', meal: 'ANY' })
        s.nextPage()
        s.openDuel()
      }],
      ['饭桌模式', async (s) => {
        s.closeDuel()
        s.nextPage()
        s.openTable()
      }],
    ]
    for (const [firstName, first] of ways) {
      for (const [secondName, second] of ways) {
        const label = `${firstName} + ${secondName}`
        const store = h.store(5)
        h.clock.advance(MEAL_MS + MINUTE) // 每一组都是新的一餐
        await searched(store)
        expect(decideOnPage(store).regretsLeft, label).toBe(1)
        await first(store)
        await flush()
        // 新的一局：先问（不服、同一组店除外）。
        if (store.mealPrompt) store.confirmMealRegret()
        await flush()
        const regretsAfterFirst = store.mealDecision?.regretsLeft
        if (firstName !== '同一组重新搜索') expect(regretsAfterFirst, label).toBe(0)
        // 不管第二种是什么：不会有第三局，也不会问。
        const shownDuel = store.duel
        if (shownDuel && shownDuel.mode === 'ROCK_PAPER_SCISSORS' && shownDuel.userHand == null) store.playHand('PAPER')
        if (store.table) store.closeTable()
        const before = store.mealDecision?.duel
        if (!before) throw new Error('这一餐没有定：' + label)
        await second(store)
        await flush()
        if (regretsAfterFirst === 0) {
          expect(store.mealPrompt, label).toBeNull()
          expect(store.table, label).toBeNull()
          if (store.duel) expect(store.duel.round, label).toBe(before.round)
          expect(store.mealDecision?.duel.round, label).toBe(before.round)
        }
        store.dispose()
      }
    }
  })

  it('MEAL-11 换一组店先问；「不了，就吃这家」显示原结果、不用反悔；「确定，重新玩」用这组店新开一局；用完后开局显示锁定的结果、不问；大家都同意重来开新局（一次拒绝只能用一次）；3 小时后才重新有 1 次', async () => {
    const h = setup()
    h.searcher.places = shops(times(9, true))
    const store = h.store(5)
    await searched(store)
    const first = decideOnPage(store, 'SCISSORS')
    expect(store.mealDecision?.duel.round).toBe(first.round)
    store.closeDuel()
    store.nextPage()
    store.openDuel()
    const meal = store.mealDecision
    if (!meal) throw new Error('这一餐没定')
    expect(store.mealPrompt?.placeName).toBe(mealWinnerName(meal))
    store.declineMealRegret()
    expect(store.duel?.round).toBe(first.round)
    expect(store.mealDecision?.regretsLeft).toBe(1)

    store.closeDuel()
    store.openDuel()
    store.confirmMealRegret()
    expect(store.duel?.placeIds).toEqual(['p4', 'p5', 'p6'])
    expect(store.duel?.userHand).toBeNull()
    store.playHand('PAPER')
    const second = duelOf(store)
    expect(store.mealDecision?.duel.round).toBe(second.round)
    expect(second.regretsLeft).toBe(0)

    store.closeDuel()
    store.nextPage()
    store.openDuel()
    const locked = duelOf(store)
    expect(locked.locked).toBe(true)
    expect(locked.round).toBe(second.round)
    expect(store.mealPrompt).toBeNull()

    store.agreeToRestart() // 画面上问了两次「大家都同意重来？」
    expect(store.duel?.placeIds).toEqual(['p7', 'p8', 'p9'])
    expect(store.duel?.userHand).toBeNull()
    store.agreeToRestart() // 一次拒绝只能用一次
    store.playHand('ROCK')
    expect(store.mealDecision?.duel.round).toBe(store.duel?.round)

    // 还是同一餐（从第一次定下算起）。
    h.clock.advance(MEAL_MS - 30 * MINUTE)
    store.closeDuel()
    store.firstPage()
    store.openDuel()
    expect(store.duel?.locked).toBe(true)
    // 第一次定下的 3 小时后：新的一餐，又有 1 次反悔。
    h.clock.advance(31 * MINUTE)
    store.closeDuel()
    store.openDuel()
    expect(store.duel?.locked).toBe(false)
    expect(store.duel?.userHand).toBeNull()
    expect(store.duel?.regretsLeft).toBe(1)
    expect(h.searcher.calls).toBe(1)
  })

  it('MEAL-12 这一餐的决定和用掉的反悔：被系统关掉后还在；按返回退出再打开也在（存在本机、不存照片网址）；一餐过后从本机删掉；看一看显示那个结果；换了搜索也带着原来的店', async () => {
    const h = setup()
    h.searcher.places = shops(times(9, true))
    const store = h.store(5)
    await searched(store)
    const decided = decideOnPage(store)
    store.duelAgain()
    store.playHand('PAPER')
    const final = duelOf(store)
    const restored = h.store(5, h.afterProcessDeath(h.session))
    await flush()
    expect(restored.mealDecision?.duel.round).toBe(final.round)
    expect(restored.mealDecision?.regretsLeft).toBe(0)
    expect(restored.mealDecision?.duel.round).not.toBe(decided.round)

    // 按返回离开再打开（sessionStorage 是空的）：还是同一餐。
    const reopened = h.store(5)
    expect(reopened.mealDecision?.duel.round).toBe(final.round)
    expect(reopened.mealDecision?.regretsLeft).toBe(0)
    expect(reopened.mealDecision?.items.every((i) => i.photo.kind === 'NONE')).toBe(true) // 照片网址不存
    // 一餐过了：本机也删掉。
    h.clock.advance(MEAL_MS + MINUTE)
    expect(h.store(5).mealDecision).toBeNull()
    expect(h.games.mealJson).toBeNull()
    h.clock.advance(-(MEAL_MS + MINUTE))

    // 「🤝 这一餐已经定了：…　看一看」：那个结果，什么都不重玩。
    restored.showMealDecision()
    expect(restored.duel?.round).toBe(final.round)
    expect(restored.duel?.animationDone).toBe(true)
    expect(restored.duel?.locked).toBe(false)
    // 换了搜索、别的店：照样看得到（店一起带着）。
    restored.closeDuel()
    h.searcher.places = shops(times(9, true)).map((p) => ({ ...p, id: 'x' + p.id }))
    h.clock.advance(11 * MINUTE)
    await searched(restored, JAPANESE_ANY)
    restored.showMealDecision()
    const again = duelOf(restored)
    expect(again.round).toBe(final.round)
    expect(new Set(again.snapshot.map((i) => i.place.id))).toEqual(new Set(final.placeIds))
    restored.closeDuel()
    restored.openDuel()
    expect(restored.duel?.locked).toBe(true)
  })

  it('MEAL-13 看一看以前那次的结果再不服：新的一局用那次的店（带着店的资料），定下后成为这一餐的决定', async () => {
    const h = setup()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    await searched(store)
    const first = decideOnPage(store)
    store.closeDuel()
    h.searcher.places = shops(times(6, true)).map((p) => ({ ...p, id: 'x' + p.id }))
    h.clock.advance(11 * MINUTE)
    await searched(store, JAPANESE_ANY)
    store.showMealDecision()
    expect(store.duel?.regretsLeft).toBe(1)
    store.duelAgain()
    const again = duelOf(store)
    expect(again.round).not.toBe(first.round)
    expect(again.placeIds).toEqual(first.placeIds)
    expect(new Set(again.snapshot.map((i) => i.place.id))).toEqual(new Set(first.placeIds))
    store.playHand('PAPER')
    expect(store.mealDecision?.duel.round).toBe(store.duel?.round)
    expect(new Set(store.mealDecision?.items.map((i) => i.place.id))).toEqual(new Set(first.placeIds))
  })

  it('MEAL-14 真实的这一餐定了以后，在演示模式开局不会被锁、不会问', async () => {
    const h = setup()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    await searched(store)
    decideOnPage(store)
    store.closeDuel()
    store.backToHome()
    store.setDemoMode(true)
    await searched(store, ANY_ANY)
    store.openDuel()
    expect(store.mealPrompt).toBeNull() // 真实的一餐锁不到演示
    expect(store.duel).not.toBeNull()
    expect(store.duel?.locked).toBe(false)
  })
})

describe('状态层：📊 计票板', () => {
  it('VOTE-01 回首页再搜（就算用缓存）：计票板和清空撤销都没有了', async () => {
    const h = setup()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    await searched(store)
    store.toggleBasket('p1')
    store.clearBasket()
    store.startVoteCount(['p1', 'p2', 'p3'])
    store.changeVote(0, true)
    store.backToHome()
    await searched(store) // 10 分钟内：用缓存
    expect(results(store).fromCache).toBe(true)
    expect(results(store).vote).toBeNull()
    expect(results(store).clearedBasket).toEqual([])
  })

  it('VOTE-02 计票：减到 0 不再减；还没人投票时数好了没反应；4:2:1 → 第一家赢、没有转盘、算这一餐；同一组店再开计票保留票数，再给第二家加 2 票成 4:4:1 平票 → 只在打平的两家里转盘（2 格）；重新搜索清掉', async () => {
    const h = setup()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    await searched(store)
    store.startVoteCount(['p1', 'p2', 'p3'])
    store.changeVote(1, false)
    expect(results(store).vote?.counts).toEqual([0, 0, 0])
    store.finishVote() // 还没人投票：没反应
    expect(store.duel).toBeNull()
    for (let i = 0; i < 4; i++) store.changeVote(0, true)
    for (let i = 0; i < 2; i++) store.changeVote(1, true)
    store.changeVote(2, true)
    store.changeVote(2, true)
    store.changeVote(2, false)
    expect(results(store).vote?.counts).toEqual([4, 2, 1])
    store.finishVote()
    const result = duelOf(store)
    expect(result.mode).toBe('VOTE')
    expect(result.winnerIndex).toBe(0)
    expect(result.wheel).toBeNull()
    expect(store.mealDecision?.duel.round).toBe(result.round)

    // 平票（另一餐）：只有打平的几家上转盘。
    store.closeDuel()
    h.clock.advance(MEAL_MS + MINUTE)
    store.startVoteCount(['p1', 'p2', 'p3']) // 同一组店：保留票数
    expect(results(store).vote?.counts).toEqual([4, 2, 1])
    store.changeVote(1, true)
    store.changeVote(1, true)
    store.finishVote()
    const tie = duelOf(store)
    expect(tie.tiedIndices).toEqual([0, 1])
    expect(tie.winnerIndex).toBe(tie.tiedIndices[tie.wheel?.target ?? -1])
    expect(tie.wheel?.segments).toBe(2)
    // 新的搜索：没有计票板。
    store.closeDuel()
    h.clock.advance(11 * MINUTE)
    await searched(store)
    expect(results(store).vote).toBeNull()
    expect(h.searcher.calls).toBe(2)
  })
})

describe('状态层：👥 饭桌模式', () => {
  it('TABLE-12 20:45 饭桌的候选：没圈时用这一页能去的（来不及的鸡饭、休息中的都不算，营业时间不明的算）；圈了 4 家就用圈的 4 家，而且暗中出拳不能玩（不是 3 家）', async () => {
    const h = setup()
    h.clock.setTime(20, 45)
    h.searcher.places = [chickenRice(h), ...shops([false, true, null, true, true])]
    const store = h.store(5)
    await searched(store)
    expect(shownIds(store)).toEqual(['ahming', 'p2', 'p3']) // p1（休息）藏起来了
    store.openTable()
    // 鸡饭（还有 15 分钟、走 18 分钟）不玩；p3（营业时间不明）玩。
    expect(tableOf(store).placeIds).toEqual(['p2', 'p3'])
    expect(tableOf(store).fromBasket).toBe(false)
    store.closeTable()
    for (const id of ['p2', 'p3', 'p4', 'p5']) store.toggleBasket(id)
    store.openTable()
    expect(tableOf(store).placeIds).toEqual(['p2', 'p3', 'p4', 'p5'])
    expect(tableOf(store).fromBasket).toBe(true)
    expect(secretPossible(tableOf(store))).toBe(false) // 4 家：刚好 3 家才能玩
    expect(h.searcher.calls).toBe(1)
  })

  it('TABLE-13 第一次用默认人数 = 店数（4）；改成 5 人、改名「小玲」（去空白、存在本机）；3 刀 2 个裁判；撤销只撤刚才那刀；最后一刀；剩一家进结果（划刀记录、饭桌台词、算这一餐）；没有不服；下一餐人数记得是 5', async () => {
    const h = setup()
    h.searcher.places = shops(times(9, true))
    const store = h.store(5)
    await searched(store)
    for (const id of ['p1', 'p2', 'p3']) store.toggleBasket(id)
    store.nextPage()
    store.toggleBasket('p4')
    store.openTable()
    expect(tableOf(store).playerCount).toBe(4) // 第一次：几家就几个人
    store.setTablePlayers(5)
    store.renameAvatar('PANDA', '  小玲  ')
    expect(tableOf(store).avatars.find((a) => a.avatar === 'PANDA')?.customName).toBe('小玲')
    expect(h.games.avatarName('PANDA')).toBe('小玲') // 只存在这个浏览器
    store.startVeto()
    const veto = tableOf(store).veto
    if (!veto) throw new Error('没有开始划刀')
    expect(veto.order).toHaveLength(5)
    expect(vetoTurns(veto)).toHaveLength(3)
    expect(vetoTurns(veto)).toEqual(veto.order.slice(0, 3))
    expect(vetoReferees(veto)).toEqual(veto.order.slice(3))
    expect(tableInProgress(tableOf(store))).toBe(true)

    store.cutPlace('p1')
    expect(tableOf(store).undoable).toBe(true)
    store.undoCut()
    expect(tableOf(store).veto?.cuts).toEqual([])
    store.undoCut() // 只能撤刚才那一刀
    store.cutPlace('p2')
    store.expireCutUndo() // 3 秒过了
    store.undoCut()
    expect(tableOf(store).veto?.cuts).toEqual(['p2'])
    store.cutPlace('p4')
    store.expireCutUndo() // 撤销结束，手机交给下一个人，才能再划
    const lastVeto = tableOf(store).veto
    if (!lastVeto) throw new Error('没有划刀')
    expect(vetoIsLastCut(lastVeto)).toBe(true)
    store.cutPlace('p1')
    const finished = tableOf(store).veto
    expect(finished && vetoIsFinished(finished)).toBe(true)
    expect(store.duel).toBeNull() // 撤销还来得及的那一下
    store.finishVeto()
    expect(store.table).toBeNull()
    const result = duelOf(store)
    expect(result.mode).toBe('VETO')
    expect(winnerId(result)).toBe('p3')
    expect(result.table?.cuts).toEqual(['p2', 'p4', 'p1'])
    expect(lineVerdict(result.line ?? '')).toBe('TABLE')
    expect(store.mealDecision?.duel.round).toBe(result.round)
    store.duelAgain() // 大家一起定的：没有不服
    expect(store.duel?.round).toBe(result.round)
    expect(allowsRegret(result.mode)).toBe(false)

    store.closeDuel()
    h.clock.advance(MEAL_MS + MINUTE)
    store.openTable()
    expect(tableOf(store).playerCount).toBe(5) // 记得人数
    expect(h.searcher.calls).toBe(1)
  })

  it('TABLE-14 2 人 6 家：5 刀按 A B A B A 轮流，剩下的那家赢', async () => {
    const h = setup()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    await searched(store)
    for (const id of ['p1', 'p2', 'p3']) store.toggleBasket(id)
    store.nextPage()
    for (const id of ['p4', 'p5', 'p6']) store.toggleBasket(id)
    store.openTable()
    store.setTablePlayers(2)
    store.startVeto()
    const order = tableOf(store).veto?.order ?? []
    const cutters: (number | null)[] = []
    for (const id of ['p6', 'p5', 'p4', 'p3', 'p2']) {
      const veto = tableOf(store).veto
      if (!veto) throw new Error('没有划刀')
      cutters.push(vetoCurrentPlayer(veto))
      store.cutPlace(id)
      store.expireCutUndo()
    }
    expect(cutters).toEqual([order[0], order[1], order[0], order[1], order[0]])
    store.finishVeto()
    expect(winnerId(duelOf(store))).toBe('p1')
  })

  it('TABLE-15 4 人暗中出拳：翻牌前画面拿到的任何状态里都没有任何手势和判定（连 ROCK/SCISSORS 字样都没有），这一餐也没定；翻牌后手势和判定对、石头 3 人赢；App 从不出拳；算这一餐的决定', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    await searched(store)
    store.openTable()
    store.setTablePlayers(4)
    store.startSecretHands()
    const hands: HandId[] = ['ROCK', 'SCISSORS', 'ROCK', 'ROCK']
    const shown: TableState[] = []
    for (let turn = 0; turn < 4; turn++) {
      shown.push(tableOf(store))
      expect(tableOf(store).secret?.step).toBe('HANDOVER')
      store.secretTakePhone()
      shown.push(tableOf(store))
      const secret = tableOf(store).secret
      if (!secret) throw new Error('没有暗中出拳')
      const player = secretCurrentPlayer(secret)
      store.secretChoose(hands[player] as HandId)
      shown.push(tableOf(store))
      if (turn === 1) {
        // 「点错了？重出」：在自己的「✔ 出好了」那一页、交出去之前。
        store.secretRedo()
        expect(tableOf(store).secret?.step).toBe('CHOOSING')
        const redo = tableOf(store).secret
        expect(redo && secretCurrentPlayer(redo)).toBe(player)
        store.secretChoose(hands[player] as HandId)
      }
      store.secretPass()
    }
    expect(tableOf(store).secret?.step).toBe('ALL_DONE')
    shown.push(tableOf(store))
    // 翻牌前画面拿到的一切都没有手势。
    for (const state of shown) {
      expect(state.secret?.hands).toEqual([])
      expect(state.secret?.verdict).toBeNull()
      expect(JSON.stringify(state)).not.toContain('SCISSORS')
      expect(JSON.stringify(state)).not.toContain('ROCK')
    }
    expect(store.mealDecision).toBeNull()
    store.secretReveal()
    const revealed = tableOf(store).secret
    expect(revealed?.hands).toEqual(hands)
    expect(revealed?.verdict).toEqual(judgeSecretHands(hands))
    expect(revealed?.winnerIndex).toBe(0) // ✊（3 个人）赢 ✌️
    store.showTableResult()
    const result = duelOf(store)
    expect(result.mode).toBe('SECRET_HANDS')
    expect(result.appHand).toBeNull() // App 从不出拳
    expect(result.table?.hands).toEqual(hands)
    expect(store.mealDecision?.duel.round).toBe(result.round)
  })

  it('TABLE-16 2:2:1 打平 300 局：转盘只在 ✊ ✌️ 两家里转、两家各约一半、第三家从不赢；台词不会是「剩下的就是缘分」', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const counts = [0, 0, 0]
    const hands: HandId[] = ['ROCK', 'SCISSORS', 'ROCK', 'SCISSORS', 'PAPER']
    for (let game = 0; game < 300; game++) {
      const store = h.store(game)
      h.clock.advance(MEAL_MS + MINUTE)
      await searched(store)
      store.openTable()
      store.setTablePlayers(5)
      store.startSecretHands()
      for (let i = 0; i < 5; i++) {
        store.secretTakePhone()
        const secret = tableOf(store).secret
        if (!secret) throw new Error('没有暗中出拳')
        store.secretChoose(hands[secretCurrentPlayer(secret)] as HandId)
        store.secretPass()
      }
      store.secretReveal()
      const secret = tableOf(store).secret
      if (!secret || secret.winnerIndex == null) throw new Error('没有结果')
      expect(secret.verdict?.kind).toBe('TIE')
      expect(secret.tiedIndices).toEqual([0, 1])
      expect(secret.winnerIndex).toBe(secret.tiedIndices[secret.tieSpin?.target ?? -1])
      expect(store.mealDecision?.duel.line).not.toBe('TABLE_2') // 「剩下的就是缘分」是划刀剩下的
      counts[secret.winnerIndex] = (counts[secret.winnerIndex] ?? 0) + 1
      store.dispose()
    }
    expect(counts[2]).toBe(0)
    expect(counts[0]).toBeGreaterThanOrEqual(110)
    expect(counts[0]).toBeLessThanOrEqual(190)
    expect(counts[1]).toBeGreaterThanOrEqual(110)
    expect(counts[1]).toBeLessThanOrEqual(190)
  })

  it('TABLE-17 在猜拳出拳画面改用饭桌模式：猜拳层关掉、饭桌用这 3 家；第一屏按返回直接关（不问），开始划以后才算「玩到一半」；关掉后这一餐没定', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    await searched(store)
    store.openDuel()
    store.openTable(true)
    expect(store.duel).toBeNull()
    expect(tableOf(store).placeIds).toEqual(['p1', 'p2', 'p3'])
    expect(tableInProgress(tableOf(store))).toBe(false) // 第一屏：返回直接关
    store.startVeto()
    expect(tableInProgress(tableOf(store))).toBe(true)
    store.closeTable()
    expect(store.table).toBeNull()
    expect(store.mealDecision).toBeNull() // 什么都没定
  })
})

describe('状态层：🃏 任务卡、🎯 谁来做、📊 今日战绩', () => {
  it('TASK-04 定了才能抽卡、一局只能抽一张；一个人玩说 4 个人 → 前 4 个头像上转盘、转到谁就是谁、不能再转；停了记为转完；看一看还是同一张卡；今日战绩记了 1 局', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(11)
    await searched(store)
    decideOnPage(store)
    expect(store.duel?.task).toBeNull()
    store.drawTaskCard()
    const task = store.duel?.task
    if (!task) throw new Error('没有任务卡')
    store.drawTaskCard() // 不会有第二张
    expect(store.duel?.task).toBe(task)
    if (!isFreePass(task)) {
      store.spinTaskWheel(4)
      const spun = store.duel?.task
      if (!spun?.spin) throw new Error('没有转')
      expect(spun.players).toHaveLength(4)
      expect(spun.players.map((p) => p.avatar)).toEqual(ALL_AVATARS.slice(0, 4))
      expect(taskAssignee(spun)).toEqual(spun.players[spun.spin.target])
      store.spinTaskWheel(6) // 不能再转
      expect(store.duel?.task).toBe(spun)
      store.onTaskWheelStopped()
      expect(store.duel?.task?.spun).toBe(true)
    }
    // 跟着这一餐的决定存着：再看一次还是同一张。
    store.closeDuel()
    store.showMealDecision()
    expect(store.duel?.task?.card).toBe(task.card)
    // 📊 今天和 App 玩了 1 局。
    const stats = store.todayStats
    expect(stats.wins + stats.losses + stats.ties).toBe(1)
  })

  it('TASK-05 抽到免死金牌时谁来做转盘不会转', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    let found = false
    for (let seed = 0; seed < 400 && !found; seed++) {
      const store = h.store(seed)
      h.clock.advance(MEAL_MS + MINUTE)
      await searched(store)
      decideOnPage(store)
      store.drawTaskCard()
      const task = store.duel?.task
      if (task && isFreePass(task)) {
        store.spinTaskWheel(4)
        expect(store.duel?.task?.spin).toBeNull()
        found = true
      }
      store.dispose()
    }
    expect(found).toBe(true)
  })
})

describe('状态层：📜 今日饭签、📳 摇一摇、随便挑和半夜排序', () => {
  it('FORTUNE-06 饭签由日期和设备种子算出；没抽之前随便挑不知道它；抽了以后同一天重开网页还是那支、已抽；随便挑带上签；照签去找选好那个菜系；第二天变回没抽；都不搜索', () => {
    const h = setup()
    h.clock.setTime(12, 0)
    const store = h.store(5)
    const fortune = store.home.fortune
    if (!fortune) throw new Error('没有饭签')
    expect(fortune.drawn).toBe(false)
    expect(fortune.stickIndex).toBe(fortuneIndexFor(localEpochDay(h.clock.nowMillis, KL), h.games.phoneSeed))
    store.openRandomPick()
    expect(store.home.randomPick?.fortuneStick).toBeNull() // 没抽之前随便挑不知道
    store.dismissRandomPick()
    store.drawFortune()
    expect(store.home.fortune?.drawn).toBe(true)

    h.clock.setTime(19, 0)
    const later = h.store(5) // 同一天再打开
    expect(later.home.fortune?.stickIndex).toBe(fortune.stickIndex)
    expect(later.home.fortune?.drawn).toBe(true)
    later.openRandomPick()
    const pick = later.home.randomPick
    if (pick?.excludedCuisine == null) expect(pick?.fortuneStick).toBe(fortune.stickIndex)
    later.dismissRandomPick()
    const favoured = fortuneChoice(fortune.stickIndex)
    expect(later.acceptFortune()).toEqual(favoured)
    expect(later.home.selectedCuisine).toBe(favoured.cuisine)

    h.clock.setTime(9, 0, 1) // 第二天
    later.onResume()
    expect(later.home.fortune?.drawn).toBe(false)
    expect(h.searcher.calls).toBe(0)
  })

  it('SHAKE-05 首页摇 → 打开随便挑（转 1.1–2 秒）；转动中摇没用；停下后摇 → 再摇一次、更用力转更久；结果页摇没用；设置关掉后摇没用（开关存在本机）', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    store.onShake(30)
    const first = store.home.randomPick
    if (!first) throw new Error('没有打开随便挑')
    expect(first.spinMillis).toBeGreaterThanOrEqual(1100)
    expect(first.spinMillis).toBeLessThanOrEqual(2000)
    store.onShake(30) // 还在转：没用
    expect(store.home.randomPick?.round).toBe(first.round)
    store.onRandomPickSettled(first.round)
    store.onShake(40)
    const second = store.home.randomPick
    expect(second?.round).not.toBe(first.round)
    expect(second?.spinMillis).toBeGreaterThan(first.spinMillis)
    store.dismissRandomPick()
    await searched(store)
    store.onShake(30) // 结果页：不开
    expect(store.home.randomPick).toBeNull()
    store.backToHome()
    store.setShakeEnabled(false)
    expect(h.games.shakeEnabled).toBe(false)
    store.onShake(30)
    expect(store.home.randomPick).toBeNull()
  })

  it('PICK-19 18:00 吃泰国餐 → 19:30 少给泰国餐；23:30 超过 5 小时就不少给；半夜 00:10 吃嘛嘛档 → 1:00 不少给（宵夜多给它）；不搜索', () => {
    const h = setup()
    const store = h.store(5)
    h.clock.setTime(18, 0)
    h.visits.save([])
    store.onNavigate({ ...testPlace('thai'), primaryType: 'thai_restaurant', types: ['thai_restaurant'] })
    h.clock.setTime(19, 30)
    store.openRandomPick()
    expect(store.home.randomPick?.lessLikely).toEqual(['THAI'])
    store.dismissRandomPick()
    h.clock.setTime(23, 30)
    store.openRandomPick()
    expect(store.home.randomPick?.lessLikely).toEqual([])
    store.dismissRandomPick()
    h.clock.setTime(0, 10, 1)
    store.onNavigate({ ...testPlace('mamak'), primaryType: 'indian_restaurant', types: ['indian_restaurant'] })
    h.clock.setTime(1, 0)
    store.openRandomPick()
    expect(store.home.randomPick?.lessLikely).toEqual([])
    expect(h.searcher.calls).toBe(0)
  })

  it('RESULTS-04 22:35 只看营业中开着：确定营业的 p2 p4 p5 排前面、不明的 p1 p3 排后面，名次跟着变；关掉只看营业中就照评分；白天照评分；6:00 是白天、21:00 和 5:59 是半夜', async () => {
    const h = setup()
    h.clock.setTime(22, 35)
    h.searcher.places = shops([null, true, null, true, true])
    const store = h.store(5)
    await searched(store)
    expect(shownIds(store)).toEqual(['p2', 'p4', 'p5'])
    store.nextPage()
    expect(shownIds(store)).toEqual(['p1', 'p3'])
    expect(displayRank(results(store), 'p2')).toBe(1)
    expect(displayRank(results(store), 'p1')).toBe(4)
    store.setOpenNowOnly(false)
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    h.settings.openNowOnly = true
    h.clock.setTime(12, 0, 1)
    await searched(store)
    expect(shownIds(store)).toEqual(['p1', 'p2', 'p3'])
    expect(isNight(klMillis(7, 6, 0), KL)).toBe(false)
    expect(isNight(klMillis(7, 21, 0), KL)).toBe(true)
    expect(isNight(klMillis(7, 5, 59), KL)).toBe(true)
  })

  it('FREE-04 饭桌划一刀、任务卡、谁来做、看一看、清空撤销、计票、饭签、摇一摇：一共只有最初那 1 次搜索，照片也没多拿', async () => {
    const h = setup()
    h.searcher.places = shops(times(9, true))
    const store = h.store(5)
    await searched(store)
    const photoCalls = h.photos.calls
    for (const id of ['p1', 'p2', 'p3']) store.toggleBasket(id)
    store.openTable()
    store.startVeto()
    store.cutPlace('p1')
    store.expireCutUndo()
    store.cutPlace('p2')
    store.finishVeto()
    store.drawTaskCard()
    store.spinTaskWheel(3)
    store.closeDuel()
    store.showMealDecision()
    store.closeDuel()
    store.clearBasket()
    store.undoClearBasket()
    store.startVoteCount(['p1', 'p2', 'p3'])
    store.changeVote(0, true)
    store.finishVote()
    if (store.mealPrompt) store.confirmMealRegret()
    store.closeDuel()
    store.backToHome()
    store.drawFortune()
    store.onShake(30)
    await flush()
    expect(h.searcher.calls).toBe(1)
    expect(h.photos.calls).toBe(photoCalls)
  })
})
