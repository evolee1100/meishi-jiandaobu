/**
 * 画面要的状态（安卓 ui/UiState.kt、TableModels.kt、ResultsPager.kt、DuelPlanner.kt）。
 * 全部是普通 JSON 物件，状态层（store.ts）每次改动都换一个新的；画面只读不改。
 */
import { RESULTS } from '../data/constants.ts'
import type { CuisineId, DayPartId, HandId, Place, SearchChoice } from '../domain/model.ts'
import {
  canGoAt,
  closesBeforeArrivalAt,
  clockZoned,
  isClosed,
  NO_CLOCK,
  statusAt,
  type OpenStatus,
  type StatusClock,
} from '../domain/openingHours.ts'
import { judge, type DuelOutcome } from '../domain/rps.ts'
import type { WheelSpin } from '../domain/spin.ts'
import { SECRET_HANDS_PLACES, type SecretVerdict, type TableOutcome, type TablePlayer, type VetoGame } from '../domain/table.ts'
import type { DayStats, TaskDraw } from '../domain/taskDeck.ts'
import { localFields } from '../domain/time.ts'
import type { VoteTally } from '../domain/vote.ts'
import type { ApiKeySource } from '../services/settings.ts'
import type { SearchError } from './searchError.ts'

// ------------------------------------------------------------------ 首页

export type LocationStatus =
  /** 还没问过（浏览器的询问还没出现）。 */
  | { readonly kind: 'WAITING_PERMISSION' }
  /** 没有权限；permanently = 浏览器挡住了（不会再问）。 */
  | { readonly kind: 'PERMISSION_DENIED'; readonly permanently: boolean }
  | { readonly kind: 'LOCATING' }
  | { readonly kind: 'READY'; readonly approximate: boolean }
  /** 网页分不出来，不会出现（保留给和安卓对照）。 */
  | { readonly kind: 'SERVICES_OFF' }
  | { readonly kind: 'UNAVAILABLE' }

/** 今天的饭签：哪一支、今天抽过没有。 */
export interface FortuneState {
  readonly stickIndex: number
  readonly drawn: boolean
}

/**
 * 🎲 随便挑的对话框：choice 在打开（或按再摇一次）那一刻就决定好，卷轴只是转到那里。round 每摇一次就变。
 */
export interface RandomPickState {
  readonly round: number
  readonly choice: SearchChoice
  /** 这一轮的卷轴已经停好（再显示时直接显示结果）。 */
  readonly settled: boolean
  readonly dayPart: DayPartId | null
  /** 「换个菜系再摇」：这个菜系这次不摇。 */
  readonly excludedCuisine: CuisineId | null
  /** 上一餐（5 个钟头内）的菜系，机会少一点。 */
  readonly lessLikely: readonly CuisineId[]
  /** 「刚才摇到：」新的在前，最多 3 个。 */
  readonly history: readonly SearchChoice[]
  /** 今天抽过的饭签（签上的组合多给机会）。 */
  readonly fortuneStick: number | null
  /** 左边卷轴转多久（摇一摇越用力越久）；右边多 0.4 秒。 */
  readonly spinMillis: number
}

export const RANDOM_HISTORY_MAX = 3
export const DEFAULT_SPIN_MILLIS = 1100

export interface HomeState {
  readonly location: LocationStatus
  readonly radiusKm: number
  /** 本月还可以免费搜索几次。 */
  readonly remainingSearches: number
  /** 本月已经发了几个 Google 请求（不是搜索次数）。 */
  readonly textSearchesUsed: number
  readonly photosUsed: number
  readonly apiKeySource: ApiKeySource
  readonly apiKeyOverride: string
  /** 第 ① 步选了哪个菜系；只在内存（重新打开网页从「不限」开始）。 */
  readonly selectedCuisine: CuisineId
  /** 问候用的时段；每次回到页面都重算。 */
  readonly dayPart: DayPartId
  readonly demoMode: boolean
  readonly randomPick: RandomPickState | null
  /** 刚从首页黑条关掉演示：「演示模式已经关掉了　撤销」。 */
  readonly demoUndo: boolean
  /** 最近 3 餐都是这个菜系：「连吃 3 次中餐了…」。 */
  readonly streakCuisine: CuisineId | null
  /** 吃过的记录有几笔（设置里可以清除）。 */
  readonly visitCount: number
  readonly fortune: FortuneState | null
  readonly shakeEnabled: boolean
  /** 网页专属：这个浏览器不让网页记东西（隐私模式…）：真实搜索停用，演示照玩。 */
  readonly storageBlocked: boolean
  /** 网页专属：要显示「先跟你说一声」（定位说明）。 */
  readonly explainLocation: boolean
}

