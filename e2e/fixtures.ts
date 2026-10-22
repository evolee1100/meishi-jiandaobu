/**
 * 浏览器测试的公共工具。测试文件请从这里 import { test, expect }，不要直接用 @playwright/test：
 * - 自动挡掉所有连到外部网站的请求（尤其是真的 Google 接口）。要测 Google 接口就用 mockGoogleApi() 模拟；
 * - 自动收集网页上的错误，测试结束时有错误就算失败；
 * - 截图、固定时间、放大字体、检查横向滚动等小工具。
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { test as base, expect, type BrowserContext, type Locator, type Page, type Route, type TestInfo } from '@playwright/test'
import { BASE_URL } from './constants.ts'

export { expect }

/** 截图放在哪里：默认 web/screenshots/<手机尺寸>/，可以用 SHOTS_DIR 环境变量改。 */
export const SHOTS_DIR = path.resolve(process.env.SHOTS_DIR ?? 'screenshots')

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

function isLocal(url: URL): boolean {
  return LOCAL_HOSTS.has(url.hostname) || url.protocol === 'data:' || url.protocol === 'blob:'
}

/** 浏览器对模拟的 Google（测试故意回的 403 / 500 / 断网）写的「Failed to load resource」。 */
function isSimulatedGoogleFailure(text: string, url: string): boolean {
  if (!text.startsWith('Failed to load resource')) return false
  try {
    const host = new URL(url).hostname
    return host.endsWith('googleapis.com') || host.endsWith('googleusercontent.com')
  } catch {
    return false
  }
}

/**
 * 浏览器内建的翻译（Chrome 电脑版的 Translator API）。假的翻译器每准备一次，window.__fakeTranslatorCreated 加 1。
 * - 'none'（默认）：拿掉，像手机 Chrome、iPhone Safari 一样没有内建翻译（英文 / 马来文店名显示原名 + 大概意思）。
 *   本机的 Chrome 电脑版其实有，真的用会在背景下载翻译模型（测试里不能连外部、结果也不固定），所以默认拿掉。
 * - 'fake'：换成假的翻译器（按 FAKE_TRANSLATIONS 对照表翻，马上好），用来看电脑 Chrome「机翻」那条路。
 */
export type BuiltInTranslator = 'none' | 'fake'

/** 假的内建翻译器认得的店名（e2e/results-helpers.ts 模拟的 Google 里的店）。 */
export const FAKE_TRANSLATIONS: Readonly<Record<string, string>> = {
  'Restoran Nasi Kandar Bintang Timur': '东方之星扁担饭餐厅',
  'Lucky Chicken Rice & Noodle House': '幸运鸡饭面馆',
  'Kedai Makan Ikan Bakar Pak Din': '丁伯烤鱼餐馆',
  'Warung Nasi Lemak Kak Yah': '雅姐椰浆饭档',
  'Kopitiam Sri Bulan': '月光咖啡店',
}

interface Fixtures {
  /** 被挡下来的外部请求。测试结束时必须是空的。 */
  blockedRequests: string[]
  /** 网页上的错误（console.error、没接住的异常）。测试结束时必须是空的。 */
  pageErrors: string[]
  /** 浏览器内建的翻译（见 BuiltInTranslator）。用 test.use({ builtInTranslator: 'fake' }) 改。 */
  builtInTranslator: BuiltInTranslator
  /** 照 builtInTranslator 拿掉或换掉 Translator API（自动）。 */
  translatorSetup: void
}

