/**
 * 冒烟测试：打包好的网页放在 GitHub Pages 一样的子路径下，能不能正常打开。
 * 同时示范：固定时间（page.clock）、定位权限和坐标、模拟 Google 接口、截图存到指定文件夹。
 */
import { KL_PETALING_STREET } from './constants.ts'
import {
  cachedUrls,
  expect,
  expectNoHorizontalScroll,
  freezeTime,
  mockGoogleApi,
  saveShot,
  setFontScale,
  test,
  waitForServiceWorker,
} from './fixtures.ts'

test.describe('冒烟测试', () => {
  test('打开首页看到标题「美食剪刀布」，并截图', async ({ page }, testInfo) => {
    // 示范：把时间定在吉隆坡 2026-10-17 中午 12:30（午餐时间）。
    await freezeTime(page, '2026-10-17T12:30:00+08:00')
    await page.goto('./')

    await expect(page).toHaveTitle('美食剪刀布')
    await expect(page.getByRole('heading', { level: 1, name: '美食剪刀布' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expectNoHorizontalScroll(page)

    const now = await page.evaluate(() => ({ hour: new Date().getHours(), minute: new Date().getMinutes() }))
    expect(now).toEqual({ hour: 12, minute: 30 })

    // 示范：截图存到 screenshots/<手机尺寸>/00-冒烟测试-首页.png
    await saveShot(page, testInfo, '00-冒烟测试-首页')
  })

  test('示范：定位已允许，位置在吉隆坡茨厂街', async ({ page, context }) => {
    // playwright.config.ts 里已经默认允许定位；这里示范在测试里自己设定（可以换成别的地方）。
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation(KL_PETALING_STREET)
    await page.goto('./')

    const permission = await page.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state)
    expect(permission).toBe('granted')

    const position = await page.evaluate(
      () =>
        new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
            (error) => reject(new Error(error.message)),
            { timeout: 5_000 },
          )
        }),
    )
    expect(position).toEqual(KL_PETALING_STREET)
  })

  test('示范：用户没有允许定位', async ({ page, context }) => {
    await context.clearPermissions()
    await page.goto('./')
    const permission = await page.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state)
    expect(permission).not.toBe('granted')
  })

  test('深色模式：背景跟安卓版一样是深咖啡色', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./')
    // 主栏的底色（手机上就是整个画面；电脑上两边是暖色装饰）
    await expect(page.locator('.app')).toHaveCSS('background-color', 'rgb(29, 18, 13)')
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(255, 181, 144)')
  })

  test('减少动画：CSS 动画和过渡立刻走完', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('./')
    const durations = await page.evaluate(() => {
      const box = document.createElement('div')
      box.style.animation = 'spin 2s infinite'
      box.style.transition = 'opacity var(--motion-medium)'
      document.body.append(box)
      const style = getComputedStyle(box)
      const result = {
        token: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-medium')),
        animation: parseFloat(style.animationDuration),
        transition: parseFloat(style.transitionDuration),
        iterations: style.animationIterationCount,
        matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      }
      box.remove()
      return result
    })
    expect(durations.matches).toBe(true)
    expect(durations.token).toBe(0)
    // 0.01ms 写成秒是 0.00001s
    expect(durations.animation).toBeLessThan(0.001)
    expect(durations.transition).toBeLessThan(0.001)
    expect(durations.iterations).toBe('1')
  })

  test('字体放大 1.3 倍：标题跟着变大，页面不会左右滑', async ({ page }) => {
    await page.goto('./')
    const normal = await page.getByRole('heading', { level: 1 }).evaluate((h) => parseFloat(getComputedStyle(h).fontSize))

    await setFontScale(page, 1.3)
    await page.goto('./')
    const larger = await page.getByRole('heading', { level: 1 }).evaluate((h) => parseFloat(getComputedStyle(h).fontSize))

    expect(larger / normal).toBeCloseTo(21 / 16, 1)
    await expectNoHorizontalScroll(page)
  })

  test('PWA：manifest 和图标在子路径下都拿得到', async ({ page, request }) => {
    await page.goto('./')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBe('./manifest.webmanifest')

    const manifestUrl = new URL(href ?? '', page.url())
    const response = await request.get(manifestUrl.href)
    expect(response.ok()).toBe(true)
    const manifest = (await response.json()) as { name: string; theme_color: string; icons: { src: string }[] }
    expect(manifest.name).toBe('美食剪刀布')
    expect(manifest.theme_color).toBe('#D9480F')
    for (const icon of manifest.icons) {
      const iconResponse = await request.get(new URL(icon.src, manifestUrl).href)
      expect(iconResponse.ok(), icon.src).toBe(true)
    }
  })

  test('离线缓存：在子路径下注册成功，断网也能打开', async ({ page, context, baseURL }) => {
    await page.goto('./')
    const scope = await waitForServiceWorker(page)
    expect(scope).toBe(baseURL)

    const { cacheNames, urls } = await cachedUrls(page)
    expect(cacheNames).toHaveLength(1)
    expect(cacheNames[0]).toMatch(/^meishi-jiandaobu-/)
    expect(urls).toContain(new URL('index.html', baseURL).href)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: '美食剪刀布' })).toBeVisible()
    await context.setOffline(false)
  })

  test('离线缓存绝不缓存 Google 接口（用模拟的接口，不连真的 Google）', async ({ page, context }) => {
    const google = await mockGoogleApi(context)
    await page.goto('./')
    await waitForServiceWorker(page)

    const status = await page.evaluate(async () => {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'places.id' },
        body: JSON.stringify({ textQuery: '云吞面' }),
      })
      return response.status
    })
    expect(status).toBe(200)
    expect(google.calls).toHaveLength(1)

    const { urls } = await cachedUrls(page)
    expect(urls.filter((url) => url.includes('google'))).toEqual([])
  })
})
