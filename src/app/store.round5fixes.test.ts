/**
 * 状态层：第五版检查后的修正（安卓 MainViewModelRound5FixesTest）——拿着手机的人改不了别人的手势、不能连划两刀；
 * 大家一起定的不能一个人反悔；演示的一局碰不到真的一餐；离开结果时问题一起收掉；被丢掉再载入时点名的店都在；
 * 看一看以前那局再不服只用还能去的店；导航算那局搜的菜系；❤️ 三家以上永远是饭桌的店。
 */
import { describe, expect, it } from 'vitest'
import type { HandId, Place } from '../domain/model.ts'
import { weeklyPeriod } from '../domain/openingHours.ts'
import { pickNote } from '../domain/randomPicker.ts'
import { fortuneChoice } from '../domain/fortune.ts'
import { vetoCurrentPlayer, vetoCutterOf, vetoIsFinished, vetoIsLastCut } from '../domain/table.ts'
import { DEMO_REFERENCE_CENTER } from '../services/demoPlaces.ts'
import { flush, testPlace } from '../test/helpers.ts'
import { Harness, placeAt, results, searched, shops, times } from '../test/storeHarness.ts'
import type { MainStore } from './store.ts'
import { MEAL_MS } from './store.ts'
import {
  foundCount,
  mealWinner,
  mealWinnerName,
  planDuel,
  rankIn,
  resultItem,
  secretCurrentPlayer,
  secretIsLastTurn,
  secretNextPlayer,
  tableCandidates,
  type DuelState,
  type TableState,
} from './state.ts'
import { pickNoteText } from './texts.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const ANY_ANY = { cuisine: 'ANY', meal: 'ANY' } as const
const JAPANESE_ANY = { cuisine: 'JAPANESE', meal: 'ANY' } as const

function setup(options: { demoMode?: boolean } = {}) {
  return new Harness({ position: DEMO_REFERENCE_CENTER, openNowOnly: true, phoneSeed: 1234, demoMode: options.demoMode ?? false })
}

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

/** 现在营业中、今天 hour:00 关门（300 米外：走路 5 分钟）。 */
function closingAt(h: Harness, id: string, hour: number, rating: number): Place {
  return {
    ...testPlace(id, { rating, reviews: 500 }),
    openNow: true,
    openingHours: { periods: [0, 1, 2, 3, 4, 5, 6].map((d) => weeklyPeriod(d, 10, 0, d, hour, 0)), nextOpenMillis: null, nextCloseMillis: h.clock.todayAt(hour) },
  }
}

/** 两个人在 picks 里每人划一刀，照 cuts 的顺序。 */
function vetoOut(store: MainStore, picks: readonly string[], cuts: readonly string[]): void {
  for (const id of picks) store.toggleBasket(id)
  store.openTable()
  store.setTablePlayers(2)
  store.startVeto()
  for (const id of cuts) {
    store.cutPlace(id)
    store.expireCutUndo()
  }
  store.finishVeto()
}

