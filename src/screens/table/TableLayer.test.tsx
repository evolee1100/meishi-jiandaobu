/**
 * 👥 饭桌模式的画面（功能清单第十四节；测试 SCREEN-01、TABLE-07、TABLE-08、TABLE-13、TABLE-17 的画面部分）。
 * 用演示店（不连网）把整个 App 画出来，按画面上的按钮玩一遍；状态层的规则另外在 store.round5*.test.ts 测过。
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resultsView, tablePlayers } from '../../app/state.ts'
import { text } from '../../app/texts.ts'
import { TABLE } from '../../data/constants.ts'
import { acceptNameInput } from '../../dialogs/TableDialogs.tsx'
import type { SearchChoice } from '../../domain/model.ts'
import { avatarEmoji, playerLabel } from '../../domain/table.ts'
import { flush, plain } from '../../test/helpers.ts'
import { results } from '../../test/storeHarness.ts'
import { button, getText, queryButton, queryText, renderApp } from '../../test/ui.tsx'

async function demoSearch(choice: SearchChoice = { cuisine: 'CHINESE', meal: 'ANY' }) {
  const rendered = renderApp({ demoMode: true })
  await act(flush)
  act(() => rendered.store.search(choice))
  await act(flush)
  await waitFor(() => expect(rendered.store.ui.kind).toBe('RESULTS'))
  return rendered
}

/** 圈这一页 3 家 + 下一页 1 家 → 👥 饭桌模式（4 家）。 */
async function tableWithFour() {
  const rendered = await demoSearch()
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getAllByRole('button', { name: /^圈起来：/ })[0] as HTMLElement)
  fireEvent.click(button(text('more')))
  fireEvent.click(screen.getAllByRole('button', { name: /^圈起来：/ })[0] as HTMLElement)
  fireEvent.click(button(text('basket_table')))
  expect(rendered.store.table?.placeIds).toHaveLength(4)
  return rendered
}

/** 剪刀石头布（这一页 3 家）→ 改用饭桌模式。 */
async function tableWithThree() {
  const rendered = await demoSearch()
  fireEvent.click(button(text('decide_rps_bar')))
  fireEvent.click(screen.getByRole('button', { name: (name) => plain(name).includes(plain(text('duel_switch_table'))) }))
  expect(rendered.store.duel).toBeNull()
  expect(rendered.store.table?.placeIds).toHaveLength(3)
  return rendered
}

function cutButtons(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: /^划掉：/ })
}

function pressBack(): void {
  fireEvent.keyDown(window, { key: 'Escape' })
}