export const test = base.extend<Fixtures>({
  builtInTranslator: ['none', { option: true }],

  translatorSetup: [
    async ({ context, builtInTranslator }, use) => {
      await context.addInitScript(
        ({ mode, table }: { mode: BuiltInTranslator; table: Record<string, string> }) => {
          const g = globalThis as unknown as Record<string, unknown>
          for (const name of ['Translator', 'LanguageDetector']) {
            try {
              delete g[name]
            } catch {
              // 删不掉就算了
            }
          }
          if (mode !== 'fake') return
          g.__fakeTranslatorCreated = 0
          g.Translator = {
            availability: async () => 'available',
            create: async () => {
              g.__fakeTranslatorCreated = (g.__fakeTranslatorCreated as number) + 1
              return {
                translate: async (text: string) => {
                  const found = table[text]
                  if (found == null) throw new Error('fake translator: unknown text')
                  return found
                },
                destroy() {},
              }
            },
          }
        },
        { mode: builtInTranslator, table: { ...FAKE_TRANSLATIONS } },
      )
      await use()
    },
    { auto: true },
  ],

  blockedRequests: [
    async ({ context }, use) => {
      const blocked: string[] = []
      // 最先登记，所以优先级最低：测试里自己登记的 mock 会先处理。
      await context.route(
        (url) => !isLocal(url),
        async (route) => {
          blocked.push(route.request().url())
          await route.abort('blockedbyclient')
        },
      )
      await use(blocked)
      expect(blocked, '测试不能连到外部网站（要测 Google 接口请用 mockGoogleApi 模拟）').toEqual([])
    },
    { auto: true },
  ],

  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() !== 'error') return
        // 模拟的 Google 故意回错误（403、500、断网）时，浏览器自己会在控制台写「Failed to load resource」：那是测试安排的，不算网页的错。
        if (isSimulatedGoogleFailure(message.text(), message.location().url)) return
        errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(String(error)))
      await use(errors)
      expect(errors, '网页上不能有错误').toEqual([])
    },
    { auto: true },
  ],
})

/**
 * 模拟 Google Places 接口（绝不连真的 Google，也不用真的密钥）。
 * handler 收到请求，返回要回给网页的 JSON；返回的次数会记在 calls 里，方便检查有没有多花请求。
 */
export async function mockGoogleApi(
  context: BrowserContext,
  handler: (route: Route) => unknown = () => ({ places: [] }),
): Promise<{ calls: string[] }> {
  const calls: string[] = []
  await context.route(
    (url) => url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('googleusercontent.com'),
    async (route) => {
      const corsHeaders = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST',
        'access-control-allow-headers': '*',
      }
      // 浏览器先问一下能不能跨域（OPTIONS），这不算一次搜索。
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: corsHeaders })
        return
      }
      calls.push(route.request().url())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(await handler(route)),
      })
    },
  )
  return { calls }
}

/**
 * 把网页里的时间固定在某一刻（例如 '2026-10-17T19:30:00+08:00' = 吉隆坡晚上 7 点半）。
 * 要在 page.goto() 之前调用。计时器照常走，只是 Date 永远是这个时间，截图每次都一样。
 * 想让时间往前跳（例如等 30 分钟看营业状态变化），改用 page.clock.install() + page.clock.fastForward()。
 */
export async function freezeTime(page: Page, isoTime: string): Promise<void> {
  await page.clock.setFixedTime(new Date(isoTime))
}

/**
 * 模拟用户把浏览器字体调大（例如 1.3 倍 = 默认 16px 变成 21px）。
 * 直接改 Chrome 的默认字号，跟用户在设置里调的一样。要在 page.goto() 之前调用。
 */
export async function setFontScale(page: Page, scale: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Page.setFontSizes', {
    fontSizes: { standard: Math.round(16 * scale), fixed: Math.round(13 * scale) },
  })
}

/** 页面不能左右滑（内容不能比屏幕宽）。 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, '页面比屏幕宽，会左右滑').toBeLessThanOrEqual(clientWidth)
}

/** 网页里所有离线缓存的网址。 */
export async function cachedUrls(page: Page): Promise<{ cacheNames: string[]; urls: string[] }> {
  return page.evaluate(async () => {
    const cacheNames = await caches.keys()
    const urls: string[] = []
    for (const name of cacheNames) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) urls.push(request.url)
    }
    return { cacheNames, urls }
  })
}

/** 等离线缓存装好，并且已经接管这个页面。 */
export async function waitForServiceWorker(page: Page): Promise<string> {
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  return scope
}

/**
 * 截图存到 SHOTS_DIR/<项目名>/<名字>.png，返回文件路径。
 * 名字用中文写清楚画面内容，例如「03-首页-字体1.3倍」。
 */
