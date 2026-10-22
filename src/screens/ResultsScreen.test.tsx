import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resultsView } from '../app/state.ts'
import { shareVote, text, webText } from '../app/texts.ts'
import { HOURS, RESULTS } from '../data/constants.ts'
import { cuisineName } from '../domain/cuisine.ts'
import { roughMeaning } from '../domain/roughMeaning.ts'
import { clockZoned, statusAt } from '../domain/openingHours.ts'
import type { NameTranslator } from '../domain/localizer.ts'
import type { SearchChoice } from '../domain/model.ts'
import { flush, klMillis, plain, testPlace } from '../test/helpers.ts'
import { results, shops } from '../test/storeHarness.ts'
import { button, getText, queryButton, queryText, renderApp } from '../test/ui.tsx'

/** 手机浏览器没有内建翻译：每次都翻不了（照样显示原名）。 */
const noTranslation: NameTranslator = {
  async translateToChinese(): Promise<string> {
    throw new Error('no translator')
  },
  close() {},
}

function heading(): string {
  return plain(screen.getByRole('heading', { level: 2 }).textContent ?? '')
}

async function demoSearch(choice: SearchChoice = { cuisine: 'CHINESE', meal: 'ANY' }, options: Parameters<typeof renderApp>[0] = {}) {
  const rendered = renderApp({ demoMode: true, ...options })
  await act(flush)
  act(() => rendered.store.search(choice))
  await act(flush)
  await waitFor(() => expect(rendered.store.ui.kind).toBe('RESULTS'))
  return rendered
}

let opened: string[] = []

beforeEach(() => {
  opened = []
  window.open = ((url?: string | URL) => {
    opened.push(String(url))
    return null
  }) as typeof window.open
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
})