beforeEach(() => {
  Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('👥 饭桌模式的画面（功能清单第十四节）', () => {
  it('第一页：几个人（第一次 = 店数）、6 个头像（玩的亮）、候选、两张大卡（4 家时暗中出拳不能玩）、不扣免费次数；一个请求都不发', async () => {
    const { store, h } = await tableWithFour()
    const layer = screen.getByTestId('table-layer')
    expect(within(layer).getByRole('heading', { level: 2 })).toContainElement(getText(text('table_title')))
    const four = screen.getByRole('radio', { name: (name) => plain(name) === plain(text('table_people_a11y', 4)) })
    expect(four).toHaveAttribute('aria-checked', 'true')
    expect(within(layer).getAllByRole('listitem')).toHaveLength(6)
    expect(layer.querySelectorAll('.avatar-row__item.is-playing')).toHaveLength(4)
    const names = store.table?.placeIds.map((id) => resultsView(results(store)).items.find((i) => i.place.id === id)) ?? []
    expect(names).toHaveLength(4)
    getText(text('table_rename_hint'))
    expect(screen.getByRole('button', { name: new RegExp(plain(text('table_veto_title'))) })).toBeEnabled()
    const secret = screen.getByRole('button', { name: new RegExp(plain(text('table_secret_title'))) })
    expect(secret).toBeDisabled()
    expect(secret).toContainElement(getText(text('table_secret_need_three')))
    getText(text('duel_free_note'))

    fireEvent.click(screen.getByRole('radio', { name: (name) => plain(name) === plain(text('table_people_a11y', 6)) }))
    expect(store.table?.playerCount).toBe(6)
    expect(h.games.tablePlayers).toBe(6) // 记住
    expect(layer.querySelectorAll('.avatar-row__item.is-playing')).toHaveLength(6)
    expect(h.searcher.calls).toBe(0)
    expect(h.photos.calls).toBe(0)
  })

  it('改名字：最多 6 个字（emoji 算 1 个，超过的整个不收，换行去掉）、只存在这个浏览器；【用回原来的名字】；返回键只关对话框', async () => {
    expect(acceptNameInput('陈大伯的女儿')).toBe('陈大伯的女儿')
    expect(acceptNameInput('陈大伯的女儿啊')).toBeNull()
    expect(acceptNameInput('🐯🐯🐯🐯🐯🐯')).toBe('🐯🐯🐯🐯🐯🐯')
    expect(acceptNameInput('Jenny\nL')).toBe('JennyL')

    const { store, h } = await tableWithFour()
    fireEvent.click(screen.getByRole('button', { name: (name) => plain(name) === plain(text('avatar_a11y', '🐯 老虎')) }))
    const dialog = screen.getByRole('dialog', { name: (name) => plain(name) === plain(text('table_rename_title', '🐯 老虎')) })
    const input = within(dialog).getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', '老虎')
    fireEvent.change(input, { target: { value: '小玲' } })
    fireEvent.change(input, { target: { value: '小玲小玲小玲小' } }) // 7 个字：整个不收
    expect(input).toHaveValue('小玲')
    getText(text('table_rename_note'))
    fireEvent.click(within(dialog).getByRole('button', { name: text('table_rename_save') }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.games.avatarName('TIGER')).toBe('小玲')
    expect(store.table?.avatars[0]?.customName).toBe('小玲')
    expect(screen.getByRole('button', { name: (name) => plain(name) === plain(text('avatar_a11y', '🐯 小玲')) })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: (name) => plain(name) === plain(text('avatar_a11y', '🐯 小玲')) }))
    pressBack() // 返回键：只关对话框，饭桌还在
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(store.table).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: (name) => plain(name) === plain(text('avatar_a11y', '🐯 小玲')) }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: text('table_rename_reset') }))
    expect(h.games.avatarName('TIGER')).toBe('')
    expect(store.table?.avatars[0]?.customName).toBe('')
  })

  it('TABLE-08 ✂️ 划一刀：抽签、裁判、还要划几刀；划了 3 秒内可以撤销，这 3 秒谁都不能再划；3 秒后轮到下一位；最后一刀红框；划完 3 秒自己进「就这一家吧！」（没有不服）', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { store, h } = await tableWithFour()
    fireEvent.click(screen.getByRole('radio', { name: (name) => plain(name) === plain(text('table_people_a11y', 5)) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(plain(text('table_veto_title'))) }))
    const table = store.table
    const veto = table?.veto
    if (!table || !veto) throw new Error('没有开始划刀')
    const players = tablePlayers(table)
    const emoji = (i: number) => avatarEmoji(players[i]?.avatar ?? 'TIGER')
    getText(text('veto_order', veto.order.map(emoji).join(' → ')))
    getText(text('veto_referees', veto.order.slice(3).map(emoji).join('、')))
    getText(text('veto_turn', playerLabel(players[veto.order[0] as number]!)))
    getText(text('veto_left', 3))
    expect(cutButtons()).toHaveLength(4)

    fireEvent.click(cutButtons()[0] as HTMLElement)
    expect(store.table?.undoable).toBe(true)
    expect(cutButtons()).toHaveLength(0) // 撤销期间谁都不能再划
    expect(button(text('veto_undo'))).toBeInTheDocument()
    fireEvent.click(button(text('veto_undo')))
    expect(store.table?.veto?.cuts).toEqual([])
    expect(cutButtons()).toHaveLength(4)

    fireEvent.click(cutButtons()[0] as HTMLElement)
    act(() => vi.advanceTimersByTime(TABLE.CUT_UNDO_MS + 50))
    expect(store.table?.undoable).toBe(false)
    expect(queryButton(text('veto_undo'))).toBeNull()
    getText(text('veto_left', 2))
    expect(cutButtons()).toHaveLength(3)

    fireEvent.click(cutButtons()[0] as HTMLElement)
    act(() => vi.advanceTimersByTime(TABLE.CUT_UNDO_MS + 50))
    // 最后一刀：标题变红、整个画面一圈红框
    expect(screen.getByTestId('veto-board')).toHaveClass('is-last-cut')
    expect(document.querySelector('.veto-frame')).not.toBeNull()
    getText(text('veto_last_cut', playerLabel(players[veto.order[2] as number]!)))

    fireEvent.click(cutButtons()[0] as HTMLElement)
    expect(button(text('veto_see_result'))).toBeInTheDocument()
    expect(store.duel).toBeNull() // 还在撤销的 3 秒里
    act(() => vi.advanceTimersByTime(TABLE.CUT_UNDO_MS + 50))
    expect(store.table).toBeNull()
    expect(store.duel?.mode).toBe('VETO')
    await waitFor(() => screen.getByTestId('game-layer'))
    getText(text('verdict_veto', 3))
    expect(queryButton(text('duel_regret', 1))).toBeNull()
    getText(text('meal_settled'))
    expect(h.searcher.calls).toBe(0)
  })

  it('TABLE-17 返回键：第一页直接关（不问）；开始划以后先问「饭桌还没玩完，要结束吗？」【继续玩】留下、【结束】关掉，这一餐没定', async () => {
    const { store } = await tableWithFour()
    pressBack()
    await waitFor(() => expect(store.table).toBeNull())
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(button(text('basket_table')))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(plain(text('table_veto_title'))) }))
    fireEvent.click(cutButtons()[0] as HTMLElement)
    pressBack()
    const ask = await waitFor(() => screen.getByRole('dialog', { name: text('table_leave_title') }))
    fireEvent.click(within(ask).getByRole('button', { name: text('table_leave_no') }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(store.table?.phase).toBe('VETO')

    fireEvent.click(screen.getByRole('button', { name: text('back') }))
    const again = await waitFor(() => screen.getByRole('dialog', { name: text('table_leave_title') }))
    fireEvent.click(within(again).getByRole('button', { name: text('table_leave_yes') }))
    await waitFor(() => expect(store.table).toBeNull())
    expect(store.duel).toBeNull()
    expect(store.mealDecision).toBeNull()
    expect(button(text('basket_table'))).toBeInTheDocument()
  })

  it('SCREEN-01 / TABLE-07 🙈 暗中出拳：交手机页没有重出；选了以后三张一起翻成一样的「✔ 出好了」（画面看不出按了哪张）；只有自己这一页有重出；不会自己交出去；全部出完页没有重出', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { store } = await tableWithThree()
    fireEvent.click(screen.getByRole('radio', { name: (name) => plain(name) === plain(text('table_people_a11y', 2)) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(plain(text('table_secret_title'))) }))
    const table = store.table
    const secret = table?.secret
    if (!table || !secret) throw new Error('没有开始暗中出拳')
    const players = tablePlayers(table)
    const first = players[secret.order[0] as number]!
    const second = players[secret.order[1] as number]!

    // 交手机：谁的手势都不在，也不能重出
    getText(text('secret_handover_first', playerLabel(first)))
    getText(text('secret_dont_peek'))
    getText(text('secret_progress', 0, 2))
    expect(queryButton(text('secret_redo_self'))).toBeNull()
    fireEvent.click(button(text('secret_take')))

    // 选手势：三张卡，读屏念「✊ 石头，代表…」
    getText(text('secret_choose_title', playerLabel(first)))
    const hands = screen.getAllByRole('button', { name: /，代表/ })
    expect(hands).toHaveLength(3)
    fireEvent.click(hands[1] as HTMLElement)
    expect(screen.getByTestId('secret-choose')).toHaveAttribute('data-step', 'chosen')
    // 三张一起翻过去：每张背面都一样，画面上没有任何一张标出「选了」
    const cards = document.querySelectorAll('.secret-card')
    expect(cards).toHaveLength(3)
    cards.forEach((card) => expect(card).toHaveClass('is-turned'))
    expect(document.querySelectorAll('.secret-card__done')).toHaveLength(3)
    expect(screen.queryAllByRole('button', { name: /，代表/ })).toHaveLength(0)
    expect(JSON.stringify(store.table)).not.toMatch(/ROCK|SCISSORS|PAPER/)
    // 不会过几秒自己交出去
    act(() => vi.advanceTimersByTime(10_000))
    expect(store.table?.secret?.step).toBe('CHOSEN')
    // 自己这一页可以重出
    fireEvent.click(button(text('secret_redo_self')))
    expect(store.table?.secret?.step).toBe('CHOOSING')
    fireEvent.click(screen.getAllByRole('button', { name: /，代表/ })[0] as HTMLElement)
    fireEvent.click(button(text('secret_pass_next', playerLabel(second))))

    // 下一位：交手机页没有重出
    getText(text('secret_handover_next', playerLabel(second)))
    getText(text('secret_progress', 1, 2))
    expect(queryButton(text('secret_redo_self'))).toBeNull()
    fireEvent.click(button(text('secret_take')))
    fireEvent.click(screen.getAllByRole('button', { name: /，代表/ })[0] as HTMLElement)
    fireEvent.click(button(text('secret_pass_last')))

    // 全部出完：没有重出
    getText(text('secret_all_done_note'))
    expect(queryButton(text('secret_redo_self'))).toBeNull()
    expect(JSON.stringify(store.table)).not.toMatch(/ROCK|SCISSORS|PAPER/)
    expect(store.mealDecision).toBeNull()
  })

  it('🙈 一起翻牌：两个人都出 ✊ → 「全体心有灵犀！都出 ✊」；判定出来 1.8 秒后自己进「就这一家吧！」（第 1 家、饭桌定的不能反悔）', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { store } = await tableWithThree()
    fireEvent.click(screen.getByRole('radio', { name: (name) => plain(name) === plain(text('table_people_a11y', 2)) }))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(plain(text('table_secret_title'))) }))
    for (let turn = 0; turn < 2; turn++) {
      fireEvent.click(button(text('secret_take')))
      fireEvent.click(screen.getAllByRole('button', { name: /，代表/ })[0] as HTMLElement)
      fireEvent.click(screen.getByRole('button', { name: (name) => /^(交给|出好了)/.test(plain(name)) }))
    }
    fireEvent.click(button(text('secret_all_done')))
    expect(store.mealDecision).not.toBeNull() // 翻牌那一刻就算这一餐的决定
    const reveal = screen.getByTestId('secret-reveal')
    expect(reveal.querySelectorAll('.reveal-hand')).toHaveLength(2)
    getText(text('verdict_all_same', '✊'))
    expect(button(text('secret_see_result'))).toBeInTheDocument()
    expect(store.duel).toBeNull()
    act(() => vi.advanceTimersByTime(TABLE.VERDICT_MS + 50))
    expect(store.table).toBeNull()
    expect(store.duel?.mode).toBe('SECRET_HANDS')
    expect(store.duel?.winnerIndex).toBe(0)
    await waitFor(() => screen.getByTestId('game-layer'))
    expect(queryText(text('duel_regret', 1))).toBeNull()
    getText(text('lock_table'))
  })
})