describe('状态层：🙈 暗中出拳只能改自己的、✂️ 一次一刀', () => {
  it('TABLE-07 暗中出拳：交出去以后，下一位的遮挡页、出拳页和「全部出完了」页按重出都没用；最后一位在自己手里可以重出；翻牌后每人的手势就是自己出的', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    await searched(store)
    store.openTable()
    store.setTablePlayers(3)
    store.startSecretHands()
    const order = tableOf(store).secret?.order ?? []
    // 第一个人：出 ✊，自己把手机交出去。
    store.secretTakePhone()
    store.secretChoose('ROCK')
    const chosen = tableOf(store).secret
    if (!chosen) throw new Error('没有暗中出拳')
    expect(chosen.step).toBe('CHOSEN')
    expect(secretNextPlayer(chosen)).toBe(order[1])
    store.secretPass()
    // 下一个人拿着手机（遮挡页）：替上一个人「重出」没用。
    const handover = tableOf(store)
    expect(handover.secret?.step).toBe('HANDOVER')
    expect(handover.secret && secretCurrentPlayer(handover.secret)).toBe(order[1])
    store.secretRedo()
    expect(store.table).toBe(handover)
    // 自己的出拳页也一样。
    store.secretTakePhone()
    const choosing = tableOf(store)
    store.secretRedo()
    expect(store.table).toBe(choosing)
    expect(choosing.secret?.chosenCount).toBe(1)
    store.secretChoose('SCISSORS')
    store.secretPass()
    // 最后一个人：手机还在自己手上时可以收回自己的…
    store.secretTakePhone()
    store.secretChoose('PAPER')
    const last = tableOf(store).secret
    if (!last) throw new Error('没有暗中出拳')
    expect(secretIsLastTurn(last)).toBe(true)
    expect(secretNextPlayer(last)).toBeNull()
    store.secretRedo()
    expect(tableOf(store).secret?.step).toBe('CHOOSING')
    expect(tableOf(store).secret?.chosenCount).toBe(2)
    store.secretChoose('ROCK')
    store.secretPass()
    // …但到了「全部出完了」（大家都围着手机）就什么都改不了。
    const allDone = tableOf(store)
    expect(allDone.secret?.step).toBe('ALL_DONE')
    store.secretRedo()
    expect(store.table).toBe(allDone)
    store.secretReveal()
    const hands = tableOf(store).secret?.hands ?? []
    expect(hands[order[0] as number]).toBe('ROCK')
    expect(hands[order[1] as number]).toBe('SCISSORS')
    expect(hands[order[2] as number]).toBe('ROCK')
  })

  it('TABLE-08 划一刀后 3 秒「撤销」期间再点别的卡没用（不能连划两刀）；撤销只撤刚才那刀；3 秒后轮到下一位，最后一刀一定是下一位划的', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    await searched(store)
    store.openTable()
    store.setTablePlayers(2)
    store.startVeto()
    const order = tableOf(store).veto?.order ?? []
    store.cutPlace('p1')
    expect(tableOf(store).undoable).toBe(true)
    store.cutPlace('p2') // 3 秒内再点（故意或点到滑上来的卡）：没用
    expect(tableOf(store).veto?.cuts).toEqual(['p1'])
    const veto = tableOf(store).veto
    expect(veto && vetoIsFinished(veto)).toBe(false)
    store.undoCut() // 这段时间还可以撤销刚才那刀
    expect(tableOf(store).veto?.cuts).toEqual([])
    store.cutPlace('p1')
    store.expireCutUndo()
    const table = tableOf(store)
    expect(table.undoable).toBe(false)
    if (!table.veto) throw new Error('没有划刀')
    expect(vetoIsLastCut(table.veto)).toBe(true)
    expect(vetoCurrentPlayer(table.veto)).toBe(order[1]) // 最后一刀：下一位的，不是第一位的
    store.cutPlace('p3')
    const done = tableOf(store).veto
    if (!done) throw new Error('没有划刀')
    expect(vetoIsFinished(done)).toBe(true)
    expect(vetoCutterOf(done, 1)).toBe(order[1])
    store.finishVeto()
    expect(winnerId(duelOf(store))).toBe('p2')
  })
})

