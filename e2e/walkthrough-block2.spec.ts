/**
 * 画面第 2 块（搜索流程、结果页、设置）走一遍并截图：npm run shots。
 * 只在 e2e/sizes.ts 里 shots: true 的尺寸拍（320×568、390×844、430×932、844×390 横屏、768×1024、1280×800），
 * 存到 测试截图-开发中/搜索、结果页、设置/<尺寸>/。演示模式为主；真实模式只用模拟的 Google（不连外部网站、不用真的密钥）。
 * 每一步也顺便做响应式检查（没有横向滚动、可点的东西够大、主要按钮看得到）。
 */
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { blockLocation, checkRwd, DINNER_TIME, expect, FAKE_KEY, loose, losAngelesMonth, openApp, test } from './fixtures.ts'
import { mockPlacesWithPhotos, stubDeviceApis } from './results-helpers.ts'
import { sizeOf } from './sizes.ts'

const SHOT_ROOT = path.resolve('测试截图-开发中', '搜索、结果页、设置')

async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = false): Promise<void> {
  const size = sizeOf(testInfo.project.name)
  const file = path.join(SHOT_ROOT, size?.label ?? testInfo.project.name, `${name}.png`)
  await mkdir(path.dirname(file), { recursive: true })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide', fullPage })
}

async function scrollTop(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function scrollBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
}

/** 首页选菜系、按吃饭 / 吃面 / 都可以，等到结果页。 */
async function search(page: Page, cuisine: RegExp | null, meal: '吃饭' | '吃面' | '都可以'): Promise<void> {
  if (cuisine) await page.getByRole('radio', { name: cuisine }).click()
  await page.getByRole('button', { name: meal, exact: true }).click()
}

const LUNCH_2PM = '2026-10-17T14:02:00+08:00'
const LATE_NIGHT = '2026-10-17T23:30:00+08:00'