// ------------------------------------------------------------------ 主画面

export type LoadingPhase = 'LOCATING' | 'SEARCHING'

export type PhotoState =
  /** 有照片、还没拿（显示 emoji）；店出现在画面上才拿。 */
  | { readonly kind: 'PENDING' }
  /** 正在拿（收费的照片请求）。 */
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'LOADED'; readonly url: string }
  /** 没有照片、额度用完、请求失败：显示 emoji。 */
  | { readonly kind: 'NONE' }

export const PHOTO_PENDING: PhotoState = { kind: 'PENDING' }
export const PHOTO_LOADING: PhotoState = { kind: 'LOADING' }
export const PHOTO_NONE: PhotoState = { kind: 'NONE' }

export function photoLoaded(url: string): PhotoState {
  return { kind: 'LOADED', url }
}

export function isUnresolved(photo: PhotoState): boolean {
  return photo.kind === 'PENDING' || photo.kind === 'LOADING'
}

export interface ResultItem {
  /** 在（只看营业中筛选后）列表里的名次，从 1 起。 */
  readonly rank: number
  readonly place: Place
  readonly photo: PhotoState
  /** 店名的机翻（没有汉字的店名才有；还没好是 null）。 */
  readonly translatedName: string | null
  /** 类型名的机翻（第四版画面上没显示）。 */
  readonly translatedType: string | null
}

export interface ResultsState {
  readonly kind: 'RESULTS'
  readonly choice: SearchChoice
  readonly radiusKm: number
  /** 全部排好的店，最好的在前（不只画面上的 3 家）。 */
  readonly ranked: readonly ResultItem[]
  /** 第几页（0 起，每页 3 家，筛选后算）。 */
  readonly page: number
  readonly openNowOnly: boolean
  /** 有一部分关键词失败了。 */
  readonly partial: boolean
  readonly fromCache: boolean
  /** 演示的假店（决定演示条，不管现在的开关）。 */
  readonly isDemo: boolean
  /** 为了存进 sessionStorage 丢掉的排名靠后的店（一般是 0）。 */
  readonly trimmedCount: number
  /** ❤️ 候选篮：最多 6 家，按圈的顺序，可以跨页。 */
  readonly basket: readonly string[]
  /** 「已清空 5 家　撤销」：清空时拿掉的，按原来的顺序。 */
  readonly clearedBasket: readonly string[]
  /** 📊 正在数的群投票。 */
  readonly vote: VoteTally | null
  /** 营业状态按哪一刻算的（时间走了会更新）。 */
  readonly clock: StatusClock
  /** 结果显示出来的时间（0 = 不知道）。 */
  readonly shownAtMillis: number
  /** 搜索时的时段（下一餐回首页用）。 */
  readonly dayPart: DayPartId | null
}

export type UiState =
  | { readonly kind: 'HOME' }
  | { readonly kind: 'LOADING'; readonly choice: SearchChoice; readonly phase: LoadingPhase; readonly isDemo: boolean }
  | ResultsState
  | { readonly kind: 'ERROR'; readonly choice: SearchChoice | null; readonly error: SearchError }

export const HOME: UiState = { kind: 'HOME' }

// ------------------------------------------------------------------ 一页一页看（ResultsPager）

export const PAGE_SIZE = RESULTS.PAGE_SIZE
export const BASKET_MAX = RESULTS.BASKET_MAX

