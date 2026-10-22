/// <reference lib="webworker" />
import { CACHE_PREFIX, cacheNameFor, classifyRequest, isHashedAsset } from './cache-rules.ts'

// 下面两个值在打包时由 vite-plugins/service-worker.ts 填进来。
declare const __PRECACHE_MANIFEST__: string[]
declare const __SW_VERSION__: string

const sw = self as unknown as ServiceWorkerGlobalScope
const CACHE = cacheNameFor(__SW_VERSION__)
const scope = sw.registration.scope
const shellUrl = new URL('index.html', scope).href

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const requests = __PRECACHE_MANIFEST__.map(
        (path) =>
          // 没带哈希的文件（index.html、图标）一定要拿最新的，别用浏览器的旧副本。
          new Request(new URL(path, scope).href, { cache: isHashedAsset(path) ? 'default' : 'reload' }),
      )
      await cache.addAll(requests)
      await sw.skipWaiting()
    })(),
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE).map((name) => caches.delete(name)),
      )
      await sw.clients.claim()
    })(),
  )
})

sw.addEventListener('fetch', (event) => {
  const request = event.request
  const decision = classifyRequest(request, scope)
  if (decision === 'bypass') return
  event.respondWith(decision === 'shell' ? serveShell(request) : cacheFirst(request))
})

async function serveShell(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE)
  return (await cache.match(shellUrl)) ?? fetch(request)
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && response.type === 'basic') {
    await cache.put(request, response.clone())
  }
  return response
}