test.describe('画面第 2 块走一遍（截图）', { tag: '@shots' }, () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!sizeOf(testInfo.project.name)?.shots, '这个尺寸不拍整套截图')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await stubDeviceApis(page)
  })

  test('演示：加载页 → 结果页（中餐）→ 滑到底 → 换 3 家 → 回到前 3 名', async ({ page }, testInfo) => {
    await openApp(page)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await search(page, /中餐/, '都可以')
    await expect(page.getByText(/正在帮你找附近/)).toBeVisible()
    await shot(page, testInfo, '01-加载页-正在帮你找附近最好吃的中餐')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByRole('heading', { name: loose('附近最强 3 家') })).toBeVisible()
    await page.waitForTimeout(300)
    await shot(page, testInfo, '02-结果页-附近最强3家中餐-演示条-只看营业中')
    await checkRwd(page, '结果页', [page.getByRole('button', { name: loose('换 3 家') }), page.getByRole('button', { name: /剪刀石头布/ })])
    await scrollBottom(page)
    await shot(page, testInfo, '03-结果页-滑到底-重新选择-数据来源')
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await expect(page.getByRole('heading', { name: loose('附近第 4–6 名') })).toBeVisible()
    await page.waitForTimeout(400)
    await shot(page, testInfo, '04-换3家-附近第4到6名-滑回最上面')
    await page.getByRole('button', { name: /换\s*3\s*家|剩下/ }).click()
    await expect(page.getByRole('button', { name: loose('回到前 3 名') })).toBeVisible()
    await scrollBottom(page)
    await shot(page, testInfo, '05-看完了-已经看完全部-回到前3名')
  })

  test('演示：❤️ 圈店、饭桌提示、圈 5 家转转盘、清空可撤销、太晚不能圈', async ({ page }, testInfo) => {
    await openApp(page)
    await search(page, /中餐/, '都可以')
    const hearts = page.getByRole('button', { name: /^圈起来：/ })
    await expect(hearts.first()).toBeVisible()
    await hearts.first().click()
    await shot(page, testInfo, '10-圈了1家-再圈1家就能用它们来玩')
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await expect(page.getByText(loose('圈够 3 家就能开'))).toBeVisible()
    await shot(page, testInfo, '11-圈第2家-提示圈够3家就能开饭桌模式')
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await expect(page.getByRole('button', { name: loose('用我圈的 5 家转转盘') })).toBeVisible()
    // 「几个人一起吃？…」的提示 3 秒后收起（像安卓第四版截图 11 那样只剩已圈一行）
    await expect(page.locator('.bar-notice')).toHaveCount(0, { timeout: 6000 })
    await shot(page, testInfo, '12-圈了5家-已圈一行-饭桌模式-清空-转转盘')
    await checkRwd(page, '圈了 5 家', [
      page.getByRole('button', { name: '👥 饭桌模式' }),
      page.getByRole('button', { name: '清空' }),
      page.getByRole('button', { name: loose('用我圈的 5 家转转盘') }),
    ])
    await page.getByRole('button', { name: '清空' }).click()
    await expect(page.getByText(loose('已清空 5 家'))).toBeVisible()
    await page.waitForTimeout(300)
    await shot(page, testInfo, '13-清空-已清空5家-8秒内可撤销')
    await checkRwd(page, '清空可撤销', [page.getByRole('button', { name: '撤销' })])
    await page.getByRole('button', { name: '撤销' }).click()
    await expect(page.getByRole('button', { name: loose('用我圈的 5 家转转盘') })).toBeVisible()
    await page.getByRole('button', { name: loose('用我圈的 5 家转转盘') }).click()
    await expect(page.getByTestId('game-layer')).toBeVisible()
    await shot(page, testInfo, '14-转转盘-游戏层')
  })

  test('演示：下午 2 点快关门、快关门来不及的店不能圈', async ({ page }, testInfo) => {
    await openApp(page, { time: LUNCH_2PM })
    await search(page, /中餐/, '都可以')
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await expect(page.getByText(loose('还有 28 分钟关门'))).toBeVisible()
    await page.waitForTimeout(300)
    await shot(page, testInfo, '20-下午2点-还有28分钟关门-可能停止点餐了')
    // 下午 2:12：只剩 18 分钟，走过去 7 分钟 + 点餐 20 分钟，来不及了
    await openApp(page, { time: '2026-10-17T14:12:00+08:00' })
    await search(page, /中餐/, '都可以')
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    const late = page.getByRole('article').filter({ hasText: loose('还有 18 分钟关门') })
    await late.getByRole('button', { name: /^圈起来：/ }).click()
    await expect(page.getByText(loose('这家快关门了，过去来不及，先不能圈'))).toBeVisible()
    await shot(page, testInfo, '21-快关门的店-过去来不及先不能圈')
  })

  test('演示：导航（先记一笔吃过）→ 卡片写「👣 刚刚导航过」', async ({ page }, testInfo) => {
    await openApp(page)
    await search(page, /中餐/, '都可以')
    await page.getByRole('button', { name: '导航' }).nth(1).click()
    await expect(page.getByText(loose('👣 刚刚导航过'))).toBeVisible()
    await page.getByText(loose('👣 刚刚导航过')).evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await shot(page, testInfo, '22-导航以后-卡片写刚刚导航过')
  })

  test('演示：帮我挑一家定了 → 换一组店重新玩先问「会用掉唯一一次反悔」', async ({ page }, testInfo) => {
    await openApp(page)
    await search(page, /中餐/, '都可以')
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: loose('在我圈的 2 家里挑') }).click()
    await expect(page.getByTestId('game-layer')).toBeVisible()
    await page.getByRole('button', { name: '回到列表' }).click()
    await page.getByRole('button', { name: '清空' }).click()
    await page.getByRole('button', { name: /选不了？/ }).click()
    await expect(page.getByTestId('meal-prompt')).toContainText('会用掉唯一一次反悔')
    await shot(page, testInfo, '35-定了以后换一组店重新玩-先问会用掉唯一一次反悔')
  })

  test('演示：发到群里投票 → 计票板 → 数票 → 数好了 → 这一餐已经定了', async ({ page }, testInfo) => {
    await openApp(page)
    await search(page, /中餐/, '吃饭')
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    await expect(page.getByRole('heading', { name: '📊 群里投票，帮你数票' })).toBeVisible()
    await expect(page.getByText(/已经复制好了/)).toBeVisible()
    await shot(page, testInfo, '30-发到群里投票-已经复制好了-计票板出现')
    const plus = page.getByRole('button', { name: /加一票$/ })
    await plus.nth(0).click()
    await plus.nth(0).click()
    for (let i = 0; i < 4; i++) await plus.nth(1).click()
    for (let i = 0; i < 4; i++) await plus.nth(2).click()
    await shot(page, testInfo, '31-计票板-鸡饭2票-茶餐厅4票-点心楼4票')
    await checkRwd(page, '计票板', [page.getByRole('button', { name: '数好了，看结果' }), page.getByRole('button', { name: '收起' }), plus.nth(2)])
    await page.getByRole('button', { name: '数好了，看结果' }).click()
    await expect(page.getByTestId('game-layer')).toBeVisible()
    await shot(page, testInfo, '32-数好了-平票-App来当判官')
    await page.getByRole('button', { name: '回到列表' }).click()
    await expect(page.getByRole('button', { name: /这一餐已经定了/ })).toBeVisible()
    await shot(page, testInfo, '33-回到列表-这一餐已经定了-看一看')
    await page.getByRole('button', { name: /选不了？/ }).click()
    await expect(page.getByTestId('game-layer')).toContainText('这一餐已经定了')
    await shot(page, testInfo, '34-想再猜拳-这一餐已经定了-愿赌服输')
  })

  test('演示：只看营业中关掉、救援卡（火锅只剩 1 家能去）、显示全部店', async ({ page }, testInfo) => {
    await openApp(page)
    await search(page, /中餐/, '都可以')
    await page.getByRole('switch', { name: /只看营业中/ }).click()
    await expect(page.getByRole('switch', { name: /只看营业中/ })).toHaveAttribute('aria-checked', 'false')
    await shot(page, testInfo, '40-关掉只看营业中-休息中的店也出来了')
    await page.getByRole('switch', { name: /只看营业中/ }).click()
    await page.getByRole('button', { name: '重新选择' }).click()
    await search(page, /火锅/, '吃饭')
    await expect(page.getByText(loose('只剩 1 家能去'))).toBeVisible()
    await shot(page, testInfo, '41-救援卡-火锅只剩1家能去-换一样还是找远一点')
    await checkRwd(page, '救援卡', [
      page.getByRole('button', { name: '🎲 换个菜系再摇' }),
      page.getByRole('button', { name: loose('扩大到 3 公里再找') }),
      page.getByRole('button', { name: '显示全部店（含休息中）' }),
    ])
    await page.getByRole('button', { name: '显示全部店（含休息中）' }).click()
    await expect(page.getByRole('switch', { name: /只看营业中/ })).toHaveAttribute('aria-checked', 'false')
    await shot(page, testInfo, '42-显示全部店-只是这一次')
    await page.getByRole('button', { name: '🎲 换个菜系再摇' }).click()
    await expect(page.getByRole('dialog', { name: '🎲 帮你随便挑' })).toBeVisible()
    await shot(page, testInfo, '43-换个菜系再摇-这次不摇火锅')
  })

  test('演示：半夜日本餐都打烊了的救援卡', async ({ page }, testInfo) => {
    await openApp(page, { time: LATE_NIGHT })
    await search(page, /日本餐/, '都可以')
    await expect(page.getByText(/都打烊了/)).toBeVisible()
    await shot(page, testInfo, '44-救援卡-半夜日本餐都打烊了-换一样吃吧')
  })

  test('演示：附近没找到（0.5 公里素食饭）→ 扩大范围 / 换成不限 / 换个菜系再摇', async ({ page }, testInfo) => {
    await openApp(page, { storage: { 'meishi.radius_km': '0.5' } })
    await search(page, /素食/, '吃饭')
    await expect(page.getByRole('heading', { name: /没找到/ })).toBeVisible()
    await shot(page, testInfo, '50-附近没找到-素食饭-扩大到1公里-换成不限')
    await checkRwd(page, '附近没找到', [
      page.getByRole('button', { name: loose('扩大到 1 公里再找') }),
      page.getByRole('button', { name: '换成「不限」再找' }),
      page.getByRole('button', { name: '🎲 换个菜系再摇' }),
      page.getByRole('button', { name: '返回首页' }),
    ])
  })

  test('真实模式（模拟的 Google）：没有密钥、网络断了、Google 错误、本月用完', async ({ page, context }, testInfo) => {
    await openApp(page, { demo: false, storage: {} })
    await page.getByRole('button', { name: '都可以', exact: true }).click()
    await expect(page.getByRole('heading', { name: '还没设置 API 密钥' })).toBeVisible()
    await shot(page, testInfo, '60-错误页-还没设置API密钥-打开设置')

    await page.evaluate((key) => localStorage.setItem('meishi.places_api_key', key), FAKE_KEY)
    await context.route('https://places.googleapis.com/**', (route) => route.abort('internetdisconnected'))
    await page.reload()
    await page.getByRole('button', { name: '都可以', exact: true }).click()
    await expect(page.getByRole('heading', { name: '网络好像断了' })).toBeVisible()
    await shot(page, testInfo, '61-错误页-网络好像断了-重试')

    await context.unroute('https://places.googleapis.com/**')
    await context.route('https://places.googleapis.com/**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({
          error: {
            code: 403,
            message: 'Requests from referer http://127.0.0.1:5181/ are blocked.',
            status: 'PERMISSION_DENIED',
            details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_HTTP_REFERRER_BLOCKED' }],
          },
        }),
      }),
    )
    await page.getByRole('button', { name: '重试' }).click()
    await expect(page.getByRole('heading', { name: loose('Google 返回了错误（403）') })).toBeVisible()
    await shot(page, testInfo, '62-错误页-Google返回了错误403-网站限制没对上')

    await page.evaluate((key) => localStorage.setItem(key, '900'), `meishi.text_search_${losAngelesMonth('2026-10-17T12:15:00+08:00')}`)
    await page.getByRole('button', { name: '返回首页' }).click()
    await page.reload()
    await page.getByRole('button', { name: '都可以', exact: true }).click()
    await expect(page.getByRole('heading', { name: /本月免费次数已用完/ })).toBeVisible()
    await shot(page, testInfo, '63-错误页-本月免费次数已用完')
  })

  test('定位的错误页：浏览器挡住了（怎么打开？）、拿不到你的位置', async ({ page, context }, testInfo) => {
    await openApp(page)
    await blockLocation(context, page)
    await page.reload()
    await page.getByRole('button', { name: '吃饭', exact: true }).click()
    await expect(page.getByRole('heading', { name: '需要定位权限' })).toBeVisible()
    await shot(page, testInfo, '64-错误页-定位被浏览器挡住-怎么打开-重试')
  })

  test('定位的错误页：拿不到你的位置', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(Geolocation.prototype, 'getCurrentPosition', {
        configurable: true,
        value(_ok: PositionCallback, fail?: PositionErrorCallback | null) {
          setTimeout(() => fail?.({ code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError), 20)
        },
      })
    })
    await openApp(page)
    await page.getByRole('button', { name: '吃饭', exact: true }).click()
    await expect(page.getByRole('heading', { name: '拿不到你的位置' })).toBeVisible()
    await shot(page, testInfo, '65-错误页-拿不到你的位置-重试')
  })

  test.describe('电脑 Chrome 有内建翻译（假的翻译器）', () => {
    test.use({ builtInTranslator: 'fake' })

    test('真实模式（模拟的 Google）：机翻的店名 +「机翻」+ 招牌原名', async ({ page, context }, testInfo) => {
      await mockPlacesWithPhotos(context)
      await openApp(page, { demo: false, time: DINNER_TIME, storage: { 'meishi.places_api_key': FAKE_KEY } })
      await page.getByRole('button', { name: '吃饭', exact: true }).click()
      await expect(page.getByRole('article', { name: '东方之星扁担饭餐厅' }).getByText('机翻', { exact: true })).toBeVisible()
      await expect(page.getByText(/📷/).first()).toBeVisible()
      await shot(page, testInfo, '72-电脑Chrome有内建翻译-机翻标签-下面是招牌原名')
    })
  })

  test('真实模式（模拟的 Google）：照片和作者、原名 + 大概意思、部分失败、刚刚搜过', async ({ page, context }, testInfo) => {
    const google = await mockPlacesWithPhotos(context, { failSecondQuery: true })
    await openApp(page, { demo: false, time: DINNER_TIME, storage: { 'meishi.places_api_key': FAKE_KEY } })
    await page.getByRole('button', { name: '吃饭', exact: true }).click()
    await expect(page.getByText(/有一部分搜索没成功/)).toBeVisible()
    await expect(page.getByText(/📷/).first()).toBeVisible()
    await shot(page, testInfo, '70-真实-照片和作者-原名下面大概意思-部分失败可重新搜索')
    google.failSecondQuery = false
    await page.getByRole('button', { name: '重新搜索' }).click()
    await expect(page.getByText(/有一部分搜索没成功/)).toBeHidden()
    await page.getByRole('button', { name: '重新选择' }).click()
    await page.getByRole('button', { name: '吃饭', exact: true }).click()
    await expect(page.getByText(/刚刚搜过/)).toBeVisible()
    await shot(page, testInfo, '71-真实-刚刚搜过-直接用上次的结果')
  })

  test('设置：一般（演示、剩余次数、摇一摇、清除记录）→ 进阶（密钥、申请步骤、网站网址）', async ({ page }, testInfo) => {
    await openApp(page)
    await search(page, /中餐/, '都可以')
    await page.getByRole('button', { name: '导航' }).first().click()
    await page.getByRole('button', { name: '设置' }).click()
    const settings = page.getByRole('dialog', { name: '设置' })
    await expect(settings.getByRole('button', { name: /清除吃过的记录/ })).toBeVisible()
    await shot(page, testInfo, '80-设置-一般-演示开关-剩余次数-摇一摇-清除吃过的记录')
    await settings.getByRole('button', { name: /进阶：Google 密钥/ }).click()
    await expect(settings.getByLabel('Places API 密钥')).toBeVisible()
    await page.waitForTimeout(400)
    await shot(page, testInfo, '81-设置-进阶-密钥框-申请步骤')
    await settings.getByText('📖 怎么申请密钥？一步一步来').evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await shot(page, testInfo, '82-设置-进阶-怎么申请密钥-一步一步')
    await settings.getByText('网站网址').evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await shot(page, testInfo, '83-设置-进阶-网站限制要填两行-本月用量')
    await settings.getByLabel('Places API 密钥').fill('test-key-typed-into-settings')
    await settings.getByRole('button', { name: '显示密钥' }).click()
    await settings.getByRole('button', { name: '保存密钥' }).scrollIntoViewIfNeeded()
    await shot(page, testInfo, '84-设置-打了密钥-显示密钥-保存密钥')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '密钥还没保存，要保存吗？' })).toBeVisible()
    await shot(page, testInfo, '85-设置-没保存就离开-要保存吗')
    await page.getByRole('button', { name: '不保存' }).click()
    await page.getByRole('button', { name: '设置' }).click()
    await page.getByRole('dialog', { name: '设置' }).getByRole('switch', { name: /演示模式/ }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: '今天想吃什么？' })).toBeVisible()
    await shot(page, testInfo, '86-设置-关掉演示-演示结果马上回首页')
  })

  test('深色模式、字体放大 1.3 倍的结果页', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await openApp(page)
    await search(page, /中餐/, '都可以')
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.waitForTimeout(3300)
    await shot(page, testInfo, '90-深色-结果页-营业中绿色-快关门橙色')
    await page.emulateMedia({ colorScheme: 'light' })
    await openApp(page, { fontScale: 1.3 })
    await search(page, /中餐/, '都可以')
    await expect(page.getByRole('heading', { name: loose('附近最强 3 家') })).toBeVisible()
    await page.waitForTimeout(300)
    await shot(page, testInfo, '91-字体1.3倍-结果页-不断字')
    await scrollTop(page)
  })
})
