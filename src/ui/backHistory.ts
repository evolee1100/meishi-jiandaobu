/**
 * 浏览器的返回键 = 安卓的返回键（功能清单 2.4、31.15，测试 WEB-13）。
 *
 * 做法：画面上「有东西可以关」（弹窗、游戏层、饭桌、不是首页）时，在浏览器历史里多放一格「标记」（pushState，网址不变）。
 * 用户按返回 → 浏览器退掉这一格、发 popstate → 我们照 2.4 的顺序只关一层；关完还有东西可以关，就再放一格。
 * 用按钮把最后一层关掉时（例如按「算了，我自己选」），自己退掉那一格（history.back()），
 * 这样回到首页后再按一次返回就真的离开网页，不用多按一次。
 *
 * 不靠服务器路由、不改网址：GitHub Pages 子路径下刷新也不会 404。
 */

/** 历史里「标记」那一格的 state。 */
export const LAYER_STATE = { meishi: 'layer' } as const

export interface HistoryLike {
  readonly state: unknown
  pushState(data: unknown, unused: string): void
  back(): void
}

export interface PopTarget {
  addEventListener(type: 'popstate', listener: (event: PopStateEvent) => void): void
  removeEventListener(type: 'popstate', listener: (event: PopStateEvent) => void): void
}

function isLayerState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { meishi?: unknown }).meishi === LAYER_STATE.meishi
}

export class BackHistory {
  private readonly history: HistoryLike
  private readonly target: PopTarget
  private readonly onBack: () => void
  /** 现在停在我们放的「标记」那一格上。 */
  private onLayer: boolean
  /** 自己调了 history.back()：下一个 popstate 是我们自己造成的，不算用户按返回。 */
  private selfBacks = 0
  private wanted = false
  private readonly listener = (event: PopStateEvent) => this.onPop(event)

  /**
   * onBack：用户按了一次返回（画面照 2.4 只关一层）。
   * 网页重新整理后可能已经停在「标记」那一格上（history.state 还在），这时不再多放一格。
   */
  constructor(onBack: () => void, history: HistoryLike = window.history, target: PopTarget = window) {
    this.history = history
    this.target = target
    this.onBack = onBack
    this.onLayer = isLayerState(history.state)
    target.addEventListener('popstate', this.listener)
  }

  dispose(): void {
    this.target.removeEventListener('popstate', this.listener)
  }

  /** 每次画面变化都告诉这里「现在有没有东西可以关」。 */
  sync(hasLayer: boolean): void {
    this.wanted = hasLayer
    if (this.selfBacks > 0) return // 等自己的 back() 回来再说
    if (hasLayer && !this.onLayer) {
      this.history.pushState(LAYER_STATE, '')
      this.onLayer = true
    } else if (!hasLayer && this.onLayer) {
      this.onLayer = false
      this.selfBacks++
      this.history.back()
    }
  }

  /** 画面上的「返回」箭头、Esc：跟按浏览器的返回键一样。回传 false = 没有标记可以退（画面自己直接关一层）。 */
  requestBack(): boolean {
    if (!this.onLayer || this.selfBacks > 0) return false
    this.history.back()
    return true
  }

  private onPop(event: PopStateEvent): void {
    const onLayer = isLayerState(event.state)
    if (this.selfBacks > 0) {
      this.selfBacks--
      this.onLayer = onLayer
      this.sync(this.wanted)
      return
    }
    if (onLayer) {
      // 用户按「前进」又回到标记那一格：什么都不关。
      this.onLayer = true
      this.sync(this.wanted)
      return
    }
    this.onLayer = false
    if (this.wanted) this.onBack()
  }
}
