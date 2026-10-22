/**
 * 画面第 2 块（搜索流程、结果页、设置）在真浏览器里的检查（phone-390x844、phone-360x740、desktop-1280x800）：
 * 第一屏看得到几家（WEB-24）、永远免费（演示 0 个请求、真实每次搜索最多 3 个 + 每家最多 1 张照片）、分享 / 复制（WEB-19）、
 * 导航（WEB-20）、时间在走、手机键盘、返回键和重新整理、减少动画（WEB-22）、深色模式（WEB-23）。
 * 真实模式一律用模拟的 Google（mockPlacesWithPhotos），绝不连真的 Google、绝不用真的密钥。
 */
import type { Page } from '@playwright/test'
import { DINNER_TIME, expect, FAKE_KEY, loose, openApp, test } from './fixtures.ts'
import { copiedTexts, mockPlacesWithPhotos, openedUrls, stubDeviceApis } from './results-helpers.ts'

async function searchFor(page: Page, cuisine: RegExp | null, meal: '吃饭' | '吃面' | '都可以'): Promise<void> {
  if (cuisine) await page.getByRole('radio', { name: cuisine }).click()
  await page.getByRole('button', { name: meal, exact: true }).click()
  await expect(page.getByRole('button', { name: '重新选择' })).toBeVisible()
}

/** 底栏上缘（没有底栏就是画面最下面）。 */
async function barTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const bar = document.querySelector('.results-bar')
    return bar ? bar.getBoundingClientRect().top : window.innerHeight
  })
}