export interface ResultsPage {
  /** 画面上的店，rank 是筛选后的名次。 */
  readonly items: readonly ResultItem[]
  /** 真正显示的是第几页（超出范围会夹回来）。 */
  readonly page: number
  readonly pageSize: number
  /** 筛选后一共几家（「已经看完全部 N 家」）。 */
  readonly total: number
  /** 被只看营业中藏起来的（休息中）。 */
  readonly hiddenClosed: number
}

export function isFirstPage(view: ResultsPage): boolean {
  return view.page === 0
}

export function firstRank(view: ResultsPage): number {
  return view.page * view.pageSize + 1
}

export function lastRank(view: ResultsPage): number {
  return view.page * view.pageSize + view.items.length
}

/** 这一页之后还有几家。 */
export function remainingAfter(view: ResultsPage): number {
  return Math.max(view.total - lastRank(view), 0)
}

export function hasMore(view: ResultsPage): boolean {
  return remainingAfter(view) > 0
}

/** 21:00–05:59：确定营业中的排在营业时间不明的前面。 */
export function isNight(epochMillis: number, zone: string): boolean {
  const hour = localFields(epochMillis, zone).hour
  return hour >= RESULTS.NIGHT_FROM_HOUR || hour < RESULTS.NIGHT_UNTIL_HOUR
}

/**
 * 列表怎么排：只看营业中关 → 照排名；开 → 去掉休息中的（营业时间不明的留着）；
 * 开 + 晚上 → 确定营业中的在前、不明的在后，各自照排名。
 */
export function orderedItems(ranked: readonly ResultItem[], openNowOnly: boolean, clock: StatusClock): ResultItem[] {
  if (!openNowOnly) return [...ranked]
  const open = ranked.filter((item) => !isClosed(statusAt(item.place, clock)))
  const now = clockZoned(clock)
  if (!now || !isNight(now.epochMillis, now.zone)) return open
  const known = open.filter((item) => statusAt(item.place, clock).kind !== 'UNKNOWN')
  const unknown = open.filter((item) => statusAt(item.place, clock).kind === 'UNKNOWN')
  return [...known, ...unknown]
}

export function visiblePage(
  ranked: readonly ResultItem[],
  openNowOnly: boolean,
  page: number,
  pageSize: number = PAGE_SIZE,
  clock: StatusClock = NO_CLOCK,
): ResultsPage {
  const filtered = orderedItems(ranked, openNowOnly, clock)
  const pageCount = Math.floor((filtered.length + pageSize - 1) / pageSize)
  const shownPage = Math.min(Math.max(page, 0), Math.max(pageCount - 1, 0))
  const first = shownPage * pageSize
  const items = filtered.slice(first, first + pageSize).map((item, i) => ({ ...item, rank: first + i + 1 }))
  return { items, page: shownPage, pageSize, total: filtered.length, hiddenClosed: ranked.length - filtered.length }
}

// ------------------------------------------------------------------ 结果的小工具

/** 搜到、排上名的有几家（「从 45 家里」），恢复时丢掉的也算。 */
export function foundCount(results: ResultsState): number {
  return results.ranked.length + results.trimmedCount
}

/** 画面上现在这一页。 */
export function resultsView(results: ResultsState): ResultsPage {
  return visiblePage(results.ranked, results.openNowOnly, results.page, PAGE_SIZE, results.clock)
}

export function resultsItems(results: ResultsState): readonly ResultItem[] {
  return resultsView(results).items
}

export function statusOf(results: ResultsState, place: Place): OpenStatus {
  return statusAt(place, results.clock)
}

/** 现在能去（营业中或不明，而且走到、点菜之前不会关门）。 */
export function canGo(results: ResultsState, place: Place): boolean {
  return canGoAt(place, results.clock)
}

export function closesBeforeArrival(results: ResultsState, place: Place): boolean {
  return closesBeforeArrivalAt(place, results.clock)
}

/** 整份结果里现在能去的有几家（救援卡用）。 */
export function reachableCount(results: ResultsState): number {
  return results.ranked.filter((item) => canGo(results, item.place)).length
}