describe('状态层：🤝 大家一起定的，一个人反悔不了', () => {
  it('MEAL-03 饭桌模式定的：反悔次数 0；自己猜拳、换一页、再开饭桌、投票都只显示锁定的结果、不问；只有「大家都同意重来」才玩（投票）', async () => {
    const h = setup()
    h.searcher.places = shops(times(9, true))
    const store = h.store(5)
    await searched(store)
    vetoOut(store, ['p1', 'p2', 'p3'], ['p1', 'p2'])
    const decided = duelOf(store)
    expect(decided.mode).toBe('VETO')
    expect(decided.regretsLeft).toBe(0)
    expect(store.mealDecision?.regretsLeft).toBe(0)
    store.closeDuel()
    store.clearBasket()
    const ways: ((s: MainStore) => void)[] = [
      (s) => s.openDuel(),
      (s) => {
        s.nextPage()
        s.openDuel()
      },
      (s) => s.openTable(),
      (s) => {
        s.startVoteCount(['p4', 'p5', 'p6'])
        s.changeVote(0, true)
        s.finishVote()
      },
    ]
    for (const way of ways) {
      way(store)
      expect(store.mealPrompt).toBeNull()
      expect(store.table).toBeNull()
      expect(store.duel?.locked).toBe(true)
      expect(store.duel?.round).toBe(decided.round)
      store.closeDuel()
    }
    // 当着大家的面：「大家都同意重来？」（画面问两次）才投票。
    store.finishVote()
    store.agreeToRestart()
    expect(store.duel?.mode).toBe('VOTE')
    expect(store.mealDecision?.duel.round).toBe(store.duel?.round)
    expect(store.mealDecision?.regretsLeft).toBe(0)
    expect(h.searcher.calls).toBe(1)
  })

  it('MEAL-04 暗中出拳和群投票定的也是反悔 0，之后开局都显示锁定的结果', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    await searched(store)
    store.openTable()
    store.setTablePlayers(2)
    store.startSecretHands()
    for (let i = 0; i < 2; i++) {
      store.secretTakePhone()
      store.secretChoose('ROCK')
      store.secretPass()
    }
    store.secretReveal()
    expect(store.mealDecision?.regretsLeft).toBe(0)
    store.showTableResult()
    store.closeDuel()
    store.openDuel()
    expect(store.mealPrompt).toBeNull()
    expect(store.duel?.locked).toBe(true)

    h.clock.advance(MEAL_MS + MINUTE) // 下一餐
    store.closeDuel()
    store.startVoteCount(['p1', 'p2', 'p3'])
    store.changeVote(2, true)
    store.finishVote()
    expect(store.mealDecision?.regretsLeft).toBe(0)
    store.closeDuel()
    store.openDuel()
    expect(store.duel?.locked).toBe(true)
  })

  it('MEAL-05 还有反悔时同一组店直接显示结果（不锁）；反悔用完后同一组店也锁定显示；大家都同意重来后重新玩同一组店', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    await searched(store)
    const first = decideOnPage(store)
    store.closeDuel()
    store.openDuel()
    expect(store.duel?.locked).toBe(false)
    expect(store.duel?.round).toBe(first.round)
    store.duelAgain()
    store.playHand('PAPER')
    const second = duelOf(store)
    expect(store.mealDecision?.regretsLeft).toBe(0)
    store.closeDuel()
    store.openDuel()
    const locked = duelOf(store)
    expect(locked.locked).toBe(true)
    expect(locked.round).toBe(second.round)
    expect(store.mealPrompt).toBeNull()
    store.agreeToRestart()
    const again = duelOf(store)
    expect(again.round).not.toBe(second.round)
    expect(again.placeIds).toEqual(['p1', 'p2', 'p3'])
    expect(again.userHand).toBeNull()
  })
})

