/**
 * 响应式（RWD）自动测试：第三块（游戏层、「就这一家吧！」、任务卡、愿赌服输）和第四块（👥 饭桌模式）。
 * 每种尺寸（e2e/sizes.ts：最窄 320×568、各种手机、手机横屏、iPad Mini、电脑、浏览器放大 200%）都检查：
 * 没有横向滚动、主要按钮完整在画面里（滑得到也算）而且没被挡住、可以点的东西至少 44×44。
 * 第一、二块在 rwd.spec.ts。
 */
import { checkRwd, expect, loose, test } from './fixtures.ts'
import { circle, cuttable, demoResults, openTableFromRps, openTableWithFour, pickPlayers, playRps, secretHands } from './game-helpers.ts'
import { stubDeviceApis } from './results-helpers.ts'

test.describe('RWD：第三块（游戏层、就这一家吧、任务卡、愿赌服输）', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await stubDeviceApis(page)
  })

  test('剪刀石头布：三个手势、改用饭桌模式 → 就这一家吧（导航、不服、回到列表、告诉朋友、任务卡）', async ({ page }) => {
    await demoResults(page)
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await checkRwd(page, '剪刀石头布', [
      page.getByRole('button', { name: /^石头，代表第/ }),
      page.getByRole('button', { name: /^剪刀，代表第/ }),
      page.getByRole('button', { name: /^布，代表第/ }),
      page.getByRole('button', { name: /改用饭桌模式/ }),
    ])
    await playRps(page, '剪刀')
    await checkRwd(page, '就这一家吧', [
      page.getByRole('button', { name: '导航过去' }),
      page.getByRole('button', { name: loose('不服！再来一局') }),
      page.getByRole('button', { name: '回到列表' }),
      page.getByRole('button', { name: '📤 告诉朋友' }),
      page.getByRole('button', { name: '饭桌任务卡，点一下翻牌' }),
    ])
  })

  test('任务卡 → 转一下看谁来做 → 几个人一起？→ 谁来做转盘', async ({ page }) => {
    await demoResults(page)
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await playRps(page, '石头')
    await page.getByRole('button', { name: '饭桌任务卡，点一下翻牌' }).click()
    await expect(page.getByText('🃏 饭桌任务')).toBeVisible()
    const who = page.getByRole('button', { name: '🎯 转一下，看谁来做' })
    if ((await who.count()) === 0) return // 免死金牌：没有「谁来做」
    await checkRwd(page, '任务卡翻开', [who])
    await who.click()
    await checkRwd(page, '几个人一起', [page.getByRole('radio', { name: loose('2 个人') }), page.getByRole('radio', { name: loose('6 个人') })])
    await page.getByRole('radio', { name: loose('6 个人') }).click()
    await expect(page.getByText(/就是你了！/)).toBeVisible({ timeout: 6000 })
    await checkRwd(page, '谁来做转盘', [page.getByTestId('task-wheel'), page.getByText(/就是你了！/)])
  })

  test('帮我挑一家（圈 2 家）→ 不服 → 🔒 这一餐定了 → 再玩：这一餐已经定了 🤝 愿赌服输 → 大家都同意重来？', async ({ page }) => {
    await demoResults(page)
    await circle(page, 2)
    await page.getByRole('button', { name: loose('在我圈的 2 家里挑') }).click()
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 6000 })
    await page.getByRole('button', { name: loose('不服！再来一局') }).click()
    await expect(page.getByText('🔒 这一餐定了')).toBeVisible({ timeout: 6000 })
    await checkRwd(page, '这一餐定了', [page.getByRole('button', { name: '导航过去' }), page.getByRole('button', { name: '回到列表' })])
    await page.getByRole('button', { name: '回到列表' }).click()
    await page.getByRole('button', { name: '清空' }).click()
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await expect(page.getByText(loose('这一餐已经定了 🤝 愿赌服输'))).toBeVisible()
    await checkRwd(page, '愿赌服输-锁住', [page.getByRole('button', { name: '大家都同意重来？' }), page.getByRole('button', { name: '导航过去' })])
    await page.getByRole('button', { name: '大家都同意重来？' }).click()
    const ask = page.getByTestId('restart-dialog')
    await checkRwd(page, '大家都同意重来', [ask.getByRole('button', { name: /大家都点头了/ }), ask.getByRole('button', { name: '算了' })])
  })

  test('🎡 转盘（圈 6 家）：转！→ 停在这一家', async ({ page }) => {
    await demoResults(page)
    await circle(page, 6)
    await page.getByRole('button', { name: loose('用我圈的 6 家转转盘') }).click()
    await checkRwd(page, '转盘', [page.getByRole('button', { name: '转转盘' }), page.getByTestId('duel-wheel')])
    await page.getByRole('button', { name: '转转盘' }).click()
    await expect(page.getByText('停在这一家！')).toBeVisible()
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 6000 })
    await checkRwd(page, '转盘-就这一家吧', [page.getByRole('button', { name: '导航过去' })])
  })

  test('字体放大 1.3 倍：剪刀石头布、就这一家吧不断字、不挡住', async ({ page }) => {
    await demoResults(page, { fontScale: 1.3 })
    await page.getByRole('button', { name: /剪刀石头布/ }).click()
    await checkRwd(page, '字体1.3倍-剪刀石头布', [page.getByRole('button', { name: /^布，代表第/ }), page.getByRole('button', { name: /改用饭桌模式/ })])
    await playRps(page, '布')
    await checkRwd(page, '字体1.3倍-就这一家吧', [page.getByRole('button', { name: '导航过去' }), page.getByRole('button', { name: '回到列表' })])
  })
})

