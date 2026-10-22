/**
 * 注册离线缓存（service worker）。
 * - 只在打包好的版本里注册（npm run dev 时不注册，免得改了代码看不到）；
 * - 用相对路径 ./sw.js，放在 GitHub Pages 的子路径下（/<仓库名>/sw.js）也能用；
 * - 等页面加载完再注册，不跟首屏抢网速。
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  const register = () => {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch((error: unknown) => {
      // 注册失败只是不能离线用，网页照样能用。
      console.warn('离线缓存没有开成功：', error)
    })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
