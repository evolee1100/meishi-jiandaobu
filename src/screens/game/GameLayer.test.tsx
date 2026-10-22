/**
 * 游戏层和「就这一家吧！」的画面（功能清单第十二、十三节；测试 SCREEN-03、SCREEN-04、SCREEN-05、SCREEN-06 的画面部分）。
 * 用演示店把整个 App 画出来，按画面上的按钮玩；随机结果、愿赌服输的规则另外在状态层的测试里测过。
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { duelOutcome } from '../../app/state.ts'
import { text } from '../../app/texts.ts'
import { DUEL } from '../../data/constants.ts'
import type { SearchChoice } from '../../domain/model.ts'
import { isFreePass } from '../../domain/taskDeck.ts'
import { LuckyWheel } from './LuckyWheel.tsx'
import { flush, plain } from '../../test/helpers.ts'
import { button, getText, queryButton, renderApp, type AppOptions } from '../../test/ui.tsx'

async function demoSearch(choice: SearchChoice = { cuisine: 'CHINESE', meal: 'ANY' }, options: AppOptions = {}) {
  const rendered = renderApp({ demoMode: true, ...options })
  await act(flush)
  act(() => rendered.store.search(choice))
  await act(flush)
  await waitFor(() => expect(rendered.store.ui.kind).toBe('RESULTS'))
  return rendered
}

/** 等到「就这一家吧！」出来（App 的手停下、揭晓停一下）。 */
async function waitForResult(): Promise<HTMLElement> {
  act(() => vi.advanceTimersByTime(DUEL.RPS_REVEAL_MS + 2500))
  return waitFor(() => button(text('duel_navigate')))
}

