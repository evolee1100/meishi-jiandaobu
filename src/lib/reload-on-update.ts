/**
 * 发布新版以后，还开着的旧页面如果要按需加载旧版的文件（assets/xxx.js），
 * GitHub Pages 和离线缓存里都已经换成新版，旧文件找不到，画面就会出错。
 * 这时自动重新打开一次网页，直接换成新版。
 * 一分钟内最多重新打开一次（记在 sessionStorage），没网或者真的坏了也不会一直刷新。
 */

const STORAGE_KEY = 'meishi:reloaded-for-update-at'
const MIN_INTERVAL_MS = 60_000

/** 只用到 window 的这几样东西，方便单元测试。 */
export interface ReloadTarget {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void
  sessionStorage: Pick<Storage, 'getItem' | 'setItem'>
  location: Pick<Location, 'reload'>
}

export function reloadOnStaleAssets(target: ReloadTarget = window, now: () => number = Date.now): void {
  target.addEventListener('vite:preloadError', (event) => {
    let last = 0
    try {
      last = Number(target.sessionStorage.getItem(STORAGE_KEY) ?? 0)
      // 先记下来再刷新：万一刷新后还是加载失败，下一次就不会再刷新。
      if (now() - last < MIN_INTERVAL_MS) return
      target.sessionStorage.setItem(STORAGE_KEY, String(now()))
    } catch {
      // 浏览器不让用 sessionStorage（例如无痕模式的某些设置）：没办法防止一直刷新，就不刷新了。
      return
    }
    // 不让错误继续往外抛，直接换成新版。
    event.preventDefault()
    target.location.reload()
  })
}
