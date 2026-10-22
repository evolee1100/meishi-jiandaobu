/**
 * 第 2 块（搜索、结果页、设置）浏览器测试共用的东西：
 * - stubDeviceApis：不打开真的系统分享面板、不开新分页去 Google 地图（测试连不到外部网站）；
 *   改成记下来，测试可以检查「复制了什么」「打开了哪个网址」。
 * - mockPlacesWithPhotos：模拟的 Google（文字搜索 + 照片网址 + 照片本身），绝不连真的 Google、绝不用真的密钥。
 *   店都是编的（名字、地址都是假的），有中文名、马来文名、英文名。
 */
import type { BrowserContext, Page, Route } from '@playwright/test'

declare global {
  interface Window {
    /** stubDeviceApis：复制到剪贴板的文字。 */
    __copied?: string[]
    /** stubDeviceApis：window.open 打开的网址。 */
    __opened?: string[]
  }
}

/**
 * 没有系统分享面板（像大部分电脑浏览器）→ 网页会改成复制；剪贴板写入成功（记在 window.__copied）；
 * window.open 不真的开分页（记在 window.__opened）。要在 page.goto 之前调用。
 */
export async function stubDeviceApis(page: Page, options: { clipboard?: boolean } = {}): Promise<void> {
  await page.addInitScript((clipboard: boolean) => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true })
    window.__copied = []
    window.__opened = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard
        ? {
            writeText: async (text: string) => {
              window.__copied?.push(text)
            },
          }
        : undefined,
    })
    if (!clipboard) document.execCommand = () => false
    window.open = ((url?: string | URL) => {
      window.__opened?.push(String(url))
      return null
    }) as typeof window.open
  }, options.clipboard ?? true)
}

export async function copiedTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__copied ?? [])
}

export async function openedUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__opened ?? [])
}

// ------------------------------------------------------------------ 模拟的 Google

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST' }

/** 一张假照片（SVG，一碗东西的样子），从「googleusercontent」回来。 */
function fakePhoto(hue: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="hsl(${hue} 70% 82%)"/>
  <circle cx="200" cy="215" r="140" fill="hsl(${hue} 30% 96%)"/>
  <circle cx="200" cy="215" r="105" fill="hsl(${(hue + 30) % 360} 75% 60%)"/>
  <circle cx="165" cy="190" r="26" fill="hsl(${(hue + 90) % 360} 60% 45%)"/>
  <circle cx="235" cy="235" r="30" fill="hsl(${(hue + 200) % 360} 55% 92%)"/>
  <rect x="120" y="60" width="16" height="140" rx="8" fill="hsl(30 40% 35%)" transform="rotate(-18 128 130)"/>
</svg>`
}

interface FakeShop {
  readonly id: string
  readonly name: string
  readonly lang: string
  readonly rating: number
  readonly reviews: number
  readonly dLat: number
  readonly dLng: number
  readonly address: string
  readonly price: readonly [string, string] | null
  /** 当地时间几点开、几点关（每天一样）。 */
  readonly hours: readonly [number, number] | null
  readonly author: string | null
  readonly type: string
}

/** 编出来的店（茨厂街附近）：按关键词分三组（饭 / rice restaurant / nasi）。 */
const SHOPS: readonly (readonly FakeShop[])[] = [
  [
    { id: 'ChIJ-e2e-01', name: '顺记瓦煲鸡饭', lang: 'zh-CN', rating: 4.6, reviews: 1240, dLat: 0.002, dLng: 0.001, address: 'Jalan Hang Lekir, Kuala Lumpur', price: ['8', '15'], hours: [10, 22], author: 'Ah Seng', type: 'chinese_restaurant' },
    { id: 'ChIJ-e2e-02', name: 'Restoran Nasi Kandar Bintang Timur', lang: 'ms', rating: 4.5, reviews: 860, dLat: -0.003, dLng: 0.002, address: 'Jalan Tun H S Lee, Kuala Lumpur', price: ['10', '20'], hours: [0, 24], author: 'Siti', type: 'indian_restaurant' },
    { id: 'ChIJ-e2e-03', name: 'Lucky Chicken Rice & Noodle House', lang: 'en', rating: 4.4, reviews: 530, dLat: 0.004, dLng: -0.003, address: 'Jalan Sultan, Kuala Lumpur', price: ['9', '16'], hours: [9, 20], author: 'Jason L.', type: 'restaurant' },
  ],
  [
    { id: 'ChIJ-e2e-04', name: 'Kedai Makan Ikan Bakar Pak Din', lang: 'ms', rating: 4.3, reviews: 410, dLat: -0.006, dLng: -0.004, address: 'Jalan Petaling, Kuala Lumpur', price: ['15', '35'], hours: [17, 23], author: null, type: 'seafood_restaurant' },
    { id: 'ChIJ-e2e-05', name: '福记海南饭店', lang: 'zh-CN', rating: 4.2, reviews: 300, dLat: 0.007, dLng: 0.004, address: 'Jalan Cheng Lock, Kuala Lumpur', price: null, hours: null, author: 'Mei', type: 'restaurant' },
  ],
  [
    { id: 'ChIJ-e2e-06', name: 'Warung Nasi Lemak Kak Yah', lang: 'ms', rating: 4.4, reviews: 320, dLat: -0.002, dLng: 0.006, address: 'Lorong Bandar 3, Kuala Lumpur', price: ['5', '12'], hours: [6, 14], author: 'Yah', type: 'malaysian_restaurant' },
    { id: 'ChIJ-e2e-07', name: 'Kopitiam Sri Bulan', lang: 'ms', rating: 4.1, reviews: 210, dLat: 0.003, dLng: -0.006, address: 'Jalan Balai Polis, Kuala Lumpur', price: ['6', '12'], hours: [7, 21], author: 'Kumar', type: 'coffee_shop' },
  ],
]

const CENTER = { latitude: 3.144, longitude: 101.6979 }

/** 「不限・饭」的三个关键词（cuisines.ts）。 */
const QUERY_GROUPS = ['饭', 'rice restaurant', 'nasi']

function toGoogle(shop: FakeShop) {
  const periods = shop.hours
    ? shop.hours[1] - shop.hours[0] >= 24
      ? [{ open: { day: 0, hour: 0, minute: 0 } }]
      : [0, 1, 2, 3, 4, 5, 6].map((day) => ({
          open: { day, hour: shop.hours?.[0] ?? 0, minute: 0 },
          close: { day, hour: shop.hours?.[1] ?? 0, minute: 0 },
        }))
    : null
  return {
    id: shop.id,
    displayName: { text: shop.name, languageCode: shop.lang },
    shortFormattedAddress: shop.address,
    formattedAddress: `${shop.address}, 50000 Kuala Lumpur, Malaysia`,
    location: { latitude: CENTER.latitude + shop.dLat, longitude: CENTER.longitude + shop.dLng },
    rating: shop.rating,
    userRatingCount: shop.reviews,
    ...(shop.price ? { priceRange: { startPrice: { currencyCode: 'MYR', units: shop.price[0] }, endPrice: { currencyCode: 'MYR', units: shop.price[1] } } } : {}),
    ...(periods ? { currentOpeningHours: { periods } } : {}),
    businessStatus: 'OPERATIONAL',
    photos: [{ name: `places/${shop.id}/photos/p1`, widthPx: 800, heightPx: 800, authorAttributions: shop.author ? [{ displayName: shop.author }] : [] }],
    googleMapsUri: `https://maps.google.com/?cid=${shop.id.slice(-2)}`,
    primaryType: shop.type,
    types: [shop.type, 'restaurant', 'food', 'point_of_interest'],
  }
}

