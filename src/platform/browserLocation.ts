/**
 * 浏览器的定位（安卓 data/LocationProvider.kt 的网页版）：navigator.geolocation + Permissions API。
 *
 * - 权限状态先用 navigator.permissions.query({name:'geolocation'}) 查好、记着（状态层要同步读）；
 *   granted → 有权限；prompt → 还没问（先显示自己的中文说明，按「好，去允许」才让浏览器问）；
 *   denied → 浏览器挡住了（不会再问）；不支持 permissions.query（旧 Safari）当 prompt。
 * - 定位：enableHighAccuracy、最多等 10 秒、接受 30 秒内的缓存位置。
 * - 位置的「拿到时刻」用 performance.now()（单调时钟，调手机时间不影响）。
 * - 只能在安全的网址（HTTPS 或 localhost）用；局域网 http 打开时浏览器会直接说不行（当作拿不到位置）。
 */
import { LOCATION } from '../data/constants.ts'
import type { LocationFix, LocationResult, LocationSource, PermissionAnswer, PermissionLevel } from '../services/location.ts'

export type BrowserPermissionState = 'granted' | 'prompt' | 'denied' | 'unknown'

/** 模糊定位（iPhone 关掉「精确位置」时）的准确度通常是几公里：超过这个当作「大概位置」。 */
export const APPROXIMATE_ACCURACY_METERS = 1500

const PERMISSION_DENIED = 1

export interface BrowserLocationEnv {
  geolocation?: Geolocation | null
  permissions?: Pick<Permissions, 'query'> | null
  /** 单调时钟（毫秒）。 */
  elapsed?: () => number
  /** 墙上时钟（只用来算缓存位置有多旧）。 */
  now?: () => number
}

export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: LOCATION.TIMEOUT_MS,
  maximumAge: LOCATION.MAX_CACHED_AGE_MS,
}

export class BrowserLocationSource implements LocationSource {
  private readonly geolocation: Geolocation | null
  private readonly permissions: Pick<Permissions, 'query'> | null
  private readonly elapsedFn: () => number
  private readonly nowFn: () => number
  private state: BrowserPermissionState = 'unknown'
  private status: PermissionStatus | null = null
  private readonly listeners = new Set<() => void>()

  constructor(env: BrowserLocationEnv = {}) {
    const nav = typeof navigator === 'undefined' ? undefined : navigator
    this.geolocation = env.geolocation === undefined ? (nav?.geolocation ?? null) : env.geolocation
    this.permissions = env.permissions === undefined ? (nav?.permissions ?? null) : env.permissions
    this.elapsedFn = env.elapsed ?? (() => performance.now())
    this.nowFn = env.now ?? (() => Date.now())
  }

  /** 先查好权限再给状态层用。 */
  static async create(env: BrowserLocationEnv = {}): Promise<BrowserLocationSource> {
    const source = new BrowserLocationSource(env)
    await source.refreshPermission()
    return source
  }

  /** 现在记着的权限状态。 */
  permissionState(): BrowserPermissionState {
    return this.state
  }

  permissionLevel(): PermissionLevel {
    return this.state === 'granted' ? 'PRECISE' : 'NONE'
  }

  permanentlyDenied(): boolean {
    return this.state === 'denied'
  }

  /** 浏览器分不出「定位服务没开」：永远 true（错误会变成「拿不到你的位置」）。 */
  locationServicesEnabled(): boolean {
    return true
  }

  async refreshPermission(): Promise<void> {
    if (!this.geolocation) {
      this.setState('denied')
      return
    }
    if (!this.permissions) {
      // 旧 Safari：不知道；先当「还没问」（拿到过位置的话保持 granted）。
      if (this.state !== 'granted') this.setState('prompt')
      return
    }
    try {
      const status = await this.permissions.query({ name: 'geolocation' as PermissionName })
      this.watch(status)
      this.setState(status.state)
    } catch {
      if (this.state !== 'granted') this.setState('prompt')
    }
  }

  onPermissionChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private watch(status: PermissionStatus): void {
    if (this.status === status) return
    this.status = status
    try {
      status.addEventListener('change', () => this.setState(status.state))
    } catch {
      // 有的浏览器不给 change 事件：回到页面时会再查
    }
  }

  private setState(next: BrowserPermissionState): void {
    if (next === this.state) return
    this.state = next
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        // 不影响别人
      }
    }
  }

  private toFix(position: GeolocationPosition): LocationFix {
    const cachedAge = Math.min(Math.max(this.nowFn() - position.timestamp, 0), LOCATION.MAX_CACHED_AGE_MS)
    return {
      latLng: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      elapsedMillis: this.elapsedFn() - cachedAge,
      approximate: Number.isFinite(position.coords.accuracy) && position.coords.accuracy > APPROXIMATE_ACCURACY_METERS,
    }
  }

  private locate(): Promise<{ position: GeolocationPosition | null; error: GeolocationPositionError | null }> {
    const geolocation = this.geolocation
    if (!geolocation) return Promise.resolve({ position: null, error: null })
    return new Promise((resolve) => {
      let done = false
      // 浏览器偶尔既不成功也不失败：最多多等 1 秒。
      const guard = setTimeout(() => {
        if (!done) {
          done = true
          resolve({ position: null, error: null })
        }
      }, LOCATION.TIMEOUT_MS + 1000)
      try {
        geolocation.getCurrentPosition(
          (position) => {
            if (done) return
            done = true
            clearTimeout(guard)
            resolve({ position, error: null })
          },
          (error) => {
            if (done) return
            done = true
            clearTimeout(guard)
            resolve({ position: null, error })
          },
          GEO_OPTIONS,
        )
      } catch {
        done = true
        clearTimeout(guard)
        resolve({ position: null, error: null })
      }
    })
  }

  async currentLocation(): Promise<LocationResult> {
    if (this.permissionLevel() === 'NONE') return { kind: 'NO_PERMISSION' }
    const { position, error } = await this.locate()
    if (position) return { kind: 'SUCCESS', fix: this.toFix(position) }
    if (error?.code === PERMISSION_DENIED) {
      await this.refreshPermission()
      if (this.state === 'granted') this.setState('prompt')
      return { kind: 'NO_PERMISSION' }
    }
    return { kind: 'UNAVAILABLE' }
  }

  async requestPermission(): Promise<PermissionAnswer> {
    const { position, error } = await this.locate()
    if (position) {
      this.setState('granted')
      return { granted: true, permanentlyDenied: false, interrupted: false, fix: this.toFix(position) }
    }
    await this.refreshPermission()
    if (error?.code === PERMISSION_DENIED) {
      if (this.state === 'granted') this.setState('prompt')
      return { granted: false, permanentlyDenied: this.state === 'denied', interrupted: false, fix: null }
    }
    // 允许了但暂时拿不到位置（室内、信号不好；超时只会在允许以后才开始算）：算允许，之后会再定位。
    if (this.state === 'granted' || error != null) {
      this.setState('granted')
      return { granted: true, permanentlyDenied: false, interrupted: false, fix: null }
    }
    return { granted: false, permanentlyDenied: this.state === 'denied', interrupted: true, fix: null }
  }
}

/**
 * 这个网页能不能定位（和权限无关）：不是 https 打开的 → 'INSECURE'（浏览器一律不给位置）；
 * 浏览器没有 navigator.geolocation → 'UNSUPPORTED'；否则 'OK'。
 */
export function locationEnvironment(
  win: { isSecureContext?: boolean; navigator?: { geolocation?: unknown } } | null = typeof window === 'undefined' ? null : window,
): 'OK' | 'INSECURE' | 'UNSUPPORTED' {
  if (!win) return 'OK'
  if (win.isSecureContext === false) return 'INSECURE'
  if (!win.navigator?.geolocation) return 'UNSUPPORTED'
  return 'OK'
}
