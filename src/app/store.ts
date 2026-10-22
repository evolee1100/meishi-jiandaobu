/**
 * 网页版的状态层（安卓 ui/MainViewModel.kt 逐个方法照搬）：画面只调用这里的方法、只读 getState() 的快照。
 * 不碰画面、不碰 React；时钟、随机数、定位、Google、存储都可以注入，单元测试可以固定种子和时间。
 *
 * 永远免费：会发 Google 请求的只有 search()（最多 3 个文字搜索）和画面上新出现的店的照片（每家最多 1 次）；
 * 演示模式一个请求都不发。
 */
import { CACHE, MEAL as MEAL_RULES, WHEEL } from '../data/constants.ts'
import { apiKeyProblem } from '../domain/apiKeys.ts'
import { isBlank, ktTrim, needsTranslation } from '../domain/chineseText.ts'
import { isSpecific } from '../domain/cuisine.ts'
import { dayPartAt } from '../domain/dayPart.ts'
import { fortuneChoice, fortuneIndexFor } from '../domain/fortune.ts'
import { haversineMeters } from '../domain/geo.ts'
import { ChineseLocalizer } from '../domain/localizer.ts'
import { isDemoPlace, sameChoice, type AvatarId, type CuisineId, type HandId, type Place, type SearchChoice } from '../domain/model.ts'
import { statusClockOf, type StatusClock } from '../domain/openingHours.ts'
import { largerRadius, MAX_KM, snapRadius } from '../domain/radius.ts'
import { createRandom, type RandomSource } from '../domain/random.ts'
import { lessLikely as lessLikelyCuisines, pick as pickChoice } from '../domain/randomPicker.ts'
import {
  isVegetarian,
  pickLine,
  pickOfTwo,
  placeIndexOf,
  play,
  ROULETTE_SPIN_MS,
  RPS_SPIN_MS,
  spinMillis as drawSpinMillis,
  verdictOf,
  winnerIndexOf,
} from '../domain/rps.ts'
import { matchTypesFor, rankedFor } from '../domain/searchConfig.ts'
import { spinMillisFor } from '../domain/shake.ts'
import { wheelSpin } from '../domain/spin.ts'
import {
  ALL_AVATARS,
  cleanName,
  drawOrder,
  judgeSecretHands,
  MAX_PLAYERS,
  MIN_PLAYERS,
  newVetoGame,
  secretWinningHand,
  tablePlayer,
  vetoCut,
  vetoIsFinished,
  vetoUndo,
  vetoWinner,
  type TablePlayer,
} from '../domain/table.ts'
import { dayStatsOn, drawTaskCard as drawCard, EMPTY_DAY_STATS, isFreePass, recordDayStats, taskDraw, type DayStats } from '../domain/taskDeck.ts'
import { isoDateOfEpochDay, localDate, localEpochDay, systemZone, type ZonedTime } from '../domain/time.ts'
import { addVisit, cuisineOfVisit, isDemoVisit, lastMeal, lastVisits, prunedVisits, streak, visit, type Visit } from '../domain/visits.ts'
import { addVote, newVoteTally, removeVote, sameVotePlaces, voteLeaders } from '../domain/vote.ts'
import { DEMO_REFERENCE_CENTER, DemoPlacesClient, demoNameTranslator, demoReachableCount } from '../services/demoPlaces.ts'
import { MemoryGameStore, type GameStore } from '../services/gameStore.ts'
import { FALLBACK_MAX_AGE_MS, isFixWithin, REUSE_MAX_AGE_MS, type LocationFix, type LocationResult, type LocationSource, type PermissionAnswer } from '../services/location.ts'
import { isCancelled } from '../services/placesErrors.ts'
import { mostInformativeFailure, type PlacesClient } from '../services/placesRepository.ts'
import type { SettingsStore } from '../services/settings.ts'
import { MemoryStore, type KeyValueStore } from '../services/storage.ts'
import type { UsageGuard } from '../services/usageGuard.ts'
import { MemoryVisitStore, type VisitStore } from '../services/visitStore.ts'
import { isLocationProblem, mightBeFixedByNewKey, toSearchError, type SearchError } from './searchError.ts'
import { normalizeMeal, parseSavedSession, SESSION_KEY, SESSION_VERSION, withoutRunningRequests, type CachedResults, type SavedSession } from './session.ts'
import {
  allowsRegret,
  BASKET_MAX,
  canGo,
  closesBeforeArrival,
  DEFAULT_SPIN_MILLIS,
  duelOutcome,
  HOME,
  isTableMode,
  isUnresolved,
  mealWinnerName,
  MIN_BASKET,
  MIN_PLACES,
  modeFor,
  newDuelState,
  photoLoaded,
  PHOTO_LOADING,
  PHOTO_NONE,
  PHOTO_PENDING,
  planDuel,
  RANDOM_HISTORY_MAX,
  resultItem,
  resultsItems,
  resultsView,
  hasMore,
  secretCurrentPlayer,
  secretIsLastTurn,
  secretPossible,
  statusOf,
  tableCandidates,
  tablePlayers,
  type AppState,
  type DuelMode,
  type DuelState,
  type FortuneState,
  type HomeState,
  type LocationStatus,
  type MealDecision,
  type MealPrompt,
  type PhotoState,
  type ResultItem,
  type ResultsState,
  type SecretProgress,
  type SecretStep,
  type TableState,
  type UiState,
} from './state.ts'

/** ❤️ 按下去的结果（画面照它显示提示条）。 */
export type BasketChange = 'ADDED' | 'ADDED_TABLE_HINT' | 'REMOVED' | 'FULL' | 'CLOSED' | 'TOO_LATE'

/** 按「吃饭 / 吃面 / 都可以」以后：直接搜索了，或先显示定位说明（等用户按「好，去允许」）。 */
export type EatResult = 'SEARCHING' | 'EXPLAINING' | 'BLOCKED'

export const MEAL_MS = MEAL_RULES.MEAL_MS
export const REGRETS_PER_MEAL = MEAL_RULES.REGRETS_PER_MEAL
export const TASK_WHEEL_MILLIS = WHEEL.TASK_SPIN_MS
export const SAVED_RANKED_MAX = CACHE.SAVED_RANKED_MAX

export interface MainStoreDeps {
  location: LocationSource
  /** 真正的 Google（演示模式绝不用它）。 */
  places: PlacesClient
  /** 拿照片网址（默认就是 places）。 */
  photos?: Pick<PlacesClient, 'photoUri'>
  /** 真实店名的翻译（浏览器内建翻译；没有就翻不了，照样显示原名）。 */
  localizer: ChineseLocalizer
  usageGuard: UsageGuard
  settings: SettingsStore
  /** 「分页被丢掉再载入」时存东西的地方（sessionStorage）。 */
  session?: KeyValueStore
  /** 墙上时钟（毫秒）。 */
  now?: () => number
  /** 单调时钟（毫秒，performance.now()）：位置的新旧，调手机时间不影响。 */
  elapsed?: () => number
  /** 手机时区。 */
  zone?: () => string
  random?: RandomSource
  /** 演示的假「Google」（默认等 600 毫秒再给演示店）。 */
  demoPlaces?: PlacesClient
  demoLocalizer?: ChineseLocalizer
  visitStore?: VisitStore
  gameStore?: GameStore
  /** localStorage 写得进去吗（写不进去 → 真实搜索一个请求都不发）。 */
  storageWritable?: () => boolean
  /** 在用户点按的那一刻先准备浏览器翻译器（下载模型要用户刚点过）。 */
  primeTranslator?: () => void
}

interface PendingGame {
  readonly placeIds: readonly string[]
  readonly start: () => void
}

function cacheKey(choice: SearchChoice, radiusKm: number): string {
  return `${choice.cuisine}/${choice.meal}/${radiusKm}`
}

function sameClock(a: StatusClock, b: StatusClock): boolean {
  return a.epochMillis === b.epochMillis && a.zoneId === b.zoneId
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  return sa.size === sb.size && [...sa].every((x) => sb.has(x))
}

const DENIED = (permanently: boolean): LocationStatus => ({ kind: 'PERMISSION_DENIED', permanently })

export class MainStore {
  private readonly deps: MainStoreDeps
  private readonly locationSource: LocationSource
  private readonly placesClient: PlacesClient
  private readonly photoResolver: Pick<PlacesClient, 'photoUri'>
  private readonly localizer: ChineseLocalizer
  private readonly demoLocalizer: ChineseLocalizer
  private readonly demoClient: PlacesClient
  private readonly guard: UsageGuard
  private readonly settings: SettingsStore
  private readonly sessionStore: KeyValueStore
  private readonly visitStore: VisitStore
  private readonly gameStore: GameStore
  private readonly random: RandomSource
  private readonly now: () => number
  private readonly elapsed: () => number
  private readonly zone: () => string

  private listeners = new Set<() => void>()
  private snapshot: AppState | null = null
  private unsubscribePermission: (() => void) | null = null

  private uiValue: UiState = HOME
  private homeValue: HomeState
  private duelValue: DuelState | null = null
  private tableValue: TableState | null = null
  private mealPromptValue: MealPrompt | null = null
  private mealValue: MealDecision | null = null
  private todayStatsValue: DayStats = EMPTY_DAY_STATS
  private lastVisitsValue: ReadonlyMap<string, number> = new Map()

  private visits: Visit[]
  private demoVisits: Visit[] = []
  private lastFix: LocationFix | null = null
  private locationJob: Promise<LocationResult> | null = null
  private searchToken = 0
  private searchAbort: AbortController | null = null
  private lastChoice: SearchChoice | null = null
  /** 每摇一次随便挑、每开一局就加 1，每一次都从头播动画。 */
  private round = 0
  private readonly resultCache = new Map<string, CachedResults>()
  /** 这次打开网页拿过的照片网址（按店 id）：同一家不会再花一次额度。 */
  private readonly photoUriCache = new Map<string, string>()
  private readonly photoRequestsInFlight = new Set<string>()
  private readonly translationsInFlight = new Set<string>()
  private tableHintShown = false
  private realMeal: MealDecision | null = null
  private demoMeal: MealDecision | null = null
  private pendingGame: PendingGame | null = null
  private lockedRestart: PendingGame | null = null
  /** 🙈 暗中出拳每个人的手势（按玩家下标）；翻牌前绝不放进 table 状态。 */
  private secretHands: (HandId | null)[] = []
  private pendingTableResult: DuelState | null = null
  /** 网页的定位流程：等用户回答定位询问时要接着搜的那一次。 */
  private pendingChoice: SearchChoice | null = null

