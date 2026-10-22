import { describe, expect, it } from 'vitest'
import { BackHistory, LAYER_STATE, type HistoryLike, type PopTarget } from './backHistory.ts'

/** 假的浏览器历史：back() 跟真的一样是「等一下」才发 popstate（flush() 时才发）。 */
class FakeHistory implements HistoryLike, PopTarget {
  entries: unknown[] = [null]
  index = 0
  private listeners = new Set<(event: PopStateEvent) => void>()
  private pending = 0

  get state(): unknown {
    return this.entries[this.index]
  }

  pushState(data: unknown): void {
    this.entries = this.entries.slice(0, this.index + 1)
    this.entries.push(data)
    this.index++
  }

  back(): void {
    this.pending++
  }

  /** 用户按浏览器的返回键。 */
  userBack(): void {
    this.pending++
    this.flush()
  }

  flush(): void {
    while (this.pending > 0) {
      this.pending--
      if (this.index === 0) continue // 离开网页
      this.index--
      const event = { state: this.state } as PopStateEvent
      for (const listener of [...this.listeners]) listener(event)
    }
  }

  addEventListener(_type: 'popstate', listener: (event: PopStateEvent) => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'popstate', listener: (event: PopStateEvent) => void): void {
    this.listeners.delete(listener)
  }
}

/** 一个很小的「画面」：一叠可以关的层，按返回只关最上面一层。 */
function setup() {
  const history = new FakeHistory()
  const layers: string[] = []
  const back = new BackHistory(
    () => {
      layers.pop()
      back.sync(layers.length > 0)
    },
    history,
    history,
  )
  const open = (name: string) => {
    layers.push(name)
    back.sync(true)
  }
  const closeByButton = () => {
    layers.pop()
    back.sync(layers.length > 0)
  }
  return { history, layers, back, open, closeByButton }
}

describe('返回键（WEB-13）', () => {
  it('WEB-13 有东西可以关时多放一格；按返回只关最上面一层，关完还有就再放一格', () => {
    const { history, layers, open } = setup()
    open('结果页')
    open('随便挑')
    expect(history.entries).toEqual([null, LAYER_STATE])

    history.userBack()
    expect(layers).toEqual(['结果页'])
    expect(history.index).toBe(1) // 又放了一格

    history.userBack()
    expect(layers).toEqual([])
    expect(history.index).toBe(0)
  })

  it('WEB-13 首页（没有东西可以关）再按返回就离开网页', () => {
    const { history, layers } = setup()
    expect(history.entries).toEqual([null])
    history.userBack()
    expect(layers).toEqual([])
    expect(history.index).toBe(0)
  })

  it('WEB-13 用按钮关掉最后一层：自己退掉标记那一格，回首页后按一次返回就离开', () => {
    const { history, layers, open, closeByButton } = setup()
    open('随便挑')
    closeByButton()
    history.flush()
    expect(layers).toEqual([])
    expect(history.index).toBe(0)
  })

  it('自己的 back() 还没回来时又开了一层：回来以后再放一格，不会把新的一层关掉', () => {
    const { history, layers, open, closeByButton } = setup()
    open('随便挑')
    closeByButton()
    open('饭签')
    history.flush()
    expect(layers).toEqual(['饭签'])
    expect(history.state).toEqual(LAYER_STATE)
    history.userBack()
    expect(layers).toEqual([])
  })

  it('画面上的返回箭头 = 浏览器返回键；没有标记时回传 false', () => {
    const { history, layers, back, open } = setup()
    expect(back.requestBack()).toBe(false)
    open('错误页')
    expect(back.requestBack()).toBe(true)
    history.flush()
    expect(layers).toEqual([])
  })

  it('重新整理后已经停在标记那一格上：不再多放一格', () => {
    const history = new FakeHistory()
    history.pushState(LAYER_STATE)
    let backs = 0
    const back = new BackHistory(() => backs++, history, history)
    back.sync(true)
    expect(history.entries).toEqual([null, LAYER_STATE])
    history.userBack()
    expect(backs).toBe(1)
  })

  it('按「前进」回到标记那一格：什么都不关', () => {
    const { history, layers, open } = setup()
    open('结果页')
    history.userBack()
    expect(layers).toEqual([])
    // 浏览器的「前进」
    history.index = 1
    const event = { state: LAYER_STATE } as PopStateEvent
    ;(history as unknown as { listeners: Set<(e: PopStateEvent) => void> }).listeners.forEach((l) => l(event))
    expect(layers).toEqual([])
    history.flush()
    expect(history.index).toBe(0)
  })
})
