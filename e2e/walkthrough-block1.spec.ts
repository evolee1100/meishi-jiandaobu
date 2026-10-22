/**
 * 画面第 1 块（框架、首页、随便挑、饭签）走一遍并截图：npm run shots。
 * 只在 e2e/sizes.ts 里 shots: true 的尺寸拍（320×568、390×844、430×932、844×390 横屏、768×1024、1280×800），
 * 存到 测试截图-开发中/框架、首页、随便挑、饭签/<尺寸>/。全部用演示模式或假的设定，不连任何外部网站、不用真的密钥。
 * 每一步也顺便做响应式检查（没有横向滚动、可点的东西够大、主要按钮看得到）。
 */
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { blockLocation, checkRwd, chineseStreak, DINNER_TIME, expect, FAKE_KEY, losAngelesMonth, openApp, test } from './fixtures.ts'
import { sizeOf } from './sizes.ts'

const SHOT_ROOT = path.resolve('测试截图-开发中', '框架、首页、随便挑、饭签')

const DINNER = DINNER_TIME

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const size = sizeOf(testInfo.project.name)
  const file = path.join(SHOT_ROOT, size?.label ?? testInfo.project.name, `${name}.png`)
  await mkdir(path.dirname(file), { recursive: true })
  // 等两帧，字和动画排好再拍
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' })
}