  constructor(deps: MainStoreDeps) {
    this.deps = deps
    this.locationSource = deps.location
    this.placesClient = deps.places
    this.photoResolver = deps.photos ?? deps.places
    this.localizer = deps.localizer
    this.demoLocalizer = deps.demoLocalizer ?? new ChineseLocalizer(demoNameTranslator)
    this.guard = deps.usageGuard
    this.settings = deps.settings
    this.sessionStore = deps.session ?? new MemoryStore()
    this.visitStore = deps.visitStore ?? new MemoryVisitStore()
    this.gameStore = deps.gameStore ?? new MemoryGameStore()
    this.random = deps.random ?? createRandom()
    this.now = deps.now ?? (() => Date.now())
    this.elapsed = deps.elapsed ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    const zoneFn = deps.zone ?? systemZone
    this.zone = zoneFn
    this.demoClient = deps.demoPlaces ?? new DemoPlacesClient({ now: () => this.zonedNow() })

    const noPermissionAtStart = this.locationSource.permissionLevel() === 'NONE'
    const blockedAtStart = noPermissionAtStart && this.locationSource.permanentlyDenied()
    this.homeValue = {
      location: blockedAtStart ? DENIED(true) : { kind: 'WAITING_PERMISSION' },
      radiusKm: this.settings.radiusKm,
      remainingSearches: this.guard.remainingSearchUses(),
      textSearchesUsed: this.guard.textSearchesUsed(),
      photosUsed: this.guard.photosUsed(),
      apiKeySource: this.settings.apiKeySource(),
      apiKeyOverride: this.settings.apiKeyOverride,
      selectedCuisine: 'ANY',
      dayPart: dayPartAt(this.now(), this.zone()),
      demoMode: this.settings.demoMode,
      randomPick: null,
      demoUndo: false,
      streakCuisine: null,
      visitCount: 0,
      fortune: null,
      shakeEnabled: this.gameStore.shakeEnabled,
      storageBlocked: !this.storageWritable(),
      // 第一次打开、还没有定位权限：先显示自己的中文说明（一次打开只自动说明一次；被浏览器挡住了就不说明）。
      explainLocation: noPermissionAtStart && !blockedAtStart,
    }

    // 吃过的记录（只有真实的店；旧版本存进去的演示店清掉）。
    const stored = this.visitStore.load()
    this.visits = prunedVisits(
      stored.filter((v) => !isDemoVisit(v)),
      this.now(),
    )
    if (stored.some(isDemoVisit)) this.visitStore.save(this.visits)

    this.publishVisits()
    this.publishFortune()
    this.publishStats()
    this.loadStoredMeals()
    this.publishMeal()
    this.restoreSession()
    if (!noPermissionAtStart) this.refreshLocation()
    this.unsubscribePermission = this.locationSource.onPermissionChange?.(() => this.onResume()) ?? null
  }

  // ================================================================ 订阅（画面用）

  /** 画面订阅变化；回传取消订阅。适合 React 的 useSyncExternalStore。 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 现在的快照（没变就是同一个物件）。 */
  getState(): AppState {
    if (!this.snapshot) {
      this.snapshot = {
        ui: this.uiValue,
        home: this.homeValue,
        duel: this.duelValue,
        table: this.tableValue,
        meal: this.mealValue,
        mealPrompt: this.mealPromptValue,
        todayStats: this.todayStatsValue,
        lastVisits: this.lastVisitsValue,
      }
    }
    return this.snapshot
  }

  get ui(): UiState {
    return this.uiValue
  }

  get home(): HomeState {
    return this.homeValue
  }

  get duel(): DuelState | null {
    return this.duelValue
  }

  get table(): TableState | null {
    return this.tableValue
  }

  get mealPrompt(): MealPrompt | null {
    return this.mealPromptValue
  }

  get mealDecision(): MealDecision | null {
    return this.mealValue
  }

  get todayStats(): DayStats {
    return this.todayStatsValue
  }

  get lastVisits(): ReadonlyMap<string, number> {
    return this.lastVisitsValue
  }

  /** 不再用这个状态层（例如测试结束）。 */
  dispose(): void {
    this.unsubscribePermission?.()
    this.unsubscribePermission = null
    this.cancelSearch()
    this.listeners.clear()
    this.localizer.close()
    this.demoLocalizer.close()
  }

