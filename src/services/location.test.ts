import { afterEach, describe, expect, it, vi } from 'vitest'
import { locationCard, locationStatusLine } from '../app/texts.ts'
import { BrowserLocationSource, GEO_OPTIONS, type BrowserLocationEnv } from '../platform/browserLocation.ts'
import { flush, plain, TestClock, klMillis, testPlace } from '../test/helpers.ts'
import { CHINESE_RICE, Harness } from '../test/storeHarness.ts'
import { FALLBACK_MAX_AGE_MS, isAgeWithin, isFixWithin, type LocationFix } from './location.ts'

const MINUTE = 60_000
const BOOT = 5 * 60 * MINUTE

function fixAt(elapsedMillis: number): LocationFix {
  return { latLng: { latitude: 3.139, longitude: 101.687 }, elapsedMillis, approximate: false }
}

// ------------------------------------------------------------------ 假浏览器（navigator.geolocation + navigator.permissions）

type UserChoice = 'allow' | 'block' | 'dismiss' | 'safari-deny' | 'ignore'

class FakePermissionStatus {
  state: PermissionState
  private readonly listeners: (() => void)[] = []

  constructor(state: PermissionState) {
    this.state = state
  }

  addEventListener(_type: string, listener: () => void): void {
    this.listeners.push(listener)
  }

  /** 浏览器的权限变了（例如在网址栏的设置里改成允许）。 */
  change(state: PermissionState): void {
    this.state = state
    for (const l of this.listeners) l()
  }
}

/** 假浏览器：照权限状态回答定位；还没问过（prompt）时按 user 的选择回答。 */
class FakeBrowser {
  readonly status: FakePermissionStatus
  /** 用户在浏览器的询问里怎么选。 */
  user: UserChoice = 'allow'
  /** 允许以后，定位本身失败（室内、超时）。 */
  failWith: number | null = null
  accuracy = 25
  /** 位置是几毫秒前的（浏览器的缓存位置）。 */
  cachedAgeMs = 0
  supportsQuery = true
  readonly options: PositionOptions[] = []
  private readonly clock: TestClock

  constructor(clock: TestClock, state: PermissionState = 'prompt') {
    this.clock = clock
    this.status = new FakePermissionStatus(state)
  }

  get calls(): number {
    return this.options.length
  }

