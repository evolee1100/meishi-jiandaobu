/**
 * 画面第 4 块（👥 饭桌模式）在真浏览器里的检查（phone-390x844、phone-360x740、desktop-1280x800）：
 * 有动画时划刀（印章 → 撕开 → 收起）真的播完、卡片收起来；暗中出拳一起翻牌后 1.8 秒自己看结果；
 * 返回键 / Esc 玩到一半先问；重新整理后饭桌不留（只有结果会留）；深色模式；中文输入法打名字。全部用演示店。
 */
import { expect, loose, test } from './fixtures.ts'
import { cuttable, demoResults, openTableFromRps, openTableWithFour, pickPlayers, secretHands } from './game-helpers.ts'
import { stubDeviceApis } from './results-helpers.ts'

test.describe('画面第 4 块：饭桌模式', () => {
  test.beforeEach(async ({ page }) => {
    await stubDeviceApis(page)
  })

  test('有动画：划一刀 → 红色印章「✂️ 不吃！」→ 撕开 → 卡片收起来（1.2 秒）；撤销 3 秒后自己轮到下一位', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await demoResults(page)
    await openTableWithFour(page)
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await expect(page.getByTestId('veto-card')).toHaveCount(4)
    await cuttable(page).first().click()
    await expect(page.locator('.veto-card__stamp').first()).toBeVisible()
    await expect(page.locator('.veto-half')).toHaveCount(2)
    await expect(page.getByTestId('veto-card')).toHaveCount(3, { timeout: 3000 })
    await expect(page.getByRole('button', { name: '撤销' })).toBeVisible()
    await expect(page.getByRole('button', { name: '撤销' })).toHaveCount(0, { timeout: 5000 })
    await expect(page.getByText(loose('还要划 2 刀'))).toBeVisible()
    await expect(cuttable(page)).toHaveCount(3)
  })

  test('撤销：卡片马上回来（动画还没播完也一样）', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await demoResults(page)
    await openTableWithFour(page)
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await cuttable(page).first().click()
    await page.getByRole('button', { name: '撤销' }).click()
    await expect(page.locator('.veto-half')).toHaveCount(0)
    await expect(cuttable(page)).toHaveCount(4)
    await page.waitForTimeout(1500)
    await expect(page.getByTestId('veto-card')).toHaveCount(4)
  })

  test('有动画：🙈 一起翻牌一张一张翻开 → 判定 → 1.8 秒后自己进「就这一家吧！」', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await demoResults(page)
    await openTableFromRps(page)
    await pickPlayers(page, 3)
    await page.getByRole('button', { name: /暗中出拳/ }).click()
    await secretHands(page, ['布', '布', '布'])
    await page.getByRole('button', { name: loose('全部出完了！一起翻牌 👀') }).click()
    await expect(page.locator('.reveal-hand.is-turned')).toHaveCount(3, { timeout: 2000 })
    await expect(page.getByText(/全体心有灵犀！都出/)).toBeVisible()
    await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 4000 })
    await expect(page.getByRole('button', { name: /不服/ })).toHaveCount(0)
  })

  test('返回键 / Esc：第一页直接关；玩到一半先问；重新整理以后饭桌不留，结果页还在', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await demoResults(page)
    await openTableWithFour(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('table-layer')).toHaveCount(0)
    await page.getByRole('button', { name: '👥 饭桌模式' }).click()
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    await cuttable(page).first().click()
    await page.keyboard.press('Escape')
    const ask = page.getByRole('dialog', { name: '饭桌还没玩完，要结束吗？' })
    await expect(ask).toBeVisible()
    await page.keyboard.press('Escape') // 再按一次：只关问题（= 继续玩）
    await expect(ask).toHaveCount(0)
    await expect(page.getByTestId('veto-board')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('table-layer')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '👥 饭桌模式' })).toBeVisible()
  })

  test('改名字：中文输入法打拼音时不会被 6 个字挡住，选好字才检查；只存在这个浏览器（重新整理还在）', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await demoResults(page)
    await openTableWithFour(page)
    await page.getByRole('button', { name: /熊猫，点一下改名字/ }).click()
    const input = page.getByRole('dialog').getByRole('textbox')
    await input.click()
    // 模拟输入法：先出拼音（超过 6 个字母），选字后变成「陈大伯的女儿」
    await input.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      setter?.call(el, 'chendabodenver')
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    })
    await expect(input).toHaveValue('chendabodenver')
    await input.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(el, '陈大伯的女儿')
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '陈大伯的女儿' }))
    })
    await expect(input).toHaveValue('陈大伯的女儿')
    await page.getByRole('dialog').getByRole('button', { name: '好' }).click()
    await expect(page.getByRole('button', { name: /🐼 陈大伯的女儿，点一下改名字/ })).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: '👥 饭桌模式' }).click()
    await expect(page.getByRole('button', { name: /🐼 陈大伯的女儿，点一下改名字/ })).toBeVisible()
  })

  test('WEB-23 深色模式：饭桌第一页、划刀卡片用深色底，字看得清', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
    await demoResults(page)
    await openTableWithFour(page)
    await page.getByRole('button', { name: /每人划一刀/ }).click()
    const colors = await page.evaluate(() => {
      const layer = document.querySelector('[data-testid="table-layer"]') as HTMLElement
      const body = document.querySelector('.veto-card__body') as HTMLElement
      return { layer: getComputedStyle(layer).backgroundColor, card: getComputedStyle(body).backgroundColor, text: getComputedStyle(body).color }
    })
    const lum = (rgb: string) => {
      const [r, g, b] = (rgb.match(/\d+/g) ?? ['0', '0', '0']).map(Number)
      return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
    }
    expect(lum(colors.layer)).toBeLessThan(60)
    expect(lum(colors.text) - lum(colors.card)).toBeGreaterThan(100)
  })
})
