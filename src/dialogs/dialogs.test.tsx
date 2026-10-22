import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fortuneChip, fortuneGoLabel, pickNoteText, randomResultValue, shareFortune, text, webText } from '../app/texts.ts'
import { choiceChipLabel } from '../domain/cuisine.ts'
import { fortuneChoice, fortuneLevelName, fortuneStick } from '../domain/fortune.ts'
import { flush } from '../test/helpers.ts'
import { button, byFullText, getText, queryText, renderApp } from '../test/ui.tsx'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function randomDialog() {
  return screen.getByRole('dialog', { name: text('random_title') })
}

describe('🎲 帮你随便挑（功能清单第五节）', () => {
  it('PICK 打开那一刻就决定好；减少动画时卷轴直接停在结果，「就它了」「再摇一次」可以按', async () => {
    const { store } = renderApp({ demoMode: true })
    await act(flush)
    fireEvent.click(button(text('random_entry')))
    const pick = store.home.randomPick
    expect(pick).not.toBeNull()
    const dialog = randomDialog()
    within(dialog).getByText(text('random_result_prefix'))
    within(dialog).getByText(randomResultValue(pick!.choice))
    expect(within(dialog).getByRole('button', { name: text('random_go') })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: text('random_again') })).toBeEnabled()
    // 中午：时段说明那一行；摇多少次都不扣次数
    within(dialog).getByText(byFullText(pickNoteText({ kind: 'TIME_OF_DAY', dayPart: 'LUNCH' })!))
    within(dialog).getByText(byFullText(text('random_note')))
    await waitFor(() => expect(store.home.randomPick?.settled).toBe(true))
  })

  it('转动中「就它了」「再摇一次」是灰的（不会在看到结果前就搜索），「算了，我自己选」随时能按', async () => {
    const { store } = renderApp({ reducedMotion: false })
    await act(flush)
    fireEvent.click(button(text('random_entry')))
    const dialog = randomDialog()
    expect(within(dialog).getByRole('button', { name: text('random_go') })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: text('random_again') })).toBeDisabled()
    within(dialog).getByText(text('random_spinning'))
    fireEvent.click(within(dialog).getByRole('button', { name: text('random_cancel') }))
    expect(store.home.randomPick).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('PICK-17 再摇一次：一定会变，刚才的放进「刚才摇到」（在按钮下面）；点回去马上显示那个、不转', async () => {
    const { store } = renderApp({ demoMode: true })
    await act(flush)
    fireEvent.click(button(text('random_entry')))
    const first = store.home.randomPick!.choice
    fireEvent.click(button(text('random_again')))
    const second = store.home.randomPick!.choice
    expect(second).not.toEqual(first)
    const dialog = randomDialog()
    within(dialog).getByText(text('random_history'))
    within(dialog).getByText(randomResultValue(second))
    fireEvent.click(within(dialog).getByRole('button', { name: choiceChipLabel(first) }))
    expect(store.home.randomPick!.choice).toEqual(first)
    expect(store.home.randomPick!.settled).toBe(true)
    within(dialog).getByText(randomResultValue(first))
    within(dialog).getByRole('button', { name: choiceChipLabel(second) })
  })

  it('「就它了，开始找」：关掉对话框、首页格子选好那个菜系，用这个组合搜索（演示不扣次数）', async () => {
    const { store, h } = renderApp({ demoMode: true })
    await act(flush)
    fireEvent.click(button(text('random_entry')))
    const choice = store.home.randomPick!.choice
    fireEvent.click(button(text('random_go')))
    expect(store.home.randomPick).toBeNull()
    expect(store.home.selectedCuisine).toBe(choice.cuisine)
    await act(flush)
    await waitFor(() => expect(store.ui.kind).toBe('RESULTS'))
    expect(store.ui.kind === 'RESULTS' && store.ui.choice).toEqual(choice)
    expect(h.guard.textSearchesUsed()).toBe(0)
  })

  it('连吃 3 次同一个菜系：首页提醒，点一下打开随便挑，这次不摇那个菜系', async () => {
    const { store } = renderApp({
      before: (h) => {
        const now = h.clock.now()
        const hour = 60 * 60 * 1000
        h.visits.save([
          { placeId: 'a', cuisine: 'JAPANESE', atMillis: now - 30 * hour },
          { placeId: 'b', cuisine: 'JAPANESE', atMillis: now - 20 * hour },
          { placeId: 'c', cuisine: 'JAPANESE', atMillis: now - 6 * hour },
        ])
      },
    })
    await act(flush)
    const streak = text('streak_text', 3, '日本餐')
    getText(streak)
    fireEvent.click(screen.getByText(byFullText(streak)).closest('button')!)
    expect(store.home.randomPick?.excludedCuisine).toBe('JAPANESE')
    within(randomDialog()).getByText(byFullText(text('random_excluded', '日本餐')))
  })
})