describe('结果页（功能清单第十一节）', () => {
  it('演示：固定的演示条、标题、副标题、扩大范围（演示不扣次数）、只看营业中、投票、3 张店卡、底栏、数据来源；一个请求都不发', async () => {
    const { store, h } = await demoSearch()
    const r = results(store)
    getText(text('demo_results_banner'))
    expect(heading()).toBe(plain(`${text('results_title_top', 3)}・${cuisineName('CHINESE')}`))
    getText(text('results_subtitle_found', r.ranked.length))
    getText(text('results_subtitle_range', '1.5'))
    expect(button(text('expand_range_demo', '3'))).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: new RegExp(text('open_only')) })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: text('share_vote_button') })).toBeEnabled()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(button(text('more'))).toBeInTheDocument()
    expect(button(text('decide_rps_bar'))).toBeInTheDocument()
    expect(button(text('reselect'))).toBeInTheDocument()
    getText(text('data_source_demo'))
    expect(h.searcher.calls).toBe(0)
    expect(h.photos.calls).toBe(0)
  })

  it('RESULTS-11 换 3 家 → 附近第 4–6 名；到最后一页「回到前 3 名」+「已经看完全部 N 家」；从不重新搜索', async () => {
    const { store, h } = await demoSearch()
    fireEvent.click(button(text('more')))
    expect(heading()).toContain(plain(text('results_title_page', 4, 6)))
    while (queryButton(text('bar_back_to_top')) == null) {
      const next = queryButton(text('more')) ?? screen.getByRole('button', { name: /剩下/ })
      fireEvent.click(next)
    }
    getText(text('more_done', resultsView(results(store)).total))
    fireEvent.click(button(text('bar_back_to_top')))
    expect(heading()).toContain(plain(text('results_title_top', 3)))
    expect(h.searcher.calls).toBe(0)
  })

  it('RESULTS-01 只看营业中：拨一下记住，休息中的店出来，「已隐藏 N 家」不见了；不发请求', async () => {
    const { store, h } = await demoSearch()
    const hidden = resultsView(results(store)).hiddenClosed
    expect(hidden).toBeGreaterThan(0)
    getText(text('open_only_hidden', hidden))
    fireEvent.click(screen.getByRole('switch', { name: new RegExp(text('open_only')) }))
    expect(h.settings.openNowOnly).toBe(false)
    expect(results(store).openNowOnly).toBe(false)
    expect(queryText(text('open_only_hidden', hidden))).toBeNull()
    expect(screen.getByRole('switch', { name: new RegExp(text('open_only')) })).toHaveAttribute('aria-checked', 'false')
    expect(h.searcher.calls).toBe(0)
  })

  it('BASKET ❤️ 圈第 2 家提示饭桌模式；圈了 2 家决定按钮变「在我圈的 2 家里挑」；清空 → 「已清空 2 家　撤销」→ 撤销回来；8 秒后自己收起', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { store } = await demoSearch()
    const names = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label') ?? '')
    fireEvent.click(button(text('basket_add_a11y', names[0] ?? '')))
    getText(text('basket_hint_one'))
    fireEvent.click(button(text('basket_add_a11y', names[1] ?? '')))
    getText(text('basket_table_hint'))
    getText(text('basket_count', 2) + `${names[0]}、${names[1]}`)
    expect(button(text('decide_basket_roulette'))).toBeInTheDocument()
    expect(button(text('basket_remove_a11y', names[0] ?? ''))).toHaveAttribute('aria-pressed', 'true')
    // 提示 3 秒后收起
    act(() => vi.advanceTimersByTime(RESULTS.NOTICE_MS + 50))
    act(() => vi.advanceTimersByTime(400))
    expect(queryText(text('basket_table_hint'))).toBeNull()

    fireEvent.click(button(text('basket_clear')))
    expect(results(store).basket).toEqual([])
    getText(text('basket_cleared', 2))
    fireEvent.click(button(text('basket_undo')))
    expect(results(store).basket).toHaveLength(2)

    fireEvent.click(button(text('basket_clear')))
    act(() => vi.advanceTimersByTime(RESULTS.BASKET_UNDO_MS + 50))
    act(() => vi.advanceTimersByTime(400))
    expect(results(store).clearedBasket).toEqual([])
    expect(queryButton(text('basket_undo'))).toBeNull()
  })

  it('BASKET 圈够 3 家出现「👥 饭桌模式」；圈 4 家起决定按钮变转盘', async () => {
    const { store } = await demoSearch()
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getAllByRole('button', { name: /^圈起来：/ })[0] as HTMLElement)
    fireEvent.click(button(text('more')))
    for (let i = 0; i < 2; i++) fireEvent.click(screen.getAllByRole('button', { name: /^圈起来：/ })[0] as HTMLElement)
    expect(results(store).basket).toHaveLength(4)
    expect(button(text('basket_table'))).toBeInTheDocument()
    expect(button(text('decide_basket_wheel', 4))).toBeInTheDocument()
  })

  it('BASKET 休息中的店不能圈（🤍 变淡）：「这家在休息，先不能圈」', async () => {
    const { store } = await demoSearch()
    fireEvent.click(screen.getByRole('switch', { name: new RegExp(text('open_only')) }))
    const closedItem = results(store).ranked.find((item) => statusAt(item.place, results(store).clock).kind === 'CLOSED')
    expect(closedItem).toBeDefined()
    while (screen.queryByRole('article', { name: closedItem?.translatedName ?? closedItem?.place.name }) == null) fireEvent.click(button(text('more')))
    const heart = button(text('basket_add_a11y', closedItem?.translatedName ?? closedItem?.place.name ?? ''))
    expect(heart.className).toContain('heart-btn--faded')
    fireEvent.click(heart)
    getText(text('basket_closed'))
    expect(results(store).basket).toEqual([])
  })

  it('WEB-20 导航：先记一笔吃过（卡片出现「👣 刚刚导航过」），再用新分页打开 Google 地图路线（不带密钥）；演示店按店名提示「演示的店没有地图页面」', async () => {
    await demoSearch()
    const first = screen.getAllByRole('article')[0] as HTMLElement
    fireEvent.click(within(first).getByRole('button', { name: text('navigate') }))
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatch(/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/)
    expect(opened[0]).not.toContain('key=')
    expect(opened[0]).not.toContain('destination_place_id')
    expect(within(first).getByText(text('visit_just_now'))).toBeInTheDocument()
    fireEvent.click(within(first).getByRole('button', { name: first.getAttribute('aria-label') ?? '' }))
    getText(text('maps_demo_no_page'))
    expect(opened).toHaveLength(1)
  })

  it('WEB-19 📤 发到群里投票：没有分享面板就复制投票文字，底栏提示已复制；计票板 ＋ / －，没人投票时「数好了」不能按', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { store } = await demoSearch({ cuisine: 'CHINESE', meal: 'RICE' })
    const r = results(store)
    const items = resultsView(r).items
    fireEvent.click(screen.getByRole('button', { name: text('share_vote_button') }))
    await act(flush)
    const now = clockZoned(r.clock)
    expect(now).not.toBeNull()
    expect(writeText).toHaveBeenCalledWith(shareVote(items, items.map((i) => statusAt(i.place, r.clock)), now!, true))
    getText(webText('web_share_copied'))
    expect(screen.getByRole('heading', { name: text('vote_board_title') })).toBeInTheDocument()
    expect(button(text('vote_finish'))).toBeDisabled()
    const firstName = items[0]?.translatedName ?? items[0]?.place.name ?? ''
    expect(button(text('vote_minus_a11y', firstName))).toBeDisabled()
    fireEvent.click(button(text('vote_plus_a11y', firstName)))
    fireEvent.click(button(text('vote_plus_a11y', firstName)))
    expect(results(store).vote?.counts[0]).toBe(2)
    getText(text('vote_count_a11y', 2))
    fireEvent.click(button(text('vote_minus_a11y', firstName)))
    expect(results(store).vote?.counts[0]).toBe(1)
    expect(button(text('vote_finish'))).toBeEnabled()
    fireEvent.click(button(text('vote_close')))
    expect(results(store).vote).toBeNull()
  })

  it('分享、复制都不行：显示文字让人长按复制', async () => {
    const { store } = await demoSearch()
    fireEvent.click(screen.getByRole('button', { name: text('share_vote_button') }))
    await act(flush)
    const dialog = screen.getByRole('dialog', { name: webText('web_share_copy_failed') })
    expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toContain(plain(text('share_demo_header')))
    expect(results(store).vote).not.toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: text('settings_close') }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('MEAL 数好了 → 这一局（盖住列表和底栏）→ 回到列表：「🤝 这一餐已经定了」→ 看一看；投票定的不能反悔，想再猜拳就「这一餐已经定了 🤝 愿赌服输」', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true })
    const { store } = await demoSearch({ cuisine: 'CHINESE', meal: 'RICE' })
    fireEvent.click(screen.getByRole('button', { name: text('share_vote_button') }))
    await act(flush)
    const first = resultsView(results(store)).items[0]
    fireEvent.click(button(text('vote_plus_a11y', first?.translatedName ?? first?.place.name ?? '')))
    fireEvent.click(button(text('vote_finish')))
    expect(store.duel?.mode).toBe('VOTE')
    const layer = screen.getByTestId('game-layer')
    // 盖住列表：画面上只剩「就这一家吧！」的那一张店卡
    expect(screen.queryAllByRole('article')).toHaveLength(1)
    expect(within(layer).getByRole('article')).toBeInTheDocument()
    fireEvent.click(button(text('duel_back')))
    expect(store.duel).toBeNull()
    const strip = button(text('meal_banner', first?.translatedName ?? first?.place.name ?? '') + text('meal_banner_look'))
    fireEvent.click(strip)
    expect(store.duel?.locked).toBe(false)
    fireEvent.click(button(text('duel_back')))
    fireEvent.click(button(text('decide_rps_bar')))
    expect(store.duel?.locked).toBe(true)
    expect(screen.getByTestId('game-layer')).toHaveTextContent(plain(text('meal_locked_title')))
  })

  it('MEAL 定了还有反悔：换一组店再玩先问「会用掉唯一一次反悔，确定吗？」；不了 → 显示定了的那家', async () => {
    const { store } = await demoSearch()
    fireEvent.click(button(text('decide_rps_bar')))
    act(() => store.playHand('ROCK'))
    // App 的手停下、揭晓停 1.5 秒，才到「就这一家吧！」
    fireEvent.click(await waitFor(() => button(text('duel_back')), { timeout: 3000 }))
    fireEvent.click(button(text('more')))
    fireEvent.click(screen.getByRole('button', { name: /剪刀石头布|帮我挑一家|转转盘/ }))
    const prompt = screen.getByTestId('meal-prompt')
    expect(prompt).toHaveTextContent(plain(text('meal_prompt_text', store.mealPrompt?.placeName ?? '')).replace(/\s+/g, ''))
    fireEvent.click(within(prompt).getByRole('button', { name: text('meal_prompt_decline') }))
    expect(screen.queryByTestId('meal-prompt')).toBeNull()
    expect(store.duel?.winnerIndex).not.toBeNull()
  })

  it('RESULTS-02/03 救援卡（只剩 1 家能去）：换个菜系再摇、扩大到 3 公里再找（演示不扣次数）、显示全部店（只是这一次）', async () => {
    const { store, h } = await demoSearch({ cuisine: 'HOT_POT', meal: 'RICE' })
    getText(text('rescue_one_open', cuisineName('HOT_POT')))
    getText(text('rescue_expand_note_demo'))
    fireEvent.click(button(text('rescue_show_all')))
    expect(results(store).openNowOnly).toBe(false)
    expect(h.settings.openNowOnly).toBe(true)
    fireEvent.click(button(text('rescue_reroll')))
    expect(store.home.randomPick?.excludedCuisine).toBe('HOT_POT')
    act(() => store.dismissRandomPick())
    fireEvent.click(button(text('rescue_expand', '3')))
    await act(flush)
    await waitFor(() => expect(store.ui.kind).toBe('RESULTS'))
    expect(results(store).radiusKm).toBe(3)
    expect(h.searcher.calls).toBe(0)
  })

  it('真实：照片显示出来才写「📷 作者」；没有机翻的英文 / 马来文店名写原名 + 「大概意思」；部分失败可以重新搜索', async () => {
    const places = [
      { ...testPlace('m1', { name: 'Restoran Nasi Kandar Bintang', rating: 4.8, reviews: 900 }), photoAuthor: 'Siti' },
      { ...testPlace('m2', { name: '顺记鸡饭', rating: 4.6, reviews: 900 }), photoAuthor: 'Ah Seng' },
      testPlace('m3', { name: 'Pelita Corner', rating: 4.4, reviews: 900 }),
    ]
    const { store, h } = renderApp({ places, translator: noTranslation })
    h.searcher.failures = [new Error('一个关键词失败')]
    await act(flush)
    act(() => store.search({ cuisine: 'ANY', meal: 'RICE' }))
    await act(flush)
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3))
    getText(webText('web_rough_meaning', roughMeaning('Restoran Nasi Kandar Bintang') ?? ''))
    expect(queryText(text('machine_translated'))).toBeNull()
    // Pelita Corner：一个词都认不出 → 只有原名
    expect(screen.getAllByText(/大概意思/)).toHaveLength(1)
    const card = screen.getByRole('article', { name: 'Restoran Nasi Kandar Bintang' })
    const img = await within(card).findByRole('img', { name: 'Restoran Nasi Kandar Bintang' })
    expect(within(card).queryByText(text('photo_by', 'Siti'))).toBeNull()
    fireEvent.load(img)
    expect(within(card).getByText(text('photo_by', 'Siti'))).toBeInTheDocument()
    expect(h.photos.calls).toBe(3)
    // 部分失败
    getText('⚠️ ' + text('results_partial'))
    h.searcher.failures = []
    fireEvent.click(button(text('search_again')))
    await act(flush)
    await waitFor(() => expect(queryText('⚠️ ' + text('results_partial'))).toBeNull())
    expect(h.searcher.calls).toBe(2)
    getText(text('data_source'))
    expect(queryText(text('demo_results_banner'))).toBeNull()
  })

  it('WEB-26 机翻过的店名：中文名 +「机翻」+ 招牌原名（没有「大概意思」）', async () => {
    const { store } = renderApp({ places: [testPlace('t1', { name: 'Sakura Ramen House' }), testPlace('t2'), testPlace('t3')] })
    await act(flush)
    act(() => store.search({ cuisine: 'ANY', meal: 'NOODLE' }))
    await act(flush)
    await waitFor(() => expect(screen.getByRole('article', { name: '译Sakura Ramen House' })).toBeInTheDocument())
    const card = screen.getByRole('article', { name: '译Sakura Ramen House' })
    expect(within(card).getByText(text('machine_translated'))).toBeInTheDocument()
    expect(within(card).getByText('Sakura Ramen House')).toBeInTheDocument()
    expect(within(card).queryByText(/大概意思/)).toBeNull()
  })

  it('HOURS-19 时间在走：每 30 秒问一次，分钟变了「还有 N 分钟关门」跟着倒数；快关门、过去来不及的店不能圈', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { store, h } = await demoSearch({ cuisine: 'CHINESE', meal: 'ANY' }, { startMillis: klMillis(17, 14, 2) })
    fireEvent.click(button(text('more')))
    getText(text('hours_closing_soon', 28))
    getText(text('hours_last_orders'))
    act(() => {
      h.clock.advance(10 * 60_000)
      vi.advanceTimersByTime(HOURS.CLOCK_TICK_MS)
    })
    getText(text('hours_closing_soon', 18))
    const card = screen.getAllByRole('article').find((a) => plain(a.textContent ?? '').includes(plain(text('hours_closing_soon', 18))))
    expect(card).toBeDefined()
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /^圈起来：/ }))
    getText(text('basket_too_late'))
    expect(results(store).basket).toEqual([])
  })

  it('没有游戏可以玩（这一页能去的不到 2 家，而且没有救援卡时）：提示块「这一页能去的店不到 2 家」', async () => {
    // 前 2 家开着、后面 3 家休息中 → 第 2 页只有休息中的店（关掉只看营业中才看得到）
    const { store } = renderApp({ places: shops([true, true, true, false, false, false]) })
    await act(flush)
    act(() => store.search({ cuisine: 'ANY', meal: 'RICE' }))
    await act(flush)
    await waitFor(() => expect(store.ui.kind).toBe('RESULTS'))
    fireEvent.click(screen.getByRole('switch', { name: new RegExp(text('open_only')) }))
    fireEvent.click(button(text('more')))
    getText(text('decide_none'))
    expect(queryText(text('rescue_one_open', text('rescue_subject_rice')))).toBeNull()
  })
})