describe('状态层：演示和真实是两餐、离开时问题收掉', () => {
  it('MEAL-06 演示和真实分开：真实反悔用完后去演示玩，演示有自己的一餐（1 次反悔）；回到真实，这一餐和用掉的反悔原封不动；重新打开网页、分页被丢掉后都分开记得', async () => {
    const h = setup()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    const saved = h.session
    await searched(store)
    decideOnPage(store)
    store.duelAgain()
    store.playHand('PAPER')
    const real = store.mealDecision
    if (!real) throw new Error('这一餐没定')
    expect(real.isDemo).toBe(false)
    expect(real.regretsLeft).toBe(0)

    store.closeDuel()
    store.backToHome()
    store.setDemoMode(true)
    expect(store.mealDecision).toBeNull() // 演示的世界还没有一餐
    await searched(store, ANY_ANY)
    store.openDuel()
    expect(store.mealPrompt).toBeNull()
    if (duelOf(store).mode === 'ROCK_PAPER_SCISSORS') store.playHand('ROCK')
    if (duelOf(store).mode === 'WHEEL') store.spinWheel()
    const demo = store.mealDecision
    if (!demo) throw new Error('演示没定')
    expect(demo.isDemo).toBe(true)
    expect(demo.regretsLeft).toBe(1)
    expect(h.games.mealJson).not.toBeNull()
    expect(h.games.demoMealJson).not.toBeNull()

    // 回到真实：真的那一餐还在、反悔用掉了，新开一局显示锁定的结果。
    store.closeDuel()
    store.setDemoMode(false)
    expect(store.mealDecision?.duel.round).toBe(real.duel.round)
    await searched(store) // 10 分钟内：同样的真实结果
    expect(store.mealDecision?.duel.round).toBe(real.duel.round)
    expect(store.mealDecision?.regretsLeft).toBe(0)
    store.nextPage()
    store.openDuel()
    expect(store.duel?.locked).toBe(true)
    expect(store.duel?.round).toBe(real.duel.round)

    // 本机和分页被丢掉后都分开记着。
    const reopened = h.store(5)
    expect(reopened.mealDecision?.duel.round).toBe(real.duel.round)
    expect(reopened.mealDecision?.regretsLeft).toBe(0)
    const restored = h.store(5, h.afterProcessDeath(saved))
    await flush()
    expect(restored.mealDecision?.duel.round).toBe(real.duel.round)
    restored.backToHome()
    restored.setDemoMode(true)
    expect(restored.mealDecision?.duel.round).toBe(demo.duel.round)
    expect(restored.mealDecision?.regretsLeft).toBe(1)
    expect(h.searcher.calls).toBe(1)
  })

  it('MEAL-07 正在问「会用掉唯一一次反悔」时回首页或重新搜索：问题一起收掉，之后按确定也没用，反悔还在', async () => {
    const h = setup()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    await searched(store)
    decideOnPage(store)
    store.closeDuel()
    store.nextPage()
    store.openDuel()
    expect(store.mealPrompt).not.toBeNull()
    store.backToHome() // 问着的时候回首页
    expect(store.mealPrompt).toBeNull()
    store.confirmMealRegret()
    expect(store.duel).toBeNull()
    expect(store.mealDecision?.regretsLeft).toBe(1)

    await searched(store)
    store.nextPage()
    store.openDuel()
    expect(store.mealPrompt).not.toBeNull()
    h.clock.advance(11 * MINUTE)
    h.searcher.places = shops(times(6, true)).map((p) => ({ ...p, id: 'x' + p.id }))
    await searched(store, { cuisine: 'WESTERN', meal: 'ANY' })
    expect(store.mealPrompt).toBeNull()
    store.confirmMealRegret()
    expect(store.duel).toBeNull()
    expect(store.mealDecision?.regretsLeft).toBe(1)
  })

  it('TABLE-09 暗中出拳翻牌后被迫回首页（关掉演示）：之后再开饭桌，旧结果不会冒出来', async () => {
    const h = setup({ demoMode: true })
    const store = h.store(5)
    await searched(store, ANY_ANY)
    store.openTable()
    store.setTablePlayers(2)
    store.startSecretHands()
    expect(tableOf(store).secret).not.toBeNull() // 演示 12:30 都可以的这一页刚好 3 家
    for (let i = 0; i < 2; i++) {
      store.secretTakePhone()
      store.secretChoose('PAPER')
      store.secretPass()
    }
    store.secretReveal()
    // 翻牌动画还在播：设置里关掉演示 → 回首页。
    store.setDemoMode(false)
    expect(store.ui.kind).toBe('HOME')
    store.setDemoMode(true)
    h.clock.advance(MEAL_MS + MINUTE)
    await searched(store, ANY_ANY)
    store.openTable()
    expect(store.table).not.toBeNull()
    store.closeTable()
    expect(store.duel).toBeNull()
  })
})