/** 列表现在显示的名次（只看营业中以后），不在列表里就用搜索的名次；都没有 → 0。 */
export function displayRank(results: ResultsState, placeId: string): number {
  const shown = orderedItems(results.ranked, results.openNowOnly, results.clock)
  const index = shown.findIndex((item) => item.place.id === placeId)
  if (index >= 0) return index + 1
  return results.ranked.findIndex((item) => item.place.id === placeId) + 1
}

export function resultItem(results: ResultsState, placeId: string): ResultItem | null {
  return results.ranked.find((item) => item.place.id === placeId) ?? null
}

/** 一局里某家的「第 N 家」：列表上的名次，不在这份列表（之前那次搜索的局）就用它在这局里的位置。 */
export function rankIn(results: ResultsState, duel: DuelState, placeId: string): number {
  const rank = displayRank(results, placeId)
  return rank > 0 ? rank : duel.placeIds.indexOf(placeId) + 1
}

// ------------------------------------------------------------------ 游戏

export type DuelMode = 'ROCK_PAPER_SCISSORS' | 'ROULETTE' | 'WHEEL' | 'VETO' | 'SECRET_HANDS' | 'VOTE'

/** 大家一起定的（饭桌、投票）：没有「不服」。 */
export function isTableMode(mode: DuelMode): boolean {
  return mode === 'VETO' || mode === 'SECRET_HANDS' || mode === 'VOTE'
}

export function allowsRegret(mode: DuelMode): boolean {
  return !isTableMode(mode)
}

/**
 * 盖在结果上的一局（剪刀石头布 3 家、帮我挑一家 2 家、🎡 转盘 4–6 家；饭桌、投票的结果也放这里）。
 * 每个随机结果都在状态层按下去的那一刻决定好，画面只播动画。不发任何请求。
 */
export interface DuelState {
  readonly round: number
  /** 这局的店（显示顺序）。 */
  readonly placeIds: readonly string[]
  readonly mode: DuelMode
  /** 跳过的店：休息中、或走到前会关门。 */
  readonly skippedIds: readonly string[]
  /** 用的是 ❤️ 圈的店。 */
  readonly fromBasket: boolean
  /** 这一餐还剩几次「不服」。 */
  readonly regretsLeft: number
  /** 「就这一家吧！」下面的台词（duelLines.ts 的 id），定了才有。 */
  readonly line: string | null
  readonly userHand: HandId | null
  readonly appHand: HandId | null
  /** 今天吃哪家（placeIds 的下标）；还没定是 null。 */
  readonly winnerIndex: number | null
  /** App 的手 / 亮灯转多久。 */
  readonly spinMillis: number
  /** 画面已经把这局播完（再打开直接显示结果）。 */
  readonly animationDone: boolean
  /** 🎡 停在哪（转盘；暗中出拳、投票打平时也是）。 */
  readonly wheel: WheelSpin | null
  /** 打平时转盘在这几家（placeIds 的下标）里转；空的 = 全部。 */
  readonly tiedIndices: readonly number[]
  readonly table: TableOutcome | null
  readonly vote: VoteTally | null
  readonly task: TaskDraw | null
  /** 这一餐定了、反悔也用完了：显示定了的结果（「这一餐已经定了 🤝 愿赌服输」）。 */
  readonly locked: boolean
  /** 之前那次搜索的局：店的资料一起带着（「看一看」还看得到）。 */
  readonly snapshot: readonly ResultItem[]
  /** 这局的店是哪次搜索来的（导航时算哪个菜系）。 */
  readonly choice: SearchChoice | null
}

export function newDuelState(fields: Pick<DuelState, 'round' | 'placeIds' | 'mode'> & Partial<DuelState>): DuelState {
  return {
    skippedIds: [],
    fromBasket: false,
    regretsLeft: 1,
    line: null,
    userHand: null,
    appHand: null,
    winnerIndex: null,
    spinMillis: 0,
    animationDone: false,
    wheel: null,
    tiedIndices: [],
    table: null,
    vote: null,
    task: null,
    locked: false,
    snapshot: [],
    choice: null,
    ...fields,
  }
}