describe('📜 今日饭签（功能清单第六节）', () => {
  it('FORTUNE 第一次打开：先摇签筒「摇啊摇…」，签纸打开那一刻才记成今天抽过（首页胶囊才变）', async () => {
    vi.useFakeTimers()
    const { store } = renderApp({ reducedMotion: false })
    const stick = store.home.fortune!.stickIndex
    fireEvent.click(button(`${text('fortune_chip_a11y')}，${text('fortune_chip_draw')}`))
    const dialog = screen.getByRole('dialog', { name: text('fortune_title') })
    within(dialog).getByText(text('fortune_shaking'))
    expect(store.home.fortune!.drawn).toBe(false)
    act(() => vi.advanceTimersByTime(1000))
    expect(store.home.fortune!.drawn).toBe(false)
    act(() => vi.advanceTimersByTime(1000))
    expect(store.home.fortune!.drawn).toBe(true)
    within(dialog).getByText(byFullText(text('fortune_yi', fortuneStick(stick).yi)))
    within(dialog).getByText(byFullText(text('fortune_ji', fortuneStick(stick).ji)))
    expect(within(dialog).getByText(new RegExp(fortuneLevelName(stick)))).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: text('fortune_close') }))
    expect(button(`${text('fortune_chip_a11y')}，${fortuneChip(stick, true)}`)).toBeInTheDocument()
  })

  it('抽过了（或减少动画）：直接显示签纸；同一天再打开还是同一支', async () => {
    const { store } = renderApp()
    const stick = store.home.fortune!.stickIndex
    fireEvent.click(button(`${text('fortune_chip_a11y')}，${text('fortune_chip_draw')}`))
    expect(queryText(text('fortune_shaking'))).toBeNull()
    getText(text('fortune_yi', fortuneStick(stick).yi))
    expect(store.home.fortune!.drawn).toBe(true)
    getText(text('fortune_go_note'))
    fireEvent.click(button(text('fortune_close')))
    fireEvent.click(button(`${text('fortune_chip_a11y')}，${fortuneChip(stick, true)}`))
    getText(text('fortune_yi', fortuneStick(stick).yi))
  })

  it('FORTUNE-06 照签去找：关窗口、格子选好签上的菜系、用签上的组合搜索（演示写「演示模式不扣次数」）', async () => {
    const { store } = renderApp({ demoMode: true })
    const stick = store.home.fortune!.stickIndex
    fireEvent.click(button(`${text('fortune_chip_a11y')}，${text('fortune_chip_draw')}`))
    getText(text('fortune_go_note_demo'))
    fireEvent.click(button(fortuneGoLabel(stick)))
    expect(screen.queryByRole('dialog', { name: text('fortune_title') })).toBeNull()
    expect(store.home.selectedCuisine).toBe(fortuneChoice(stick).cuisine)
    await act(flush)
    await waitFor(() => expect(store.ui.kind).toBe('RESULTS'))
    expect(store.ui.kind === 'RESULTS' && store.ui.choice).toEqual(fortuneChoice(stick))
  })

  it('WEB-19 发到群里比一比：没有分享面板就复制，提示「已经复制好了」；复制的是四行的纯文字', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { store } = renderApp()
    const stick = store.home.fortune!.stickIndex
    fireEvent.click(button(`${text('fortune_chip_a11y')}，${text('fortune_chip_draw')}`))
    fireEvent.click(button(text('fortune_share')))
    await act(flush)
    expect(writeText).toHaveBeenCalledWith(shareFortune(stick))
    expect(shareFortune(stick).split('\n')).toHaveLength(4)
    expect(screen.getByRole('status')).toHaveTextContent(webText('web_share_copied'))
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
  })

  it('复制也不行：显示文字让人长按复制', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const { store } = renderApp()
    const stick = store.home.fortune!.stickIndex
    fireEvent.click(button(`${text('fortune_chip_a11y')}，${text('fortune_chip_draw')}`))
    fireEvent.click(button(text('fortune_share')))
    await act(flush)
    getText(webText('web_share_copy_failed'))
    expect(screen.getByRole('textbox')).toHaveValue(shareFortune(stick))
  })
})