let scrolled: Element[] = []

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  scrolled = []
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this)
  }
  window.open = (() => null) as typeof window.open
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('游戏层（功能清单第十二节）', () => {
  it('✊✌️🖐️ 剪刀石头布：等你先出拳（三张手势卡、改用饭桌模式）→ 出拳 → App 出拳、判定 → 就这一家吧！；不发请求', async () => {
    const { store, h } = await demoSearch()
    fireEvent.click(button(text('decide_rps_bar')))
    const layer = screen.getByTestId('game-layer')
    expect(layer).toHaveAttribute('data-phase', 'choose')
    getText(text('duel_title'))
    getText(text('duel_app_waiting'))
    getText(text('duel_pick_hint'))
    expect(within(layer).getAllByRole('button', { name: /，代表第/ })).toHaveLength(3)
    expect(screen.getByRole('button', { name: (name) => plain(name).includes(plain(text('duel_switch_table'))) })).toBeInTheDocument()

    fireEvent.click(within(layer).getAllByRole('button', { name: /，代表第/ })[0] as HTMLElement)
    if (!store.duel?.appHand) throw new Error('App 没出拳')
    // 出了拳就不能再换、也不能改用饭桌模式
    expect(within(layer).queryAllByRole('button', { name: /，代表第/ }).every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(queryButton(text('duel_switch_table'))).toBeNull()
    await waitForResult()
    getText(text('duel_result_title'))
    expect(screen.getByTestId('game-layer')).toHaveAttribute('data-phase', 'result')
    expect(h.searcher.calls).toBe(0)
  })

  it('SCREEN-04 彩带：刚揭晓才放、画在内容下面（先画）；「看一看」再显示不放；减少动画时不画', async () => {
    const { store } = await demoSearch(undefined, { reducedMotion: false })
    fireEvent.click(button(text('decide_rps_bar')))
    act(() => store.playHand('ROCK'))
    await waitForResult()
    const layer = screen.getByTestId('game-layer')
    const confetti = within(layer).getByTestId('confetti')
    expect(layer.firstElementChild).toBe(confetti) // 先画 = 在字和店卡下面
    fireEvent.click(button(text('duel_back')))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(plain(text('meal_banner_look'))) }))
    expect(screen.getByTestId('game-layer')).toBeInTheDocument()
    expect(screen.queryByTestId('confetti')).toBeNull()
  })

  it('SCREEN-04 减少动画：直接到结果，不放彩带', async () => {
    const { store } = await demoSearch(undefined, { reducedMotion: true })
    fireEvent.click(button(text('decide_rps_bar')))
    act(() => store.playHand('PAPER'))
    await waitForResult()
    expect(screen.queryByTestId('confetti')).toBeNull()
    expect(duelOutcome(store.duel!)).not.toBeNull()
  })

  it('SCREEN-05 「就这一家吧！」的字和透明按钮都垫了页面底色（不服、回到列表、谁来做、大家都同意重来）', async () => {
    const { store } = await demoSearch()
    fireEvent.click(button(text('decide_rps_bar')))
    act(() => store.playHand('ROCK'))
    await waitForResult()
    const regret = screen.getByRole('button', { name: (name) => plain(name).startsWith(plain(text('duel_regret', 1)).slice(0, 4)) })
    expect(regret).toHaveClass('btn--page')
    expect(button(text('duel_back'))).toHaveClass('btn--page')
    expect(document.querySelector('.result-title__main')?.closest('.backdrop, .result-title')).not.toBeNull()
    fireEvent.click(button(text('task_card_a11y')))
    await waitFor(() => expect(store.duel?.task).not.toBeNull())
    const who = queryButton(text('task_who'))
    if (who) expect(who).toHaveClass('btn--page')
  })

  it('🎡 转盘（圈 4 家）：中间「转！」→ 转啊转… → 停在这一家！→ 就这一家吧！', async () => {
    const { store } = await demoSearch()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getAllByRole('button', { name: /^圈起来：/ })[0] as HTMLElement)
    fireEvent.click(button(text('more')))
    fireEvent.click(screen.getAllByRole('button', { name: /^圈起来：/ })[0] as HTMLElement)
    fireEvent.click(button(text('decide_basket_wheel', 4)))
    expect(store.duel?.mode).toBe('WHEEL')
    getText(text('wheel_title_basket', 4))
    const spin = button(text('wheel_spin_a11y'))
    expect(spin).toBeEnabled()
    fireEvent.click(spin)
    expect(store.duel?.wheel).not.toBeNull()
    expect(store.mealDecision).not.toBeNull() // 按下「转！」那一刻就算这一餐的决定
    await waitForResult()
    expect(plain(screen.getByTestId('game-layer').textContent ?? '')).toMatch(/转盘停在了第\s*\d+\s*家/)
  })

  it('SCREEN-03 / SCREEN-06 🃏 任务卡：翻开后「转一下，看谁来做」自己滚进画面；几个人一起？→ 转 → 就是你了；再「看一看」从最上面开始、转盘直接停在结果、不自己往下滚', async () => {
    const { store } = await demoSearch()
    fireEvent.click(button(text('decide_rps_bar')))
    act(() => store.playHand('SCISSORS'))
    await waitForResult()
    fireEvent.click(button(text('task_card_a11y')))
    const task = store.duel?.task
    if (!task) throw new Error('没有抽到卡')
    if (isFreePass(task)) {
      getText(text('task_free_pass'))
      return
    }
    const who = await waitFor(() => button(text('task_who')))
    expect(scrolled).toContain(who) // 刚翻开：自己滚进画面
    fireEvent.click(who)
    getText(text('task_how_many'))
    fireEvent.click(screen.getByRole('radio', { name: (name) => plain(name) === plain(text('table_people_a11y', 3)) }))
    expect(store.duel?.task?.players).toHaveLength(3)
    await waitFor(() => expect(screen.getByTestId('task-wheel')).toHaveAttribute('data-stopped', 'true'))
    await waitFor(() => expect(document.querySelector('.task-assigned')).not.toBeNull())

    fireEvent.click(button(text('duel_back')))
    scrolled = []
    const scrollTo = vi.spyOn(window, 'scrollTo')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(plain(text('meal_banner_look'))) }))
    expect(screen.getByTestId('task-wheel')).toHaveAttribute('data-stopped', 'true')
    expect(scrolled).toHaveLength(0) // 再显示：不自己往下滚
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('不服！再来一局：用掉这一餐唯一一次反悔 → 新的一局；之后只剩「🔒 这一餐定了」+ 回到列表', async () => {
    const { store } = await demoSearch()
    fireEvent.click(button(text('decide_rps_bar')))
    act(() => store.playHand('ROCK'))
    await waitForResult()
    const round = store.duel?.round ?? 0
    fireEvent.click(screen.getByRole('button', { name: (name) => plain(name).startsWith(plain(text('duel_regret', 1)).slice(0, 4)) }))
    expect(store.duel?.round).toBeGreaterThan(round)
    expect(store.duel?.regretsLeft).toBe(0)
    const hand = store.duel?.mode === 'ROCK_PAPER_SCISSORS' ? within(screen.getByTestId('game-layer')).queryAllByRole('button', { name: /，代表第/ })[0] : null
    if (hand) fireEvent.click(hand)
    await waitForResult()
    getText(text('meal_settled'))
    expect(screen.queryByRole('button', { name: (name) => plain(name).startsWith('不服') })).toBeNull()
  })
})

describe('🎡 转盘零件（LuckyWheel）', () => {
  const spin = { target: 1, segments: 3, millis: 3000, offset: 0.1 }
  const segments = [
    { emoji: '🐯', label: '老虎' },
    { emoji: '🐼', label: '熊猫' },
    { emoji: '🐵', label: '猴子' },
  ]

  it('WEB-22 减少动画、一打开就要转的（投票平票、谁来做）：直接停在结果，而且一定告诉外面「停好了」（不会卡在「转啊转…」）', () => {
    const onStopped = vi.fn()
    render(<LuckyWheel segments={segments} spin={spin} play reducedMotion onStopped={onStopped} hub={false} description="转盘" maxSize={260} testId="wheel" />)
    expect(onStopped).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('wheel')).toHaveAttribute('data-stopped', 'true')
  })

  it('再显示已经转过的（play = false）：直接停在结果，不再叫「停好了」', () => {
    const onStopped = vi.fn()
    render(<LuckyWheel segments={segments} spin={spin} play={false} reducedMotion={false} onStopped={onStopped} hub={false} description="转盘" maxSize={260} testId="wheel" />)
    expect(onStopped).not.toHaveBeenCalled()
    expect(screen.getByTestId('wheel')).toHaveAttribute('data-stopped', 'true')
  })
})