  private emit(): void {
    this.snapshot = null
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        // 画面的错不影响状态
      }
    }
  }

  /** 每次换画面都经过这里：保存的 session 永远和画面一致，「这一餐」的条也跟着画面的世界（演示 / 真实）。 */
  private setUi(value: UiState): void {
    this.uiValue = value
    this.saveSession()
    this.publishMeal()
    this.emit()
  }

  private updateHome(change: (home: HomeState) => HomeState): void {
    const next = change(this.homeValue)
    if (next === this.homeValue) return
    this.homeValue = next
    this.emit()
  }

  private setDuel(value: DuelState | null): void {
    this.duelValue = value
    this.emit()
  }

  private setTable(value: TableState | null): void {
    this.tableValue = value
    this.emit()
  }

  private setMealPrompt(value: MealPrompt | null): void {
    this.mealPromptValue = value
    this.emit()
  }

  private results(): ResultsState | null {
    return this.uiValue.kind === 'RESULTS' ? this.uiValue : null
  }

  private zonedNow(): ZonedTime {
    return { epochMillis: this.now(), zone: this.zone() }
  }

  private storageWritable(): boolean {
    try {
      return this.deps.storageWritable?.() ?? true
    } catch {
      return false
    }
  }

  // ================================================================ 定位

  /** 用户回答了浏览器的定位询问（网页版的 onPermissionResult）。 */
  onPermissionResult(answer: PermissionAnswer): void {
    if (answer.granted) {
      if (answer.fix) this.applyLocationResult({ kind: 'SUCCESS', fix: answer.fix })
      else this.refreshLocation()
      return
    }
    this.updateHome((h) => ({ ...h, location: DENIED(answer.permanentlyDenied && !answer.interrupted) }))
  }

  /**
   * 每次回到页面（visibilitychange 变成 visible、pageshow）：权限 → 用量 → 问候 → 饭签 → 战绩 → 这一餐 →
   * 定位修好了就重试 → 结果太旧回首页，否则按现在时间重算营业状态。
   */
  onResume(): void {
    const hasPermission = this.locationSource.permissionLevel() !== 'NONE'
    const blocked = !hasPermission && this.locationSource.permanentlyDenied()
    const status = this.homeValue.location
    switch (status.kind) {
      case 'READY':
      case 'LOCATING':
        if (!hasPermission) this.updateHome((h) => ({ ...h, location: DENIED(blocked) }))
        break
      case 'WAITING_PERMISSION':
        if (hasPermission) this.refreshLocation()
        else if (blocked) this.updateHome((h) => ({ ...h, location: DENIED(true) }))
        break
      case 'PERMISSION_DENIED':
      case 'SERVICES_OFF':
      case 'UNAVAILABLE':
        if (hasPermission) this.refreshLocation()
        else if (status.kind !== 'PERMISSION_DENIED' || status.permanently !== blocked) {
          this.updateHome((h) => ({ ...h, location: DENIED(blocked) }))
        }
        break
    }
    this.refreshUsage()
    this.updateHome((h) => ({ ...h, dayPart: dayPartAt(this.now(), this.zone()), storageBlocked: !this.storageWritable() }))
    this.publishFortune()
    this.publishStats()
    this.publishMeal()
    this.emit()
    this.retryIfFixedInSettings(hasPermission)
    if (!this.backHomeIfStale()) this.onClockTick()
  }

  /** 回到页面：先重新查浏览器的定位权限，再做 onResume。 */
  async resume(): Promise<void> {
    try {
      await this.locationSource.refreshPermission?.()
    } catch {
      // 查不到就照旧
    }
    this.onResume()
  }

  /**
   * 隔了很久才回来、又是另一餐（午餐的结果到晚餐再看；昨天午餐的结果今天午餐再看）→ 回首页（结果还在缓存里，什么都不花）。
   * 从地图很快回来，结果还在。
   */
  private backHomeIfStale(): boolean {
    const results = this.results()
    if (!results || results.dayPart == null || results.shownAtMillis <= 0) return false
    const age = this.now() - results.shownAtMillis
    const stale =
      age > CACHE.STALE_RESULTS_MS &&
      (dayPartAt(this.now(), this.zone()) !== results.dayPart || age > CACHE.SAME_MEAL_MAX_MS)
    if (stale) this.backToHome()
    return stale
  }

  /** 浏览器挡住了定位（网页版的「永久拒绝」）：不再说明「好，去允许」，首页卡片改说怎么在浏览器打开。 */
  checkPermanentLocationDenial(): boolean {
    if (this.locationSource.permissionLevel() !== 'NONE') return false
    const permanently = this.locationSource.permanentlyDenied()
    if (permanently) this.updateHome((h) => ({ ...h, location: DENIED(true) }))
    return permanently
  }

  /** 在自己的定位说明按了「先不要」。 */
  onLocationExplanationDeclined(): void {
    if (this.homeValue.location.kind === 'WAITING_PERMISSION') {
      this.updateHome((h) => ({ ...h, location: DENIED(false) }))
    }
  }

  /** 错误页是定位问题、而现在在浏览器设置里修好了 → 自动重搜。 */
  private retryIfFixedInSettings(hasPermission: boolean): void {
    if (this.uiValue.kind !== 'ERROR') return
    const error = this.uiValue.error
    const fixed =
      error.kind === 'PERMISSION_NEEDED'
        ? hasPermission
        : error.kind === 'LOCATION_SERVICES_OFF'
          ? hasPermission && this.locationSource.locationServicesEnabled()
          : false
    if (fixed) this.retry()
  }

  refreshLocation(): void {
    void this.obtainLocation(true)
  }

  private async obtainLocation(forceRefresh: boolean): Promise<LocationResult> {
    if (this.locationSource.permissionLevel() === 'NONE') {
      this.applyLocationResult({ kind: 'NO_PERMISSION' })
      return { kind: 'NO_PERMISSION' }
    }
    const fix = this.lastFix
    if (!forceRefresh && fix && isFixWithin(fix, REUSE_MAX_AGE_MS, this.elapsed())) return { kind: 'SUCCESS', fix }
    if (!this.locationJob) {
      this.updateHome((h) => ({ ...h, location: { kind: 'LOCATING' } }))
      const job = (async (): Promise<LocationResult> => {
        let result: LocationResult
        try {
          result = await this.locationSource.currentLocation()
        } catch {
          result = { kind: 'UNAVAILABLE' }
        }
        this.applyLocationResult(result)
        return result
      })()
      this.locationJob = job
      void job.finally(() => {
        if (this.locationJob === job) this.locationJob = null
      })
    }
    return this.locationJob
  }

  private applyLocationResult(result: LocationResult): void {
    let status: LocationStatus
    switch (result.kind) {
      case 'SUCCESS':
        this.lastFix = result.fix
        status = { kind: 'READY', approximate: result.fix.approximate }
        break
      case 'NO_PERMISSION': {
        const current = this.homeValue.location
        status = current.kind === 'PERMISSION_DENIED' ? current : DENIED(this.locationSource.permanentlyDenied())
        break
      }
      case 'SERVICES_OFF':
        status = { kind: 'SERVICES_OFF' }
        break
      case 'UNAVAILABLE':
        status = { kind: 'UNAVAILABLE' }
        break
    }
    this.updateHome((h) => ({ ...h, location: status }))
  }

  // ---------------------------------------------------------------- 网页的定位流程（安卓在 MainScreen 里）

  /**
   * 按「吃饭 / 吃面 / 都可以」（或就它了、照签去找）：没有定位权限、还可以问 → 记下这次要搜什么、先显示定位说明；
   * 被浏览器挡住了或已经有权限 → 直接搜索（挡住了会进「需要定位权限」错误页）。
   */
  requestSearch(choice: SearchChoice): EatResult {
    const location = this.homeValue.location
    const canAsk = !(location.kind === 'PERMISSION_DENIED' && location.permanently)
    if (this.locationSource.permissionLevel() === 'NONE' && canAsk && !this.checkPermanentLocationDenial()) {
      this.pendingChoice = choice
      this.updateHome((h) => ({ ...h, explainLocation: true }))
      return 'EXPLAINING'
    }
    this.search(choice)
    return 'SEARCHING'
  }

  /**
   * 首页卡片 / 错误页的「允许定位」：被浏览器挡住了 → 'BLOCKED'（画面显示「怎么打开？」的步骤）；
   * 否则显示定位说明（从错误页来的，答应以后接着搜那一次）。
   */
  askForLocation(pending: SearchChoice | null = null): EatResult {
    if (this.checkPermanentLocationDenial()) {
      this.pendingChoice = null
      return 'BLOCKED'
    }
    this.pendingChoice = pending
    this.updateHome((h) => ({ ...h, explainLocation: true }))
    return 'EXPLAINING'
  }

  /** 定位说明的「好，去允许」：这时才让浏览器问；回答以后（不管允许与否）马上接着搜那一次。 */
  async acceptLocationExplanation(): Promise<void> {
    this.updateHome((h) => ({ ...h, explainLocation: false }))
    let answer: PermissionAnswer
    try {
      answer = await this.locationSource.requestPermission()
    } catch {
      answer = { granted: false, permanentlyDenied: false, interrupted: true, fix: null }
    }
    this.onPermissionResult(answer)
    const pending = this.pendingChoice
    this.pendingChoice = null
    if (pending) this.search(pending)
  }

  /** 定位说明的「先不要」或点窗口外：关掉，不搜。 */
  declineLocationExplanation(): void {
    this.pendingChoice = null
    this.updateHome((h) => ({ ...h, explainLocation: false }))
    this.onLocationExplanationDeclined()
  }

  /** 「怎么打开？」里的「我改好了，再试一次」。 */
  async retryAfterLocationHelp(): Promise<void> {
    await this.resume()
    if (this.uiValue.kind === 'ERROR' && isLocationProblem(this.uiValue.error)) this.retry()
    else if (this.uiValue.kind === 'HOME' && this.locationSource.permissionLevel() !== 'NONE') this.refreshLocation()
  }

  // ================================================================ 首页

  onRadiusChange(km: number): void {
    this.updateHome((h) => ({ ...h, radiusKm: snapRadius(km) }))
  }

  /** 滑杆放手才记住。 */
  onRadiusChangeFinished(): void {
    this.settings.radiusKm = this.homeValue.radiusKm
  }

  /** 四个大按钮：马上换、马上记住，不搜索。 */
  setRadius(km: number): void {
    this.onRadiusChange(km)
    this.onRadiusChangeFinished()
  }

  /** 第 ① 步：永远只选中一个，点一下只选中、不搜索。 */
  selectCuisine(cuisine: CuisineId): void {
    this.updateHome((h) => ({ ...h, selectedCuisine: cuisine }))
  }

  /**
   * 设置的「保存」：密钥和演示开关一起生效。演示开关变了 → 照 setDemoMode；否则画面是「换密钥可能修得好」的错误、
   * 新密钥和原来的不一样、不是空的、演示没开 → 自动重搜。
   */
  saveSettings(apiKey: string, demoMode: boolean): void {
    const previousKey = this.settings.effectiveApiKey()
    this.settings.apiKeyOverride = apiKey
    this.updateHome((h) => ({ ...h, apiKeySource: this.settings.apiKeySource(), apiKeyOverride: this.settings.apiKeyOverride }))
    if (demoMode !== this.settings.demoMode) {
      this.setDemoMode(demoMode)
      return
    }
    if (this.uiValue.kind !== 'ERROR') return
    const error = this.uiValue.error
    const newKey = this.settings.effectiveApiKey()
    if (!demoMode && mightBeFixedByNewKey(error) && newKey !== previousKey && !isBlank(newKey)) this.retry()
  }

  /** 只存密钥，演示开关不变。 */
  saveApiKey(key: string): void {
    this.saveSettings(key, this.settings.demoMode)
  }

  /** 首页黑条的「关掉」：马上关，另外出「撤销」。 */
  turnOffDemoFromBanner(): void {
    this.setDemoMode(false)
    this.updateHome((h) => ({ ...h, demoUndo: true }))
  }

  /** 「撤销」：演示再打开（首页，不搜索）。 */
  undoDemoOff(): void {
    if (!this.homeValue.demoUndo) return
    this.updateHome((h) => ({ ...h, demoUndo: false }))
    this.setDemoMode(true)
  }

  dismissDemoUndo(): void {
    this.updateHome((h) => (h.demoUndo ? { ...h, demoUndo: false } : h))
  }

  /**
   * 开关演示（一拨就生效、记住）。打开时：错误页而且不是定位问题 → 马上用演示资料重搜。
   * 关掉时：从不自己搜索；画面上是演示结果 → 回首页；是真实结果 → 补拿照片和翻译。
   */
  setDemoMode(on: boolean): void {
    if (this.settings.demoMode === on && this.homeValue.demoMode === on) return
    this.settings.demoMode = on
    this.updateHome((h) => ({ ...h, demoMode: on }))
    this.publishVisits()
    this.publishMeal()
    this.emit()
    const current = this.uiValue
    if (current.kind === 'ERROR') {
      if (on && !isLocationProblem(current.error)) this.retry()
    } else if (current.kind === 'RESULTS') {
      if (!on && current.isDemo) this.backToHome()
      else if (!on) this.enrich(resultsItems(current))
    }
  }

  backToHome(): void {
    this.cancelSearch()
    this.closeGames()
    this.setUi(HOME)
    this.refreshUsage()
  }

  /** 离开这份结果（回首页、新的搜索）：游戏层、饭桌、问题、等着的新局全部收掉。 */
  private closeGames(): void {
    this.duelValue = null
    this.tableValue = null
    this.mealPromptValue = null
    this.pendingGame = null
    this.lockedRestart = null
    this.pendingTableResult = null
    this.secretHands = []
    this.emit()
  }

  private currentChoice(): SearchChoice | null {
    const current = this.uiValue
    switch (current.kind) {
      case 'RESULTS':
      case 'ERROR':
      case 'LOADING':
        return current.choice
      case 'HOME':
        return this.lastChoice
    }
  }

  /** 错误页「重试」、部分失败的「重新搜索」：用最后一次的组合再搜。 */
  retry(): void {
    if (this.lastChoice) this.search(this.lastChoice)
  }

  /** 没找到页的「扩大到 X 公里再找」：范围改成 X、记住，再搜同一个组合。 */
  searchWithRadius(km: number): void {
    this.onRadiusChange(km)
    this.onRadiusChangeFinished()
    this.retry()
  }

  /** 「扩大到 X 公里」/「🔍 扩大到 X 公里再找」：两倍（最多 5），记住，再搜同一个组合；已经 5 公里就没有。 */
  expandRadius(): void {
    const radius = this.results()?.radiusKm ?? this.homeValue.radiusKm
    const larger = largerRadius(radius)
    if (larger == null) return
    const choice = this.currentChoice()
    if (!choice) return
    this.lastChoice = choice
    this.searchWithRadius(larger)
  }

  /** 「🎲 换个菜系再摇」：不搜索，打开随便挑、这次不摇刚才搜的菜系。 */
  rescueReroll(): void {
    const cuisine = this.currentChoice()?.cuisine ?? null
    this.openRandomPick(cuisine != null && isSpecific(cuisine) ? cuisine : null)
  }

  /** 没找到页的「换成「不限」再找」：同一个饭/面/都可以。 */
  searchAnyCuisine(): void {
    const meal = this.lastChoice?.meal
    if (!meal) return
    this.selectCuisine('ANY')
    this.search({ cuisine: 'ANY', meal })
  }

  // ================================================================ 🎲 随便挑（在手机里，不花钱）

  /** 打开随便挑：结果马上决定好（卷轴只是转到那里）。excludeCuisine 这次不摇；spinMillis 摇一摇越用力越久。 */
  openRandomPick(excludeCuisine: CuisineId | null = null, spinMillis: number = DEFAULT_SPIN_MILLIS): void {
    const dayPart = dayPartAt(this.now(), this.zone())
    const favoured = this.favouredByFortune()
    const lastMealCuisine = lastMeal(this.activeVisits(), this.now())?.cuisine ?? null
    const less = lessLikelyCuisines(lastMealCuisine, dayPart, favoured?.cuisine ?? null, excludeCuisine)
    const choice = pickChoice(this.random, {
      dayPart,
      excludeCuisine,
      lessLikely: less,
      playable: this.playableChoices(),
      favoured,
    })
    this.updateHome((h) => ({
      ...h,
      randomPick: {
        round: ++this.round,
        choice,
        settled: false,
        dayPart,
        excludedCuisine: excludeCuisine,
        lessLikely: less,
        history: [],
        fortuneStick: h.fortune?.drawn && favoured != null ? h.fortune.stickIndex : null,
        spinMillis,
      },
    }))
  }

  /** 再摇一次：一定和现在的不一样；现在的放进「刚才摇到」。 */
  rerollRandomPick(spinMillis: number = DEFAULT_SPIN_MILLIS): void {
    const current = this.homeValue.randomPick
    if (!current) return
    const choice = pickChoice(this.random, {
      exclude: current.choice,
      dayPart: current.dayPart,
      excludeCuisine: current.excludedCuisine,
      lessLikely: current.lessLikely,
      playable: this.playableChoices(),
      favoured: current.fortuneStick != null ? fortuneChoice(current.fortuneStick) : null,
    })
    const history: SearchChoice[] = []
    for (const c of [current.choice, ...current.history]) {
      if (sameChoice(c, choice) || history.some((h) => sameChoice(h, c))) continue
      history.push(c)
      if (history.length >= RANDOM_HISTORY_MAX) break
    }
    this.updateHome((h) => ({
      ...h,
      randomPick: { ...current, round: ++this.round, choice, settled: false, history, spinMillis },
    }))
  }

  /** 📳 首页摇一摇 → 打开随便挑；对话框里、卷轴停好了 → 再摇一次；转动中、别的画面 → 不理。 */
  onShake(strength: number): void {
    if (!this.homeValue.shakeEnabled) return
    const spin = spinMillisFor(strength)
    const pick = this.homeValue.randomPick
    if (pick == null) {
      if (this.uiValue.kind === 'HOME') this.openRandomPick(null, spin)
    } else if (pick.settled) {
      this.rerollRandomPick(spin)
    }
  }

  /** 演示模式：只摇「至少 2 家能去」的组合（店都在手机里，不用搜索就知道）；真实模式不知道，全部可以。 */
  private playableChoices(): (choice: SearchChoice) => boolean {
    if (!this.settings.demoMode) return () => true
    const center = this.lastFix?.latLng ?? DEMO_REFERENCE_CENTER
    const radiusMeters = this.homeValue.radiusKm * 1000
    const at = this.zonedNow()
    const counts = new Map<string, number>()
    return (choice) => {
      const key = choice.cuisine + '/' + choice.meal
      let count = counts.get(key)
      if (count === undefined) {
        count = demoReachableCount(choice, center, radiusMeters, at)
        counts.set(key, count)
      }
      return count >= MIN_PLACES
    }
  }

  /** 点「刚才摇到」的某一个：马上显示（不转）；不在历史里的没反应。 */
  returnToEarlierPick(choice: SearchChoice): void {
    const current = this.homeValue.randomPick
    if (!current || !current.history.some((h) => sameChoice(h, choice))) return
    const history = [current.choice, ...current.history].filter((c) => !sameChoice(c, choice)).slice(0, RANDOM_HISTORY_MAX)
    this.updateHome((h) => ({
      ...h,
      randomPick: { ...current, round: ++this.round, choice, settled: true, history },
    }))
  }

  /** 这一轮的卷轴停好了（再显示时直接显示结果）；旧的一轮晚到的通知不理。 */
  onRandomPickSettled(round: number): void {
    this.updateHome((h) => (h.randomPick?.round === round ? { ...h, randomPick: { ...h.randomPick, settled: true } } : h))
  }

  dismissRandomPick(): void {
    this.updateHome((h) => (h.randomPick ? { ...h, randomPick: null } : h))
  }

  /** 「就它了，开始找」：关掉对话框、首页格子选好那个菜系，回传要搜的组合（画面接着走定位流程 requestSearch）。 */
  acceptRandomPick(): SearchChoice | null {
    const pick = this.homeValue.randomPick?.choice
    if (!pick) return null
    this.updateHome((h) => ({ ...h, selectedCuisine: pick.cuisine, randomPick: null }))
    return pick
  }

  // ================================================================ 结果：换页、只看营业中（不花钱）

  /** 换 3 家：同一次搜索排名后面的店，从不重新搜索。 */
  nextPage(): void {
    const results = this.results()
    if (!results) return
    const view = resultsView(results)
    if (hasMore(view)) this.show({ ...results, page: view.page + 1, clock: this.statusClock() })
  }

  /** 回到前 3 名。 */
  firstPage(): void {
    const results = this.results()
    if (!results) return
    if (results.page !== 0) this.show({ ...results, page: 0, clock: this.statusClock() })
  }

  /** 只看营业中（默认开、记住）：在手机里筛选、回第一页；它带出来的店不拿照片（一个请求都不花）。 */
  setOpenNowOnly(on: boolean): void {
    this.settings.openNowOnly = on
    this.showOpenNowOnly(on)
  }

  /** 救援卡的「显示全部店（含休息中）」：只是这份结果，设置里记住的值不变。 */
  showClosedToo(): void {
    this.showOpenNowOnly(false)
  }

  private showOpenNowOnly(on: boolean): void {
    const results = this.results()
    if (!results) return
    this.show({ ...results, openNowOnly: on, page: 0, clock: this.statusClock() }, false)
  }

  /**
   * 结果页开着时时间在走：分钟变了（或时区变了）才按现在时间重算营业状态，不发请求。
   * 筛选后新冒出来的店只翻译名字、不拿照片；已经在画面上的卡片不动。
   */
  onClockTick(): void {
    const results = this.results()
    if (!results) return
    const clock = this.statusClock()
    if (Math.floor(clock.epochMillis / 60_000) === Math.floor(results.clock.epochMillis / 60_000) && clock.zoneId === results.clock.zoneId) return
    const onScreen = new Set(resultsItems(results).map((i) => i.place.id))
    const updated: ResultsState = { ...results, clock }
    this.setUi(updated)
    this.enrich(
      resultsItems(updated).filter((i) => !onScreen.has(i.place.id)),
      false,
    )
  }

  private statusClock(): StatusClock {
    return statusClockOf(this.now(), this.zone())
  }

  // ================================================================ ❤️ 候选篮（不花钱）

  /** ❤️：圈 / 取消，可以跨页；最多 6 家，只能圈现在能去的。 */
  toggleBasket(placeId: string): BasketChange | null {
    const results = this.results()
    if (!results) return null
    if (results.basket.includes(placeId)) {
      this.setUi({ ...results, basket: results.basket.filter((id) => id !== placeId), clearedBasket: [] })
      return 'REMOVED'
    }
    const item = resultItem(results, placeId)
    if (!item) return null
    const fresh: ResultsState = { ...results, clock: this.statusClock() }
    if (statusOf(fresh, item.place).kind === 'CLOSED') return 'CLOSED'
    if (closesBeforeArrival(fresh, item.place)) return 'TOO_LATE'
    if (results.basket.length >= BASKET_MAX) return 'FULL'
    this.setUi({ ...fresh, basket: [...results.basket, placeId], clearedBasket: [] })
    if (results.basket.length + 1 === MIN_BASKET && !this.tableHintShown) {
      this.tableHintShown = true
      return 'ADDED_TABLE_HINT'
    }
    return 'ADDED'
  }

  /** 清空：先出「已清空 N 家　撤销」。 */
  clearBasket(): void {
    const results = this.results()
    if (results && results.basket.length > 0) this.setUi({ ...results, basket: [], clearedBasket: results.basket })
  }

  /** 撤销：原来的店按原来的顺序回来（结果里已经没有的店不回来）。 */
  undoClearBasket(): void {
    const results = this.results()
    if (!results || results.clearedBasket.length === 0) return
    this.setUi({
      ...results,
      basket: results.clearedBasket.filter((id) => resultItem(results, id) != null),
      clearedBasket: [],
    })
  }

  dismissBasketUndo(): void {
    const results = this.results()
    if (results && results.clearedBasket.length > 0) this.setUi({ ...results, clearedBasket: [] })
  }

  // ================================================================ 🤝 愿赌服输：一餐只能反悔一次

  /** 现在是哪个世界：画面上的结果决定，不在结果页时看演示开关。 */
  private inDemoWorld(): boolean {
    return this.results()?.isDemo ?? this.settings.demoMode
  }

  private mealIn(demo: boolean): MealDecision | null {
    return demo ? this.demoMeal : this.realMeal
  }

  private isWithinMeal(meal: MealDecision): boolean {
    const age = this.now() - meal.decidedAtMillis
    return age >= 0 && age <= MEAL_MS
  }

  /** 3 小时内定下的这一餐（画面上那个世界的）；过期就清掉。 */
  private currentMeal(): MealDecision | null {
    const demo = this.inDemoWorld()
    const decided = this.mealIn(demo)
    if (!decided) return null
    if (!this.isWithinMeal(decided)) {
      this.keepMeal(demo, null)
      return null
    }
    return decided
  }

  private keepMeal(demo: boolean, decided: MealDecision | null): void {
    if (demo) this.demoMeal = decided
    else this.realMeal = decided
    this.publishMeal()
    this.saveSession()
    this.storeMeal()
    this.emit()
  }

  private publishMeal(): void {
    const meal = this.mealIn(this.inDemoWorld())
    const next = meal && this.isWithinMeal(meal) ? meal : null
    if (next !== this.mealValue) {
      this.mealValue = next
      this.snapshot = null
    }
  }

  /** 也存在本机（不只 session）：按返回离开再打开还是同一餐。只存这一餐的，照片网址不存。 */
  private storeMeal(): void {
    this.gameStore.mealJson = this.encodeMeal(this.realMeal)
    this.gameStore.demoMealJson = this.encodeMeal(this.demoMeal)
  }

  private encodeMeal(meal: MealDecision | null): string | null {
    if (!meal || !this.isWithinMeal(meal)) return null
    const lean: MealDecision = { ...meal, items: meal.items.map((item) => ({ ...item, photo: PHOTO_NONE })) }
    try {
      return JSON.stringify(lean)
    } catch {
      return null
    }
  }

  private loadStoredMeals(): void {
    const kept: MealDecision[] = []
    for (const json of [this.gameStore.mealJson, this.gameStore.demoMealJson]) {
      if (json == null) continue
      try {
        const meal = normalizeMeal(JSON.parse(json))
        if (meal && this.isWithinMeal(meal)) kept.push(meal)
      } catch {
        // 读不懂就当没有
      }
    }
    this.realMeal = kept.find((m) => !m.isDemo) ?? null
    this.demoMeal = kept.find((m) => m.isDemo) ?? null
    this.storeMeal()
  }

  /**
   * 每一局新游戏都要过的关：这一餐还没定 → 直接开；反悔用完了（或饭桌 / 投票定的）→ 显示定了的结果、锁住；
   * 同一局 → 再显示定了的结果；否则先问「会用掉唯一一次反悔，确定吗？」。
   */
  private gate(placeIds: readonly string[], sameAsDecided: boolean, start: () => void): void {
    const decided = this.currentMeal()
    if (decided == null) {
      start()
    } else if (decided.regretsLeft <= 0) {
      this.lockedRestart = { placeIds, start }
      this.showDecided(decided, true)
    } else if (sameAsDecided) {
      this.showDecided(decided, false)
    } else {
      this.pendingGame = { placeIds, start }
      this.setMealPrompt({ placeName: mealWinnerName(decided) })
    }
  }

  private placesShown(pending: PendingGame): boolean {
    const results = this.results()
    if (!results) return false
    return pending.placeIds.every((id) => resultItem(results, id) != null)
  }

  /** 【确定，重新玩】：用掉唯一一次反悔，开新局（那局的店还在现在的结果里才开）。 */
  confirmMealRegret(): void {
    const pending = this.pendingGame
    if (!pending) return
    this.pendingGame = null
    this.setMealPrompt(null)
    if (!this.placesShown(pending)) return
    const meal = this.currentMeal()
    if (meal) this.useRegret(meal)
    pending.start()
  }

  /** 【不了，就吃这家】或点外面：显示定了的结果（不锁）。 */
  declineMealRegret(): void {
    this.pendingGame = null
    this.setMealPrompt(null)
    const meal = this.currentMeal()
    if (meal) this.showDecided(meal, false)
  }

  /** 「大家都同意重来？」确认后：被拒绝的那局新游戏直接开，不用反悔（每次被拒绝只能用一次）。 */
  agreeToRestart(): void {
    const pending = this.lockedRestart
    if (!pending) return
    this.lockedRestart = null
    if (!this.placesShown(pending)) return
    this.setDuel(null)
    pending.start()
  }

  /** 「🤝 这一餐已经定了：…　看一看」：再显示那个结果，什么都不重玩。 */
  showMealDecision(): void {
    const meal = this.currentMeal()
    if (meal) this.showDecided(meal, false)
  }

  private showDecided(decided: MealDecision, locked: boolean): void {
    this.tableValue = null
    this.setDuel({
      ...decided.duel,
      regretsLeft: decided.regretsLeft,
      animationDone: true,
      locked,
      snapshot: decided.items,
    })
  }

  private useRegret(decided: MealDecision): void {
    this.keepMeal(decided.isDemo, { ...decided, regretsLeft: Math.max(decided.regretsLeft - 1, 0) })
  }

  /**
   * 这一局定了这一餐：第一次决定开始这一餐（3 小时）和唯一的反悔；反悔后再定的取代它（开始时间和用掉的反悔不变）。
   * 饭桌、投票是大家一起定的：反悔 0，只有「大家都同意重来？」。
   */
  private recordDecision(duel: DuelState): void {
    const results = this.results()
    if (!results) return
    const items = duel.placeIds
      .map((id) => resultItem(results, id) ?? duel.snapshot.find((item) => item.place.id === id) ?? null)
      .filter((item): item is ResultItem => item != null)
    const existing = this.currentMeal()
    const decided: MealDecision = {
      decidedAtMillis: existing?.decidedAtMillis ?? this.now(),
      regretsLeft: isTableMode(duel.mode) ? 0 : (existing?.regretsLeft ?? REGRETS_PER_MEAL),
      isDemo: results.isDemo,
      duel: { ...duel, snapshot: [], locked: false },
      items,
    }
    this.keepMeal(results.isDemo, decided)
  }

  private withMealRegrets(duel: DuelState): DuelState {
    return { ...duel, regretsLeft: this.currentMeal()?.regretsLeft ?? REGRETS_PER_MEAL }
  }

  /** 改画面上的这一局；它也是这一餐的决定时，存着的那份一起改（编号一样才改）。 */
  private updateDuel(change: (duel: DuelState) => DuelState): void {
    const duel = this.duelValue
    if (!duel) return
    this.setDuel(change(duel))
    const demo = this.inDemoWorld()
    const decided = this.mealIn(demo)
    if (decided && decided.duel.round === duel.round) this.keepMeal(demo, { ...decided, duel: change(decided.duel) })
  }

  // ================================================================ 剪刀石头布 / 帮我挑一家 / 🎡（不花钱）

  /** 打开游戏：能去的 3 家剪刀石头布、2 家帮我挑一家、圈的 4–6 家转盘；不到 2 家没有游戏。先过愿赌服输的关。 */
  openDuel(): void {
    const current = this.results()
    if (!current) return
    const results: ResultsState = { ...current, clock: this.statusClock() }
    if (!sameClock(results.clock, current.clock)) this.setUi(results)
    const plan = planDuel(results)
    const mode = plan.mode
    if (mode == null) return
    const decided = this.currentMeal()?.duel ?? null
    const same = decided != null && decided.mode === mode && sameSet(decided.placeIds, plan.candidateIds)
    this.gate(plan.candidateIds, same, () => {
      this.tableValue = null
      const duel = this.newDuelRound(plan.candidateIds, mode, plan.skippedIds, plan.fromBasket, results.choice)
      if (duel.winnerIndex != null) this.recordDecision(duel)
      this.setDuel(this.withMealRegrets(duel))
    })
  }

  /** 出拳：App 的手、赢家、台词马上决定；记今天的战绩。 */
  playHand(hand: HandId): void {
    const duel = this.duelValue
    if (!duel || duel.mode !== 'ROCK_PAPER_SCISSORS' || duel.userHand != null) return
    const outcome = play(hand, this.random)
    const played: DuelState = {
      ...duel,
      userHand: outcome.user,
      appHand: outcome.app,
      winnerIndex: winnerIndexOf(outcome),
      spinMillis: drawSpinMillis(this.random, RPS_SPIN_MS),
    }
    const decided: DuelState = { ...played, line: this.lineFor(played) }
    this.setDuel(decided)
    this.recordDecision(decided)
    this.gameStore.dayStats = recordDayStats(this.gameStore.dayStats, this.today(), verdictOf(duelOutcome(decided)))
    this.publishStats()
  }

  /** 🎡「转！」：停在哪现在就抽好。 */
  spinWheel(): void {
    const duel = this.duelValue
    if (!duel || duel.mode !== 'WHEEL' || duel.wheel != null) return
    const spin = wheelSpin(this.random, duel.placeIds.length)
    const spun: DuelState = { ...duel, wheel: spin, winnerIndex: spin.target, spinMillis: spin.millis }
    const decided: DuelState = { ...spun, line: this.lineFor(spun) }
    this.setDuel(decided)
    this.recordDecision(decided)
  }

  /** 画面把这一局播完了（再打开直接显示结果）；旧的一局晚到的通知不理。 */
  onDuelAnimationDone(round: number): void {
    if (this.duelValue?.round === round) this.updateDuel((d) => ({ ...d, animationDone: true }))
    const demo = this.inDemoWorld()
    const decided = this.mealIn(demo)
    if (decided && decided.duel.round === round && !decided.duel.animationDone) {
      this.keepMeal(demo, { ...decided, duel: { ...decided.duel, animationDone: true } })
    }
  }

  /**
   * 「不服！再来一局」：一餐一次，饭桌、投票没有。只用这局里现在还能去的店：≥ 4 转盘、3 剪刀石头布、2 帮我挑一家；
   * 不到 2 家不开、反悔也不用掉。
   */
  duelAgain(): void {
    const duel = this.duelValue
    if (!duel || !allowsRegret(duel.mode) || duel.locked) return
    const decided = this.currentMeal()
    const left = decided?.regretsLeft ?? REGRETS_PER_MEAL
    if (left <= 0) return
    const current = this.results()
    if (!current) return
    const results: ResultsState = { ...current, clock: this.statusClock() }
    const open: string[] = []
    const gone: string[] = []
    for (const id of duel.placeIds) {
      const item = resultItem(results, id) ?? duel.snapshot.find((i) => i.place.id === id) ?? null
      ;(item && canGo(results, item.place) ? open : gone).push(id)
    }
    const mode = modeFor(open.length)
    if (mode == null) return
    if (!sameClock(results.clock, current.clock)) this.setUi(results)
    if (decided) this.useRegret(decided)
    const again: DuelState = {
      ...this.newDuelRound(open, mode, [...duel.skippedIds, ...gone], duel.fromBasket, duel.choice),
      snapshot: duel.snapshot,
    }
    if (again.winnerIndex != null) this.recordDecision(again)
    this.setDuel(this.withMealRegrets(again))
  }

  /** 「回到列表」/ 返回：关掉游戏层（列表、页数、滑到的位置都不变）。 */
  closeDuel(): void {
    this.lockedRestart = null
    this.setDuel(null)
  }

  private newDuelRound(
    placeIds: readonly string[],
    mode: DuelMode,
    skippedIds: readonly string[],
    fromBasket: boolean,
    choice: SearchChoice | null,
  ): DuelState {
    const fresh = newDuelState({ round: ++this.round, placeIds: [...placeIds], mode, skippedIds: [...skippedIds], fromBasket, choice })
    if (mode === 'ROULETTE') {
      const picked: DuelState = {
        ...fresh,
        winnerIndex: pickOfTwo(this.random),
        spinMillis: drawSpinMillis(this.random, ROULETTE_SPIN_MS),
      }
      return { ...picked, line: this.lineFor(picked) }
    }
    return fresh
  }

  /** 这一局的台词（输到素食店有自己那句）。 */
  private lineFor(duel: DuelState): string {
    const verdict = isTableMode(duel.mode) ? 'TABLE' : verdictOf(duelOutcome(duel))
    const winnerId = duel.winnerIndex == null ? null : (duel.placeIds[duel.winnerIndex] ?? null)
    const results = this.results()
    const item =
      winnerId == null
        ? null
        : ((results ? resultItem(results, winnerId) : null) ?? duel.snapshot.find((i) => i.place.id === winnerId) ?? null)
    return pickLine(verdict, this.random, item != null && isVegetarian(item.place), duel.mode === 'VETO')
  }

  // ================================================================ 🃏 任务卡、🎯 谁来做（不花钱）

  /** 🃏 一局一张（有时是免死金牌）。 */
  drawTaskCard(): void {
    const duel = this.duelValue
    if (!duel || duel.task != null || duel.winnerIndex == null) return
    const card = drawCard(this.random)
    this.updateDuel((d) => ({ ...d, task: taskDraw(card, d.table?.players ?? []) }))
  }

  /** 🎯 转一下，看谁来做：饭桌模式用饭桌的玩家；一个人玩用他说的几个人（头像表前 N 个）。 */
  spinTaskWheel(people: number): void {
    const task = this.duelValue?.task
    if (!task || isFreePass(task) || task.spin != null) return
    const players: TablePlayer[] =
      task.players.length > 0
        ? [...task.players]
        : this.avatars().slice(0, Math.min(Math.max(people, MIN_PLAYERS), MAX_PLAYERS))
    const spin = wheelSpin(this.random, players.length, TASK_WHEEL_MILLIS)
    this.updateDuel((d) => ({ ...d, task: { ...task, players, spin } }))
  }

  /** 🎯 转盘在画面上停好了：之后再显示直接停在结果。 */
  onTaskWheelStopped(): void {
    const task = this.duelValue?.task
    if (task && task.spin != null && !task.spun) this.updateDuel((d) => ({ ...d, task: { ...task, spun: true } }))
  }

  private publishStats(): void {
    this.todayStatsValue = dayStatsOn(this.gameStore.dayStats, this.today())
    this.emit()
  }

  private today(): string {
    return localDate(this.now(), this.zone())
  }

  // ================================================================ 👥 饭桌模式（不花钱）

  private avatars(): TablePlayer[] {
    return ALL_AVATARS.map((avatar) => tablePlayer(avatar, this.gameStore.avatarName(avatar)))
  }

  /**
   * 👥 饭桌模式：圈了 3 家以上用圈的店里能去的，否则这一页能去的。fromDuel = 从还没出拳的剪刀石头布切换过来（不再过关）。
   * 能去的不到 2 家 → false（画面说「你圈的店里能去的不到 2 家」）。
   */
  openTable(fromDuel = false): boolean {
    const current = this.results()
    if (!current) return false
    const results: ResultsState = { ...current, clock: this.statusClock() }
    if (!sameClock(results.clock, current.clock)) this.setUi(results)
    const plan = tableCandidates(results)
    if (plan.mode == null) return false
    const start = () => {
      this.duelValue = null
      this.secretHands = []
      this.pendingTableResult = null
      const remembered = this.gameStore.tablePlayers
      const count =
        remembered >= MIN_PLAYERS && remembered <= MAX_PLAYERS
          ? remembered
          : Math.min(Math.max(plan.candidateIds.length, MIN_PLAYERS), MAX_PLAYERS)
      this.setTable({
        round: ++this.round,
        placeIds: [...plan.candidateIds],
        fromBasket: plan.fromBasket,
        playerCount: count,
        avatars: this.avatars(),
        phase: 'SETUP',
        veto: null,
        undoable: false,
        secret: null,
      })
    }
    if (fromDuel && this.duelValue?.winnerIndex == null) start()
    else this.gate(plan.candidateIds, false, start)
    return true
  }

  /** 「几个人？」2–6，记住。 */
  setTablePlayers(count: number): void {
    const table = this.tableValue
    if (!table || table.phase !== 'SETUP') return
    const n = Math.min(Math.max(count, MIN_PLAYERS), MAX_PLAYERS)
    this.gameStore.tablePlayers = n
    this.setTable({ ...table, playerCount: n })
  }

  /** 头像改名（最多 6 个字；空的 = 原名），只存在这个浏览器。 */
  renameAvatar(avatar: AvatarId, name: string): void {
    const clean = cleanName(name)
    this.gameStore.setAvatarName(avatar, clean)
    const table = this.tableValue
    if (table) {
      this.setTable({ ...table, avatars: table.avatars.map((p) => (p.avatar === avatar ? { ...p, customName: clean } : p)) })
    }
  }

  /** ✂️ 每人划一刀：公开抽签排顺序。 */
  startVeto(): void {
    const table = this.tableValue
    if (!table || table.phase !== 'SETUP') return
    this.gameStore.tablePlayers = table.playerCount
    this.setTable({ ...table, phase: 'VETO', veto: newVetoGame(table.placeIds, drawOrder(table.playerCount, this.random)) })
  }

  /** 轮到的人划掉一家。「撤销」还在时谁都不能再划（手机正在交给下一个人）。 */
  cutPlace(placeId: string): void {
    const table = this.tableValue
    const veto = table?.veto
    if (!table || !veto || table.undoable) return
    const cut = vetoCut(veto, placeId)
    if (cut !== veto) this.setTable({ ...table, veto: cut, undoable: true })
  }

  /** 「点错了？撤销」：只收回刚才那一刀。 */
  undoCut(): void {
    const table = this.tableValue
    const veto = table?.veto
    if (!table || !veto || !table.undoable) return
    this.setTable({ ...table, veto: vetoUndo(veto), undoable: false })
  }

  /** 撤销的 3 秒过了。 */
  expireCutUndo(): void {
    const table = this.tableValue
    if (table?.undoable) this.setTable({ ...table, undoable: false })
  }

  /** 剩下最后一家（撤销时间也过了）：「就这一家吧！」，这一餐的决定。 */
  finishVeto(): void {
    const table = this.tableValue
    const veto = table?.veto
    if (!table || !veto) return
    const winner = vetoWinner(veto)
    if (winner == null || !vetoIsFinished(veto)) return
    const base = newDuelState({
      round: ++this.round,
      placeIds: [...table.placeIds],
      mode: 'VETO',
      fromBasket: table.fromBasket,
      winnerIndex: table.placeIds.indexOf(winner),
      table: { players: tablePlayers(table), order: [...veto.order], cuts: [...veto.cuts], hands: [] },
      choice: this.results()?.choice ?? null,
    })
    const result: DuelState = { ...base, line: this.lineFor(base) }
    this.tableValue = null
    this.recordDecision(result)
    this.setDuel(this.withMealRegrets(result))
  }

  /** 🙈 暗中出拳（刚好 3 家）：抽传手机的顺序。 */
  startSecretHands(): void {
    const table = this.tableValue
    if (!table || table.phase !== 'SETUP' || !secretPossible(table)) return
    this.gameStore.tablePlayers = table.playerCount
    this.secretHands = Array.from({ length: table.playerCount }, () => null)
    this.pendingTableResult = null
    this.setTable({
      ...table,
      phase: 'SECRET',
      secret: {
        order: drawOrder(table.playerCount, this.random),
        turn: 0,
        step: 'HANDOVER',
        chosenCount: 0,
        hands: [],
        verdict: null,
        tieSpin: null,
        tiedIndices: [],
        winnerIndex: null,
      },
    })
  }

  /** 「我拿到了，开始出拳」。 */
  secretTakePhone(): void {
    this.updateSecret('HANDOVER', (s) => ({ ...s, step: 'CHOOSING' }))
  }

  /** 拿着手机的人偷偷出一个手势（一起翻牌前谁都看不到）。 */
  secretChoose(hand: HandId): void {
    this.updateSecret('CHOOSING', (s) => {
      this.secretHands[secretCurrentPlayer(s)] = hand
      return { ...s, step: 'CHOSEN', chosenCount: this.secretHands.filter((h) => h != null).length }
    })
  }

  /** 出好的人自己按「交给下一位」（最后一个人「出好了，叫大家过来」）：从此这个手势就定了。 */
  secretPass(): void {
    this.updateSecret('CHOSEN', (s) => (secretIsLastTurn(s) ? { ...s, step: 'ALL_DONE' } : { ...s, turn: s.turn + 1, step: 'HANDOVER' }))
  }

  /** 「点错了？重出」：只有自己「✔ 出好了」那一页、手机还在自己手上时才行。 */
  secretRedo(): void {
    this.updateSecret('CHOSEN', (s) => {
      this.secretHands[secretCurrentPlayer(s)] = null
      return { ...s, step: 'CHOOSING', chosenCount: this.secretHands.filter((h) => h != null).length }
    })
  }

  /** 「全部出完了！一起翻牌 👀」：这时才判定（App 不出拳）；人头打平的转盘现在抽好；这一餐定了。 */
  secretReveal(): void {
    const table = this.tableValue
    const secret = table?.secret
    if (!table || !secret || secret.step !== 'ALL_DONE' || this.secretHands.some((h) => h == null)) return
    const hands = this.secretHands as HandId[]
    const verdict = judgeSecretHands(hands)
    const winningHand = secretWinningHand(verdict)
    const tied = verdict.kind === 'TIE' ? verdict.tiedHands.map(placeIndexOf) : []
    const spin = winningHand == null ? wheelSpin(this.random, tied.length) : null
    const winnerIndex = winningHand != null ? placeIndexOf(winningHand) : (tied[spin?.target ?? 0] as number)
    this.setTable({
      ...table,
      secret: { ...secret, step: 'REVEAL', hands: [...hands], verdict, tieSpin: spin, tiedIndices: tied, winnerIndex },
    })
    const base = newDuelState({
      round: ++this.round,
      placeIds: [...table.placeIds],
      mode: 'SECRET_HANDS',
      fromBasket: table.fromBasket,
      winnerIndex,
      wheel: spin,
      tiedIndices: tied,
      table: { players: tablePlayers(table), order: [...secret.order], cuts: [], hands: [...hands] },
      choice: this.results()?.choice ?? null,
    })
    const result: DuelState = { ...base, line: this.lineFor(base) }
    this.pendingTableResult = result
    this.recordDecision(result)
  }

  /** 翻牌播完了：「就这一家吧！」。 */
  showTableResult(): void {
    const result = this.pendingTableResult
    if (!result) return
    this.pendingTableResult = null
    this.tableValue = null
    this.setDuel(this.withMealRegrets(result))
  }

  /** 离开饭桌模式（玩到一半画面会先问）。已经翻牌的 → 直接显示结果，不会丢。 */
  closeTable(): void {
    const revealed = this.pendingTableResult
    this.secretHands = []
    this.pendingTableResult = null
    this.tableValue = null
    if (revealed) this.setDuel(this.withMealRegrets(revealed))
    else this.emit()
  }

  private updateSecret(step: SecretStep, change: (secret: SecretProgress) => SecretProgress): void {
    const table = this.tableValue
    const secret = table?.secret
    if (!table || !secret || secret.step !== step) return
    this.setTable({ ...table, secret: change(secret) })
  }

  // ================================================================ 📊 群投票计票板（不花钱）

  /** 「📤 发到群里投票」发出去了：出现计票板（同一组店已经在计就保留票数）。 */
  startVoteCount(placeIds: readonly string[]): void {
    const results = this.results()
    if (!results || placeIds.length < MIN_PLACES) return
    if (sameVotePlaces(results.vote, placeIds)) return
    this.setUi({ ...results, vote: newVoteTally(placeIds) })
  }

  /** ＋ / －（票数不会小于 0）。 */
  changeVote(index: number, add: boolean): void {
    const results = this.results()
    const vote = results?.vote
    if (!results || !vote) return
    this.setUi({ ...results, vote: add ? addVote(vote, index) : removeVote(vote, index) })
  }

  closeVote(): void {
    const results = this.results()
    if (results?.vote) this.setUi({ ...results, vote: null })
  }

  /** 「数好了，看结果」：最多票的赢；打平 → 转盘只在打平的几家里转。大家一起定的，不能反悔。 */
  finishVote(): void {
    const results = this.results()
    const vote = results?.vote
    if (!results || !vote) return
    if (vote.placeIds.some((id) => resultItem(results, id) == null)) {
      this.setUi({ ...results, vote: null })
      return
    }
    const leaders = voteLeaders(vote)
    if (leaders.length === 0) return
    this.gate(vote.placeIds, false, () => {
      this.tableValue = null
      const spin = leaders.length > 1 ? wheelSpin(this.random, leaders.length) : null
      const base = newDuelState({
        round: ++this.round,
        placeIds: [...vote.placeIds],
        mode: 'VOTE',
        fromBasket: results.basket.length >= MIN_BASKET,
        winnerIndex: spin ? (leaders[spin.target] as number) : (leaders[0] as number),
        wheel: spin,
        spinMillis: spin?.millis ?? 0,
        tiedIndices: spin ? leaders : [],
        vote,
        choice: results.choice,
      })
      const result: DuelState = { ...base, line: this.lineFor(base) }
      this.recordDecision(result)
      this.setDuel(this.withMealRegrets(result))
    })
  }

  // ================================================================ 📜 今日饭签（不花钱）

  private fortuneState(): FortuneState {
    const day = localEpochDay(this.now(), this.zone())
    return {
      stickIndex: fortuneIndexFor(day, this.gameStore.phoneSeed),
      drawn: this.gameStore.fortuneDay === isoDateOfEpochDay(day),
    }
  }

  private publishFortune(): void {
    const fortune = this.fortuneState()
    this.updateHome((h) =>
      h.fortune && h.fortune.stickIndex === fortune.stickIndex && h.fortune.drawn === fortune.drawn ? h : { ...h, fortune },
    )
  }

  /** 「📜 抽今日饭签」：同一天永远同一支；签纸打开那一刻才记成「今天抽过」。 */
  drawFortune(): void {
    this.gameStore.fortuneDay = this.today()
    this.publishFortune()
  }

  /** 「照签去找」：选好签上的菜系，回传签上的组合（画面接着走 requestSearch；算 1 次搜索，演示不扣）。 */
  acceptFortune(): SearchChoice | null {
    const fortune = this.homeValue.fortune
    if (!fortune) return null
    const choice = fortuneChoice(fortune.stickIndex)
    this.updateHome((h) => ({ ...h, selectedCuisine: choice.cuisine }))
    return choice
  }

  /** 今天抽过签：随便挑多给签上的组合机会。 */
  private favouredByFortune(): SearchChoice | null {
    const fortune = this.homeValue.fortune
    return fortune?.drawn ? fortuneChoice(fortune.stickIndex) : null
  }

  // ================================================================ 📳 摇一摇

  setShakeEnabled(on: boolean): void {
    this.gameStore.shakeEnabled = on
    this.updateHome((h) => ({ ...h, shakeEnabled: on }))
  }

  // ================================================================ 👣 吃过的记录（只存在这个浏览器）

  private activeVisits(): Visit[] {
    return this.settings.demoMode ? this.demoVisits : this.visits
  }

  /**
   * 「导航」/「导航过去」：记下店的编号、菜系、时间（同一餐只算一次）。演示店记在内存里的演示记录。
   * 画面自己负责打开 Google 地图。
   */
  onNavigate(place: Place): void {
    const game = this.duelValue && this.duelValue.placeIds.includes(place.id) ? this.duelValue : null
    const searched = game?.choice?.cuisine ?? this.results()?.choice.cuisine ?? 'ANY'
    const v = visit(place.id, cuisineOfVisit(place, searched, matchTypesFor), this.now())
    if (isDemoPlace(place)) {
      this.demoVisits = addVisit(this.demoVisits, v)
    } else {
      this.visits = addVisit(this.visits, v)
      this.visitStore.save(this.visits)
    }
    this.publishVisits()
  }

  /** 清除吃过的记录（演示的也清）。 */
  clearVisits(): void {
    this.visits = []
    this.demoVisits = []
    this.visitStore.save(this.visits)
    this.publishVisits()
  }

  private publishVisits(): void {
    const active = this.activeVisits()
    this.lastVisitsValue = lastVisits(active)
    this.snapshot = null
    this.updateHome((h) => ({ ...h, streakCuisine: streak(active), visitCount: active.length }))
    this.emit()
  }

  // ================================================================ 搜索

  private cancelSearch(): void {
    this.searchToken++
    this.searchAbort?.abort()
    this.searchAbort = null
  }

  /** 开始搜索（定位权限已经先过了；按钮请用 requestSearch）。 */
  search(choice: SearchChoice): void {
    this.cancelSearch()
    this.closeGames()
    this.lastChoice = choice
    this.updateHome((h) => (h.demoUndo ? { ...h, demoUndo: false } : h))
    const token = this.searchToken
    const controller = new AbortController()
    this.searchAbort = controller
    // 浏览器翻译器要在用户点按的那一刻准备（演示模式不准备：不下载模型）。
    if (!this.settings.demoMode) {
      try {
        this.deps.primeTranslator?.()
      } catch {
        // 准备不了就算了
      }
    }
    void this.runSearch(choice, token, controller.signal).catch(() => undefined)
  }

  private stale(token: number): boolean {
    return token !== this.searchToken
  }

  private async runSearch(choice: SearchChoice, token: number, signal: AbortSignal): Promise<void> {
    // 只读一次：搜索中途拨开关也不会混用两边。
    const demo = this.settings.demoMode
    if (!demo) {
      if (!this.storageWritable()) return this.showError(choice, { kind: 'STORAGE_BLOCKED' })
      const problem = apiKeyProblem(this.settings.effectiveApiKey())
      if (problem === 'NO_API_KEY') return this.showError(choice, { kind: 'NO_API_KEY' })
      if (problem === 'INVALID_API_KEY') return this.showError(choice, { kind: 'INVALID_API_KEY' })
    }
    const radiusKm = this.homeValue.radiusKm
    this.setUi({ kind: 'LOADING', choice, phase: 'LOCATING', isDemo: demo })

    const location = await this.obtainLocation(false)
    if (this.stale(token)) return
    let fix: LocationFix
    switch (location.kind) {
      case 'SUCCESS':
        fix = location.fix
        break
      case 'NO_PERMISSION': {
        const status = this.homeValue.location
        return this.showError(choice, { kind: 'PERMISSION_NEEDED', permanently: status.kind === 'PERMISSION_DENIED' && status.permanently })
      }
      case 'SERVICES_OFF':
        return this.showError(choice, { kind: 'LOCATION_SERVICES_OFF' })
      case 'UNAVAILABLE': {
        // 10 分钟内的旧位置还可以用；更旧的不用（免得在别处找店）。
        const previous = this.lastFix
        if (previous && isFixWithin(previous, FALLBACK_MAX_AGE_MS, this.elapsed())) {
          fix = previous
          break
        }
        return this.showError(choice, { kind: 'LOCATION_UNAVAILABLE' })
      }
    }

    // 同一个组合 + 范围、10 分钟内、离当时不到 200 米：直接用上次的结果，0 个请求。
    if (!demo) {
      const reused = this.reusableResults(choice, radiusKm, fix.latLng)
      if (reused) {
        this.show(reused)
        return
      }
    }

    this.setUi({ kind: 'LOADING', choice, phase: 'SEARCHING', isDemo: demo })
    let outcome
    try {
      outcome = await (demo ? this.demoClient : this.placesClient).search(choice, fix.latLng, radiusKm * 1000, signal)
    } catch (e) {
      if (this.stale(token) || isCancelled(e)) return
      this.refreshUsage()
      return this.showError(choice, toSearchError(e))
    }
    if (this.stale(token)) return
    this.refreshUsage()

    const ranked = rankedFor(choice, outcome.places)
    if (ranked.length === 0) {
      // 有关键词失败了：「附近没有」只是猜的，改说失败的原因（可以重试）。
      if (outcome.failures.length > 0) return this.showError(choice, toSearchError(mostInformativeFailure(outcome.failures)))
      const larger = radiusKm < MAX_KM ? snapRadius(Math.min(radiusKm * 2, MAX_KM)) : null
      return this.showError(choice, { kind: 'NO_RESULTS', radiusKm, largerRadiusKm: larger })
    }

    const results: ResultsState = {
      kind: 'RESULTS',
      choice,
      radiusKm,
      ranked: ranked.map((place, index) => ({
        rank: index + 1,
        place,
        photo: this.initialPhotoState(place),
        translatedName: this.localizerFor(place).cached(place.name),
        translatedType: this.localizerFor(place).cached(place.primaryTypeDisplayName),
      })),
      page: 0,
      openNowOnly: this.settings.openNowOnly,
      partial: outcome.failures.length > 0,
      fromCache: false,
      isDemo: demo,
      trimmedCount: 0,
      basket: [],
      clearedBasket: [],
      vote: null,
      clock: this.statusClock(),
      shownAtMillis: this.now(),
      dayPart: dayPartAt(this.now(), this.zone()),
    }
    // 只缓存完整的真实结果：部分失败后下一次按会真的再搜。
    if (!demo && !results.partial) this.putInCache({ center: fix.latLng, timeMillis: this.now(), results })
    this.show(results)
  }

  private reusableResults(choice: SearchChoice, radiusKm: number, at: Place['location']): ResultsState | null {
    const cached = this.resultCache.get(cacheKey(choice, radiusKm))
    if (!cached) return null
    const age = this.now() - cached.timeMillis
    const fresh = age >= 0 && age <= CACHE.TTL_MS
    const near = haversineMeters(cached.center, at) < CACHE.MAX_MOVE_METERS
    if (!fresh || !near) return null
    return {
      ...cached.results,
      fromCache: true,
      page: 0,
      openNowOnly: this.settings.openNowOnly,
      basket: [],
      clearedBasket: [],
      vote: null,
      clock: this.statusClock(),
      shownAtMillis: this.now(),
      dayPart: dayPartAt(this.now(), this.zone()),
    }
  }

  /** 最多 6 组；同一个键再放就替换并排到最后。 */
  private putInCache(entry: CachedResults): void {
    const key = cacheKey(entry.results.choice, entry.results.radiusKm)
    this.resultCache.delete(key)
    this.resultCache.set(key, entry)
    while (this.resultCache.size > CACHE.MAX_ENTRIES) {
      const first = this.resultCache.keys().next().value
      if (first === undefined) break
      this.resultCache.delete(first)
    }
  }

  /** 显示结果，再为画面上的店补照片和翻译。 */
  private show(results: ResultsState, fetchPhotos = true): void {
    this.setUi(results)
    this.enrich(resultsItems(results), fetchPhotos)
  }

  private showError(choice: SearchChoice | null, error: SearchError): void {
    this.setUi({ kind: 'ERROR', choice, error })
  }

  private initialPhotoState(place: Place): PhotoState {
    const cached = this.photoUriCache.get(place.id)
    if (cached != null) return photoLoaded(cached)
    if (place.photoName == null) return PHOTO_NONE
    return PHOTO_PENDING
  }

  /** 演示店用内置对照表，真实店用浏览器翻译。 */
  private localizerFor(place: Place): ChineseLocalizer {
    return isDemoPlace(place) ? this.demoLocalizer : this.localizer
  }

  /**
   * 为画面上的店补照片和中文名（店已经显示出来以后）。开着演示时一律不碰 Google（不拿照片、不翻真实店名）；
   * fetchPhotos = false（只看营业中、时间跳动带出来的店）只显示已经知道的照片。
   */
  private enrich(items: readonly ResultItem[], fetchPhotos = true): void {
    const online = !this.settings.demoMode
    for (const item of items) {
      const place = item.place
      if (isUnresolved(item.photo)) this.loadPhoto(place, online && fetchPhotos)
      if (!online && !isDemoPlace(place)) continue
      if (item.translatedName == null) this.translate(place, 'name')
      if (item.translatedType == null) this.translate(place, 'type')
    }
  }

  private translate(place: Place, field: 'name' | 'type'): void {
    const text = field === 'name' ? place.name : place.primaryTypeDisplayName
    if (text == null) return
    const original = ktTrim(text)
    if (!needsTranslation(original)) return
    const demo = isDemoPlace(place)
    const translator = this.localizerFor(place)
    const key = (demo ? 'D|' : 'R|') + original
    if (this.translationsInFlight.has(key)) return
    this.translationsInFlight.add(key)
    void (async () => {
      try {
        const translated = await translator.localize(original)
        if (translated == null) return
        this.patchItems(
          (it) => isDemoPlace(it.place) === demo && ktTrim((field === 'name' ? it.place.name : it.place.primaryTypeDisplayName) ?? '') === original,
          (it) =>
            field === 'name'
              ? it.translatedName == null
                ? { ...it, translatedName: translated }
                : it
              : it.translatedType == null
                ? { ...it, translatedType: translated }
                : it,
        )
      } catch {
        // 安静地显示原名
      } finally {
        this.translationsInFlight.delete(key)
      }
    })()
  }

  /** 已经知道的照片网址直接用；否则（request）请求一次。同一家正在拿就等那一个：每家最多 1 个收费请求。 */
  private loadPhoto(place: Place, request: boolean): void {
    const photoName = place.photoName
    if (photoName == null) return
    const known = this.photoUriCache.get(place.id)
    if (known != null) {
      this.patchPlace(place.id, (it) => this.withPhoto(it, photoLoaded(known)))
      return
    }
    if (!request) return
    this.patchPlace(place.id, (it) => (it.photo.kind === 'PENDING' ? { ...it, photo: PHOTO_LOADING } : it))
    if (this.photoRequestsInFlight.has(place.id)) return
    this.photoRequestsInFlight.add(place.id)
    void (async () => {
      let uri: string | null = null
      try {
        uri = await this.photoResolver.photoUri(photoName)
      } catch {
        uri = null
      } finally {
        this.photoRequestsInFlight.delete(place.id)
      }
      if (uri != null) this.photoUriCache.set(place.id, uri)
      const photo = uri != null ? photoLoaded(uri) : PHOTO_NONE
      this.patchPlace(place.id, (it) => this.withPhoto(it, photo))
      this.refreshUsage()
    })()
  }

  /** 还没定的照片才更新；已经知道的结果不会被盖掉。 */
  private withPhoto(item: ResultItem, photo: PhotoState): ResultItem {
    return isUnresolved(item.photo) ? { ...item, photo } : item
  }

  private patchPlace(placeId: string, change: (item: ResultItem) => ResultItem): void {
    this.patchItems((it) => it.place.id === placeId, change)
  }

  /** 改每一张对得上的卡片：画面上的、缓存里的（照片和中文名属于店，不属于某一次搜索）。 */
  private patchItems(matches: (item: ResultItem) => boolean, change: (item: ResultItem) => ResultItem): void {
    const patched = (results: ResultsState): ResultsState => ({
      ...results,
      ranked: results.ranked.map((it) => (matches(it) ? change(it) : it)),
    })
    for (const [key, cached] of this.resultCache) this.resultCache.set(key, { ...cached, results: patched(cached.results) })
    const current = this.results()
    if (current) this.setUi(patched(current))
    else this.saveSession()
  }

  // ================================================================ 分页被丢掉再载入（sessionStorage）

  /**
   * 每次画面变化都存一份：画面上的结果（最多 30 家，加上 ❤️ / 撤销 / 计票板点名的店）、缓存最近 3 组、这一餐。
   * 丢掉的家数记在 trimmedCount（标题的「从 N 家里」照样对）。
   */
  private saveSession(): void {
    const trimmed = (results: ResultsState): ResultsState => {
      if (results.ranked.length <= SAVED_RANKED_MAX) return results
      const named = new Set([...results.basket, ...results.clearedBasket, ...(results.vote?.placeIds ?? [])])
      const kept = [
        ...results.ranked.slice(0, SAVED_RANKED_MAX),
        ...results.ranked.slice(SAVED_RANKED_MAX).filter((it) => named.has(it.place.id)),
      ]
      return { ...results, ranked: kept, trimmedCount: results.trimmedCount + results.ranked.length - kept.length }
    }
    const shown = this.results()
    const session: SavedSession = {
      v: SESSION_VERSION,
      shown: shown ? trimmed(shown) : null,
      cache: [...this.resultCache.values()].slice(-CACHE.SAVED_MAX).map((c) => ({ ...c, results: trimmed(c.results) })),
      meal: this.realMeal,
      demoMeal: this.demoMeal,
    }
    try {
      this.sessionStore.set(SESSION_KEY, JSON.stringify(session))
    } catch {
      // 存不了就算了（只是重新整理后要重来）
    }
  }

  /** 分页被丢掉再载入（或重新整理）：结果、还新鲜的缓存、这一餐回来，不会再花一次额度。 */
  private restoreSession(): void {
    const json = this.sessionStore.get(SESSION_KEY)
    if (json == null) return
    const parsed = parseSavedSession(json)
    if (!parsed) return
    const session = withoutRunningRequests(parsed)
    const nowMillis = this.now()
    for (const meal of [session.meal, session.demoMeal]) {
      if (!meal) continue
      const age = nowMillis - meal.decidedAtMillis
      if (age < 0 || age > MEAL_MS) continue
      if (meal.isDemo) this.demoMeal = meal
      else this.realMeal = meal
    }
    this.publishMeal()
    for (const entry of session.cache) {
      const age = nowMillis - entry.timeMillis
      if (age >= 0 && age <= CACHE.TTL_MS) this.putInCache(entry)
    }
    for (const item of [...session.cache.flatMap((c) => c.results.ranked), ...(session.shown?.ranked ?? [])]) {
      if (item.photo.kind === 'LOADED') this.photoUriCache.set(item.place.id, item.photo.url)
    }
    const shown = session.shown
    if (shown) {
      this.lastChoice = shown.choice
      this.updateHome((h) => ({ ...h, selectedCuisine: shown.choice.cuisine }))
      this.show(shown)
    }
  }

  // ================================================================ 其他

  private refreshUsage(): void {
    this.updateHome((h) => {
      const remainingSearches = this.guard.remainingSearchUses()
      const textSearchesUsed = this.guard.textSearchesUsed()
      const photosUsed = this.guard.photosUsed()
      return h.remainingSearches === remainingSearches && h.textSearchesUsed === textSearchesUsed && h.photosUsed === photosUsed
        ? h
        : { ...h, remainingSearches, textSearchesUsed, photosUsed }
    })
  }
}

