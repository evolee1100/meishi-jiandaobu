/**
 * 返回键、摇一摇什么时候听、回到页面、分页被丢掉再载入（安卓 BackHandler、ShakeListener、onResume、SavedStateHandle 的网页版）。
 */
import { describe, expect, it } from 'vitest'
import { ChineseLocalizer } from '../domain/localizer.ts'
import { onPageResume } from '../platform/device.ts'
import { DemoPlacesClient } from '../services/demoPlaces.ts'
import { StoredGameStore } from '../services/gameStore.ts'
import { StoredSettings } from '../services/settings.ts'
import { MemoryStore, type KeyValueStore } from '../services/storage.ts'
import { UsageGuard } from '../services/usageGuard.ts'
import { StoredVisitStore } from '../services/visitStore.ts'
import { FakeLocation, FakePhotos, FakeSearcher, flush, KL, PrefixTranslator, seeded, TestClock } from '../test/helpers.ts'
import { CHINESE_RICE, GUARD_NOW, Harness, PETALING, placeAt, results, searched, shops, shownIds, times } from '../test/storeHarness.ts'
import { backStep, shouldListenForShake } from './navigation.ts'
import { MainStore } from './store.ts'
import { foundCount, resultsView, type AppState } from './state.ts'

const MINUTE = 60_000

function copyOf(store: KeyValueStore): MemoryStore {
  const copy = new MemoryStore()
  for (const key of store.keys()) {
    const value = store.get(key)
    if (value != null) copy.set(key, value)
  }
  return copy
}

describe('网页版另外要加的：返回键、摇一摇', () => {
  it('WEB-13 返回键（popstate）：先关对话框；饭桌模式玩到一半先问「饭桌还没玩完，要结束吗？」；再来是游戏层；最后回首页（和安卓 BackHandler 一样）', async () => {
    const h = new Harness()
    h.searcher.places = shops(times(6, true))
    const store = h.store(5)
    const step = (dialogOpen = false) => backStep(store.getState(), dialogOpen)
    expect(step()).toBe('LEAVE') // 首页：交给浏览器
    expect(step(true)).toBe('CLOSE_DIALOG') // 设置、饭签、想找多远的店？……画面自己的窗口
    store.openRandomPick()
    expect(step()).toBe('CLOSE_DIALOG')
    store.dismissRandomPick()

    await searched(store)
    store.nextPage()
    expect(step()).toBe('BACK_HOME')
    // 游戏层：关掉，回到列表（第几页不变）。
    store.openDuel()
    store.playHand('ROCK')
    expect(step()).toBe('CLOSE_DUEL')
    store.closeDuel()
    expect(results(store).page).toBe(1)
    // 「换一组店重新玩…确定吗？」也是对话框。
    store.firstPage()
    store.openDuel()
    expect(store.mealPrompt).not.toBeNull()
    expect(step()).toBe('CLOSE_DIALOG')
    store.declineMealRegret()
    store.closeDuel()

    // 饭桌模式：第一屏直接关；开始划了就先问；暗中出拳翻了牌就直接关（显示结果）。
    for (const id of ['p1', 'p2', 'p3']) store.toggleBasket(id)
    store.openTable()
    store.confirmMealRegret()
    expect(step()).toBe('CLOSE_TABLE')
    store.setTablePlayers(2)
    store.startSecretHands()
    store.secretTakePhone()
    expect(step()).toBe('ASK_LEAVE_TABLE')
    store.secretChoose('ROCK')
    store.secretPass()
    store.secretTakePhone()
    store.secretChoose('ROCK')
    store.secretPass()
    store.secretReveal()
    expect(step()).toBe('CLOSE_TABLE')
    store.closeTable() // 已经翻牌：直接显示「就这一家吧！」，结果不丢
    expect(store.duel?.mode).toBe('SECRET_HANDS')
    expect(step()).toBe('CLOSE_DUEL')
    store.closeDuel()
    expect(step()).toBe('BACK_HOME')
    store.backToHome()
    expect(step()).toBe('LEAVE')

    // 定位说明窗口开着：先关它。
    const h2 = new Harness()
    h2.location.level = 'NONE'
    const s2 = h2.store(5)
    expect(s2.home.explainLocation).toBe(true)
    expect(backStep(s2.getState(), false)).toBe('CLOSE_DIALOG')
  })

  it('SHAKE-04 首页开着任何窗口（设置、饭签、定位说明、范围选择）都不感应摇一摇；饭桌还没玩完的询问只在有饭桌时出现', async () => {
    const h = new Harness()
    h.searcher.places = shops(times(3, true))
    const store = h.store(5)
    const listening = (homeWindowOpen: boolean, visible = true) => shouldListenForShake(store.getState(), homeWindowOpen, visible)
    expect(listening(false)).toBe(true) // 首页、没有窗口
    expect(listening(true)).toBe(false) // 设置、饭签、想找多远的店？（画面告诉这里）
    expect(listening(false, false)).toBe(false) // 分页看不见：不听（WEB-21）

    // 定位说明（先跟你说一声）开着也不听。
    const h2 = new Harness()
    h2.location.level = 'NONE'
    const s2 = h2.store(5)
    expect(s2.home.explainLocation).toBe(true)
    expect(shouldListenForShake(s2.getState(), false, true)).toBe(false)

    // 随便挑开着：听（摇 = 再摇一次）。
    store.openRandomPick()
    expect(listening(true)).toBe(true)
    store.dismissRandomPick()
    // 结果页、游戏、饭桌：不听。
    await searched(store)
    expect(listening(false)).toBe(false)
    store.openTable()
    expect(listening(false)).toBe(false)
    expect(backStep(store.getState(), false)).toBe('CLOSE_TABLE') // 第一屏：不问
    store.closeTable()
    // 没有饭桌：返回键永远不会问「饭桌还没玩完」。
    const withoutTable: AppState = { ...store.getState(), table: null }
    expect(backStep(withoutTable, false)).not.toBe('ASK_LEAVE_TABLE')
    // 设置里关掉摇一摇：哪里都不听。
    store.backToHome()
    store.setShakeEnabled(false)
    expect(listening(false)).toBe(false)
  })
})