export function duelOutcome(duel: DuelState): DuelOutcome | null {
  return duel.userHand != null && duel.appHand != null ? judge(duel.userHand, duel.appHand) : null
}

/** 转盘上的格子：打平的那几家，否则全部。 */
export function wheelIndices(duel: DuelState): number[] {
  return duel.tiedIndices.length > 0 ? [...duel.tiedIndices] : duel.placeIds.map((_, i) => i)
}

export function duelWinnerId(duel: DuelState): string | null {
  return duel.winnerIndex == null ? null : (duel.placeIds[duel.winnerIndex] ?? null)
}

// ------------------------------------------------------------------ 玩法规划（DuelPlanner）

export const MIN_BASKET = RESULTS.MIN_BASKET
export const MIN_PLACES = RESULTS.MIN_PLACES
export const MIN_TABLE_BASKET = RESULTS.MIN_TABLE_BASKET
export const MIN_WHEEL = RESULTS.MIN_WHEEL

export interface DuelPlan {
  /** null：能去的不到 2 家（没有游戏）。 */
  readonly mode: DuelMode | null
  readonly candidateIds: readonly string[]
  /** 跳过的：休息中，或走到前会关门。 */
  readonly skippedIds: readonly string[]
  readonly fromBasket: boolean
}

/** 能去的店数 → 玩什么：≥ 4 转盘、3 剪刀石头布、2 帮我挑一家、< 2 没有。 */
export function modeFor(places: number): DuelMode | null {
  if (places >= MIN_WHEEL) return 'WHEEL'
  if (places === 3) return 'ROCK_PAPER_SCISSORS'
  if (places >= MIN_PLACES) return 'ROULETTE'
  return null
}

function splitReachable(results: ResultsState, source: readonly ResultItem[]): { reachable: ResultItem[]; skipped: ResultItem[] } {
  const reachable: ResultItem[] = []
  const skipped: ResultItem[] = []
  for (const item of source) (canGo(results, item.place) ? reachable : skipped).push(item)
  return { reachable, skipped }
}

/** 决定按钮用哪些店：圈了 ≥ 2 家用圈的店，否则这一页；只留现在能去的。 */
export function planDuel(results: ResultsState): DuelPlan {
  const fromBasket = results.basket.length >= MIN_BASKET
  const source = fromBasket
    ? results.basket.map((id) => resultItem(results, id)).filter((i): i is ResultItem => i != null)
    : resultsItems(results)
  const { reachable, skipped } = splitReachable(results, source)
  const candidates = reachable.slice(0, fromBasket ? BASKET_MAX : PAGE_SIZE)
  const mode = modeFor(candidates.length)
  return {
    mode,
    candidateIds: mode == null ? [] : candidates.map((i) => i.place.id),
    skippedIds: skipped.map((i) => i.place.id),
    fromBasket,
  }
}

/** 饭桌模式用哪些店：圈了 ≥ 3 家永远用圈的店里能去的（不拿这一页来补），否则这一页能去的。 */
export function tableCandidates(results: ResultsState): DuelPlan {
  const fromBasket = results.basket.length >= MIN_TABLE_BASKET
  const source = fromBasket
    ? results.basket.map((id) => resultItem(results, id)).filter((i): i is ResultItem => i != null)
    : resultsItems(results)
  const { reachable, skipped } = splitReachable(results, source)
  const candidates = reachable.slice(0, fromBasket ? BASKET_MAX : PAGE_SIZE)
  const playable = candidates.length >= MIN_PLACES
  return {
    mode: playable ? 'VETO' : null,
    candidateIds: playable ? candidates.map((i) => i.place.id) : [],
    skippedIds: skipped.map((i) => i.place.id),
    fromBasket,
  }
}

// ------------------------------------------------------------------ 饭桌模式

export type TablePhase = 'SETUP' | 'VETO' | 'SECRET'

export type SecretStep = 'HANDOVER' | 'CHOOSING' | 'CHOSEN' | 'ALL_DONE' | 'REVEAL'