describe('状态层：分页被丢掉再载入时，点名的店都在', () => {
  it('RESTORE-02 计票板（第 34–36 名）和清空撤销（第 31–32 名）的店在被系统关掉后都回来，票数还在，能数票（赢家第 35 名、名字对）、能撤销清空', async () => {
    const h = setup()
    h.settings.openNowOnly = false
    h.searcher.places = shops(times(40, true))
    const store = h.store(5)
    await searched(store)
    for (let i = 0; i < 10; i++) store.nextPage() // 第 31–33 名
    store.toggleBasket('p31')
    store.toggleBasket('p32')
    store.clearBasket()
    store.nextPage() // 第 34–36 名：发到群里
    store.startVoteCount(['p34', 'p35', 'p36'])
    store.changeVote(1, true)
    const restored = h.store(5, h.afterProcessDeath())
    await flush()
    const r = results(restored)
    expect(r.vote?.placeIds).toEqual(['p34', 'p35', 'p36'])
    expect(['p31', 'p32', 'p34', 'p35', 'p36'].every((id) => resultItem(r, id) != null)).toBe(true)
    expect(r.clearedBasket).toEqual(['p31', 'p32'])
    expect(foundCount(r)).toBe(40)
    restored.finishVote()
    expect(winnerId(duelOf(restored))).toBe('p35')
    const meal = restored.mealDecision
    expect(meal && mealWinnerName(meal)).toBe('店 p35')
    restored.closeDuel()
    restored.undoClearBasket()
    expect(results(restored).basket).toEqual(['p31', 'p32'])
    expect(h.searcher.calls).toBe(1)
  })
})

describe('状态层：看一看以前那局再不服、导航算哪个菜系', () => {
  it('MEAL-08 看一看以前那次搜索的结果再按不服：只用现在还能去的两家帮我挑一家、来不及的记为跳过；名次按那一局的号码（第 1、2、3 家），不会写第 0 家；用掉反悔', async () => {
    const h = setup()
    h.clock.setTime(20, 0)
    h.searcher.places = [closingAt(h, 'p1', 21, 4.9), closingAt(h, 'p2', 23, 4.8), closingAt(h, 'p3', 23, 4.7)]
    const store = h.store(5)
    await searched(store)
    const first = decideOnPage(store)
    expect(first.placeIds).toEqual(['p1', 'p2', 'p3'])
    store.closeDuel()
    // 另一次搜索、别的店；45 分钟后 p1 走过去之前就关门了。
    h.searcher.places = shops(times(6, true)).map((p) => ({ ...p, id: 'x' + p.id }))
    h.clock.setTime(20, 45)
    await searched(store, JAPANESE_ANY)
    store.showMealDecision()
    expect(rankIn(results(store), duelOf(store), 'p1')).toBe(1) // 不在这份列表：用它在那局里的位置
    expect(rankIn(results(store), duelOf(store), 'p3')).toBe(3)
    store.duelAgain()
    const again = duelOf(store)
    expect(again.mode).toBe('ROULETTE')
    expect(again.placeIds).toEqual(['p2', 'p3'])
    expect(again.skippedIds).toContain('p1')
    expect(rankIn(results(store), again, 'p2')).toBe(1)
    expect(rankIn(results(store), again, 'p3')).toBe(2)
    expect(again.placeIds.every((id) => again.snapshot.some((i) => i.place.id === id))).toBe(true)
    expect(store.mealDecision?.regretsLeft).toBe(0)
  })

  it('MEAL-09 能去的不到 2 家时按不服：不开新局、反悔次数不变', async () => {
    const h = setup()
    h.clock.setTime(20, 0)
    h.searcher.places = [closingAt(h, 'p1', 21, 4.9), closingAt(h, 'p2', 21, 4.8), closingAt(h, 'p3', 23, 4.7)]
    const store = h.store(5)
    await searched(store)
    const first = decideOnPage(store)
    h.clock.setTime(20, 45)
    store.duelAgain()
    expect(store.duel?.round).toBe(first.round)
    expect(store.mealDecision?.regretsLeft).toBe(1)
  })

  it('VISIT-11 从「看一看」打开的以前那次（中餐）的结果按导航过去，记中餐；从现在列表（日本餐）的卡片导航记日本餐', async () => {
    const h = setup()
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    await searched(store, { cuisine: 'CHINESE', meal: 'RICE' })
    const decided = decideOnPage(store)
    expect(decided.choice).toEqual({ cuisine: 'CHINESE', meal: 'RICE' })
    store.closeDuel()
    h.searcher.places = shops([true, true, true]).map((p) => ({ ...p, id: 'x' + p.id }))
    h.clock.advance(11 * MINUTE)
    await searched(store, JAPANESE_ANY)
    store.showMealDecision()
    const meal = store.mealDecision
    const winner = meal ? mealWinner(meal) : null
    if (!winner) throw new Error('没有赢家')
    store.onNavigate(winner.place)
    expect(h.visits.load()[0]?.cuisine).toBe('CHINESE')
    store.closeDuel()
    h.clock.advance(3 * HOUR)
    store.onNavigate(placeAt(store, 0))
    expect(h.visits.load()[0]?.cuisine).toBe('JAPANESE')
  })
})

