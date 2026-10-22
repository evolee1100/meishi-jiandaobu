/**
 * 记在本机的设定（安卓 data/Prefs.kt）：范围、只看营业中、密钥、演示模式。
 * 密钥只存在这个浏览器的 localStorage（用户在设置里粘贴），绝不写进源代码或打包结果，也不放进网址。
 */
import { cleanApiKey } from '../domain/apiKeys.ts'
import { isBlank } from '../domain/chineseText.ts'
import { DEFAULT_KM, snapRadius } from '../domain/radius.ts'
import { KEY_PREFIX, readBoolean, readNumber, type KeyValueStore } from './storage.ts'

/** 网页没有「打包时内置的密钥」，只有用户自己贴的（安卓 ApiKeySource 少了 BUILD_CONFIG）。 */
export type ApiKeySource = 'IN_APP' | 'NONE'

/** 状态层要的设定；测试可以换成假的。 */
export interface SettingsStore {
  radiusKm: number
  /** 存的是清理过的密钥。 */
  apiKeyOverride: string
  demoMode: boolean
  /** 只看营业中：默认开，关掉才记住关。 */
  openNowOnly: boolean
  effectiveApiKey(): string
  apiKeySource(): ApiKeySource
}

export const SETTINGS_KEYS = {
  radiusKm: KEY_PREFIX + 'radius_km',
  openNowOnly: KEY_PREFIX + 'open_now_only',
  apiKey: KEY_PREFIX + 'places_api_key',
  demoMode: KEY_PREFIX + 'demo_mode',
} as const

export class StoredSettings implements SettingsStore {
  private readonly store: KeyValueStore

  constructor(store: KeyValueStore) {
    this.store = store
  }

  get radiusKm(): number {
    return snapRadius(readNumber(this.store, SETTINGS_KEYS.radiusKm, DEFAULT_KM))
  }

  set radiusKm(value: number) {
    this.store.set(SETTINGS_KEYS.radiusKm, String(snapRadius(value)))
  }

  get apiKeyOverride(): string {
    return this.store.get(SETTINGS_KEYS.apiKey) ?? ''
  }

  set apiKeyOverride(value: string) {
    const clean = cleanApiKey(value)
    if (clean) this.store.set(SETTINGS_KEYS.apiKey, clean)
    else this.store.remove(SETTINGS_KEYS.apiKey)
  }

  get demoMode(): boolean {
    return readBoolean(this.store, SETTINGS_KEYS.demoMode, false)
  }

  set demoMode(value: boolean) {
    this.store.set(SETTINGS_KEYS.demoMode, String(value))
  }

  get openNowOnly(): boolean {
    return readBoolean(this.store, SETTINGS_KEYS.openNowOnly, true)
  }

  set openNowOnly(value: boolean) {
    this.store.set(SETTINGS_KEYS.openNowOnly, String(value))
  }

  effectiveApiKey(): string {
    return isBlank(this.apiKeyOverride) ? '' : this.apiKeyOverride
  }

  apiKeySource(): ApiKeySource {
    return isBlank(this.apiKeyOverride) ? 'NONE' : 'IN_APP'
  }
}

/** 测试用：只在内存里的设定（和真的一样：只看营业中默认开）。 */
export class MemorySettings implements SettingsStore {
  radiusKm = DEFAULT_KM
  apiKeyOverride = ''
  demoMode = false
  openNowOnly = true

  constructor(init: Partial<Pick<SettingsStore, 'radiusKm' | 'apiKeyOverride' | 'demoMode' | 'openNowOnly'>> = {}) {
    Object.assign(this, init)
  }

  effectiveApiKey(): string {
    return isBlank(this.apiKeyOverride) ? '' : this.apiKeyOverride
  }

  apiKeySource(): ApiKeySource {
    return isBlank(this.apiKeyOverride) ? 'NONE' : 'IN_APP'
  }
}