/**
 * 🙈 暗中出拳时画面可以知道的：谁拿着手机、几个人出了。每个人的手势只在状态层里，翻牌前 hands 是空的。
 */
export interface SecretProgress {
  /** 传手机的顺序（玩家下标）。 */
  readonly order: readonly number[]
  /** 现在拿手机的人在 order 里的位置。 */
  readonly turn: number
  readonly step: SecretStep
  readonly chosenCount: number
  /** 按玩家下标；翻牌后才有。 */
  readonly hands: readonly HandId[]
  readonly verdict: SecretVerdict | null
  /** 打平：转盘停在哪。 */
  readonly tieSpin: WheelSpin | null
  /** 打平的那几家（这桌店的下标）。 */
  readonly tiedIndices: readonly number[]
  readonly winnerIndex: number | null
}

export function secretCurrentPlayer(secret: SecretProgress): number {
  return secret.order[secret.turn] as number
}

export function secretIsLastTurn(secret: SecretProgress): boolean {
  return secret.turn === secret.order.length - 1
}

/** 下一个拿手机的人；最后一个人 → null。 */
export function secretNextPlayer(secret: SecretProgress): number | null {
  return secret.order[secret.turn + 1] ?? null
}

export interface TableState {
  readonly round: number
  readonly placeIds: readonly string[]
  readonly fromBasket: boolean
  /** 「几个人？」2–6。 */
  readonly playerCount: number
  /** 6 个头像（含改过的名字），前 playerCount 个玩。 */
  readonly avatars: readonly TablePlayer[]
  readonly phase: TablePhase
  readonly veto: VetoGame | null
  /** 刚划的一刀还可以撤销（几秒钟）。 */
  readonly undoable: boolean
  readonly secret: SecretProgress | null
}

export function tablePlayers(table: TableState): TablePlayer[] {
  return table.avatars.slice(0, table.playerCount)
}

/** 暗中出拳要刚好 3 家。 */
export function secretPossible(table: TableState): boolean {
  return table.placeIds.length === SECRET_HANDS_PLACES
}

/** 已经开始玩了：离开要先问「饭桌还没玩完，要结束吗？」。 */
export function tableInProgress(table: TableState): boolean {
  switch (table.phase) {
    case 'SETUP':
      return false
    case 'VETO':
      return table.veto != null
    case 'SECRET':
      return table.secret != null && table.secret.step !== 'REVEAL'
  }
}

// ------------------------------------------------------------------ 愿赌服输

/** 这一餐的决定：哪一局、什么时候开始的、还剩几次反悔、那局的店（「看一看」用）。 */
export interface MealDecision {
  readonly decidedAtMillis: number
  readonly regretsLeft: number
  readonly isDemo: boolean
  readonly duel: DuelState
  readonly items: readonly ResultItem[]
}

export function mealWinner(meal: MealDecision): ResultItem | null {
  const id = duelWinnerId(meal.duel)
  return id == null ? null : (meal.items.find((item) => item.place.id === id) ?? null)
}

/** 「阿明海南鸡饭」（机翻过就用中文名）。 */
export function mealWinnerName(meal: MealDecision): string {
  const winner = mealWinner(meal)
  return winner ? (winner.translatedName ?? winner.place.name) : ''
}

/** 「这一餐已经定了『…』。换一组店重新玩，会用掉唯一一次反悔，确定吗？」 */
export interface MealPrompt {
  readonly placeName: string
}

// ------------------------------------------------------------------ 整个画面的快照

export interface AppState {
  readonly ui: UiState
  readonly home: HomeState
  readonly duel: DuelState | null
  readonly table: TableState | null
  /** 「🤝 这一餐已经定了：…」：画面上那个世界（演示 / 真实）的这一餐。 */
  readonly meal: MealDecision | null
  readonly mealPrompt: MealPrompt | null
  readonly todayStats: DayStats
  /** 每家店最后一次导航的时间（「👣 今天中午去过」）。 */
  readonly lastVisits: ReadonlyMap<string, number>
}