describe('状态层：❤️ 三家以上永远是饭桌的店', () => {
  it('TABLE-10 圈了 3 家、其中一家后来来不及：底栏和饭桌模式都只用剩下能去的两家，不会换成这一页的店', async () => {
    const h = setup()
    h.clock.setTime(20, 30)
    h.searcher.places = [...shops(times(5, true)), closingAt(h, 'p6', 21, 4.0)]
    const store = h.store(5)
    await searched(store)
    store.nextPage() // p4、p5、p6
    for (const id of ['p4', 'p5', 'p6']) expect(store.toggleBasket(id)).not.toBeNull()
    expect(results(store).basket).toEqual(['p4', 'p5', 'p6'])
    store.firstPage() // 画面上又是 p1–p3
    // 20:40：p6 还有 20 分钟关门、走 5 分钟：来不及。底栏用另外两家玩…
    h.clock.setTime(20, 40)
    store.onClockTick()
    expect(planDuel(results(store)).candidateIds).toEqual(['p4', 'p5'])
    // …饭桌模式也是，绝不换成这一页（p1–p3）。
    expect(store.openTable()).toBe(true)
    expect(tableOf(store).placeIds).toEqual(['p4', 'p5'])
    expect(tableOf(store).fromBasket).toBe(true)
    store.closeTable()
    expect(tableCandidates(results(store)).candidateIds).toEqual(planDuel(results(store)).candidateIds)
  })

  it('TABLE-11 圈的店里能去的不到 2 家：饭桌模式打不开，画面要提示「你圈的店里能去的不到 2 家」', async () => {
    const h = setup()
    h.clock.setTime(20, 30)
    h.searcher.places = [...shops([true, true, true]), closingAt(h, 'p4', 21, 4.2), closingAt(h, 'p5', 21, 4.1)]
    const store = h.store(5)
    await searched(store)
    store.toggleBasket('p1')
    store.nextPage()
    store.toggleBasket('p4')
    store.toggleBasket('p5')
    h.clock.setTime(20, 40)
    expect(store.openTable()).toBe(false) // 画面照这个说「你圈的店里能去的不到 2 家」
    expect(store.table).toBeNull()
    expect(tableCandidates(results(store)).mode).toBeNull()
  })
})

describe('状态层：随便挑记得上一餐', () => {
  it('PICK-18 18:00 导航泰国餐、19:30 随便挑：说明是「刚才吃过泰国餐，这次少摇它一点」（虽然一定有时段）；23:59 没吃过就显示宵夜时段说明', () => {
    const h = setup()
    const store = h.store(5)
    h.clock.setTime(18, 0)
    store.onNavigate({ ...testPlace('thai'), primaryType: 'thai_restaurant', types: ['thai_restaurant'] })
    h.clock.setTime(19, 30)
    store.openRandomPick()
    const pick = store.home.randomPick
    if (!pick) throw new Error('没有对话框')
    expect(pick.dayPart).toBe('DINNER')
    const fortuneCuisine = pick.fortuneStick == null ? null : fortuneChoice(pick.fortuneStick).cuisine
    const note = pickNote(pick.excludedCuisine, pick.fortuneStick, fortuneCuisine, pick.dayPart, pick.lessLikely)
    expect(note).toEqual({ kind: 'EATEN_RECENTLY', cuisine: 'THAI' })
    expect(pickNoteText(note)).toBe('刚才吃过泰国餐，这次少摇它一点')
    store.dismissRandomPick()
    h.clock.setTime(23, 59)
    store.openRandomPick()
    const later = store.home.randomPick
    if (!later) throw new Error('没有对话框')
    expect(pickNote(later.excludedCuisine, later.fortuneStick, null, later.dayPart, later.lessLikely)).toEqual({ kind: 'TIME_OF_DAY', dayPart: 'SUPPER' })
  })
})