export async function saveShot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<string> {
  const file = path.join(SHOTS_DIR, testInfo.project.name, `${name}.png`)
  await mkdir(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: options.fullPage ?? false, animations: 'disabled', caret: 'hide' })
  await testInfo.attach(name, { path: file, contentType: 'image/png' })
  return file
}

// ------------------------------------------------------------------ 打开网页、响应式检查（RWD）

export interface OpenOptions {
  /** 演示模式（默认开）。 */
  readonly demo?: boolean
  /** 固定的时间（默认吉隆坡中午 12:15，午餐时间）。 */
  readonly time?: string
  /** 这台设备的随机数（饭签用；固定了截图每次都一样）。 */
  readonly phoneSeed?: string
  /** 字体放大几倍。 */
  readonly fontScale?: number
  /** 先放进 localStorage 的东西。 */
  readonly storage?: Record<string, string>
}

export const LUNCH_TIME = '2026-10-17T12:15:00+08:00'

/** 打开网页（第一次打开以后先写好 localStorage 再重新载入），等标题出来。 */
export async function openApp(page: Page, options: OpenOptions = {}): Promise<void> {
  await freezeTime(page, options.time ?? LUNCH_TIME)
  if (options.fontScale && options.fontScale !== 1) await setFontScale(page, options.fontScale)
  await page.goto('./')
  const storage: Record<string, string> = {
    'meishi.phone_seed': options.phoneSeed ?? '20261017',
    ...(options.demo === false ? {} : { 'meishi.demo_mode': 'true' }),
    ...options.storage,
  }
  await page.evaluate((items) => {
    // 像新开的分页：上一次（同一个测试里）的结果页不会从 sessionStorage 回来
    sessionStorage.clear()
    for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value)
  }, storage)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '美食剪刀布' })).toBeVisible()
}

/**
 * 画面上的字（不管排版用的隐形字符）：数字和量词之间是不换行空格、「公⁠里」中间有字连接符、按短句换行的字之间
 * 读起来会多一个空格。每个字之间都允许有空白或隐形字符。
 */
export function loose(value: string, options: { exact?: boolean } = {}): RegExp {
  const chars = [...value.replace(/[\s\u2060\u200B]+/g, '')].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const body = chars.join('[\\s\\u2060\\u200B]*')
  return new RegExp(options.exact ? `^[\\s\\u2060\\u200B]*${body}[\\s\\u2060\\u200B]*$` : body)
}

/** 可以点的东西（读屏的按钮、单选、开关、输入框…）。 */
const CLICKABLE = 'button, a[href], input, select, textarea, summary, [role="button"], [role="radio"], [role="switch"], [role="checkbox"], [role="tab"]'

/**
 * 这一个画面在这个尺寸好不好用（用户的 RWD 要求）：
 * 1. 没有横向滚动（document.documentElement.scrollWidth <= window.innerWidth）；
 * 2. 现在能点的东西（有对话框就只看最上面的对话框）都至少 44 × 44；
 * 3. 主要按钮完整在看得见的区域里（滑得到也算），而且没有被底栏、标题栏挡住。
 */