  env(): BrowserLocationEnv {
    const geolocation = {
      getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback | null, options?: PositionOptions) => {
        this.options.push(options ?? {})
        const deny = () => queueMicrotask(() => error?.({ code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError))
        if (this.status.state === 'denied') return deny()
        if (this.status.state === 'prompt') {
          switch (this.user) {
            case 'ignore':
              throw new Error('询问被收起来了')
            case 'block':
              this.status.change('denied')
              return deny()
            case 'dismiss':
            case 'safari-deny':
              return deny()
            case 'allow':
              this.status.change('granted')
              break
          }
        }
        if (this.failWith != null) {
          const code = this.failWith
          queueMicrotask(() => error?.({ code, message: 'timeout', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError))
          return
        }
        const timestamp = this.clock.nowMillis - this.cachedAgeMs
        queueMicrotask(() =>
          success({ coords: { latitude: 3.144, longitude: 101.6979, accuracy: this.accuracy }, timestamp } as unknown as GeolocationPosition),
        )
      },
    } as unknown as Geolocation
    const permissions = this.supportsQuery
      ? { query: async () => this.status as unknown as PermissionStatus }
      : null
    return { geolocation, permissions, elapsed: () => this.clock.elapsedMillis, now: () => this.clock.nowMillis }
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('十二、定位与权限：位置新旧', () => {
  it('LOCATION-01 后备的旧位置 9 分钟、刚好 10 分钟可以用，4 个钟头前的（今早在家）不用', () => {
    expect(isAgeWithin(BOOT - 9 * MINUTE, FALLBACK_MAX_AGE_MS, BOOT)).toBe(true)
    expect(isAgeWithin(BOOT - FALLBACK_MAX_AGE_MS, FALLBACK_MAX_AGE_MS, BOOT)).toBe(true)
    expect(isAgeWithin(BOOT - 4 * 60 * MINUTE, FALLBACK_MAX_AGE_MS, BOOT)).toBe(false)
  })

  it('LOCATION-02 时间在「未来」的位置永远不算新鲜', () => {
    expect(isFixWithin(fixAt(BOOT + MINUTE), 2 * MINUTE, BOOT)).toBe(false)
  })

  it('LOCATION-03 位置年龄用单调时钟算：刚好 2 分钟算新鲜，多 1 毫秒就不算（网页用 performance.now()）', async () => {
    const fix = fixAt(BOOT)
    expect(isFixWithin(fix, 2 * MINUTE, BOOT + 2 * MINUTE)).toBe(true)
    expect(isFixWithin(fix, 2 * MINUTE, BOOT + 2 * MINUTE + 1)).toBe(false)
    // 不给时钟时，拿到位置的时刻用 performance.now()（不是 Date.now()）。
    const clock = new TestClock(klMillis(6, 12))
    const browser = new FakeBrowser(clock, 'granted')
    const env = browser.env()
    vi.spyOn(performance, 'now').mockReturnValue(123_456)
    const source = await BrowserLocationSource.create({ geolocation: env.geolocation, permissions: env.permissions, now: env.now })
    const result = await source.currentLocation()
    expect(result.kind === 'SUCCESS' && result.fix.elapsedMillis).toBe(123_456)
  })
})

describe('十二、定位与权限：浏览器的回答（安卓 LOCATION-15…20 的网页版）', () => {
  async function ask(user: UserChoice, state: PermissionState = 'prompt') {
    const clock = new TestClock(klMillis(6, 12))
    const browser = new FakeBrowser(clock, state)
    browser.user = user
    const source = await BrowserLocationSource.create(browser.env())
    const answer = await source.requestPermission()
    return { answer, source, browser }
  }

  it('LOCATION-15 关掉第一次的询问（权限还是 prompt）不算永久拒绝，还可以再问', async () => {
    const { answer, source } = await ask('dismiss')
    expect(answer).toMatchObject({ granted: false, permanentlyDenied: false, interrupted: false })
    expect(source.permanentlyDenied()).toBe(false)
    expect(source.permissionState()).toBe('prompt')
  })

  it('LOCATION-16 被打断的请求（询问被收起来、没有回答）永远不算拒绝', async () => {
    const { answer, source } = await ask('ignore')
    expect(answer).toMatchObject({ granted: false, permanentlyDenied: false, interrupted: true })
    expect(source.permanentlyDenied()).toBe(false)
    // 就算浏览器同时说挡住了，被打断的回答在状态层也不算永久。
    const h = new Harness()
    h.location.level = 'NONE'
    const store = h.store()
    store.onPermissionResult({ granted: false, permanentlyDenied: true, interrupted: true, fix: null })
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: false })
  })

  it('LOCATION-17 第一次明确拒绝（Safari：这次不允许，下次还会问）：还能再问，但记为没有权限', async () => {
    const { answer, source } = await ask('safari-deny')
    expect(answer).toMatchObject({ granted: false, permanentlyDenied: false, interrupted: false })
    expect(source.permanentlyDenied()).toBe(false)
    const h = new Harness()
    h.location.level = 'NONE'
    h.location.answer = 'dismiss'
    const store = h.store()
    expect(store.requestSearch(CHINESE_RICE)).toBe('EXPLAINING')
    await store.acceptLocationExplanation()
    await flush()
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: false })
    expect(store.requestSearch(CHINESE_RICE)).toBe('EXPLAINING')
  })

  it('LOCATION-18 按了「封锁」（权限变成 denied）= 永久；只是关掉询问还能问', async () => {
    const blocked = await ask('block')
    expect(blocked.answer).toMatchObject({ granted: false, permanentlyDenied: true, interrupted: false })
    expect(blocked.source.permanentlyDenied()).toBe(true)
    const dismissed = await ask('dismiss')
    expect(dismissed.answer.permanentlyDenied).toBe(false)
  })