export interface GoogleMock {
  /** 第二个关键词回 500（「有一部分搜索没成功」）。可以中途改。 */
  failSecondQuery: boolean
  /** 文字搜索请求（POST）有几个。 */
  readonly textSearches: string[]
  /** 照片网址请求（GET media）有几个。 */
  readonly photoRequests: string[]
}

/** 模拟的 Google：三个关键词各回一组店；照片 media 回 photoUri；googleusercontent 回一张假照片。 */
export async function mockPlacesWithPhotos(context: BrowserContext, options: { failSecondQuery?: boolean } = {}): Promise<GoogleMock> {
  const mock: GoogleMock = { failSecondQuery: options.failSecondQuery ?? false, textSearches: [], photoRequests: [] }
  let queryIndex = 0
  await context.route('https://places.googleapis.com/**', async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS })
      return
    }
    const url = new URL(request.url())
    if (request.method() === 'POST' && url.pathname.endsWith(':searchText')) {
      const body = request.postData() ?? ''
      mock.textSearches.push(body)
      // 按关键词分组（三个请求同时发，到达的先后不一定）：第一个词、第二个词、第三个词
      const query = (JSON.parse(body) as { textQuery?: string }).textQuery ?? ''
      const known = QUERY_GROUPS.indexOf(query)
      const index = known >= 0 ? known : queryIndex++ % 3
      if (index === 1 && mock.failSecondQuery) {
        await route.fulfill({ status: 500, headers: CORS, contentType: 'application/json', body: JSON.stringify({ error: { code: 500, message: 'Internal error', status: 'INTERNAL' } }) })
        return
      }
      await route.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ places: (SHOPS[index] ?? []).map(toGoogle) }) })
      return
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/media')) {
      mock.photoRequests.push(request.url())
      const id = url.pathname.split('/')[3] ?? 'x'
      await route.fulfill({
        status: 200,
        headers: CORS,
        contentType: 'application/json',
        body: JSON.stringify({ name: url.pathname.slice(4), photoUri: `https://lh3.googleusercontent.com/e2e/${id}.svg` }),
      })
      return
    }
    await route.fulfill({ status: 404, headers: CORS, body: '' })
  })
  await context.route('https://lh3.googleusercontent.com/**', async (route) => {
    const id = route.request().url().match(/(\d+)\.svg$/)?.[1] ?? '1'
    await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: fakePhoto((Number(id) * 47) % 360) })
  })
  return mock
}
