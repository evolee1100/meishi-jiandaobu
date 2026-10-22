/**
 * 画面第 3 块（游戏层：剪刀石头布 / 帮我挑一家 / 🎡 转盘、「就这一家吧！」、🃏 任务卡、🎯 谁来做、🤝 愿赌服输）走一遍并截图：
 * npm run shots。只在 e2e/sizes.ts 里 shots: true 的尺寸拍，存到 测试截图-开发中/游戏、就这一家吧/<尺寸>/。全部用演示店。
 * 每一步也顺便做响应式检查（没有横向滚动、可点的东西够大、主要按钮看得到）。
 */
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { checkRwd, expect, loose, test } from './fixtures.ts'
import { circle, demoResults, playRps } from './game-helpers.ts'
import { stubDeviceApis } from './results-helpers.ts'
import { sizeOf } from './sizes.ts'

const SHOT_ROOT = path.resolve('测试截图-开发中', '游戏、就这一家吧')

async function shot(page: Page, testInfo: TestInfo, name: string, fullPage = false): Promise<void> {
  const size = sizeOf(testInfo.project.name)
  const file = path.join(SHOT_ROOT, size?.label ?? testInfo.project.name, `${name}.png`)
  await mkdir(path.dirname(file), { recursive: true })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide', fullPage })
}

async function scrollBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
}