test.describe('RWD：第四块（👥 饭桌模式）', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await stubDeviceApis(page)
  })

  test('第一页：几个人、6 个头像、两张大卡 → 改名字', async ({ page }) => {
    await demoResults(page)
    await openTableWithFour(page)
    await checkRwd(page, '饭桌第一页', [
      page.getByRole('radio', { name: loose('2 个人') }),
      page.getByRole('radio', { name: loose('6 个人') }),
      page.getByRole('button', { name: /小狗，点一下改名字/ }),
      page.getByRole('button', { name: /每人划一刀/ }),
    ])
    await page.getByRole('button', { name: /老虎，点一下改名字/ }).click()
    const dialog = page.getByRole('dialog', { name: /改个名字/ })
    await checkRwd(page, '改名字', [dialog.getByRole('textbox'), dialog.getByRole('button', { name: '好' }), dialog.getByRole('button', { name: '用回原来的名字' })])
  })

  test('✂️ 划一刀（6 家、2 个人）：卡片放得下、撤销、最后一刀', async ({ page }) => {
    await demoResults(page)
    await circle(page, 6)
    await page.getByRole('button', { name: '👥 饭桌模式' }).click()
    await pickPlayers(page, 2)
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await expect(cuttable(page)).toHaveCount(6)
    await checkRwd(page, '划一刀-6家', [cuttable(page).first(), cuttable(page).last()])
    await cuttable(page).first().click()
    await checkRwd(page, '划一刀-可撤销', [page.getByRole('button', { name: '撤销' })])
    for (let left = 5; left > 2; left--) {
      await expect(cuttable(page)).toHaveCount(left, { timeout: 6000 })
      await cuttable(page).first().click()
    }
    await expect(page.getByText(/最后一刀！/)).toBeVisible({ timeout: 6000 })
    await checkRwd(page, '划一刀-最后一刀', [cuttable(page).first(), cuttable(page).last()])
  })

  test('玩到一半按返回：饭桌还没玩完，要结束吗？', async ({ page }) => {
    await demoResults(page)
    await openTableWithFour(page)
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await cuttable(page).first().click()
    await page.goBack()
    const ask = page.getByRole('dialog', { name: '饭桌还没玩完，要结束吗？' })
    await checkRwd(page, '要结束吗', [ask.getByRole('button', { name: '结束' }), ask.getByRole('button', { name: '继续玩' })])
  })

  test('🙈 暗中出拳（6 个人）：交手机、出拳、出好了、全部出完、一起翻牌', async ({ page }) => {
    await demoResults(page)
    await openTableFromRps(page)
    await pickPlayers(page, 6)
    await page.getByRole('button', { name: /暗中出拳/ }).click()
    await checkRwd(page, '交手机', [page.getByRole('button', { name: loose('我拿到了，开始出拳') })])
    await page.getByRole('button', { name: loose('我拿到了，开始出拳') }).click()
    await checkRwd(page, '出拳', [page.getByRole('button', { name: /^✊ 石头，代表/ }), page.getByRole('button', { name: /^🖐️ 布，代表/ })])
    await page.getByRole('button', { name: /^✊ 石头，代表/ }).click()
    await checkRwd(page, '出好了', [page.getByRole('button', { name: /^交给/ }), page.getByRole('button', { name: '点错了？重出' })])
    await page.getByRole('button', { name: /^交给/ }).click()
    // 6 个人 2:2:2 → 人头一样多，转盘决胜
    await secretHands(page, ['石头', '剪刀', '剪刀', '布', '布'])
    await checkRwd(page, '全部出完', [page.getByRole('button', { name: loose('全部出完了！一起翻牌 👀') })])
    await page.getByRole('button', { name: loose('全部出完了！一起翻牌 👀') }).click()
    await expect(page.getByText(/转盘决胜/)).toBeVisible()
    await expect(page.getByRole('button', { name: '看结果 🎉' })).toBeVisible({ timeout: 6000 })
    await checkRwd(page, '一起翻牌-平票转盘', [page.getByTestId('secret-wheel'), page.getByRole('button', { name: '看结果 🎉' })])
  })

  test('字体放大 1.3 倍：饭桌第一页、划一刀不断字、不挡住', async ({ page }) => {
    await demoResults(page, { fontScale: 1.3 })
    await openTableWithFour(page)
    await checkRwd(page, '字体1.3倍-饭桌第一页', [page.getByRole('radio', { name: loose('6 个人') }), page.getByRole('button', { name: /每人划一刀/ })])
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await checkRwd(page, '字体1.3倍-划一刀', [cuttable(page).first(), cuttable(page).last()])
  })
})
