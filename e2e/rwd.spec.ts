/**
 * 响应式（RWD）自动测试：每个画面在 e2e/sizes.ts 的每种尺寸（最窄 320×568、各种手机、手机横屏、iPad Mini、电脑、
 * 浏览器放大 200%）都检查：没有横向滚动、主要按钮完整在画面里（滑得到也算）而且没被挡住、可以点的东西至少 44×44。
 *
 * 画面一块一块做，做好一块就在这里加那一块的画面。现在有：
 * 第一块：定位说明、首页（没密钥 / 演示 / 真实模式晚餐 / 额度用完）、定位被挡住和「怎么打开定位？」、选菜系、想找多远的店？、
 * 关掉演示撤销、设置（一般 / 进阶 / 密钥还没保存）、随便挑（连吃提醒这次不摇）、饭签、加载页、结果页（基本）。
 * 第二块：加载页、结果页（表头、店卡、底栏、看完了、只看营业中关掉、刚刚导航过）、❤️ 圈店和清空撤销、群投票计票板、
 * 这一餐已经定了和游戏层入口、愿赌服输「会用掉唯一一次反悔，确定吗？」、救援卡、附近没找到、
 * 错误页（没有密钥 / Google 错误 / 网络 / 读不懂 / 本月用完 / 定位被挡住 / 拿不到位置）、
 * 真实模式（模拟的 Google：照片、大概意思、部分失败；电脑 Chrome 内建翻译的「机翻」）、
 * 设置（一般：清除吃过的记录；进阶：申请密钥的步骤、网站网址）、长按复制、字体放大 1.3 倍的结果页。
 */
import type { Page } from '@playwright/test'
import {
  blockLocation,
  checkRwd,
  chineseStreak,
  DINNER_TIME,
  expect,
  expectInViewWithoutScrolling,
  FAKE_KEY,
  loose,
  losAngelesMonth,
  openApp,
  test,
} from './fixtures.ts'
import { mockPlacesWithPhotos, stubDeviceApis } from './results-helpers.ts'
import { sizeOf } from './sizes.ts'

/** 画面上的字（和 src/data/strings.ts 一样；浏览器测试直接写中文，看得懂在点什么）。 */
const T = {
  action_grant_location: '允许定位',
  cancel: '取消',
  demo_home_banner_off: '关掉',
  demo_undo: '撤销',
  eat_any: '都可以',
  eat_noodle: '吃面',
  eat_rice: '吃饭',
  fortune_close: '收好了',
  fortune_share: '📤 发到群里比一比',
  fortune_title: '📜 今日饭签',
  location_explain_later: '先不要',
  location_explain_ok: '好，去允许',
  location_explain_title: '先跟你说一声',
  no_key_demo_button: '🧪 开演示',
  no_key_settings_link: '我有 Google 密钥 →',
  radius_dialog_title: '想找多远的店？',
  random_again: '🎲 再摇一次',
  random_cancel: '算了，我自己选',
  random_entry: '不知道吃什么？帮我随便挑',
  random_go: '就它了，开始找',
  random_history: '刚才摇到：',
  random_title: '🎲 帮你随便挑',
  reselect: '重新选择',
  settings: '设置',
  settings_advanced: '进阶：Google 密钥',
  settings_close: '关闭',
  settings_key_label: 'Places API 密钥',
  settings_save_key: '保存密钥',
  settings_title: '设置',
} as const

function text(key: keyof typeof T): string {
  return T[key]
}