describe('⚙️ 设置（功能清单第十九节）', () => {
  it('演示开关一拨就生效（不用按保存），标题栏马上有「演示」', async () => {
    const { store } = renderApp()
    fireEvent.click(button(text('settings')))
    const dialog = screen.getByRole('dialog', { name: text('settings_title') })
    fireEvent.click(within(dialog).getByRole('switch', { name: new RegExp(text('demo_switch').slice(0, 5)) }))
    expect(store.home.demoMode).toBe(true)
    getText(text('demo_badge'))
  })

  it('KEY 密钥每打一个字就清理（全角 → 半角，去掉看不见的符号）；没保存就关 → 先问「要保存吗？」', async () => {
    const { h } = renderApp({ apiKey: '' })
    fireEvent.click(button(text('settings')))
    fireEvent.click(button(`${text('settings_advanced')}${text('settings_advanced_note')}`))
    const input = screen.getByLabelText(text('settings_key_label'))
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.change(input, { target: { value: 'ＡＩｚａ​Sy 12-_3\n' } })
    expect(input).toHaveValue('AIzaSy12-_3')
    fireEvent.click(button(text('settings_close')))
    const ask = screen.getByRole('dialog', { name: text('settings_unsaved_title') })
    fireEvent.click(within(ask).getByRole('button', { name: text('save') }))
    expect(h.settings.apiKeyOverride).toBe('AIzaSy12-_3')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(text('settings_key_saved'))
  })

  it('网站限制写这个网站的网域（浏览器跨网站只送出网域）', async () => {
    renderApp()
    fireEvent.click(button(text('settings')))
    fireEvent.click(button(`${text('settings_advanced')}${text('settings_advanced_note')}`))
    getText(`${window.location.origin}/*`)
    getText(webText('web_key_local_note'))
  })
})

describe('返回键（功能清单 2.4，测试 WEB-13）', () => {
  it('WEB-13 浏览器的返回键先关对话框；Esc 也一样', async () => {
    const { store } = renderApp({ demoMode: true })
    await act(flush)
    fireEvent.click(button(text('random_entry')))
    expect(store.home.randomPick).not.toBeNull()
    act(() => window.history.back())
    await waitFor(() => expect(store.home.randomPick).toBeNull())
    expect(store.ui.kind).toBe('HOME')

    fireEvent.click(button(text('radius_chip_a11y', '1.5')))
    expect(screen.getByRole('dialog', { name: text('radius_dialog_title') })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('WEB-13 不是首页 → 返回键回首页', async () => {
    const { store } = renderApp({ demoMode: true })
    await act(flush)
    fireEvent.click(button(text('eat_any')))
    await act(flush)
    await waitFor(() => expect(store.ui.kind).toBe('RESULTS'))
    act(() => window.history.back())
    await waitFor(() => expect(store.ui.kind).toBe('HOME'))
  })
})