export async function checkRwd(page: Page, what: string, primary: readonly Locator[] = []): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth, `${what}：页面比屏幕宽，会左右滑`).toBeLessThanOrEqual(innerWidth)

  const tooSmall = await page.evaluate((selector) => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')]
    const scope: ParentNode = dialogs[dialogs.length - 1] ?? document
    return [...scope.querySelectorAll<HTMLElement>(selector)]
      .filter((el) => {
        const style = getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        if (el.closest('[aria-hidden="true"]')) return false
        const box = el.getBoundingClientRect()
        if (box.width === 0 && box.height === 0) return false
        return box.width < 43.5 || box.height < 43.5
      })
      .map((el) => {
        const box = el.getBoundingClientRect()
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)
        return `${el.tagName.toLowerCase()}「${name}」${Math.round(box.width)}×${Math.round(box.height)}`
      })
  }, CLICKABLE)
  expect(tooSmall, `${what}：这些可以点的东西小于 44×44`).toEqual([])

  for (const target of primary) {
    await expect(target, `${what}：主要按钮要在画面上`).toBeVisible()
    await target.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
    // 等两帧：滑动、底栏阴影、展开动画都排好了再量
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    const state = await target.evaluate((el) => {
      const box = el.getBoundingClientRect()
      const inView = box.top >= -1 && box.left >= -1 && box.bottom <= window.innerHeight + 1 && box.right <= window.innerWidth + 1
      // 中心、上下边的中间、左右两端（让开圆角：胶囊按钮的四个角本来就点不到，浏览器按圆角判断点到谁）
      const cx = box.left + box.width / 2
      const cy = box.top + box.height / 2
      const round = Math.min(box.width, box.height) / 2
      const points = [
        [cx, cy],
        [cx, box.top + 4],
        [cx, box.bottom - 4],
        [box.left + round, cy],
        [box.right - round, cy],
      ]
      const describe = (node: Element | null) =>
        node ? `${node.tagName.toLowerCase()}${node.className && typeof node.className === 'string' ? '.' + node.className.split(' ')[0] : ''}` : '（没有东西）'
      const blockers = points
        .map(([x, y]) => document.elementFromPoint(x as number, y as number))
        .filter((hit) => !(hit && (hit === el || el.contains(hit))))
        .map(describe)
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)
      return {
        inView,
        covered: blockers.length,
        blockers: [...new Set(blockers)].join('、'),
        name,
        box: `${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}×${Math.round(box.height)}`,
      }
    })
    expect(state.inView, `${what}：「${state.name}」滑到了也不完整在画面里（${state.box}）`).toBe(true)
    expect(state.covered, `${what}：「${state.name}」被 ${state.blockers} 挡住了（${state.box}）`).toBe(0)
  }
}

/** 主要按钮有没有「不用滑就看得到」（首页的三个大按钮）。 */
export async function expectInViewWithoutScrolling(page: Page, target: Locator, what: string): Promise<void> {
  const box = await target.boundingBox()
  const viewport = page.viewportSize()
  expect(box, `${what}：找不到`).not.toBeNull()
  expect(viewport).not.toBeNull()
  if (!box || !viewport) return
  expect(box.y, `${what}：在画面上面外面`).toBeGreaterThanOrEqual(-1)
  expect(box.y + box.height, `${what}：要滑才看得到`).toBeLessThanOrEqual(viewport.height + 1)
}

// ------------------------------------------------------------------ 准备好的情境（定位被挡、吃过的记录、用量）

/** 让浏览器把这个网站的定位设成「挡住」（像用户在网站设置里选了「禁止」），要重新载入才看得到。 */
export async function blockLocation(context: BrowserContext, page: Page): Promise<void> {
  const cdp = await context.newCDPSession(page)
  const { targetInfo } = await cdp.send('Target.getTargetInfo')
  await cdp.send('Browser.setPermission', {
    permission: { name: 'geolocation' },
    setting: 'denied',
    origin: new URL(BASE_URL).origin,
    browserContextId: targetInfo.browserContextId,
  })
}

/** 吃过的记录（localStorage「meishi.visits_v1」）：最近 3 餐都是中餐（6、24、30 小时前），首页会出「连吃 3 次中餐了」。 */
export function chineseStreak(nowIso: string): string {
  const now = new Date(nowIso).getTime()
  const hour = 3_600_000
  return JSON.stringify([
    { placeId: 'ChIJ-streak-1', cuisine: 'CHINESE', atMillis: now - 6 * hour },
    { placeId: 'ChIJ-streak-2', cuisine: 'CHINESE', atMillis: now - 24 * hour },
    { placeId: 'ChIJ-streak-3', cuisine: 'CHINESE', atMillis: now - 30 * hour },
  ])
}

/** 用量记在哪个月（美国洛杉矶时间，「YYYY-MM」）。 */
export function losAngelesMonth(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso))
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}`
}

/** 假的密钥：格式对、但不是真的（只用来让网页进「真实模式」的画面；测试里不会按搜索，按了也连不出去）。 */
export const FAKE_KEY = 'test-key-only-for-screenshots'

/** 晚上 7 点半（晚餐），吉隆坡时间。 */
export const DINNER_TIME = '2026-10-17T19:30:00+08:00'
