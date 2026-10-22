/**
 * 截图（npm run shots）：每种屏幕尺寸各拍一套，存到 screenshots/<尺寸>/。
 * 以后加了新画面，就在这里加一张，名字用中文写清楚画面内容。
 */
import { expectNoHorizontalScroll, freezeTime, saveShot, setFontScale, test } from './fixtures.ts'

// 晚上 7 点半（晚餐时间），吉隆坡时间。
const DINNER_TIME = '2026-10-17T19:30:00+08:00'

test.describe('截图', { tag: '@shots' }, () => {
  test.beforeEach(async ({ page }) => {
    await freezeTime(page, DINNER_TIME)
  })

  test('01-首页-浅色', async ({ page }, testInfo) => {
    await page.goto('./')
    await expectNoHorizontalScroll(page)
    await saveShot(page, testInfo, '01-首页-浅色')
  })

  test('02-首页-深色', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./')
    await expectNoHorizontalScroll(page)
    await saveShot(page, testInfo, '02-首页-深色')
  })

  test('03-首页-字体1.3倍', async ({ page }, testInfo) => {
    await setFontScale(page, 1.3)
    await page.goto('./')
    await expectNoHorizontalScroll(page)
    await saveShot(page, testInfo, '03-首页-字体1.3倍')
  })
})