/** 去掉排版用的隐形字符（字连接符、断点），换掉不换行空格，给按钮名字用。 */
function plain(value: string): string {
  return value.replace(/⁠|​/g, '').replace(/ /g, ' ')
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 按钮名字（不管隐形字符和空格）。按短句换行的字，每个短语是一个小块，Chrome 念名字时会在短语之间加空格
 * （「不知道吃什么？ 帮我随便挑」），所以每个字之间都允许有空格。
 */
function named(value: string): RegExp {
  const chars = [...plain(value).replace(/\s+/g, '')].map(escape)
  return new RegExp(`^\\s*${chars.join('\\s*')}\\s*$`)
}

test.describe('RWD：第一块（框架、首页、随便挑、饭签）', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('第一次打开：中文定位说明 → 首页（没有密钥：开演示、我有 Google 密钥）', async ({ page, context }) => {
    await context.clearPermissions()
    await openApp(page, { demo: false })
    const explain = page.getByRole('dialog', { name: text('location_explain_title') })
    await expect(explain).toBeVisible()
    await checkRwd(page, '定位说明', [
      explain.getByRole('button', { name: text('location_explain_ok') }),
      explain.getByRole('button', { name: text('location_explain_later') }),
    ])
    await explain.getByRole('button', { name: text('location_explain_later') }).click()
    await checkRwd(page, '首页-没有密钥', [
      page.getByRole('button', { name: named(text('no_key_demo_button')) }),
      page.getByRole('button', { name: named(text('no_key_settings_link')) }),
      page.getByRole('button', { name: text('action_grant_location') }),
      page.getByRole('button', { name: named(text('random_entry')) }),
      page.getByRole('button', { name: text('eat_rice') }),
      page.getByRole('button', { name: text('eat_noodle') }),
      page.getByRole('button', { name: text('eat_any') }),
    ])
  })

  test('首页（演示）：三个大按钮、选菜系、想找多远的店？、关掉演示撤销、设置', async ({ page }, testInfo) => {
    await openApp(page)
    const eat = [text('eat_rice'), text('eat_noodle'), text('eat_any')].map((name) => page.getByRole('button', { name }))
    // WEB-24：三个大按钮不用滑就看得到（浏览器放大 200% 时底栏跟着内容走，滑得到就好）
    if (sizeOf(testInfo.project.name)?.id !== 'zoom200') {
      for (const button of eat) await expectInViewWithoutScrolling(page, button, '首页三个大按钮')
    }
    await checkRwd(page, '首页-演示', [
      page.getByRole('button', { name: text('demo_home_banner_off') }),
      page.getByRole('button', { name: /今日饭签/ }),
      page.getByRole('button', { name: named(text('random_entry')) }),
      page.getByRole('radio', { name: /不限/ }),
      page.getByRole('radio', { name: /素食/ }),
      page.getByRole('slider'),
      ...eat,
    ])

    await page.getByRole('radio', { name: /印度/ }).click()
    await expect(page.getByRole('radio', { name: /印度/ })).toHaveAttribute('aria-checked', 'true')
    await checkRwd(page, '选了印度/嘛嘛档', [page.locator('.cuisine-hint'), page.getByRole('button', { name: /已选/ }), ...eat])

    await page.getByRole('button', { name: /搜索范围/ }).click()
    const radius = page.getByRole('dialog', { name: text('radius_dialog_title') })
    await checkRwd(page, '想找多远的店？', [
      radius.getByRole('button', { name: /走路就到/ }),
      radius.getByRole('button', { name: /开车去/ }),
      radius.getByRole('button', { name: text('cancel') }),
    ])
    await radius.getByRole('button', { name: /远一点/ }).click()
    await expect(radius).toBeHidden()

    await page.getByRole('button', { name: text('demo_home_banner_off') }).click()
    await checkRwd(page, '关掉演示-撤销条', [page.getByRole('button', { name: text('demo_undo') }), ...eat])
    await page.getByRole('button', { name: text('demo_undo') }).click()

    await page.getByRole('button', { name: text('settings') }).click()
    const settings = page.getByRole('dialog', { name: text('settings_title') })
    await checkRwd(page, '设置', [settings.getByRole('switch').first(), settings.getByRole('button', { name: text('settings_close') })])
    await settings.getByRole('button', { name: new RegExp(text('settings_advanced')) }).click()
    await checkRwd(page, '设置-进阶', [
      settings.getByLabel(text('settings_key_label')),
      settings.getByRole('button', { name: text('settings_save_key') }),
      settings.getByRole('button', { name: text('settings_close') }),
    ])
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()
  })

  test('随便挑：停下、再摇两次（刚才摇到）、就它了 → 加载 → 结果页', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: named(text('random_entry')) }).click()
    const dialog = page.getByRole('dialog', { name: text('random_title') })
    const go = dialog.getByRole('button', { name: text('random_go') })
    const again = dialog.getByRole('button', { name: text('random_again') })
    await expect(go).toBeEnabled()
    await checkRwd(page, '随便挑', [go, again, dialog.getByRole('button', { name: text('random_cancel') })])
    await again.click()
    await expect(go).toBeEnabled()
    await again.click()
    await expect(dialog.getByText(text('random_history'))).toBeVisible()
    await checkRwd(page, '随便挑-刚才摇到', [go, again, dialog.locator('.chip--history').first()])
    await go.click()
    await expect(page.getByRole('button', { name: text('reselect') })).toBeVisible()
    await checkRwd(page, '结果页（基本）', [page.getByRole('button', { name: text('reselect') })])
  })

  test('饭签：签纸、照签去找、抽过变小标签', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    const dialog = page.getByRole('dialog', { name: text('fortune_title') })
    const go = dialog.getByRole('button', { name: /照签去找/ })
    await expect(go).toBeVisible()
    await checkRwd(page, '饭签', [go, dialog.getByRole('button', { name: text('fortune_share') }), dialog.getByRole('button', { name: text('fortune_close') })])
    await dialog.getByRole('button', { name: text('fortune_close') }).click()
    await checkRwd(page, '首页-抽过饭签', [page.getByRole('button', { name: /今日饭签/ })])
  })

  test('定位被浏览器挡住：首页卡片「怎么打开？」→ 安卓和 iPhone 的步骤', async ({ page, context }) => {
    await openApp(page)
    await blockLocation(context, page)
    await page.reload()
    const how = page.getByRole('button', { name: '怎么打开？' })
    await checkRwd(page, '首页-定位被挡住', [how, page.getByRole('button', { name: text('eat_rice') })])
    await how.click()
    const help = page.getByRole('dialog', { name: '怎么打开定位？' })
    await checkRwd(page, '怎么打开定位', [help.getByRole('button', { name: '我改好了，再试一次' }), help.getByRole('button', { name: text('settings_close') })])
  })

  test('真实模式（假密钥）晚餐：连吃提醒、本月还可免费搜索；随便挑这次不摇中餐；额度用完的卡片', async ({ page }) => {
    await openApp(page, { demo: false, time: DINNER_TIME, storage: { 'meishi.places_api_key': FAKE_KEY, 'meishi.visits_v1': chineseStreak(DINNER_TIME) } })
    const streak = page.getByRole('button', { name: /连吃\s*3\s*次中餐了/ })
    await checkRwd(page, '首页-连吃提醒', [streak, page.getByText(/本月还可免费搜索/), page.getByRole('button', { name: text('eat_any') })])
    await streak.click()
    const dialog = page.getByRole('dialog', { name: text('random_title') })
    await expect(dialog.getByText(/这次不摇/)).toBeVisible()
    await checkRwd(page, '随便挑-这次不摇', [dialog.getByRole('button', { name: text('random_go') }), dialog.getByRole('button', { name: text('random_cancel') })])
    await page.keyboard.press('Escape')

    await page.evaluate((key) => localStorage.setItem(key, '900'), `meishi.text_search_${losAngelesMonth(DINNER_TIME)}`)
    await page.reload()
    await checkRwd(page, '首页-额度用完', [page.getByText(/本月免费次数已用完/), page.getByRole('button', { name: text('eat_rice') })])
  })

  test('设置：改了密钥没保存就关 → 「密钥还没保存，要保存吗？」', async ({ page }) => {
    await openApp(page, { demo: false })
    await page.getByRole('button', { name: named(text('no_key_settings_link')) }).click()
    const settings = page.getByRole('dialog', { name: text('settings_title') })
    await settings.getByLabel(text('settings_key_label')).fill('abc')
    await checkRwd(page, '设置-打了密钥', [settings.getByRole('button', { name: text('settings_save_key') })])
    await page.keyboard.press('Escape')
    const ask = page.getByRole('dialog', { name: '密钥还没保存，要保存吗？' })
    await checkRwd(page, '密钥还没保存', [ask.getByRole('button', { name: '不保存' }), ask.getByRole('button', { name: '保存', exact: true })])
    await ask.getByRole('button', { name: '不保存' }).click()
    await expect(settings).toBeHidden()
  })

  test('字体放大 1.3 倍：首页、随便挑、饭签都不会切掉、挡住', async ({ page }, testInfo) => {
    await openApp(page, { fontScale: 1.3 })
    const eat = [text('eat_rice'), text('eat_noodle'), text('eat_any')].map((name) => page.getByRole('button', { name }))
    if (sizeOf(testInfo.project.name)?.id !== 'zoom200') {
      for (const button of eat) await expectInViewWithoutScrolling(page, button, '字体 1.3 倍：首页三个大按钮')
    }
    await checkRwd(page, '字体1.3倍-首页', [page.getByRole('button', { name: named(text('random_entry')) }), page.getByRole('radio', { name: /素食/ }), ...eat])
    await page.getByRole('button', { name: named(text('random_entry')) }).click()
    const random = page.getByRole('dialog', { name: text('random_title') })
    await checkRwd(page, '字体1.3倍-随便挑', [random.getByRole('button', { name: text('random_go') }), random.getByRole('button', { name: text('random_cancel') })])
    await page.keyboard.press('Escape')
    await expect(random).toBeHidden()
    await page.getByRole('button', { name: /抽今日饭签/ }).click()
    const fortune = page.getByRole('dialog', { name: text('fortune_title') })
    await checkRwd(page, '字体1.3倍-饭签', [fortune.getByRole('button', { name: /照签去找/ }), fortune.getByRole('button', { name: text('fortune_close') })])
  })
})

