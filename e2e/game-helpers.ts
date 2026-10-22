/**
 * 游戏层、👥 饭桌模式的浏览器测试共用的小步骤（全部用演示店，不连外部网站）。
 */
import type { Page } from '@playwright/test'
import { expect, loose, openApp, type OpenOptions } from './fixtures.ts'

/** 演示：中餐、都可以 → 结果页（午餐时间这一页 3 家都能去）。 */
export async function demoResults(page: Page, options: OpenOptions = {}): Promise<void> {
  await openApp(page, options)
  await page.getByRole('radio', { name: /中餐/ }).click()
  await page.getByRole('button', { name: '都可以', exact: true }).click()
  await expect(page.getByRole('heading', { name: loose('附近最强 3 家') })).toBeVisible()
}

/** ❤️ 圈 n 家：先圈这一页的，不够再换 3 家接着圈。 */
export async function circle(page: Page, n: number): Promise<void> {
  let done = 0
  while (done < n) {
    const hearts = page.getByRole('button', { name: /^圈起来：/ })
    if ((await hearts.count()) === 0) {
      await page.getByRole('button', { name: loose('换 3 家') }).click()
      continue
    }
    await hearts.first().click()
    done++
  }
}

/** 圈 4 家 → 👥 饭桌模式。 */
export async function openTableWithFour(page: Page): Promise<void> {
  await circle(page, 4)
  await page.getByRole('button', { name: '👥 饭桌模式' }).click()
  await expect(page.getByTestId('table-layer')).toBeVisible()
}

/** 剪刀石头布（这一页 3 家）→ 改用饭桌模式。 */
export async function openTableFromRps(page: Page): Promise<void> {
  await page.getByRole('button', { name: /剪刀石头布/ }).click()
  await page.getByRole('button', { name: /改用饭桌模式/ }).click()
  await expect(page.getByTestId('table-layer')).toBeVisible()
}

/** 现在可以划的卡（还没划、不在撤销中）。 */
export function cuttable(page: Page) {
  return page.getByRole('button', { name: /^划掉：/ })
}

/** 「几个人？」选 n 个。 */
export async function pickPlayers(page: Page, n: number): Promise<void> {
  await page.getByRole('radio', { name: loose(`${n} 个人`) }).click()
  await expect(page.getByRole('radio', { name: loose(`${n} 个人`) })).toHaveAttribute('aria-checked', 'true')
}

/** 剪刀石头布：出一个手势（✊ 第 1 家、✌️ 第 2 家、🖐️ 第 3 家），等到「就这一家吧！」。 */
export async function playRps(page: Page, hand: '石头' | '剪刀' | '布' = '石头'): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${hand}，代表第`) }).click()
  await expect(page.getByRole('button', { name: '导航过去' })).toBeVisible({ timeout: 8000 })
}

/** 🙈 暗中出拳：每个人照 hands 出拳（按传手机的顺序），一直到「全部出完了」页。 */
export async function secretHands(page: Page, hands: readonly ('石头' | '剪刀' | '布')[]): Promise<void> {
  for (let turn = 0; turn < hands.length; turn++) {
    await page.getByRole('button', { name: loose('我拿到了，开始出拳') }).click()
    await page.getByRole('button', { name: new RegExp(`^\\S+ ${hands[turn]}，代表`) }).click()
    await page.getByRole('button', { name: turn === hands.length - 1 ? loose('出好了，叫大家过来 👀') : /^交给/ }).click()
  }
  await expect(page.getByTestId('secret-all-done')).toBeVisible()
}
