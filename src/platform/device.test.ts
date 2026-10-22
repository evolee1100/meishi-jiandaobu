/**
 * 手机能力的网页版（安卓 Intents.kt、ShakeListener.kt、HapticFeedback）：分享、复制、开地图、震动、摇一摇、回到页面。
 * 都换成假的浏览器功能来测；不支持的功能安静地退回去，网页不报错。
 */
import { describe, expect, it, vi } from 'vitest'
import { WEB_TEXTS } from '../data/webText.ts'
import { directionsUrl, placePageUrl, shareUrl } from '../domain/mapsLinks.ts'
import { ShakeDetector } from '../domain/shake.ts'
import { testPlace } from '../test/helpers.ts'
import { copyText, listenForShake, onPageResume, openExternal, requestShakePermission, shareText, supportsShake, vibrate, vibrateTwice } from './device.ts'

describe('网页版另外要加的：分享、地图、摇一摇、震动、回到页面', () => {
  it('WEB-19 有 navigator.share 时只传 text（纯文字）；没有或失败（不是用户自己取消）时复制到剪贴板（提示 web_share_copied）；复制也不行就显示文字让人长按复制', async () => {
    const shared: ShareData[] = []
    const copied: string[] = []
    const share = async (data: ShareData) => {
      shared.push(data)
    }
    const writeText = async (text: string) => {
      copied.push(text)
    }
    expect(await shareText('今晚吃哪家？', { share, writeText, legacyCopy: null })).toBe('SHARED')
    expect(shared).toEqual([{ text: '今晚吃哪家？' }]) // 只有 text，没有 title / url
    expect(copied).toEqual([])

    // 用户自己在分享面板按了取消：不算失败，不复制、不提示。
    const cancelled = async () => {
      throw new DOMException('cancelled', 'AbortError')
    }
    expect(await shareText('A', { share: cancelled, writeText, legacyCopy: null })).toBe('SHARED')
    expect(copied).toEqual([])

    // 分享失败（不是取消）、或者根本没有分享面板：复制。
    const broken = async () => {
      throw new DOMException('no gesture', 'NotAllowedError')
    }
    expect(await shareText('B', { share: broken, writeText, legacyCopy: null })).toBe('COPIED')
    expect(await shareText('C', { share: null, writeText, legacyCopy: null })).toBe('COPIED')
    expect(copied).toEqual(['B', 'C'])
    expect(WEB_TEXTS.web_share_copied).toBe('已经复制好了，去 WhatsApp 群里粘贴就可以 📋')

    // 剪贴板不行：旧方法；旧方法也不行：让人长按复制。
    const noClipboard = async () => {
      throw new Error('denied')
    }
    const legacy = vi.fn(() => true)
    expect(await copyText('D', { share: null, writeText: noClipboard, legacyCopy: legacy })).toBe('COPIED')
    expect(legacy).toHaveBeenCalledWith('D')
    expect(await shareText('E', { share: null, writeText: null, legacyCopy: () => false })).toBe('MANUAL')
    expect(await shareText('F', { share: null, writeText: null, legacyCopy: () => { throw new Error('x') } })).toBe('MANUAL')
    expect(WEB_TEXTS.web_share_copy_failed).toBe('复制不了，请长按下面的文字自己复制')
  })

  it('WEB-20 导航和店家页面用新分页打开 Google 地图的普通网址（noopener），网址里没有 API 密钥、不算用量', () => {
    const calls: [string, string, string][] = []
    const open = (url: string, target: string, features: string) => {
      calls.push([url, target, features])
      return null // noopener 时浏览器一律回 null
    }
    const place = { ...testPlace('ChIJabc'), googleMapsUri: 'https://maps.google.com/?cid=123' }
    for (const url of [directionsUrl(place), placePageUrl(place) ?? '', shareUrl(place)]) {
      expect(url).toMatch(/^https:\/\/(www\.)?(google\.com\/maps|maps\.google\.com)\//)
      expect(url).not.toContain('key=')
      expect(url).not.toContain('places.googleapis.com')
      expect(openExternal(url, open)).toBe(true)
    }
    expect(calls.every(([, target, features]) => target === '_blank' && features === 'noopener')).toBe(true)
    // 被挡住（浏览器抛错）或者根本不能开新窗口：回 false，底栏提示 maps_open_failed。
    expect(openExternal('https://www.google.com/maps', () => { throw new Error('blocked') })).toBe(false)
    expect(openExternal('https://www.google.com/maps', null)).toBe(false)
  })

  it('WEB-21 摇一摇用 devicemotion 的 accelerationIncludingGravity 喂给检测器；iPhone 要在按钮点击里调用 DeviceMotionEvent.requestPermission()；不支持就不显示提示', async () => {
    // 假的 window：只记 devicemotion 的监听。
    const listeners = new Set<(e: Event) => void>()
    const target = {
      addEventListener: (type: string, fn: (e: Event) => void) => {
        if (type === 'devicemotion') listeners.add(fn)
      },
      removeEventListener: (type: string, fn: (e: Event) => void) => {
        if (type === 'devicemotion') listeners.delete(fn)
      },
    } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>
    const G = Math.fround(9.81)
    const shakes: [number, number][] = []
    const stop = listenForShake((strength, spin) => shakes.push([strength, spin]), target, new ShakeDetector())
    expect(listeners.size).toBe(1)
    let t = 0
    const send = (x: number | null, y: number | null, z: number | null) => {
      for (const fn of listeners) fn({ accelerationIncludingGravity: { x, y, z }, timeStamp: (t += 20) } as unknown as Event)
    }
    for (let i = 0; i < 25; i++) send(0, G, 0) // 放着不动
    send(null, null, null) // 有的读数是空的：不理
    for (const x of [30, -30, 30]) for (let i = 0; i < 6; i++) send(x, G, 0) // 用力来回甩两下
    for (let i = 0; i < 6; i++) send(0, G, 0)
    expect(shakes).toHaveLength(1)
    expect(shakes[0]?.[0]).toBeGreaterThanOrEqual(14)
    expect(shakes[0]?.[1]).toBeGreaterThanOrEqual(1100)
    expect(shakes[0]?.[1]).toBeLessThanOrEqual(2000)
    stop()
    expect(listeners.size).toBe(0) // 不需要时就不听

    // 权限：没有这个功能 → 不能用；没有 requestPermission（旧版 Chrome、安卓）→ 直接可以；iPhone 要问。
    expect(await requestShakePermission(null)).toBe(false)
    expect(await requestShakePermission({})).toBe(true)
    expect(await requestShakePermission({ requestPermission: async () => 'granted' })).toBe(true)
    expect(await requestShakePermission({ requestPermission: async () => 'denied' })).toBe(false)
    expect(await requestShakePermission({ requestPermission: async () => { throw new DOMException('no gesture', 'NotAllowedError') } })).toBe(false)

    // 没有动作感应（电脑）：不显示「也可以摇一摇手机 📳」。
    expect(supportsShake({ DeviceMotionEvent: function DeviceMotionEvent() {} } as unknown as Window & typeof globalThis)).toBe(true)
    expect(supportsShake({} as Window & typeof globalThis)).toBe(false)
    expect(supportsShake(null)).toBe(false)
  })

  it('WEB-25 navigator.vibrate 不存在（iPhone）时不报错；有的话按安卓的时机轻震（10 毫秒）、重震（35 毫秒）、最后一刀震两下', () => {
    expect(vibrate('heavy', null)).toBe(false)
    expect(vibrate('light', {} as Navigator)).toBe(false)
    expect(vibrateTwice({} as Navigator)).toBe(false)
    const patterns: (number | number[])[] = []
    const nav = {
      vibrate: (pattern: number | number[]) => {
        patterns.push(pattern)
        return true
      },
    } as unknown as Navigator
    expect(vibrate('light', nav)).toBe(true)
    expect(vibrate('heavy', nav)).toBe(true)
    expect(vibrateTwice(nav)).toBe(true)
    expect(patterns).toEqual([10, 35, [35, 180, 35]])
    // 浏览器自己抛错（例如还没点过页面）：安静地算了。
    const angry = { vibrate: () => { throw new Error('no user activation') } } as unknown as Navigator
    expect(vibrate('heavy', angry)).toBe(false)
  })

  it('WEB-14 分页从隐藏变回看得见（visibilitychange）、从上一页回来（pageshow，含 bfcache）= 安卓 onResume；隐藏时不叫；拆掉以后都不叫', () => {
    let visibility: DocumentVisibilityState = 'hidden'
    const docListeners = new Map<string, () => void>()
    const winListeners = new Map<string, (e: Event) => void>()
    const doc = {
      get visibilityState() {
        return visibility
      },
      addEventListener: (type: string, fn: () => void) => docListeners.set(type, fn),
      removeEventListener: (type: string) => docListeners.delete(type),
    } as unknown as Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>
    const win = {
      addEventListener: (type: string, fn: (e: Event) => void) => winListeners.set(type, fn),
      removeEventListener: (type: string) => winListeners.delete(type),
    } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>
    let resumed = 0
    const stop = onPageResume(() => resumed++, doc, win)
    docListeners.get('visibilitychange')?.() // 变成隐藏：不叫
    expect(resumed).toBe(0)
    visibility = 'visible'
    docListeners.get('visibilitychange')?.()
    expect(resumed).toBe(1)
    winListeners.get('pageshow')?.({ persisted: true } as unknown as Event) // 从 bfcache 回来
    expect(resumed).toBe(2)
    winListeners.get('pageshow')?.({ persisted: false } as unknown as Event) // 第一次载入：不算回来
    expect(resumed).toBe(2)
    stop()
    expect(docListeners.size).toBe(0)
    expect(winListeners.size).toBe(0)
  })
})
