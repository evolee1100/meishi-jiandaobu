/**
 * 画面第 1 块（框架、首页、随便挑、饭签）在真的浏览器里的检查：返回键、重新整理、深色模式、减少动画、字体放大、
 * 只问定位。跑在主要的手机尺寸（390×844、360×740）和电脑（1280×800）上；各种尺寸的响应式检查在 rwd.spec.ts。
 * 全部用演示模式，不连任何外部网站、不用真的密钥。
 */
import type { Page } from '@playwright/test'
import { expect, expectInViewWithoutScrolling, expectNoHorizontalScroll, openApp, test } from './fixtures.ts'

const EAT = ['吃饭', '吃面', '都可以'] as const

function eatButtons(page: Page) {
  return EAT.map((name) => page.getByRole('button', { name, exact: true }))
}

function randomDialog(page: Page) {
  return page.getByRole('dialog', { name: '🎲 帮你随便挑' })
}

function fortuneDialog(page: Page) {
  return page.getByRole('dialog', { name: '📜 今日饭签' })
}

test.describe('画面第 1 块：框架、首页、随便挑、饭签', () => {
  test('WEB-24 字体 1.3 倍：首页三个大按钮不用滑就看到，没有横向滚动；电脑上内容最宽 560', async ({ page }) => {
    await openApp(page, { fontScale: 1.3 })
    for (const button of eatButtons(page)) await expectInViewWithoutScrolling(page, button, '首页三个大按钮')
    await expectNoHorizontalScroll(page)
    const widths = await page.evaluate(() => ({
      app: document.querySelector('.app')!.getBoundingClientRect().width,
      bar: document.querySelector('.bottom-bar')!.getBoundingClientRect().width,
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      viewport: window.innerWidth,
    }))
    // 主栏最宽 35rem（默认字号 = 560px，字体放大时跟着变宽一点）；底栏跟主栏一样宽
    expect(widths.app).toBeLessThanOrEqual(Math.min(widths.viewport, 35 * widths.root) + 0.5)
    expect(Math.abs(widths.bar - widths.app)).toBeLessThan(1)
  })

  test('WEB-24 默认字体：电脑上主栏 560 宽、置中，两边是暖色装饰', async ({ page }) => {
    await openApp(page)
    const layout = await page.evaluate(() => {
      const box = document.querySelector('.app')!.getBoundingClientRect()
      return { left: box.left, right: window.innerWidth - box.right, width: box.width, viewport: window.innerWidth }
    })
    if (layout.viewport >= 768) {
      expect(layout.width).toBeCloseTo(560, 0)
      expect(Math.abs(layout.left - layout.right)).toBeLessThan(1)
    } else {
      expect(layout.width).toBe(layout.viewport)
    }
  })

  test('WEB-23 深色模式：深咖啡底；饭签签纸、三个大按钮的颜色跟浅色一样', async ({ page }) => {
    const colors = async () =>
      page.evaluate(() => ({
        // 主栏的底色（电脑上 body 是两边的装饰色）
        body: getComputedStyle(document.querySelector('.app')!).backgroundColor,
        rice: getComputedStyle(document.querySelector('.eat-btn--rice')!).backgroundImage,
        noodle: getComputedStyle(document.querySelector('.eat-btn--noodle')!).backgroundImage,
        any: getComputedStyle(document.querySelector('.eat-btn--any')!).backgroundImage,
      }))
    await openApp(page)
    const light = await colors()
    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    const slipLight = await page.locator('.fortune-slip').evaluate((el) => getComputedStyle(el).backgroundColor)
    await page.keyboard.press('Escape')

    await page.emulateMedia({ colorScheme: 'dark' })
    const dark = await colors()
    expect(dark.body).toBe('rgb(29, 18, 13)')
    expect(light.body).toBe('rgb(255, 248, 243)')
    expect(dark.rice).toBe(light.rice)
    expect(dark.noodle).toBe(light.noodle)
    expect(dark.any).toBe(light.any)
    expect(dark.rice).toContain('rgb(255, 146, 43)')
    await page.getByRole('button', { name: /今日饭签/ }).click()
    const slipDark = await page.locator('.fortune-slip').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(slipDark).toBe('rgb(255, 244, 214)')
    expect(slipLight).toBe(slipDark)
  })

  test('WEB-22 减少动画：随便挑直接停在结果（马上能按「就它了」），饭签直接看到签纸', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    const dialog = randomDialog(page)
    await expect(dialog.getByText('今天就吃：')).toBeVisible({ timeout: 500 })
    await expect(dialog.getByRole('button', { name: '就它了，开始找' })).toBeEnabled({ timeout: 500 })
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    const fortune = fortuneDialog(page)
    await expect(fortune.getByRole('button', { name: /照签去找/ })).toBeVisible({ timeout: 500 })
    await expect(fortune.getByText('摇啊摇…')).toHaveCount(0)
  })

  test('随便挑（有动画）：转动中「就它了」「再摇一次」是灰的、按钮位置一直不动', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openApp(page)
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    const dialog = randomDialog(page)
    const go = dialog.getByRole('button', { name: '就它了，开始找' })
    const again = dialog.getByRole('button', { name: '🎲 再摇一次' })
    const cancel = dialog.getByRole('button', { name: '算了，我自己选' })
    await expect(go).toBeDisabled()
    await expect(again).toBeDisabled()
    await expect(cancel).toBeEnabled()
    await page.waitForTimeout(350) // 对话框出现的动画（240 毫秒）走完；卷轴要转 1.5 秒
    await expect(go).toBeDisabled()
    const spinningBoxes = await Promise.all([go, again, cancel].map((b) => b.boundingBox()))
    await expect(go).toBeEnabled({ timeout: 5000 })
    const settledBoxes = await Promise.all([go, again, cancel].map((b) => b.boundingBox()))
    expect(settledBoxes).toEqual(spinningBoxes)
    await again.click()
    await expect(go).toBeEnabled({ timeout: 5000 })
    await again.click()
    await expect(go).toBeEnabled({ timeout: 5000 })
    await expect(dialog.getByText('刚才摇到：')).toBeVisible()
    const afterHistory = await Promise.all([go, again, cancel].map((b) => b.boundingBox()))
    expect(afterHistory).toEqual(spinningBoxes)
  })

  test('SCREEN-06 字体 1.3 倍：随便挑的说明放不下时缩小字或换行，整句看得到，不会被「…」切掉', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page, { fontScale: 1.3 })
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    const note = randomDialog(page).locator('.random-note')
    await expect(note).toBeVisible()
    const fit = await note.evaluate((el) => ({
      overflow: el.scrollWidth - el.clientWidth,
      fontSize: parseFloat(getComputedStyle(el).fontSize),
    }))
    expect(fit.overflow).toBeLessThanOrEqual(1)
    expect(fit.fontSize).toBeGreaterThanOrEqual(13)
  })

  test('SCREEN-08 打开网页只问定位；摇一摇（iPhone 要先允许）只有用户按了「开启摇一摇」才问', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      const calls: string[] = []
      ;(window as unknown as { __asked: string[] }).__asked = calls
      const ctor = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
      if (ctor) ctor.requestPermission = async () => (calls.push('motion'), 'granted')
      if ('Notification' in window) Notification.requestPermission = async () => (calls.push('notification'), 'denied')
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => (calls.push('camera'), Promise.reject(new Error('no')))
    })
    await openApp(page)
    await page.waitForTimeout(1800) // 摇一摇先听 1.5 秒有没有读数
    expect(await page.evaluate(() => (window as unknown as { __asked: string[] }).__asked)).toEqual([])
    const allow = page.getByRole('button', { name: /开启摇一摇/ })
    if (testInfo.project.name.startsWith('phone')) {
      await expect(allow).toBeVisible()
      await allow.click()
      expect(await page.evaluate(() => (window as unknown as { __asked: string[] }).__asked)).toEqual(['motion'])
    } else {
      // 电脑没有动作感应：不显示摇一摇
      await expect(allow).toHaveCount(0)
    }
  })

  test('WEB-13 浏览器返回键：先关对话框（还在首页），结果页回首页，首页再按就离开网页', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    const appUrl = page.url()

    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    await expect(randomDialog(page)).toBeVisible()
    await page.goBack()
    await expect(randomDialog(page)).toBeHidden()
    await expect(page.getByRole('heading', { name: '今天想吃什么？' })).toBeVisible()
    expect(page.url()).toBe(appUrl)

    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    await expect(fortuneDialog(page)).toBeVisible()
    await page.goBack()
    await expect(fortuneDialog(page)).toBeHidden()

    await page.getByRole('button', { name: '都可以', exact: true }).click()
    await expect(page.getByRole('button', { name: '重新选择' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: '今天想吃什么？' })).toBeVisible()
    expect(page.url()).toBe(appUrl)

    // 首页什么都没开：返回键交给浏览器（离开网页）
    await page.goBack()
    await expect(page).not.toHaveURL(appUrl)
  })

  test('画面上的返回箭头 = 返回键；用按钮关掉对话框后，返回键不会多按一次', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    const appUrl = page.url()
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    await randomDialog(page).getByRole('button', { name: '算了，我自己选' }).click()
    await expect(randomDialog(page)).toBeHidden()

    await page.getByRole('button', { name: '吃饭', exact: true }).click()
    await expect(page.getByRole('button', { name: '重新选择' })).toBeVisible()
    await page.getByRole('button', { name: '返回' }).click()
    await expect(page.getByRole('heading', { name: '今天想吃什么？' })).toBeVisible()
    await expect(page.getByRole('button', { name: '返回' })).toHaveCount(0)
    expect(page.url()).toBe(appUrl)
    await page.goBack()
    await expect(page).not.toHaveURL(appUrl)
  })

  test('WEB-15 重新整理：结果页还在（同一个分页），不再搜索；对话框不会留着', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openApp(page)
    await page.getByRole('radio', { name: /日本餐/ }).click()
    await page.getByRole('button', { name: '吃面', exact: true }).click()
    const reselect = page.getByRole('button', { name: '重新选择' })
    await expect(reselect).toBeVisible()
    const title = await page.locator('.results-title').textContent()

    await page.reload()
    await expect(reselect).toBeVisible()
    await expect(page.locator('.results-title')).toHaveText(title ?? '')
    // 返回 → 首页，刚才选的「日本餐」还记得
    await page.getByRole('button', { name: '返回' }).click()
    await expect(page.getByRole('radio', { name: /日本餐/ })).toHaveAttribute('aria-checked', 'true')

    // 首页开着对话框时重新整理：回到首页，对话框不留着
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    await expect(randomDialog(page)).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: '今天想吃什么？' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