test.describe('画面第 1 块走一遍（截图）', { tag: '@shots' }, () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!sizeOf(testInfo.project.name)?.shots, '这个尺寸不拍整套截图')
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('第一次打开：定位说明 → 先不要 → 允许定位 → 没有密钥的首页 → 我有 Google 密钥', async ({ page, context }, testInfo) => {
    await context.clearPermissions()
    await openApp(page, { demo: false })
    const explain = page.getByRole('dialog', { name: '先跟你说一声' })
    await expect(explain).toBeVisible()
    await shot(page, testInfo, '01-第一次打开-先跟你说一声')
    await explain.getByRole('button', { name: '先不要' }).click()
    await expect(explain).toBeHidden()
    await shot(page, testInfo, '02-首页-没有密钥-没有定位权限')
    await checkRwd(page, '没有密钥、没有定位')

    await page.getByRole('button', { name: '允许定位' }).click()
    // 用户在浏览器的询问里按「允许」
    await context.grantPermissions(['geolocation'])
    await page.getByRole('dialog', { name: '先跟你说一声' }).getByRole('button', { name: '好，去允许' }).click()
    await expect(page.getByText('已取得你的位置')).toBeVisible()
    await shot(page, testInfo, '03-首页-没有密钥-已取得位置')

    await page.getByRole('button', { name: /我有 Google 密钥/ }).click()
    const settings = page.getByRole('dialog', { name: '设置' })
    await expect(settings.getByLabel('Places API 密钥')).toBeVisible()
    await page.waitForTimeout(400) // 展开后 150 毫秒才把密钥框滚进来
    await shot(page, testInfo, '04-设置-进阶直接展开-密钥框')
    await settings.getByLabel('Places API 密钥').fill('AB C')
    await shot(page, testInfo, '05-设置-打了字-保存密钥可以按')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '密钥还没保存，要保存吗？' })).toBeVisible()
    await shot(page, testInfo, '06-设置-密钥还没保存要保存吗')
    await page.getByRole('button', { name: '不保存' }).click()

    await page.getByRole('button', { name: /开演示/ }).click()
    await expect(page.getByText('演示', { exact: true })).toBeVisible()
    await shot(page, testInfo, '07-一按开演示-首页变成演示模式')
  })

  test('定位被浏览器挡住：首页卡片 → 怎么打开定位', async ({ page, context }, testInfo) => {
    await openApp(page)
    await blockLocation(context, page)
    await page.reload()
    const card = page.getByRole('button', { name: '怎么打开？' })
    await expect(card).toBeVisible()
    await shot(page, testInfo, '08-首页-定位被浏览器挡住')
    await card.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, testInfo, '09-怎么打开定位-安卓和iPhone步骤')
    await checkRwd(page, '怎么打开定位', [page.getByRole('dialog').getByRole('button').last()])
  })

  test('首页（演示）：午餐、滑到底、选菜系、范围、关掉演示撤销、设置', async ({ page }, testInfo) => {
    await openApp(page)
    await shot(page, testInfo, '10-首页-演示-午餐时间到')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await shot(page, testInfo, '11-首页-滑到底-范围滑杆和状态行')
    await page.evaluate(() => window.scrollTo(0, 0))

    await page.getByRole('radio', { name: /印度/ }).click()
    await page.waitForTimeout(300)
    await shot(page, testInfo, '12-选了印度嘛嘛档-说明露出在底栏上方')

    await page.getByRole('button', { name: /搜索范围/ }).click()
    await expect(page.getByRole('dialog', { name: '想找多远的店？' })).toBeVisible()
    await shot(page, testInfo, '13-想找多远的店-四个大按钮')
    await page.getByRole('button', { name: /开车去/ }).click()
    await expect(page.getByRole('button', { name: /搜索范围 5/ })).toBeVisible()
    await shot(page, testInfo, '14-选了开车去-底栏变5公里')

    await page.getByRole('button', { name: '关掉' }).click()
    await expect(page.getByRole('button', { name: '撤销' })).toBeVisible()
    await shot(page, testInfo, '15-关掉演示-撤销条在三个大按钮上方')
    await page.getByRole('button', { name: '撤销' }).click()

    await page.getByRole('button', { name: '设置' }).click()
    await expect(page.getByRole('dialog', { name: '设置' })).toBeVisible()
    await shot(page, testInfo, '16-设置-一般-演示开关和剩余次数')
  })

  test('饭签：签筒摇啊摇 → 签纸 → 首页变小标签', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openApp(page)
    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    const dialog = page.getByRole('dialog', { name: '📜 今日饭签' })
    await expect(dialog.getByText('摇啊摇…')).toBeVisible()
    await shot(page, testInfo, '20-饭签-签筒摇啊摇')
    const go = dialog.getByRole('button', { name: /照签去找/ })
    await expect(go).toBeVisible({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, testInfo, '21-饭签-签纸-照签去找')
    await checkRwd(page, '饭签', [go, dialog.getByRole('button', { name: '收好了' })])
    await dialog.getByRole('button', { name: '收好了' }).click()
    await expect(dialog).toBeHidden()
    await shot(page, testInfo, '22-首页-抽过饭签变成小标签')
  })

  test('随便挑：转动中按钮变灰 → 停下 → 再摇两次 → 刚才摇到 → 就它了 → 加载', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openApp(page)
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    const dialog = page.getByRole('dialog', { name: '🎲 帮你随便挑' })
    const go = dialog.getByRole('button', { name: '就它了，开始找' })
    await expect(go).toBeDisabled()
    await page.waitForTimeout(350)
    await shot(page, testInfo, '30-随便挑-转动中-按钮先变灰')
    await expect(go).toBeEnabled({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, testInfo, '31-随便挑-停下-今天就吃')
    const again = dialog.getByRole('button', { name: '🎲 再摇一次' })
    await again.click()
    await expect(go).toBeEnabled({ timeout: 5000 })
    await again.click()
    await expect(go).toBeEnabled({ timeout: 5000 })
    await page.waitForTimeout(500)
    await shot(page, testInfo, '32-随便挑-摇了三次-刚才摇到在按钮下面')
    await checkRwd(page, '随便挑', [go, again, dialog.getByRole('button', { name: '算了，我自己选' })])
    await go.click()
    await expect(page.getByText(/正在帮你找附近/)).toBeVisible()
    await shot(page, testInfo, '33-就它了-加载中')
  })

  test('晚上、真实模式（假密钥）：连吃提醒、本月还可免费搜索、随便挑这次不摇中餐', async ({ page }, testInfo) => {
    await openApp(page, { demo: false, time: DINNER, storage: { 'meishi.places_api_key': FAKE_KEY, 'meishi.visits_v1': chineseStreak(DINNER) } })
    await expect(page.getByText(/连吃\s*3\s*次中餐了/)).toBeVisible()
    await shot(page, testInfo, '40-首页-晚餐-连吃提醒')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await shot(page, testInfo, '41-首页-滑到底-本月还可免费搜索')
    await page.getByText(/连吃\s*3\s*次中餐了/).click()
    const dialog = page.getByRole('dialog', { name: '🎲 帮你随便挑' })
    await expect(dialog.getByText(/这次不摇/)).toBeVisible()
    await shot(page, testInfo, '42-随便挑-这次不摇中餐')
  })

  test('本月免费次数用完：首页卡片', async ({ page }, testInfo) => {
    const month = losAngelesMonth(DINNER)
    await openApp(page, { demo: false, time: DINNER, storage: { 'meishi.places_api_key': FAKE_KEY, [`meishi.text_search_${month}`]: '900' } })
    await expect(page.getByText(/本月免费次数已用完/)).toBeVisible()
    await shot(page, testInfo, '43-首页-本月免费次数用完')
  })

  test('深色模式：首页、饭签、随便挑', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await openApp(page)
    await shot(page, testInfo, '50-深色-首页')
    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    await expect(page.getByRole('button', { name: /照签去找/ })).toBeVisible()
    await shot(page, testInfo, '51-深色-饭签签纸还是米黄色')
    await page.getByRole('button', { name: '收好了' }).click()
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    await expect(page.getByRole('button', { name: '就它了，开始找' })).toBeEnabled()
    await shot(page, testInfo, '52-深色-随便挑')
  })

  test('字体放大 1.3 倍：首页、随便挑、饭签', async ({ page }, testInfo) => {
    await openApp(page, { fontScale: 1.3 })
    await shot(page, testInfo, '60-字体1.3倍-首页')
    await page.getByRole('button', { name: /帮我随便挑/ }).click()
    await expect(page.getByRole('button', { name: '就它了，开始找' })).toBeEnabled()
    await shot(page, testInfo, '61-字体1.3倍-随便挑')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    await expect(page.getByRole('button', { name: /照签去找/ })).toBeVisible()
    await shot(page, testInfo, '62-字体1.3倍-饭签')
  })
})