test.describe('画面第 2 块：搜索流程、结果页、设置', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await stubDeviceApis(page)
  })

  for (const fontScale of [1, 1.3]) {
    test(`WEB-24 结果页第一屏（字体 ${fontScale} 倍）：不用滑就看到至少 2 家的店名、星数和距离`, async ({ page }) => {
      await openApp(page, { fontScale })
      await searchFor(page, /中餐/, '都可以')
      const limit = await barTop(page)
      for (const index of [0, 1]) {
        const card = page.getByRole('article').nth(index)
        for (const part of [card.locator('.place-name__name'), card.locator('.rating-line')]) {
          const box = await part.boundingBox()
          expect(box, `第 ${index + 1} 家`).not.toBeNull()
          expect((box?.y ?? 0) + (box?.height ?? 0), `第 ${index + 1} 家的店名 / 星数和距离要在底栏上面`).toBeLessThanOrEqual(limit + 1)
        }
      }
      const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }))
      expect(width.scroll).toBeLessThanOrEqual(width.inner)
    })
  }

  test('WEB-02 演示：搜索、换 3 家、只看营业中、❤️、投票、分享、导航——一个 Google 请求都没有（测试连不到外部网站，连了就失败）', async ({ page }) => {
    let google = 0
    await page.context().route(/googleapis\.com|googleusercontent\.com/, async (route) => {
      google++
      await route.abort()
    })
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await page.getByRole('switch', { name: /只看营业中/ }).click()
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    await page.getByRole('button', { name: '导航' }).first().click()
    await page.getByRole('button', { name: '重新选择' }).click()
    expect(google).toBe(0)
    // WEB-20：导航用新分页打开 Google 地图的普通网址（不带密钥）
    const urls = await openedUrls(page)
    expect(urls).toHaveLength(1)
    expect(urls[0]).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d{7}%2C-?\d+\.\d{7}/)
    expect(urls[0]).not.toMatch(/key=/)
  })

  test('永远免费（模拟的 Google）：一次搜索 3 个文字搜索 + 画面上每家 1 张照片；换 3 家只拿新店的照片；只看营业中、回到前 3 名、10 分钟内再搜都不花', async ({ page, context }) => {
    const google = await mockPlacesWithPhotos(context)
    await openApp(page, { demo: false, time: DINNER_TIME, storage: { 'meishi.places_api_key': FAKE_KEY } })
    await searchFor(page, null, '吃饭')
    await expect(page.getByText(/📷/).first()).toBeVisible()
    expect(google.textSearches).toHaveLength(3)
    expect(google.photoRequests).toHaveLength(3)
    for (const body of google.textSearches) {
      const sent = JSON.parse(body) as Record<string, unknown>
      expect(Object.keys(sent).sort()).toEqual(['languageCode', 'locationRestriction', 'pageSize', 'regionCode', 'textQuery'])
    }
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await expect(page.getByRole('heading', { name: loose('附近第 4–6 名') })).toBeVisible()
    await expect.poll(() => google.photoRequests.length).toBe(6)
    await page.getByRole('button', { name: loose('回到前 3 名') }).click()
    await expect(page.getByRole('heading', { name: loose('附近最强 3 家') })).toBeVisible()
    await page.getByRole('switch', { name: /只看营业中/ }).click()
    await page.getByRole('switch', { name: /只看营业中/ }).click()
    await page.getByRole('button', { name: '重新选择' }).click()
    await searchFor(page, null, '吃饭')
    await expect(page.getByText(/刚刚搜过/)).toBeVisible()
    await page.waitForTimeout(300)
    expect(google.textSearches).toHaveLength(3)
    expect(google.photoRequests).toHaveLength(6)
    // 照片请求不带自订请求头（密钥放网址参数），照片本身从 googleusercontent 读
    for (const url of google.photoRequests) expect(url).toMatch(/\/media\?maxWidthPx=800&skipHttpRedirect=true&key=/)
    // 没有机翻的马来文 / 英文店名：原名 + 大概意思
    await expect(page.getByText('大概意思：餐厅、扁担饭')).toBeVisible()
    // 点店名 → 用新分页打开店家的 Google 地图页面（Google 给的普通网址，不是 API、不带密钥、不算用量）
    await page.getByRole('button', { name: /^顺记瓦煲鸡饭/ }).click()
    expect(await openedUrls(page)).toEqual(['https://maps.google.com/?cid=01'])
    expect(google.textSearches).toHaveLength(3)
    expect(google.photoRequests).toHaveLength(6)
  })

  test.describe('WEB-26 电脑 Chrome 有内建翻译（假的翻译器，不下载模型）', () => {
    test.use({ builtInTranslator: 'fake' })

    test('英文 / 马来文店名机翻成中文：中文名 +「机翻」+ 招牌原名，没有「大概意思」；中文店名不翻；翻译不发 Google 请求', async ({ page, context }) => {
      const google = await mockPlacesWithPhotos(context)
      await openApp(page, { demo: false, time: DINNER_TIME, storage: { 'meishi.places_api_key': FAKE_KEY } })
      await searchFor(page, null, '吃饭')
      const malay = page.getByRole('article', { name: '东方之星扁担饭餐厅' })
      await expect(malay.getByText('机翻', { exact: true })).toBeVisible()
      await expect(malay.getByText('Restoran Nasi Kandar Bintang Timur', { exact: true })).toBeVisible()
      await expect(malay.getByText(/大概意思/)).toHaveCount(0)
      const english = page.getByRole('article', { name: '幸运鸡饭面馆' })
      await expect(english.getByText('Lucky Chicken Rice & Noodle House', { exact: true })).toBeVisible()
      const chinese = page.getByRole('article', { name: '顺记瓦煲鸡饭' })
      await expect(chinese.getByText('机翻', { exact: true })).toHaveCount(0)
      // ❤️ 的读屏、底栏名单都用机翻的中文名
      await expect(malay.getByRole('button', { name: '圈起来：东方之星扁担饭餐厅' })).toBeVisible()
      expect(google.textSearches).toHaveLength(3)
      expect(google.photoRequests).toHaveLength(3)
    })

    test('演示模式：演示店用内建的中文名，不叫浏览器的翻译器（不下载模型）', async ({ page }) => {
      await openApp(page)
      await searchFor(page, /日本餐/, '吃面')
      const sakura = page.getByRole('article', { name: '樱花拉面屋' })
      await expect(sakura.getByText('机翻', { exact: true })).toBeVisible()
      await expect(sakura.getByText('Sakura Ramen House', { exact: true })).toBeVisible()
      expect(await page.evaluate(() => (window as unknown as { __fakeTranslatorCreated: number }).__fakeTranslatorCreated)).toBe(0)
    })
  })

  test('WEB-19 📤 发到群里投票：没有分享面板就复制投票文字，底栏提示已复制；计票板出现', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '吃饭')
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    await expect(page.locator('.bar-notice')).toContainText('已经复制好了')
    const [shared] = await copiedTexts(page)
    expect(shared?.split('\n')[0]).toBe('【演示数据，不是真实的店】')
    expect(shared).toContain('午餐吃哪家？回 ✊✌️🖐️ 投票！')
    expect(shared).toContain('👉 点这里看地图：')
    expect(shared).not.toMatch(/[ ⁠​]/)
    expect(shared).not.toContain('demo_')
    await expect(page.getByRole('heading', { name: '📊 群里投票，帮你数票' })).toBeVisible()
  })

  test('WEB-19 复制也不行：显示文字让人长按复制', async ({ page }) => {
    await stubDeviceApis(page, { clipboard: false })
    await openApp(page)
    await searchFor(page, /中餐/, '吃饭')
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    const dialog = page.getByRole('dialog', { name: '复制不了，请长按下面的文字自己复制' })
    await expect(dialog.getByRole('textbox')).toHaveValue(/吃哪家？回 ✊✌️🖐️ 投票！/)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: '重新选择' })).toBeVisible()
  })

  test('HOURS-19 时间在走：结果页开着，「还有 N 分钟关门」跟着倒数（每 30 秒看一次，不发请求）', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-17T14:00:00+08:00') })
    await page.goto('./')
    await page.evaluate(() => {
      localStorage.setItem('meishi.demo_mode', 'true')
      localStorage.setItem('meishi.phone_seed', '20261017')
    })
    await page.reload()
    await searchFor(page, /中餐/, '都可以')
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await expect(page.getByText(loose('还有 30 分钟关门'))).toBeVisible()
    await page.clock.fastForward('05:00')
    await expect(page.getByText(loose('还有 25 分钟关门'))).toBeVisible()
    await expect(page.getByText(loose('可能停止点餐了'))).toBeVisible()
  })

  test('返回键（WEB-13）：游戏层先关、回到列表还在第 2 页；再按回首页。重新整理（WEB-15）：页数、❤️、计票板都还在', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    await page.reload()
    await expect(page.getByRole('heading', { name: loose('附近第 4–6 名') })).toBeVisible()
    await expect(page.getByRole('button', { name: /^取消圈：/ })).toHaveCount(1)
    await expect(page.getByRole('heading', { name: '📊 群里投票，帮你数票' })).toBeVisible()

    await page.getByRole('button', { name: /选不了？/ }).click()
    await expect(page.getByTestId('game-layer')).toBeVisible()
    await page.goBack()
    await expect(page.getByTestId('game-layer')).toBeHidden()
    await expect(page.getByRole('heading', { name: loose('附近第 4–6 名') })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: '今天想吃什么？' })).toBeVisible()
  })

  test('设置：手机键盘弹出来（看得见的区域变矮）时，密钥框和「保存密钥」滚到看得见的地方', async ({ page }) => {
    await openApp(page, { demo: false })
    await page.getByRole('button', { name: '设置' }).click()
    const settings = page.getByRole('dialog', { name: '设置' })
    await settings.getByRole('button', { name: /进阶：Google 密钥/ }).click()
    const input = settings.getByLabel('Places API 密钥')
    await input.fill('test-key-typed-into-settings')
    const size = page.viewportSize() ?? { width: 390, height: 844 }
    // 模拟键盘占掉下面一半
    await page.setViewportSize({ width: size.width, height: Math.round(size.height * 0.5) })
    await input.focus()
    await page.waitForTimeout(600)
    const save = settings.getByRole('button', { name: '保存密钥' })
    const box = await save.boundingBox()
    const viewHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight)
    expect(box).not.toBeNull()
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewHeight + 1)
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0)
    await page.setViewportSize(size)
  })

  for (const fontScale of [1, 1.3]) {
    test(`26.3 「 · 」只画在同一行的两段中间：换到下一行的那段前面不留点，行尾也没有点（字体 ${fontScale} 倍）`, async ({ page }) => {
      await openApp(page, { fontScale })
      await searchFor(page, /中餐/, '都可以')
      await page.getByRole('button', { name: loose('换 3 家') }).click()
      const problems = await page.evaluate(() => {
        const found: string[] = []
        for (const flow of document.querySelectorAll('.sep-flow')) {
          const pieces = [...flow.querySelectorAll<HTMLElement>(':scope > .sep-flow__piece')]
          pieces.forEach((piece, i) => {
            if (i === 0) return
            const sep = piece.querySelector<HTMLElement>(':scope > .sep-flow__sep')
            const shown = sep != null && getComputedStyle(sep).display !== 'none'
            // 同一行：上下有重叠（同一行的段垂直置中）；新的一行：整个在上一段下面
            const box = piece.getBoundingClientRect()
            const previous = (pieces[i - 1] as HTMLElement).getBoundingClientRect()
            const sameLine = box.top < previous.bottom - 1
            if (shown !== sameLine) found.push(`${flow.textContent}（第 ${i + 1} 段）`)
          })
        }
        return found
      })
      expect(problems).toEqual([])
      // 换行的地方真的有：评分行在手机上会分两行（电脑的主栏够宽，一行放得下，没有换行可以检查）
      if ((page.viewportSize()?.width ?? 0) < 600) {
        expect(await page.locator('.sep-flow__piece.is-line-start').count()).toBeGreaterThan(0)
      }
    })
  }

  test('WEB-22 减少动画：加载页的 emoji 不动，决定按钮的 ✊ 不摇', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    const fist = page.locator('.decide-btn__fist')
    if ((await fist.count()) > 0) expect(await fist.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
    expect(await page.locator('.place-card').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
  })

  test('WEB-23 深色模式：营业中用深色的绿，决定按钮渐层、「换 3 家」照样看得清', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    const read = () =>
      page.evaluate(() => ({
        open: getComputedStyle(document.querySelector('.price-hours__label.tone-open') as Element).color,
        decide: getComputedStyle(document.querySelector('.decide-btn') as Element).backgroundImage,
        decideText: getComputedStyle(document.querySelector('.decide-btn') as Element).color,
      }))
    const light = await read()
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    await expect(page.getByRole('button', { name: '重新选择' })).toBeVisible()
    const dark = await read()
    expect(light.open).toBe('rgb(43, 138, 62)')
    expect(dark.open).toBe('rgb(140, 233, 154)')
    expect(dark.decide).toBe(light.decide)
    expect(dark.decideText).toBe('rgb(255, 255, 255)')
  })
})