test.describe('画面第 3 块走一遍（截图）', { tag: '@shots' }, () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!sizeOf(testInfo.project.name)?.shots, '这个尺寸不拍整套截图')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await stubDeviceApis(page)
  })

  test('✊✌️🖐️ 剪刀石头布：等你先出拳 → 揭晓 → 就这一家吧！→ 任务卡 → 谁来做', async ({ page }, testInfo) => {
    await demoResults(page)
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await expect(page.getByTestId('game-layer')).toHaveAttribute('data-phase', 'choose')
    await shot(page, testInfo, '01-剪刀石头布-等你先出拳-改用饭桌模式')
    await checkRwd(page, '剪刀石头布', [
      page.getByRole('button', { name: /^石头，代表第/ }),
      page.getByRole('button', { name: /^布，代表第/ }),
      page.getByRole('button', { name: /改用饭桌模式/ }),
    ])
    await page.getByRole('button', { name: /^石头，代表第/ }).click()
    await expect(page.getByTestId('game-layer')).toHaveAttribute('data-phase', 'reveal')
    await shot(page, testInfo, '02-揭晓-App出拳-判定')
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(400)
    await shot(page, testInfo, '03-就这一家吧-判定-台词-赢家卡-导航过去')
    await checkRwd(page, '就这一家吧', [
      page.getByRole('button', { name: '导航过去' }),
      page.getByRole('button', { name: loose('不服！再来一局') }),
      page.getByRole('button', { name: '回到列表' }),
      page.getByRole('button', { name: '📤 告诉朋友' }),
    ])
    await scrollBottom(page)
    await shot(page, testInfo, '04-滑到底-今天的战绩-抽一张饭桌任务卡')
    await page.getByRole('button', { name: '饭桌任务卡，点一下翻牌' }).click()
    await expect(page.getByText('🃏 饭桌任务')).toBeVisible()
    await page.waitForTimeout(300)
    await shot(page, testInfo, '05-任务卡翻开-转一下看谁来做')
    const who = page.getByRole('button', { name: '🎯 转一下，看谁来做' })
    if ((await who.count()) > 0) {
      await checkRwd(page, '任务卡翻开', [who])
      await who.click()
      await expect(page.getByText('几个人一起？')).toBeVisible()
      await shot(page, testInfo, '06-几个人一起-2到6')
      await checkRwd(page, '几个人一起', [page.getByRole('radio', { name: loose('2 个人') }), page.getByRole('radio', { name: loose('6 个人') })])
      await page.getByRole('radio', { name: loose('4 个人') }).click()
      await expect(page.getByText(/就是你了！/)).toBeVisible({ timeout: 6000 })
      await shot(page, testInfo, '07-谁来做转盘-就是你了')
    }
    await page.getByRole('button', { name: '📤 告诉朋友' }).click()
    await expect(page.getByText(/已经复制好了/)).toBeVisible()
    await shot(page, testInfo, '08-告诉朋友-已经复制好了-用WhatsApp发')
  })

  test('🎲 帮我挑一家（圈 2 家）→ 停在这一家 → 就这一家吧！→ 不服再来一局 → 🔒 这一餐定了', async ({ page }, testInfo) => {
    await demoResults(page)
    await circle(page, 2)
    await page.getByRole('button', { name: loose('在我圈的 2 家里挑') }).click()
    await expect(page.getByText('停在这一家！')).toBeVisible()
    await shot(page, testInfo, '10-帮我挑一家-停在这一家')
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 6000 })
    await page.waitForTimeout(400)
    await shot(page, testInfo, '11-帮我挑一家-就这一家吧')
    await page.getByRole('button', { name: loose('不服！再来一局') }).click()
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 6000 })
    await expect(page.getByText('🔒 这一餐定了')).toBeVisible()
    await page.waitForTimeout(400)
    await shot(page, testInfo, '12-不服用掉了-这一餐定了-老天帮你挑的')
    await checkRwd(page, '这一餐定了', [page.getByRole('button', { name: '回到列表' }), page.getByRole('button', { name: '📤 告诉朋友' })])
    await page.getByRole('button', { name: '回到列表' }).click()
    await page.getByRole('button', { name: '清空' }).click()
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await expect(page.getByText(loose('这一餐已经定了 🤝 愿赌服输'))).toBeVisible()
    await shot(page, testInfo, '13-反悔用完了再玩-这一餐已经定了-愿赌服输')
    await scrollBottom(page)
    await page.getByRole('button', { name: '大家都同意重来？' }).click()
    const ask = page.getByTestId('restart-dialog')
    await expect(ask).toBeVisible()
    await shot(page, testInfo, '14-大家都同意重来-要所有人都点头哦')
    await checkRwd(page, '大家都同意重来', [ask.getByRole('button', { name: /大家都点头了/ }), ask.getByRole('button', { name: '算了' })])
    await ask.getByRole('button', { name: /大家都点头了/ }).click()
    await expect(page.getByTestId('game-layer')).toHaveAttribute('data-phase', 'choose')
    await shot(page, testInfo, '15-大家都点头了-重新猜拳')
  })

  test('🎡 转盘（圈 5 家）：转！→ 停在这一家 → 就这一家吧！', async ({ page }, testInfo) => {
    await demoResults(page)
    await circle(page, 5)
    await page.getByRole('button', { name: loose('用我圈的 5 家转转盘') }).click()
    await expect(page.getByRole('button', { name: '转转盘' })).toBeEnabled()
    await shot(page, testInfo, '20-转盘-用你圈的5家-转')
    await checkRwd(page, '转盘', [page.getByRole('button', { name: '转转盘' })])
    await page.getByRole('button', { name: '转转盘' }).click()
    await expect(page.getByText('停在这一家！')).toBeVisible()
    await shot(page, testInfo, '21-转盘-停在这一家-闪亮')
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 6000 })
    await page.waitForTimeout(400)
    await shot(page, testInfo, '22-转盘-就这一家吧')
  })

  test('📊 投票平票：App 来当判官 → 转盘自己转（中间没有按钮）→ 就这一家吧！（大家一起定的，不能反悔）', async ({ page }, testInfo) => {
    await demoResults(page)
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    const plus = page.getByRole('button', { name: /加一票$/ })
    await plus.nth(0).click()
    await plus.nth(1).click()
    await page.getByRole('button', { name: '数好了，看结果' }).click()
    await expect(page.getByText(loose('平票！App 来当判官 ⚖️')).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '转转盘' })).toHaveCount(0)
    await shot(page, testInfo, '30-投票平票-App来当判官-转盘自己转')
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('🔒 这一餐定了')).toBeVisible()
    await page.waitForTimeout(400)
    await shot(page, testInfo, '31-投票平票-就这一家吧-大家一起定的')
  })

  test('字体放大 1.3 倍：剪刀石头布和「就这一家吧！」不断字、不挡住', async ({ page }, testInfo) => {
    await demoResults(page, { fontScale: 1.3 })
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await shot(page, testInfo, '40-字体1.3倍-剪刀石头布')
    await playRps(page, '布')
    await page.waitForTimeout(400)
    await shot(page, testInfo, '41-字体1.3倍-就这一家吧')
  })
})
