/**
 * 正式网页的组装（createAppStore）：密钥只从这个浏览器的 localStorage 读，每次搜索都重新读；
 * 用量也记在 localStorage；sessionStorage 和网址里都没有密钥。用 jsdom 的 localStorage、假的定位、假的 fetch。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SETTINGS_KEYS } from '../services/settings.ts'
import { billingPeriod } from '../services/usageGuard.ts'
import { flush } from '../test/helpers.ts'
import { mockGoogle, TEST_KEY, type MockServer } from '../test/mockFetch.ts'
import { CHINESE_RICE } from '../test/storeHarness.ts'
import { createAppStore, type AppServices } from './createAppStore.ts'

const PLACES = [1, 2, 3, 4]
  .map(
    (i) =>
      `{"id":"real${i}","displayName":{"text":"真店${i}"},"location":{"latitude":${3.144 + i * 0.001},"longitude":101.6979},"rating":4.${i + 2},"userRatingCount":${100 * i},"types":["chinese_restaurant","restaurant","food"],"primaryType":"chinese_restaurant","photos":[{"name":"places/real${i}/photos/p1"}]}`,
  )
  .join(',')

let server: MockServer
let app: AppServices | null = null

function defineNavigator(name: string, value: unknown): void {
  Object.defineProperty(window.navigator, name, { configurable: true, value })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  server = mockGoogle((r) => (r.url.includes('/media?') ? { body: '{"photoUri":"https://lh3.googleusercontent.com/x"}' } : { body: `{"places":[${PLACES}]}` }))
  vi.stubGlobal('fetch', server.fetch)
  // 已经允许定位的浏览器，人在茨厂街。
  defineNavigator('geolocation', {
    getCurrentPosition(success: PositionCallback) {
      queueMicrotask(() => success({ coords: { latitude: 3.144, longitude: 101.6979, accuracy: 20 }, timestamp: Date.now() } as GeolocationPosition))
    },
  })
  defineNavigator('permissions', { query: async () => ({ state: 'granted', addEventListener() {} }) })
})

afterEach(() => {
  app?.dispose()
  app = null
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window.navigator, 'geolocation')
  Reflect.deleteProperty(window.navigator, 'permissions')
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('网页版另外要加的：密钥只在这个浏览器', () => {
  it('WEB-01 密钥只从 localStorage 读（每次搜索都重新读）：没有就一个请求都不发；贴进设置后清理好存进 localStorage、发出去的请求带的就是它；sessionStorage 和网址里都没有', async () => {
    app = await createAppStore()
    const { store } = app
    await flush()
    expect(store.home.location).toEqual({ kind: 'READY', approximate: false })

    // 还没有密钥：不发。
    store.search(CHINESE_RICE)
    await flush()
    expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'NO_API_KEY' } })
    expect(server.requests).toHaveLength(0)

    // 在设置里贴上（带着聊天软件加的看不见的符号）：清理后存进 localStorage，自动重搜。
    store.saveApiKey(` ${TEST_KEY}​\n`)
    await flush()
    expect(window.localStorage.getItem(SETTINGS_KEYS.apiKey)).toBe(TEST_KEY)
    expect(store.ui.kind).toBe('RESULTS')
    const searches = server.requests.filter((r) => r.method === 'POST')
    expect(searches).toHaveLength(3)
    for (const r of searches) expect(r.headers['X-Goog-Api-Key']).toBe(TEST_KEY)
    for (const r of server.photoRequests()) expect(new URL(r.url).searchParams.get('key')).toBe(TEST_KEY)
    // 用量也记在 localStorage（发之前就记好）。
    expect(window.localStorage.getItem(`meishi.text_search_${billingPeriod(Date.now())}`)).toBe('3')

    // 密钥不在 sessionStorage、不在网页网址里。
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i) ?? ''
      expect(window.sessionStorage.getItem(key) ?? '').not.toContain(TEST_KEY)
    }
    expect(window.location.href).not.toContain(TEST_KEY)

    // localStorage 里的密钥被清掉（例如清除了网站资料）：下一次搜索马上就没有密钥，一个请求都不发。
    window.localStorage.removeItem(SETTINGS_KEYS.apiKey)
    const before = server.requests.length
    store.search({ cuisine: 'JAPANESE', meal: 'NOODLE' })
    await flush()
    expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'NO_API_KEY' } })
    expect(server.requests).toHaveLength(before)
  })

  it('WEB-04 这个浏览器不让网页记东西（localStorage 抛错）：密钥存不进去，真实搜索一个请求都不发；页面不会崩', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    try {
      app = await createAppStore()
      const { store } = app
      await flush()
      expect(store.home.storageBlocked).toBe(true)
      store.saveApiKey(TEST_KEY)
      store.search(CHINESE_RICE)
      await flush()
      expect(store.ui).toMatchObject({ kind: 'ERROR', error: { kind: 'STORAGE_BLOCKED' } })
      expect(server.requests).toHaveLength(0)
    } finally {
      getItem.mockRestore()
      setItem.mockRestore()
    }
  })
})
