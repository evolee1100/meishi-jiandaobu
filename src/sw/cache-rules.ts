/**
 * 离线缓存的规则（纯函数，单元测试在 cache-rules.test.ts）。
 *
 * 最重要的一条：Google 的接口（搜索、照片）绝对不缓存、也不经过 service worker，
 * 每次都由浏览器直接发出去。这样既不会把用户的密钥存进缓存，
 * 也不会因为缓存出问题而重复请求、多用免费次数。
 * 只有我们自己网站上的静态文件（网页、JS、CSS、图标）才会缓存。
 */

export const CACHE_PREFIX = 'meishi-jiandaobu-'

export function cacheNameFor(version: string): string {
  return `${CACHE_PREFIX}${version}`
}

/**
 * bypass = 不管，交给浏览器自己处理（不缓存）；
 * shell  = 打开网页本身（index.html），先用缓存，打开最快；
 * static = 我们自己的静态文件，先用缓存，没有才上网拿，拿到后存起来。
 */
export type CacheDecision = 'bypass' | 'shell' | 'static'

export interface RequestLike {
  url: string
  method: string
  mode?: string
  headers?: { has(name: string): boolean }
}

/** Google 的网址（接口、照片、地图）。 */
const GOOGLE_HOST =
  /(^|\.)(googleapis\.com|google\.com|google\.com\.my|googleusercontent\.com|gstatic\.com|ggpht\.com|goo\.gl)$/i

export function isGoogleUrl(url: URL): boolean {
  return GOOGLE_HOST.test(url.hostname)
}

export function classifyRequest(request: RequestLike, scopeUrl: string): CacheDecision {
  if (request.method !== 'GET') return 'bypass'

  const url = new URL(request.url)
  const scope = new URL(scopeUrl)

  if (isGoogleUrl(url)) return 'bypass'
  if (url.origin !== scope.origin) return 'bypass'
  if (!url.pathname.startsWith(scope.pathname)) return 'bypass'
  // 网址里带密钥的，不管是谁的，一律不碰。
  if (url.searchParams.has('key')) return 'bypass'
  const headers = request.headers
  if (headers && (headers.has('x-goog-api-key') || headers.has('authorization') || headers.has('range'))) {
    return 'bypass'
  }
  // sw.js 自己由浏览器负责检查更新。
  if (url.pathname.endsWith('/sw.js')) return 'bypass'

  if (request.mode === 'navigate') {
    const rest = url.pathname.slice(scope.pathname.length)
    return rest === '' || rest === 'index.html' ? 'shell' : 'static'
  }
  return 'static'
}

/** 文件名里带内容哈希的（assets/ 下面），内容不会变，可以放心用浏览器的普通缓存。 */
export function isHashedAsset(path: string): boolean {
  return path.startsWith('assets/')
}