  it('LOCATION-19 早就被挡住了：浏览器不问、直接说不 = 永久；不再显示说明、按钮改成「怎么打开？」', async () => {
    const { answer, browser } = await ask('allow', 'denied')
    expect(answer).toMatchObject({ granted: false, permanentlyDenied: true })
    expect(browser.status.state).toBe('denied')
    const h = new Harness()
    h.location.level = 'NONE'
    h.location.blocked = true
    const store = h.store()
    expect(store.home.explainLocation).toBe(false)
    expect(store.home.location).toEqual({ kind: 'PERMISSION_DENIED', permanently: true })
    expect(store.askForLocation()).toBe('BLOCKED')
    expect(store.requestSearch(CHINESE_RICE)).toBe('SEARCHING')
    await flush()
    expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'PERMISSION_NEEDED', permanently: true } })
    expect(h.searcher.calls).toBe(0)
  })

  it('LOCATION-20 允许了就不是拒绝，而且马上带着位置', async () => {
    const { answer, source } = await ask('allow')
    expect(answer.granted).toBe(true)
    expect(answer.permanentlyDenied).toBe(false)
    expect(answer.fix?.latLng).toEqual({ latitude: 3.144, longitude: 101.6979 })
    expect(source.permissionLevel()).toBe('PRECISE')
  })
})