// ================================================================ 第二块：搜索流程、结果页、设置

/** 首页选菜系、按吃饭 / 吃面 / 都可以。 */
async function searchFor(page: Page, cuisine: RegExp | null, meal: '吃饭' | '吃面' | '都可以'): Promise<void> {
  if (cuisine) await page.getByRole('radio', { name: cuisine }).click()
  await page.getByRole('button', { name: meal, exact: true }).click()
  await expect(page.getByRole('button', { name: '重新选择' }).or(page.getByRole('button', { name: '返回首页' }))).toBeVisible()
}

test.describe('RWD：第二块（搜索流程、结果页、设置）', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await stubDeviceApis(page)
  })

  test('结果页（演示）：表头、店卡、底栏、看完了、重新选择', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    const card = page.getByRole('article').first()
    await checkRwd(page, '结果页', [
      page.getByRole('button', { name: loose('扩大到 3 公里（演示不扣次数）') }),
      page.getByRole('switch', { name: /只看营业中/ }),
      page.getByRole('button', { name: '📤 发到群里投票' }),
      card.getByRole('button', { name: /^圈起来：/ }),
      card.getByRole('button', { name: '导航' }),
      page.getByRole('button', { name: loose('换 3 家') }),
      page.getByRole('button', { name: /剪刀石头布/ }),
      page.getByRole('button', { name: '重新选择' }),
    ])
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    await page.getByRole('button', { name: /换\s*3\s*家|剩下/ }).click()
    await expect(page.getByText(loose('已经看完全部 9 家'))).toBeVisible()
    await checkRwd(page, '结果页-看完了', [page.getByRole('button', { name: loose('回到前 3 名') }), page.getByText(loose('已经看完全部 9 家'))])
  })

  test('❤️ 圈 5 家（已圈一行、饭桌模式、清空、转转盘）→ 清空可撤销', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: loose('换 3 家') }).click()
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await expect(page.getByRole('button', { name: loose('用我圈的 5 家转转盘') })).toBeVisible()
    await checkRwd(page, '圈了 5 家', [
      page.getByRole('button', { name: '👥 饭桌模式' }),
      page.getByRole('button', { name: '清空' }),
      page.getByRole('button', { name: loose('换 3 家') }),
      page.getByRole('button', { name: loose('用我圈的 5 家转转盘') }),
    ])
    await expect(page.locator('.bar-notice')).toHaveCount(0, { timeout: 6000 })
    await page.getByRole('button', { name: '清空' }).click()
    await expect(page.getByText(loose('已清空 5 家'))).toBeVisible()
    await checkRwd(page, '清空可撤销', [page.getByRole('button', { name: '撤销' })])
  })

  test('群投票计票板 → 数好了 → 游戏层入口 → 这一餐已经定了', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '吃饭')
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    await expect(page.getByRole('heading', { name: '📊 群里投票，帮你数票' })).toBeVisible()
    const plus = page.getByRole('button', { name: /加一票$/ })
    await plus.first().click()
    // 「已经复制好了」的提示 3 秒后收起（很矮的画面上它会暂时盖住一些东西）
    await expect(page.locator('.bar-notice')).toHaveCount(0, { timeout: 6000 })
    await checkRwd(page, '计票板', [
      page.getByRole('button', { name: '收起' }),
      page.getByRole('button', { name: /减一票$/ }).first(),
      plus.last(),
      page.getByRole('button', { name: '数好了，看结果' }),
    ])
    await page.getByRole('button', { name: '数好了，看结果' }).click()
    await checkRwd(page, '游戏层入口', [page.getByRole('button', { name: '回到列表' })])
    await page.getByRole('button', { name: '回到列表' }).click()
    await checkRwd(page, '这一餐已经定了', [page.getByRole('button', { name: /这一餐已经定了/ })])
  })

  test('救援卡（火锅只剩 1 家能去）、附近没找到（0.5 公里素食饭）', async ({ page }) => {
    await openApp(page, { storage: { 'meishi.radius_km': '1.5' } })
    await searchFor(page, /火锅/, '吃饭')
    await checkRwd(page, '救援卡', [
      page.getByRole('button', { name: '🎲 换个菜系再摇' }),
      page.getByRole('button', { name: loose('扩大到 3 公里再找') }),
      page.getByRole('button', { name: '显示全部店（含休息中）' }),
      page.getByRole('button', { name: '重新选择' }),
    ])
    await openApp(page, { storage: { 'meishi.radius_km': '0.5' } })
    await searchFor(page, /素食/, '吃饭')
    await checkRwd(page, '附近没找到', [
      page.getByRole('button', { name: loose('扩大到 1 公里再找') }),
      page.getByRole('button', { name: '换成「不限」再找' }),
      page.getByRole('button', { name: '🎲 换个菜系再摇' }),
      page.getByRole('button', { name: '返回首页' }),
    ])
  })

  test('错误页：没有密钥、Google 错误（网站限制没对上）', async ({ page, context }) => {
    await openApp(page, { demo: false })
    await searchFor(page, null, '都可以')
    await checkRwd(page, '错误页-没有密钥', [page.getByRole('button', { name: '打开设置' }), page.getByRole('button', { name: '返回首页' })])
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
    await openApp(page, { demo: false, storage: { 'meishi.places_api_key': FAKE_KEY } })
    await searchFor(page, null, '都可以')
    await expect(page.getByRole('heading', { name: loose('Google 返回了错误（403）') })).toBeVisible()
    await checkRwd(page, '错误页-Google 错误', [page.getByRole('button', { name: '打开设置' }), page.getByRole('button', { name: '重试' }), page.getByRole('button', { name: '返回首页' })])
  })

  test('加载页（模拟的 Google 回得很慢）：取消', async ({ page, context }) => {
    let release: () => void = () => undefined
    const slow = new Promise<void>((resolve) => (release = resolve))
    await context.route('https://places.googleapis.com/**', async (route) => {
      await slow
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }).catch(() => undefined)
    })
    await openApp(page, { demo: false, storage: { 'meishi.places_api_key': FAKE_KEY } })
    await page.getByRole('button', { name: '吃面', exact: true }).click()
    await expect(page.getByText('正在比较 Google 评分和评价数 ⭐')).toBeVisible()
    await checkRwd(page, '加载页', [page.getByRole('button', { name: '取消' })])
    await page.getByRole('button', { name: '取消' }).click()
    await expect(page.getByRole('heading', { name: '今天想吃什么？' })).toBeVisible()
    release()
  })

  test('真实模式（模拟的 Google）：照片和作者、原名 + 大概意思、部分失败可重新搜索', async ({ page, context }) => {
    await mockPlacesWithPhotos(context, { failSecondQuery: true })
    await openApp(page, { demo: false, time: DINNER_TIME, storage: { 'meishi.places_api_key': FAKE_KEY } })
    await searchFor(page, null, '吃饭')
    await expect(page.getByText(/大概意思/).first()).toBeVisible()
    await checkRwd(page, '真实结果页', [
      page.getByRole('button', { name: '重新搜索' }),
      page.getByRole('button', { name: /^Restoran Nasi Kandar Bintang Timur/ }),
      page.getByRole('article').nth(1).getByRole('button', { name: '导航' }),
    ])
  })

  test('设置：进阶（申请密钥的步骤、网站网址两行、保存密钥）', async ({ page }) => {
    await openApp(page, { demo: false })
    await page.getByRole('button', { name: '设置' }).click()
    const settings = page.getByRole('dialog', { name: '设置' })
    await settings.getByRole('button', { name: /进阶：Google 密钥/ }).click()
    await settings.getByLabel('Places API 密钥').fill('test-key-typed-into-settings')
    // 打字时会把「保存密钥」滚进画面（手机键盘弹出来也看得到），等它滚完再量
    await page.waitForTimeout(500)
    await checkRwd(page, '设置-进阶-申请步骤', [
      settings.getByRole('button', { name: '保存密钥' }),
      settings.getByRole('button', { name: /怎么申请密钥/ }),
      settings.getByRole('button', { name: /^复制 / }).first(),
      settings.getByRole('button', { name: /^复制 / }).last(),
      settings.getByRole('button', { name: '关闭' }),
    ])
  })

  test('分享、复制都不行：长按复制的对话框', async ({ page }) => {
    await stubDeviceApis(page, { clipboard: false })
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    await page.getByRole('button', { name: '📤 发到群里投票' }).click()
    const dialog = page.getByRole('dialog', { name: '复制不了，请长按下面的文字自己复制' })
    await expect(dialog).toBeVisible()
    await checkRwd(page, '长按复制', [dialog.getByRole('textbox'), dialog.getByRole('button', { name: '关闭' })])
  })

  test('错误页：网络断了、读取结果时出错、本月免费次数已用完（模拟的 Google）', async ({ page, context }) => {
    await context.route('https://places.googleapis.com/**', (route) => route.abort('internetdisconnected'))
    await openApp(page, { demo: false, storage: { 'meishi.places_api_key': FAKE_KEY } })
    await searchFor(page, null, '吃饭')
    await expect(page.getByRole('heading', { name: '网络好像断了' })).toBeVisible()
    await checkRwd(page, '错误页-网络', [page.getByRole('button', { name: '重试' }), page.getByRole('button', { name: '返回首页' })])

    await context.unroute('https://places.googleapis.com/**')
    await context.route('https://places.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '这不是 JSON' }),
    )
    await page.getByRole('button', { name: '重试' }).click()
    await expect(page.getByRole('heading', { name: '读取结果时出错了' })).toBeVisible()
    await checkRwd(page, '错误页-读不懂', [page.getByRole('button', { name: '重试' }), page.getByRole('button', { name: '返回首页' })])

    await openApp(page, { demo: false, storage: { 'meishi.places_api_key': FAKE_KEY, [`meishi.text_search_${losAngelesMonth('2026-10-17T12:15:00+08:00')}`]: '900' } })
    await searchFor(page, null, '吃饭')
    await expect(page.getByRole('heading', { name: /本月免费次数已用完/ })).toBeVisible()
    await checkRwd(page, '错误页-本月用完', [page.getByRole('button', { name: '返回首页' })])
  })

  test('错误页：定位被浏览器挡住（怎么打开？）、拿不到位置（重试）', async ({ page, context }) => {
    await openApp(page)
    await blockLocation(context, page)
    await page.reload()
    await page.getByRole('button', { name: '吃饭', exact: true }).click()
    await expect(page.getByRole('heading', { name: '需要定位权限' })).toBeVisible()
    await checkRwd(page, '错误页-定位被挡住', [page.getByRole('button', { name: '怎么打开？' }), page.getByRole('button', { name: '重试' }), page.getByRole('button', { name: '返回首页' })])
  })

  test('错误页：拿不到你的位置（手机定位没开、在室内）', async ({ page }) => {
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
    await checkRwd(page, '错误页-拿不到位置', [page.getByRole('button', { name: '重试' }), page.getByRole('button', { name: '返回首页' })])
  })

  test('愿赌服输：这一餐已经定了，换一组店重新玩先问「会用掉唯一一次反悔，确定吗？」', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: /^圈起来：/ }).first().click()
    await page.getByRole('button', { name: loose('在我圈的 2 家里挑') }).click()
    await expect(page.getByTestId('game-layer')).toBeVisible()
    await page.getByRole('button', { name: '回到列表' }).click()
    await page.getByRole('button', { name: '清空' }).click()
    await page.getByRole('button', { name: /选不了？/ }).click()
    const ask = page.getByTestId('meal-prompt')
    await expect(ask).toContainText('会用掉唯一一次反悔')
    await checkRwd(page, '愿赌服输-要反悔吗', [ask.getByRole('button', { name: '确定，重新玩' }), ask.getByRole('button', { name: '不了，就吃这家' })])
    await ask.getByRole('button', { name: '不了，就吃这家' }).click()
    await expect(page.getByTestId('game-layer')).toBeVisible()
    await page.getByRole('button', { name: '回到列表' }).click()
    await checkRwd(page, '这一餐已经定了-还有反悔', [page.getByRole('button', { name: /这一餐已经定了/ }), page.getByRole('button', { name: /选不了？/ })])
  })

  test('设置（一般）：导航过以后有「清除吃过的记录」；卡片写「👣 刚刚导航过」', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    await page.getByRole('button', { name: '导航' }).first().click()
    await expect(page.getByText(loose('👣 刚刚导航过'))).toBeVisible()
    await checkRwd(page, '结果页-刚刚导航过', [page.getByText(loose('👣 刚刚导航过')), page.getByRole('button', { name: '导航' }).first()])
    await page.getByRole('button', { name: '设置' }).click()
    const settings = page.getByRole('dialog', { name: '设置' })
    await checkRwd(page, '设置-一般-清除记录', [
      settings.getByRole('switch', { name: /演示模式/ }),
      settings.getByRole('switch', { name: /摇一摇/ }),
      settings.getByRole('button', { name: /清除吃过的记录/ }),
      settings.getByRole('button', { name: /进阶：Google 密钥/ }),
      settings.getByRole('button', { name: '关闭' }),
    ])
    await settings.getByRole('button', { name: /清除吃过的记录/ }).click()
    await expect(settings.getByRole('button', { name: /清除吃过的记录/ })).toHaveCount(0)
  })

  test('只看营业中关掉：休息中的店也出来（写「休息中 下午 5:00 开」）', async ({ page }) => {
    await openApp(page)
    await searchFor(page, /中餐/, '都可以')
    await page.getByRole('switch', { name: /只看营业中/ }).click()
    await expect(page.getByRole('switch', { name: /只看营业中/ })).toHaveAttribute('aria-checked', 'false')
    await checkRwd(page, '只看营业中关掉', [page.getByRole('switch', { name: /只看营业中/ }), page.getByRole('button', { name: loose('换 3 家') })])
  })

  test.describe('电脑 Chrome 有内建翻译（假的翻译器）', () => {
    test.use({ builtInTranslator: 'fake' })

    test('机翻的店名：中文名 +「机翻」+ 招牌原名', async ({ page, context }) => {
      await mockPlacesWithPhotos(context)
      await openApp(page, { demo: false, time: DINNER_TIME, storage: { 'meishi.places_api_key': FAKE_KEY } })
      await searchFor(page, null, '吃饭')
      const card = page.getByRole('article', { name: '东方之星扁担饭餐厅' })
      await expect(card.getByText('机翻')).toBeVisible()
      await checkRwd(page, '结果页-机翻', [
        card.getByRole('button', { name: /^东方之星扁担饭餐厅/ }),
        card.getByRole('button', { name: '导航' }),
        card.getByRole('button', { name: /^圈起来：/ }),
      ])
    })
  })

  test('字体放大 1.3 倍：结果页不断字、不挡住', async ({ page }) => {
    await openApp(page, { fontScale: 1.3 })
    await searchFor(page, /中餐/, '都可以')
    await checkRwd(page, '字体1.3倍-结果页', [
      page.getByRole('switch', { name: /只看营业中/ }),
      page.getByRole('button', { name: '📤 发到群里投票' }),
      page.getByRole('article').first().getByRole('button', { name: '导航' }),
      page.getByRole('button', { name: loose('换 3 家') }),
      page.getByRole('button', { name: /剪刀石头布/ }),
    ])
  })
})
