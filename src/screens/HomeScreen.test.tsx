import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { text, webText } from '../app/texts.ts'
import { HOME } from '../data/constants.ts'
import { flush } from '../test/helpers.ts'
import { button, byFullText, getText, queryButton, queryText, renderApp } from '../test/ui.tsx'

afterEach(() => {
  vi.useRealTimers()
})

describe('首页（功能清单第三节）', () => {
  it('从上到下：问候（中午 12:30 午餐）、饭签、大标题、随便挑、① 菜系、范围、状态行；底栏三个大按钮', async () => {
    renderApp()
    await act(flush)
    expect(screen.getByRole('heading', { level: 1, name: '美食剪刀布' })).toBeInTheDocument()
    getText(text('greeting_lunch'))
    expect(button(`${text('fortune_chip_a11y')}，${text('fortune_chip_draw')}`)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: text('home_title') })).toBeInTheDocument()
    getText(text('home_subtitle'))
    expect(button(text('random_entry'))).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(13)
    getText(text('radius_label', '1.5'))
    getText(text('loc_ready'))
    getText(text('remaining_free', 300))
    for (const key of ['eat_rice', 'eat_noodle', 'eat_any'] as const) expect(button(text(key))).toBeInTheDocument()
    // 有密钥、没开演示：没有粉红卡、没有演示黑条、标题栏没有「演示」
    expect(queryText(text('no_key_banner'))).toBeNull()
    expect(queryText(text('demo_home_banner'))).toBeNull()
    expect(queryText(text('demo_badge'))).toBeNull()
  })

  it('没有密钥：粉红卡「🧪 开演示」一按就开演示（标题栏有「演示」小标签、用量那行换成演示的）', async () => {
    const { store } = renderApp({ apiKey: '' })
    await act(flush)
    getText(text('no_key_banner'))
    fireEvent.click(button(text('no_key_demo_button')))
    expect(store.home.demoMode).toBe(true)
    getText(text('demo_badge'))
    getText(text('demo_home_banner'))
    getText(text('demo_quota_line'))
    expect(queryText(text('no_key_banner'))).toBeNull()
  })

  it('演示黑条「关掉」→ 马上关，底栏出「演示模式已经关掉了　撤销」；撤销 → 演示回来，不搜索', async () => {
    const { store, h } = renderApp({ demoMode: true })
    await act(flush)
    fireEvent.click(button(text('demo_home_banner_off')))
    expect(store.home.demoMode).toBe(false)
    getText(text('demo_turned_off'))
    fireEvent.click(button(text('demo_undo')))
    expect(store.home.demoMode).toBe(true)
    expect(queryText(text('demo_turned_off'))).toBeNull()
    expect(store.ui.kind).toBe('HOME')
    expect(h.searcher.calls).toBe(0)
  })

  it('撤销条 8 秒后自己收起（HOME.DEMO_UNDO_MS）', async () => {
    vi.useFakeTimers()
    const { store } = renderApp({ demoMode: true })
    fireEvent.click(button(text('demo_home_banner_off')))
    getText(text('demo_turned_off'))
    act(() => vi.advanceTimersByTime(HOME.DEMO_UNDO_MS - 100))
    getText(text('demo_turned_off'))
    act(() => vi.advanceTimersByTime(200))
    expect(queryText(text('demo_turned_off'))).toBeNull()
    expect(store.home.demoMode).toBe(false)
  })

  it('「我有 Google 密钥 →」打开设置，「进阶」直接展开（看得到密钥框）', async () => {
    renderApp({ apiKey: '' })
    await act(flush)
    fireEvent.click(button(text('no_key_settings_link')))
    const dialog = screen.getByRole('dialog', { name: text('settings_title') })
    expect(within(dialog).getByLabelText(text('settings_key_label'))).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: new RegExp(text('settings_advanced')) })).toHaveAttribute('aria-expanded', 'true')
  })

  it('HOME 菜系永远只选中一个，点一下只选中、不搜索；说明和底栏「已选」跟着变', async () => {
    const { store, h } = renderApp()
    await act(flush)
    const any = screen.getByRole('radio', { name: /不限/ })
    const chinese = screen.getByRole('radio', { name: /中餐/ })
    expect(any).toHaveAttribute('aria-checked', 'true')
    getText(text('cuisine_hint_any'))
    fireEvent.click(chinese)
    expect(chinese).toHaveAttribute('aria-checked', 'true')
    expect(any).toHaveAttribute('aria-checked', 'false')
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    getText(text('cuisine_hint_chinese'))
    getText(text('step_meal_selected', '🥢 中餐'))
    expect(store.ui.kind).toBe('HOME')
    expect(h.searcher.calls).toBe(0)
  })

  it('HOME-03 「📏 1.5 公里 ▾」→ 四个大按钮，现在的是实心；点一个马上换、马上记住、关窗口，不搜索', async () => {
    const { h } = renderApp()
    await act(flush)
    fireEvent.click(button(text('radius_chip_a11y', '1.5')))
    const dialog = screen.getByRole('dialog', { name: text('radius_dialog_title') })
    expect(within(dialog).getByRole('button', { name: /附近/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(dialog).getByRole('button', { name: /远一点/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.settings.radiusKm).toBe(3)
    expect(button(text('radius_chip_a11y', '3'))).toBeInTheDocument()
    getText(text('radius_label', '3'))
    expect(h.searcher.calls).toBe(0)
  })

  it('滑杆：拖动时数字跟着变，放手才记住', async () => {
    const { h } = renderApp()
    await act(flush)
    const slider = screen.getByRole('slider')
    fireEvent.input(slider, { target: { value: '2.5' } })
    getText(text('radius_label', '2.5'))
    expect(h.settings.radiusKm).toBe(1.5)
    fireEvent.change(slider, { target: { value: '2.5' } })
    expect(h.settings.radiusKm).toBe(2.5)
  })

  it('QUOTA 本月免费次数用完：首页卡片「本月免费次数已用完」，不再写「还可免费搜索」；演示模式不显示', async () => {
    const { store } = renderApp({
      before: (harness) => {
        while (harness.guard.tryRecordTextSearch()) {
          // 把本月 900 个文字搜索全部用完
        }
      },
    })
    await act(flush)
    getText(text('remaining_none'))
    expect(queryText(text('remaining_free', 0))).toBeNull()
    act(() => store.setDemoMode(true))
    expect(queryText(text('remaining_none'))).toBeNull()
    getText(text('demo_quota_line'))
  })

  it('WEB-04 浏览器不让网页记东西（无痕模式）：首页先说清楚真实搜索停用；演示照样玩、不显示这张卡', async () => {
    const { store } = renderApp({ before: (harness) => (harness.storageWritable = () => false) })
    await act(flush)
    getText(webText('web_storage_blocked'))
    expect(queryText(text('remaining_free', 300))).toBeNull()
    act(() => store.setDemoMode(true))
    expect(queryText(webText('web_storage_blocked'))).toBeNull()
  })

  it('WEB-24 按「吃饭」（演示）→ 加载页 → 结果页；返回箭头回首页、菜系还记得', async () => {
    const { store } = renderApp({ demoMode: true })
    await act(flush)
    fireEvent.click(screen.getByRole('radio', { name: /中餐/ }))
    fireEvent.click(button(text('eat_rice')))
    await act(flush)
    await waitFor(() => expect(store.ui.kind).toBe('RESULTS'))
    getText(text('demo_results_banner'))
    fireEvent.click(button(text('back')))
    await waitFor(() => expect(store.ui.kind).toBe('HOME'))
    expect(screen.getByRole('radio', { name: /中餐/ })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('定位（功能清单第四节、31.4，测试 WEB-16）', () => {
  it('第一次打开、还没有权限：先显示中文说明，按「好，去允许」才让浏览器问', async () => {
    const { h } = renderApp({ before: (harness) => (harness.location.level = 'NONE') })
    const dialog = screen.getByRole('dialog', { name: text('location_explain_title') })
    within(dialog).getByText((_, el) => el?.textContent === text('location_explain_next'))
    expect(text('location_explain_next')).toBe(
      '等一下浏览器会问能不能用你的位置，请按「允许」（英文是 Allow）',
    )
    fireEvent.click(button(text('location_explain_ok')))
    await act(flush)
    expect(h.location.level).toBe('PRECISE')
    expect(screen.queryByRole('dialog')).toBeNull()
    getText(text('loc_ready'))
  })

  it('LOCATION-04 按「先不要」：首页卡片「没有定位权限」+「允许定位」，之后还可以再问', async () => {
    renderApp({ before: (harness) => (harness.location.level = 'NONE') })
    fireEvent.click(button(text('location_explain_later')))
    getText(text('loc_denied'))
    fireEvent.click(button(text('action_grant_location')))
    expect(screen.getByRole('dialog', { name: text('location_explain_title') })).toBeInTheDocument()
  })

  it('浏览器挡住了：不说明「好，去允许」，卡片说在浏览器设置里打开；「怎么打开？」有安卓和 iPhone 的步骤', async () => {
    renderApp({
      before: (harness) => {
        harness.location.level = 'NONE'
        harness.location.blocked = true
      },
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    getText(text('loc_denied_permanent'))
    fireEvent.click(button(text('action_open_app_settings')))
    const help = screen.getByRole('dialog', { name: webText('web_location_help_title') })
    within(help).getByText(byFullText(webText('web_location_help_android')))
    within(help).getByText(byFullText(webText('web_location_help_iphone')))
    expect(within(help).getByRole('button', { name: webText('web_location_help_retry') })).toBeInTheDocument()
  })

  it('不是 https 打开的：卡片说原因和办法（不叫人去「允许」）', async () => {
    renderApp({ env: 'INSECURE', before: (harness) => (harness.location.level = 'NONE') })
    expect(screen.queryByRole('dialog')).toBeNull()
    getText(webText('web_location_insecure'))
    getText(webText('web_location_insecure_help'))
    expect(queryButton(text('action_grant_location'))).toBeNull()
  })

  it('浏览器不能定位：卡片说换用手机自带的浏览器', async () => {
    renderApp({ env: 'UNSUPPORTED', before: (harness) => (harness.location.level = 'NONE') })
    expect(screen.queryByRole('dialog')).toBeNull()
    getText(webText('web_location_unsupported'))
    getText(webText('web_location_unsupported_help'))
    fireEvent.click(button(text('action_open_app_settings')))
    const help = screen.getByRole('dialog', { name: webText('web_location_help_title') })
    expect(within(help).queryByRole('button', { name: webText('web_location_help_retry') })).toBeNull()
  })

  it('暂时拿不到位置（超时）：卡片「暂时拿不到你的位置」+ 怎么办 +「重试」', async () => {
    const { h } = renderApp({ before: (harness) => (harness.location.unavailable = true) })
    await act(flush)
    getText(text('loc_unavailable'))
    getText(webText('web_location_unavailable_hint'))
    h.location.unavailable = false
    fireEvent.click(button(text('action_retry')))
    await act(flush)
    getText(text('loc_ready'))
  })

  it('按「吃饭」时还没有权限：先说明，答应以后马上接着搜那一次（演示）', async () => {
    const { store } = renderApp({ demoMode: true, before: (harness) => (harness.location.level = 'NONE') })
    fireEvent.click(button(text('location_explain_later')))
    fireEvent.click(button(text('eat_noodle')))
    expect(screen.getByRole('dialog', { name: text('location_explain_title') })).toBeInTheDocument()
    expect(store.ui.kind).toBe('HOME')
    fireEvent.click(button(text('location_explain_ok')))
    await act(flush)
    await waitFor(() => expect(store.ui.kind).toBe('RESULTS'))
  })
})