describe('网页版另外要加的：定位', () => {
  it('WEB-16 Permissions API：granted 一打开就定位；prompt 先显示中文说明，按「好，去允许」才定位；denied 卡片写浏览器挡住了 +「怎么打开？」；不支持 query 当 prompt；之后变 granted 自动继续那次搜索', async () => {
    // granted：一打开就定位一次。
    const h1 = new Harness({ places: [testPlace('a'), testPlace('b'), testPlace('c')] })
    const granted = new FakeBrowser(h1.clock, 'granted')
    h1.locationSource = await BrowserLocationSource.create(granted.env())
    const s1 = h1.store()
    await flush()
    expect(granted.calls).toBe(1)
    expect(s1.home.location).toEqual({ kind: 'READY', approximate: false })
    expect(s1.home.explainLocation).toBe(false)
    expect(plain(locationStatusLine(s1.home.location) ?? '')).toBe('📍 已取得你的位置')

    // prompt：先显示说明，没按「好，去允许」之前一次都不定位。
    const h2 = new Harness({ places: [testPlace('a'), testPlace('b'), testPlace('c')] })
    const prompt = new FakeBrowser(h2.clock, 'prompt')
    h2.locationSource = await BrowserLocationSource.create(prompt.env())
    const s2 = h2.store()
    await flush()
    expect(s2.home.explainLocation).toBe(true)
    expect(locationCard(s2.home.location)?.action).toBe('ASK')
    s2.declineLocationExplanation()
    expect(s2.requestSearch(CHINESE_RICE)).toBe('EXPLAINING')
    await flush()
    expect(prompt.calls).toBe(0)
    expect(h2.searcher.calls).toBe(0)
    await s2.acceptLocationExplanation()
    await flush()
    expect(prompt.calls).toBeGreaterThanOrEqual(1)
    expect(s2.ui.kind).toBe('RESULTS')
    expect(h2.searcher.calls).toBe(1)

    // denied：首页卡片写浏览器挡住了、按钮是「怎么打开？」，不显示说明。
    const h3 = new Harness()
    const denied = new FakeBrowser(h3.clock, 'denied')
    h3.locationSource = await BrowserLocationSource.create(denied.env())
    const s3 = h3.store()
    expect(s3.home.explainLocation).toBe(false)
    const card = locationCard(s3.home.location)
    expect(card?.action).toBe('HOW_TO')
    expect(card?.text).toContain('浏览器挡住了')
    expect(card?.button).toBe('怎么打开？')

    // 不支持 permissions.query（旧 Safari）：当作 prompt。
    const h4 = new Harness()
    const oldSafari = new FakeBrowser(h4.clock, 'prompt')
    oldSafari.supportsQuery = false
    const source4 = await BrowserLocationSource.create(oldSafari.env())
    expect(source4.permissionState()).toBe('prompt')
    expect(source4.permanentlyDenied()).toBe(false)

    // 挡住了去搜索 → 错误页；在浏览器设置改成允许（change 事件）→ 自动继续那次搜索。
    h3.searcher.places = [testPlace('a'), testPlace('b'), testPlace('c')]
    s3.requestSearch(CHINESE_RICE)
    await flush()
    expect(s3.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'PERMISSION_NEEDED', permanently: true } })
    denied.status.change('granted')
    await flush()
    expect(s3.ui.kind).toBe('RESULTS')
    expect(h3.searcher.choices).toEqual([CHINESE_RICE])

    // 没有 change 事件的浏览器：回到页面（resume）时再查一次也会继续。
    const h5 = new Harness({ places: [testPlace('a'), testPlace('b'), testPlace('c')] })
    const quiet = new FakeBrowser(h5.clock, 'denied')
    h5.locationSource = await BrowserLocationSource.create(quiet.env())
    const s5 = h5.store()
    s5.requestSearch(CHINESE_RICE)
    await flush()
    expect(s5.ui.kind).toBe('ERROR')
    quiet.status.state = 'granted' // 不发事件
    await s5.resume()
    await flush()
    expect(s5.ui.kind).toBe('RESULTS')
  })

  it('WEB-17 getCurrentPosition 用 enableHighAccuracy: true、timeout 10000、maximumAge 30000；位置新旧用单调时钟，调手机时钟不影响；缓存位置按它的年龄往前算；准确度很差当「大概位置」', async () => {
    expect(GEO_OPTIONS).toEqual({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
    const h = new Harness({ places: [testPlace('a'), testPlace('b'), testPlace('c')] })
    const browser = new FakeBrowser(h.clock, 'granted')
    browser.cachedAgeMs = 20_000
    const source = await BrowserLocationSource.create(browser.env())
    const result = await source.currentLocation()
    expect(browser.options[0]).toEqual({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
    expect(result.kind === 'SUCCESS' && result.fix.elapsedMillis).toBe(h.clock.elapsedMillis - 20_000)
    expect(result.kind === 'SUCCESS' && result.fix.approximate).toBe(false)

    // 模糊定位（iPhone 关掉精确位置）：几公里的准确度 → 大概位置。
    browser.accuracy = 3000
    const rough = await source.currentLocation()
    expect(rough.kind === 'SUCCESS' && rough.fix.approximate).toBe(true)
    browser.accuracy = 25
    browser.cachedAgeMs = 0

    // 状态层：2 分钟内直接用；手机时钟调回 1 小时、实际过了 3 分钟 → 算旧了、重新定位。
    h.locationSource = source
    const store = h.store()
    await flush()
    const before = browser.calls
    store.search(CHINESE_RICE)
    await flush()
    expect(browser.calls).toBe(before) // 刚刚定位过，直接用
    h.clock.nowMillis -= 60 * MINUTE
    h.clock.elapsedMillis += 3 * MINUTE
    store.backToHome()
    store.search({ cuisine: 'JAPANESE', meal: 'RICE' })
    await flush()
    expect(browser.calls).toBe(before + 1)

    // 允许了但拿不到位置（超时）：算允许，之后再定位；拿不到就是「暂时拿不到你的位置」。
    const h2 = new Harness()
    const indoor = new FakeBrowser(h2.clock, 'prompt')
    indoor.failWith = 3
    const s2 = await BrowserLocationSource.create(indoor.env())
    const answer = await s2.requestPermission()
    expect(answer).toMatchObject({ granted: true, permanentlyDenied: false, fix: null })
    expect(await s2.currentLocation()).toEqual({ kind: 'UNAVAILABLE' })
    expect(locationCard({ kind: 'UNAVAILABLE' })).toMatchObject({ action: 'RETRY', button: '重试' })
  })
})
