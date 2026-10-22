/**
 * 手机能力的小封装（安卓 ui/Intents.kt、ShakeListener.kt、HapticFeedback 的网页版）：分享、复制、开地图、震动、摇一摇。
 * 都要在用户点按的处理函数里直接调用（前面不要先 await 网络请求，浏览器的「用户刚点过」会过期）。
 * 不支持的功能安静地退回去，网页不会报错。
 */
import { ShakeDetector, spinMillisFor } from '../domain/shake.ts'

// ------------------------------------------------------------------ 分享

export type ShareResult =
  /** 系统分享面板开了（或用户自己取消了，也算，不提示）。 */
  | 'SHARED'
  /** 没有分享面板 / 失败：已经复制到剪贴板（提示「已经复制好了，去 WhatsApp 群里粘贴就可以 📋」）。 */
  | 'COPIED'
  /** 复制也不行：画面显示文字让人长按复制（「复制不了，请长按下面的文字自己复制」）。 */
  | 'MANUAL'

export interface ShareEnv {
  share?: ((data: ShareData) => Promise<void>) | null
  writeText?: ((text: string) => Promise<void>) | null
  /** 旧方法：textarea + document.execCommand('copy')。 */
  legacyCopy?: ((text: string) => boolean) | null
}

function defaultLegacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

function defaultShareEnv(): ShareEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return {
    share: typeof nav?.share === 'function' ? (data) => nav.share(data) : null,
    writeText: typeof nav?.clipboard?.writeText === 'function' ? (text) => nav.clipboard.writeText(text) : null,
    legacyCopy: defaultLegacyCopy,
  }
}

/**
 * 分享纯文字：有 navigator.share 只传 text；用户自己取消（AbortError）不算失败；
 * 不支持或失败 → 复制到剪贴板；复制也不行 → 'MANUAL'。
 */
export async function shareText(text: string, env: ShareEnv = defaultShareEnv()): Promise<ShareResult> {
  if (env.share) {
    try {
      await env.share({ text })
      return 'SHARED'
    } catch (e) {
      // 用户自己按了取消。只看名字：有的浏览器丢出来的 DOMException 不算 Error 的实例。
      if ((e as { name?: unknown } | null)?.name === 'AbortError') return 'SHARED'
    }
  }
  return copyText(text, env)
}

/** 复制到剪贴板：clipboard.writeText → 旧方法 → 'MANUAL'。 */
export async function copyText(text: string, env: ShareEnv = defaultShareEnv()): Promise<ShareResult> {
  if (env.writeText) {
    try {
      await env.writeText(text)
      return 'COPIED'
    } catch {
      // 退回旧方法
    }
  }
  try {
    if (env.legacyCopy?.(text)) return 'COPIED'
  } catch {
    // 算了
  }
  return 'MANUAL'
}

/**
 * 没有系统分享面板（大部分电脑浏览器）时，复制好以后再给一个「用 WhatsApp 发」：WhatsApp 的普通分享网址，
 * 打开后自己选要发给谁（手机会交给 WhatsApp App，电脑会开 WhatsApp 网页版）。不带任何密钥、不发 Google 请求。
 */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

// ------------------------------------------------------------------ 地图

/**
 * 用新分页打开 Google 地图的普通网址（手机会自己交给地图 App）。不带 API 密钥、不算用量。
 * 被浏览器挡住（回传 null）→ false（底栏提示「打不开地图，请看看浏览器有没有挡住新窗口」）。
 */
export function openExternal(url: string, open: ((url: string, target: string, features: string) => unknown) | null = typeof window === 'undefined' ? null : window.open.bind(window)): boolean {
  if (!open) return false
  try {
    open(url, '_blank', 'noopener')
    // noopener 时浏览器一律回传 null，分不出有没有被挡：当作打开了。
    return true
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ 震动

export type Haptic = 'heavy' | 'light'

/** 「重」≈ 35 毫秒、「轻」≈ 10 毫秒；没有 navigator.vibrate（iPhone）就什么都不做。 */
export function vibrate(kind: Haptic, nav: Pick<Navigator, 'vibrate'> | null = typeof navigator === 'undefined' ? null : navigator): boolean {
  try {
    if (!nav || typeof nav.vibrate !== 'function') return false
    return nav.vibrate(kind === 'heavy' ? 35 : 10)
  } catch {
    return false
  }
}

/** 震两下（划刀的最后一刀：间隔 180 毫秒）。 */
export function vibrateTwice(nav: Pick<Navigator, 'vibrate'> | null = typeof navigator === 'undefined' ? null : navigator): boolean {
  try {
    if (!nav || typeof nav.vibrate !== 'function') return false
    return nav.vibrate([35, 180, 35])
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ 📳 摇一摇

interface MotionEventLike {
  readonly accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null } | null
  readonly timeStamp: number
}

type MotionPermission = 'granted' | 'denied'

interface DeviceMotionCtor {
  requestPermission?: () => Promise<MotionPermission | string>
}

/** 这个浏览器有没有动作感应（没有就不显示「也可以摇一摇手机 📳」）。null = 不在浏览器里。 */
export function supportsShake(win: (Window & typeof globalThis) | null = typeof window === 'undefined' ? null : window): boolean {
  return win != null && 'DeviceMotionEvent' in win
}

/**
 * 「开启摇一摇」（一定要在按钮的 click 里调用）：有 DeviceMotionEvent.requestPermission（iPhone、新版 Chrome）就先问，
 * granted 才算；没有这个函数（旧版 Chrome、安卓）直接算可以。
 */
export async function requestShakePermission(ctor: DeviceMotionCtor | null = typeof DeviceMotionEvent === 'undefined' ? null : (DeviceMotionEvent as unknown as DeviceMotionCtor)): Promise<boolean> {
  if (!ctor) return false
  if (typeof ctor.requestPermission !== 'function') return true
  try {
    return (await ctor.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

/**
 * 听 devicemotion，把含重力的加速度喂给 ShakeDetector；成立一次就回调（力度、卷轴该转多久）。
 * 只在需要的时候接上（首页没有窗口、或随便挑开着、分页看得见），回传拆掉的函数。
 */
export function listenForShake(
  onShake: (strength: number, spinMillis: number) => void,
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> | null = typeof window === 'undefined' ? null : window,
  detector: ShakeDetector = new ShakeDetector(),
): () => void {
  if (!target) return () => undefined
  const handler = (event: Event) => {
    const e = event as unknown as MotionEventLike
    const a = e.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) return
    const strength = detector.onReading(e.timeStamp, a.x, a.y, a.z)
    if (strength != null) onShake(strength, spinMillisFor(strength))
  }
  target.addEventListener('devicemotion', handler)
  return () => target.removeEventListener('devicemotion', handler)
}

// ------------------------------------------------------------------ 回到页面

/**
 * 分页从隐藏变回看得见（visibilitychange）、从上一页回来（pageshow，含 bfcache）= 安卓的 onResume。
 * 回传拆掉的函数。
 */
export function onPageResume(
  callback: () => void,
  doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null = typeof document === 'undefined' ? null : document,
  win: Pick<Window, 'addEventListener' | 'removeEventListener'> | null = typeof window === 'undefined' ? null : window,
): () => void {
  if (!doc || !win) return () => undefined
  const onVisibility = () => {
    if (doc.visibilityState === 'visible') callback()
  }
  const onPageShow = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) callback()
  }
  doc.addEventListener('visibilitychange', onVisibility)
  win.addEventListener('pageshow', onPageShow)
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    win.removeEventListener('pageshow', onPageShow)
  }
}

