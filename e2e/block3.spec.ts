/**
 * 画面第 3 块（游戏层：剪刀石头布 / 帮我挑一家 / 🎡 转盘、「就这一家吧！」、任务卡、愿赌服输）在真浏览器里的检查
 * （phone-390x844、phone-360x740、desktop-1280x800）：动画真的播完（不卡住）、彩带画在内容下面、减少动画（WEB-22）、
 * 告诉朋友（WEB-19）、导航过去（WEB-20）、返回键和重新整理（WEB-13 / WEB-15）、深色模式（WEB-23）。全部用演示店。
 */
import { expect, test } from './fixtures.ts'
import { circle, demoResults, playRps } from './game-helpers.ts'
import { copiedTexts, openedUrls, stubDeviceApis } from './results-helpers.ts'

test.describe('画面第 3 块：游戏层、就这一家吧', () => {
  test.beforeEach(async ({ page }) => {
    await stubDeviceApis(page)
  })

  test('有动画：App 的手转完、揭晓停一下 → 就这一家吧！；彩带刚揭晓才放，画在字和店卡下面', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await demoResults(page)
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await page.getByRole('button', { name: /^剪刀，代表第/ }).click()
    await expect(page.getByTestId('game-layer')).toHaveAttribute('data-phase', 'spin')
    await expect(page.getByTestId('game-layer')).toHaveAttribute('data-phase', 'reveal', { timeout: 4000 })
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 4000 })
    const confetti = page.getByTestId('confetti')
    await expect(confetti).toHaveCount(1)
    const order = await page.evaluate(() => {
      const layer = document.querySelector('[data-testid="game-layer"]')
      const confettiEl = layer?.querySelector('[data-testid="confetti"]')
      const scene = layer?.querySelector('.game-scene')
      if (!confettiEl || !scene) return null
      return {
        first: layer?.firstElementChild === confettiEl,
        confettiZ: Number(getComputedStyle(confettiEl).zIndex) || 0,
        sceneZ: Number(getComputedStyle(scene).zIndex) || 0,
      }
    })
    expect(order?.first).toBe(true)
    expect(order?.sceneZ ?? 0).toBeGreaterThan(order?.confettiZ ?? 0)
  })

  test('有动画：🎡 转盘转 3–4 秒、停下 → 就这一家吧！（不会卡在「转啊转…」）', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await demoResults(page)
    await circle(page, 4)
    await page.getByRole('button', { name: /用我圈的 4\s*家转转盘/ }).click()
    await page.getByRole('button', { name: '转转盘' }).click()
    await expect(page.getByText('转啊转…')).toBeVisible()
    await expect(page.getByText('停在这一家！')).toBeVisible({ timeout: 6000 })
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 4000 })
  })

  test('WEB-22 减少动画：直接到结果、不放彩带；投票平票的转盘也直接停好（不会卡住）', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await demoResults(page)
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await playRps(page, '石头')
    await expect(page.getByTestId('confetti')).toHaveCount(0)
    await page.getByRole('button', { name: '回到列表' }).click()
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    const plus = page.getByRole('button', { name: /加一票$/ })
    await plus.nth(0).click()
    await plus.nth(2).click()
    await page.getByRole('button', { name: '数好了，看结果' }).click()
    await page.getByTestId('meal-prompt').getByRole('button', { name: '确定，重新玩' }).click()
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 4000 })
  })

  test('WEB-19 告诉朋友：没有分享面板就复制（店名、地址、怎么定的），再给「用 WhatsApp 发」；WEB-20 导航过去开 Google 地图路线', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await demoResults(page)
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await playRps(page, '布')
    const winner = (await page.getByRole('article').first().getAttribute('aria-label')) ?? ''
    await page.getByRole('button', { name: '📤 告诉朋友' }).click()
    await expect(page.getByText(/已经复制好了/)).toBeVisible()
    const copied = await copiedTexts(page)
    expect(copied.at(-1)).toContain(winner)
    await page.getByRole('button', { name: /用 WhatsApp 发/ }).click()
    await page.getByRole('button', { name: '导航过去' }).click()
    const urls = await openedUrls(page)
    expect(urls.some((url) => url.startsWith('https://wa.me/'))).toBe(true)
    const maps = urls.find((url) => url.includes('google.com/maps'))
    expect(maps).toBeTruthy()
    expect(maps).not.toContain('key=')
  })

  test('WEB-13 返回键：「就这一家吧！」→ 回到列表（还在第 2 页）；WEB-15 重新整理：「🤝 这一餐已经定了」还在，看一看照样看得到', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await demoResults(page)
    await page.getByRole('button', { name: /换\s*3\s*家/ }).click()
    await page.getByRole('button', { name: /剪刀石头布|帮我挑一家|转转盘/ }).click()
    const hand = page.getByRole('button', { name: /^石头，代表第/ })
    if ((await hand.count()) > 0) await hand.click()
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 8000 })
    await page.goBack()
    await expect(page.getByTestId('game-layer')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /附近第 4–6 名/ })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /这一餐已经定了/ })).toBeVisible()
    await page.getByRole('button', { name: /这一餐已经定了/ }).click()
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible()
  })

  test('WEB-23 深色模式：游戏层用深色底，「就这一家吧！」的店卡和按钮照样看得清', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
    await demoResults(page)
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await playRps(page, '剪刀')
    const colors = await page.evaluate(() => {
      const layer = document.querySelector('[data-testid="game-layer"]') as HTMLElement
      const nav = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('导航过去')) as HTMLElement
      return { layer: getComputedStyle(layer).backgroundColor, nav: getComputedStyle(nav).backgroundColor, navText: getComputedStyle(nav).color }
    })
    const lum = (rgb: string) => {
      const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).map(Number)
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
    }
    expect(lum(colors.layer)).toBeLessThan(60)
    expect(Math.abs(lum(colors.nav) - lum(colors.navText))).toBeGreaterThan(80)
  })
})