describe('网页版另外要加的：回到页面、分页被丢掉再载入', () => {
  it('WEB-14 页面从隐藏变回显示（visibilitychange）= 安卓 onResume：问候按现在时间、饭签换日、用量刷新、超过 3 小时又换了时段就回首页、否则重算营业状态', async () => {
    const h = new Harness()
    h.clock.setTime(12, 30)
    h.searcher.places = shops([true, true, true])
    const store = h.store(5)
    // 接上「回到页面」：假的 document 从隐藏变回看得见。
    let visibility: DocumentVisibilityState = 'hidden'
    let onVisibility: () => void = () => undefined
    const doc = {
      get visibilityState() {
        return visibility
      },
      addEventListener: (_: string, fn: () => void) => (onVisibility = fn),
      removeEventListener: () => undefined,
    } as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
    const win = { addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>
    const stop = onPageResume(() => void store.resume(), doc, win)
    const comeBack = async () => {
      visibility = 'visible'
      onVisibility()
      await flush()
      visibility = 'hidden'
    }

    await searched(store)
    store.drawFortune()
    expect(store.home.fortune?.drawn).toBe(true)
    const clockBefore = results(store).clock

    // 去 Google 地图走了 10 分钟回来：结果还在，营业状态按现在时间重算。
    h.clock.advance(10 * MINUTE)
    for (let i = 0; i < 6; i++) h.guard.tryRecordTextSearch() // 另一个分页用掉了 2 次搜索
    await comeBack()
    expect(store.ui.kind).toBe('RESULTS')
    expect(results(store).clock.epochMillis).toBeGreaterThan(clockBefore.epochMillis)
    expect(store.home.remainingSearches).toBe(298)
    expect(store.home.dayPart).toBe('LUNCH')

    // 下午茶时间才回来（超过 3 小时、换了时段）：回首页；问候跟着变。
    h.clock.setTime(15, 40)
    await comeBack()
    expect(store.ui).toEqual({ kind: 'HOME' })
    expect(store.home.dayPart).toBe('TEA')

    // 第二天早上：饭签变回没抽，问候是早餐。
    h.clock.setTime(8, 0, 1)
    await comeBack()
    expect(store.home.fortune?.drawn).toBe(false)
    expect(store.home.dayPart).toBe('BREAKFAST')
    expect(h.searcher.calls).toBe(1)
    stop()
  })

  it('WEB-15 同一个分页重新载入：结果、第几页、只看营业中、候选篮、清空撤销、计票板、缓存都从 sessionStorage 回来；新开一个分页只剩 localStorage 里的东西（设置、用量、吃过的记录、这一餐的决定）', async () => {
    const clock = new TestClock(Date.parse('2026-10-06T04:30:00Z')) // 吉隆坡 12:30
    const local = new MemoryStore() // 这个浏览器的 localStorage（每个分页共用）
    const searcher = new FakeSearcher(shops(times(9, true)))
    const photos = new FakePhotos()
    const location = new FakeLocation(clock, PETALING)
    const open = (session: KeyValueStore) =>
      new MainStore({
        location,
        places: searcher,
        photos,
        localizer: new ChineseLocalizer(new PrefixTranslator()),
        usageGuard: new UsageGuard(local, () => GUARD_NOW),
        settings: new StoredSettings(local),
        session,
        now: clock.now,
        elapsed: clock.elapsed,
        zone: () => KL,
        random: seeded(5),
        demoPlaces: new DemoPlacesClient({ now: () => clock.zoned(), delayMs: 0 }),
        visitStore: new StoredVisitStore(local),
        gameStore: new StoredGameStore(local),
      })

    const settings = new StoredSettings(local)
    settings.apiKeyOverride = 'test-key-0123456789'
    const session = new MemoryStore() // 这个分页的 sessionStorage
    const store = open(session)
    store.setRadius(3) // 记在 localStorage
    await searched(store, CHINESE_RICE)
    store.setOpenNowOnly(false)
    store.onNavigate(placeAt(store, 0)) // 吃过的记录
    store.openDuel()
    store.playHand('ROCK') // 这一餐的决定
    store.closeDuel()
    store.nextPage()
    store.toggleBasket('p4')
    store.toggleBasket('p5')
    store.clearBasket()
    store.toggleBasket('p6')
    store.startVoteCount(['p4', 'p5', 'p6'])
    store.changeVote(2, true)
    const before = results(store)
    const remaining = store.home.remainingSearches
    const meal = store.mealDecision

    // 手机浏览器把这个分页丢掉、再载入：一切照旧，不花一次额度。
    const reloaded = open(copyOf(session))
    await flush()
    const r = results(reloaded)
    expect(shownIds(reloaded)).toEqual(['p4', 'p5', 'p6'])
    expect(r.page).toBe(1)
    expect(r.openNowOnly).toBe(false)
    expect(r.basket).toEqual(['p6'])
    expect(r.clearedBasket).toEqual([])
    expect(r.vote).toEqual(before.vote)
    expect(foundCount(r)).toBe(9)
    expect(reloaded.mealDecision?.duel.round).toBe(meal?.duel.round)
    reloaded.backToHome()
    reloaded.search(CHINESE_RICE)
    await flush()
    expect(results(reloaded).fromCache).toBe(true) // 缓存也回来了
    expect(searcher.calls).toBe(1)

    // 新开一个分页：sessionStorage 是空的，只有 localStorage 里的东西。
    const fresh = open(new MemoryStore())
    await flush()
    expect(fresh.ui).toEqual({ kind: 'HOME' })
    expect(fresh.home.radiusKm).toBe(3)
    expect(new StoredSettings(local).openNowOnly).toBe(false)
    expect(fresh.home.remainingSearches).toBe(remaining)
    expect(fresh.home.visitCount).toBe(1)
    expect(fresh.mealDecision?.duel.round).toBe(meal?.duel.round)
    expect(fresh.mealDecision?.items.every((i) => i.photo.kind === 'NONE')).toBe(true) // 照片网址不进 localStorage
    // 新分页没有缓存：同一个组合会真的再搜一次。
    fresh.search(CHINESE_RICE)
    await flush()
    expect(searcher.calls).toBe(2)
    expect(resultsView(results(fresh)).page).toBe(0)
  })
})
