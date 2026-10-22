/**
 * 返回键和摇一摇什么时候听（安卓 ui/MainScreen.kt 的 BackHandler、ShakeListener 的条件），写成纯函数给画面用。
 * 网页的返回键 = history.pushState 给每一层，popstate 时照这里的顺序只关一层。
 */
import { tableInProgress, type AppState } from './state.ts'

export type BackStep =
  /** 有弹窗：关掉弹窗（画面自己管的弹窗，由画面告诉这里）。 */
  | 'CLOSE_DIALOG'
  /** 饭桌模式玩到一半：先问「饭桌还没玩完，要结束吗？」。 */
  | 'ASK_LEAVE_TABLE'
  /** 饭桌模式在第一页（或已经翻牌）：直接关（翻过牌的会显示结果）。 */
  | 'CLOSE_TABLE'
  /** 游戏层：关掉，回到列表（页数、滑到的位置都不变）。 */
  | 'CLOSE_DUEL'
  /** 不是首页：回首页（取消正在进行的搜索）。 */
  | 'BACK_HOME'
  /** 首页：交给浏览器（离开网页）。 */
  | 'LEAVE'

/** 按一次返回，只做第一件符合的事（功能清单 2.4）。dialogOpen = 画面上有任何弹窗（设置、饭签、随便挑…）。 */
export function backStep(state: AppState, dialogOpen: boolean): BackStep {
  if (dialogOpen || state.home.randomPick != null || state.mealPrompt != null || state.home.explainLocation) return 'CLOSE_DIALOG'
  if (state.table) return tableInProgress(state.table) ? 'ASK_LEAVE_TABLE' : 'CLOSE_TABLE'
  if (state.duel) return 'CLOSE_DUEL'
  if (state.ui.kind !== 'HOME') return 'BACK_HOME'
  return 'LEAVE'
}

/**
 * 📳 什么时候听感应器（其他时候根本不读）：开关开着、分页看得见，而且随便挑开着，或者在首页、首页上没有任何窗口
 * （设置、饭签、定位说明、想找多远的店？都不行）。结果页、游戏、饭桌不听。
 */
export function shouldListenForShake(state: AppState, homeWindowOpen: boolean, pageVisible: boolean): boolean {
  if (!state.home.shakeEnabled || !pageVisible) return false
  if (state.home.randomPick != null) return true
  return state.ui.kind === 'HOME' && !homeWindowOpen && !state.home.explainLocation
}
