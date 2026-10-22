/**
 * 画面第 4 块（👥 饭桌模式：第一页、✂️ 每人划一刀、🙈 暗中出拳）走一遍并截图：npm run shots。
 * 只在 e2e/sizes.ts 里 shots: true 的尺寸拍，存到 测试截图-开发中/饭桌模式/<尺寸>/。全部用演示店（不连外部网站）。
 * 每一步也顺便做响应式检查（没有横向滚动、可点的东西够大、主要按钮看得到）。
 */
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import type { Page, TestInfo } from '@playwright/test'
import { checkRwd, expect, loose, test } from './fixtures.ts'
import { cuttable, demoResults, openTableFromRps, openTableWithFour, pickPlayers } from './game-helpers.ts'
import { stubDeviceApis } from './results-helpers.ts'
import { sizeOf } from './sizes.ts'

const SHOT_ROOT = path.resolve('测试截图-开发中', '饭桌模式')

async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const size = sizeOf(testInfo.project.name)
  const file = path.join(SHOT_ROOT, size?.label ?? testInfo.project.name, `${name}.png`)
  await mkdir(path.dirname(file), { recursive: true })
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' })
}

test.describe('画面第 4 块走一遍（截图）', { tag: '@shots' }, () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!sizeOf(testInfo.project.name)?.shots, '这个尺寸不拍整套截图')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await stubDeviceApis(page)
  })

  test('✂️ 每人划一刀：圈 4 家 → 5 个人、改名字 → 抽签、裁判 → 划一刀可撤销 → 最后一刀红框 → 就这一家吧！', async ({ page }, testInfo) => {
    await demoResults(page)
    await openTableWithFour(page)
    await expect(page.getByRole('heading', { name: loose('饭桌模式：传一台手机，人人都有份') })).toBeVisible()
    await shot(page, testInfo, '01-饭桌第一页-4个人-候选4家-暗中出拳要刚好3家')
    await checkRwd(page, '饭桌第一页', [
      page.getByRole('radio', { name: loose('6 个人') }),
      page.getByRole('button', { name: /每人划一刀/ }),
    ])
    await pickPlayers(page, 5)
    await page.getByRole('button', { name: /🐯 老虎，点一下改名字/ }).click()
    const dialog = page.getByRole('dialog', { name: /改个名字/ })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').fill('  小玲  ')
    await shot(page, testInfo, '02-改名字-最多6个字-只存在这部手机')
    await checkRwd(page, '改名字', [dialog.getByRole('button', { name: '好' })])
    await dialog.getByRole('button', { name: '好' }).click()
    await expect(page.getByRole('button', { name: /🐯 小玲，点一下改名字/ })).toBeVisible()
    await shot(page, testInfo, '03-5个人-老虎改名小玲')

    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await expect(page.getByTestId('veto-board')).toBeVisible()
    await expect(page.getByText(/这次当裁判/)).toBeVisible()
    await expect(page.getByText(loose('还要划 3 刀'))).toBeVisible()
    await shot(page, testInfo, '10-划一刀-抽签-两个裁判-轮到第一个人')
    await checkRwd(page, '划一刀', [cuttable(page).last()])

    await cuttable(page).first().click()
    await expect(page.getByRole('button', { name: '撤销' })).toBeVisible()
    await shot(page, testInfo, '11-划掉一家-交给下一位-点错了可以撤销')
    await checkRwd(page, '划一刀可撤销', [page.getByRole('button', { name: '撤销' })])
    await page.getByRole('button', { name: '撤销' }).click()
    await expect(cuttable(page)).toHaveCount(4)
    await cuttable(page).first().click()
    // 3 秒后撤销自己结束，轮到下一位
    await expect(page.getByText(loose('还要划 2 刀'))).toBeVisible({ timeout: 6000 })
    await cuttable(page).first().click()
    await expect(page.getByText(/最后一刀！/)).toBeVisible({ timeout: 6000 })
    await expect(page.locator('.veto-frame')).toBeVisible()
    await shot(page, testInfo, '12-最后一刀-红框-今天吃什么就看你了')
    await checkRwd(page, '最后一刀', [cuttable(page).last()])
    await cuttable(page).first().click()
    await expect(page.getByText(/剩下最后一家/)).toBeVisible()
    await shot(page, testInfo, '13-最后一刀划完-剩下最后一家-看结果')
    await page.getByRole('button', { name: '看结果 🎉' }).click()
    await expect(page.getByText(loose('就这一家吧！'))).toBeVisible()
    await expect(page.getByText(loose('大家划了 3 刀，剩下这一家！'))).toBeVisible()
    await expect(page.getByRole('button', { name: /不服/ })).toHaveCount(0)
    await shot(page, testInfo, '14-就这一家吧-划刀记录-大家一起定的不能反悔')
  })

  test('✂️ 玩到一半按返回：先问「饭桌还没玩完，要结束吗？」', async ({ page }, testInfo) => {
    await demoResults(page)
    await openTableWithFour(page)
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await cuttable(page).first().click()
    await page.goBack()
    const ask = page.getByRole('dialog', { name: '饭桌还没玩完，要结束吗？' })
    await expect(ask).toBeVisible()
    await shot(page, testInfo, '15-玩到一半按返回-饭桌还没玩完要结束吗')
    await checkRwd(page, '要结束吗', [ask.getByRole('button', { name: '结束' }), ask.getByRole('button', { name: '继续玩' })])
    await ask.getByRole('button', { name: '继续玩' }).click()
    await expect(page.getByTestId('veto-board')).toBeVisible()
    await page.getByRole('button', { name: '返回' }).click()
    await page.getByRole('dialog', { name: '饭桌还没玩完，要结束吗？' }).getByRole('button', { name: '结束' }).click()
    await expect(page.getByTestId('table-layer')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '👥 饭桌模式' })).toBeVisible()
  })

  test('🙈 暗中出拳：剪刀石头布改用饭桌 → 3 个人 → 交手机 → 出拳 → 出好了 → 全部出完 → 一起翻牌 → 就这一家吧！', async ({ page }, testInfo) => {
    await demoResults(page)
    await openTableFromRps(page)
    await pickPlayers(page, 3)
    await shot(page, testInfo, '20-饭桌第一页-3家-可以暗中出拳')
    await page.getByRole('button', { name: /暗中出拳/ }).click()

    for (let turn = 0; turn < 3; turn++) {
      await expect(page.getByTestId('secret-handover')).toBeVisible()
      if (turn === 0) {
        await shot(page, testInfo, '21-交手机-交给第一个人-别给别人看哦')
        await checkRwd(page, '交手机', [page.getByRole('button', { name: loose('我拿到了，开始出拳') })])
      }
      await page.getByRole('button', { name: loose('我拿到了，开始出拳') }).click()
      await expect(page.getByTestId('secret-choose')).toBeVisible()
      if (turn === 0) {
        await shot(page, testInfo, '22-偷偷出一个手势-手势下面是店名')
        await checkRwd(page, '出拳', [page.getByRole('button', { name: /^✊ 石头，代表/ }), page.getByRole('button', { name: /^🖐️ 布，代表/ })])
      }
      await page.getByRole('button', { name: turn === 2 ? /^✌️ 剪刀，代表/ : /^✊ 石头，代表/ }).click()
      await expect(page.getByTestId('secret-choose')).toHaveAttribute('data-step', 'chosen')
      if (turn === 0) {
        await page.waitForTimeout(400)
        await shot(page, testInfo, '23-出好了-三张一起翻过去-交给下一位-点错了重出')
        await checkRwd(page, '出好了', [page.getByRole('button', { name: /^交给/ }), page.getByRole('button', { name: '点错了？重出' })])
      }
      await page.getByRole('button', { name: turn === 2 ? loose('出好了，叫大家过来 👀') : /^交给/ }).click()
    }

    await expect(page.getByTestId('secret-all-done')).toBeVisible()
    await shot(page, testInfo, '24-全部出完了-大家围过来一起看')
    await checkRwd(page, '全部出完', [page.getByRole('button', { name: loose('全部出完了！一起翻牌') })])
    await page.getByRole('button', { name: loose('全部出完了！一起翻牌') }).click()
    await expect(page.getByText(/石头赢！/)).toBeVisible()
    await shot(page, testInfo, '25-一起翻牌-两个人出石头一个人出剪刀-石头赢')
    await checkRwd(page, '一起翻牌', [page.getByRole('button', { name: '看结果 🎉' })])
    await expect(page.getByText(loose('就这一家吧！'))).toBeVisible({ timeout: 5000 })
    await shot(page, testInfo, '26-就这一家吧-暗中出拳记录')
  })
})
