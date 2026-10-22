/**
 * 整个网页的外框（安卓 ui/MainScreen.kt）：标题栏、四个主画面（首页 / 加载中 / 结果 / 错误，同一时间只显示一个）、
 * 各种对话框、提示条，还有返回键、摇一摇、手机键盘这些「跟手机打交道」的事。
 *
 * 换画面不靠服务器路由（GitHub Pages 子路径下刷新也不会 404）：画面跟着状态层（store）的状态走；
 * 浏览器的返回键照安卓的顺序一次只关一层（ui/backHistory.ts）。刷新网页时，状态层会从 sessionStorage 把结果找回来。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { backStep, shouldListenForShake } from './app/navigation.ts'
import { tableInProgress } from './app/state.ts'
import type { MainStore } from './app/store.ts'
import { text, webText, type ErrorButton, type LocationCardAction, type LocationEnvironment } from './app/texts.ts'
import { RESULTS } from './data/constants.ts'
import type { AvatarId, MealId, SearchChoice } from './domain/model.ts'
import { FortuneDialog } from './dialogs/FortuneDialog.tsx'
import { LocationExplainDialog, LocationHelpDialog } from './dialogs/LocationDialogs.tsx'
import { RadiusDialog } from './dialogs/RadiusDialog.tsx'
import { RandomPickDialog } from './dialogs/RandomPickDialog.tsx'
import { SettingsDialog, UnsavedKeyDialog } from './dialogs/SettingsDialog.tsx'
import { ManualCopyDialog, RestartDialog } from './dialogs/ShareDialogs.tsx'
import { LeaveTableDialog, RenameDialog } from './dialogs/TableDialogs.tsx'
import { locationEnvironment } from './platform/browserLocation.ts'
import { listenForShake, requestShakePermission, supportsShake, type ShareResult } from './platform/device.ts'
import { ErrorScreen } from './screens/ErrorScreen.tsx'
import { HomeScreen, type ShakeCapability } from './screens/HomeScreen.tsx'
import { LoadingScreen } from './screens/LoadingScreen.tsx'
import { ResultsScreen } from './screens/ResultsScreen.tsx'
import { BackHistory } from './ui/backHistory.ts'
import { useCoarsePointer, useMediaQuery, useReducedMotion } from './ui/media.ts'
import { Snackbar, type Notice } from './ui/Snackbar.tsx'
import { TopBar } from './ui/TopBar.tsx'
import { useAppState } from './ui/useAppState.ts'
import './styles/app.css'
import './styles/home.css'
import './styles/dialogs.css'
import './styles/screens.css'
import './styles/results.css'
import './styles/game.css'
import './styles/table.css'

export interface AppProps {
  readonly store: MainStore
  /** 这个网页能不能定位（测试可以指定）。 */
  readonly env?: LocationEnvironment
  /** 浏览器有没有内建翻译（设置里一行说明）。 */
  readonly translatorAvailable?: boolean
}

interface SettingsUi {
  readonly open: boolean
  /** 从「我有 Google 密钥 →」/ 错误页打开：「进阶」直接展开。 */
  readonly expand: boolean
}

/** 又窄又矮（浏览器放大 200%）：底栏不固定、跟着内容滑（和 home.css / results.css 一样的门槛）。 */
const ZOOMED_NARROW_QUERY = '(max-height: 475.98px) and (max-width: 559.98px)'

/** 等多久看有没有动作感应的读数（没有就当要先允许、或这台设备没有感应器）。 */
const SHAKE_PROBE_MS = 1500

function hasMotionPermissionApi(): boolean {
  const ctor = typeof DeviceMotionEvent === 'undefined' ? null : (DeviceMotionEvent as unknown as { requestPermission?: unknown })
  return typeof ctor?.requestPermission === 'function'
}

/** 手机键盘弹出来时，看得见的区域变矮：对话框跟着看得见的区域走，输入框和按钮不会被键盘挡住。 */
function useVisualViewportVars(): void {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--vvh', `${viewport.height}px`)
      root.style.setProperty('--vv-top', `${viewport.offsetTop}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

export default function App({ store, env = locationEnvironment(), translatorAvailable = typeof self !== 'undefined' && 'Translator' in self }: AppProps) {
  const state = useAppState(store)
  const { ui, home } = state
  const reducedMotion = useReducedMotion()
  const zoomedNarrow = useMediaQuery(ZOOMED_NARROW_QUERY)
  const coarsePointer = useCoarsePointer()
  const pageVisible = usePageVisible()
  useVisualViewportVars()

  const [settings, setSettings] = useState<SettingsUi>({ open: false, expand: false })
  const [keyDraft, setKeyDraft] = useState('')
  const [unsavedAsk, setUnsavedAsk] = useState(false)
  const [fortuneOpen, setFortuneOpen] = useState(false)
  const [radiusOpen, setRadiusOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  /** 分享、复制都不行：把文字放在对话框里让人长按复制。 */
  const [manualText, setManualText] = useState<string | null>(null)
  /** 「就这一家吧！」锁住时按了「大家都同意重来？」：先问「要所有人都点头哦！」。 */
  const [restartAsk, setRestartAsk] = useState(false)
  /** 👥 饭桌第一页点了哪个头像改名字。 */
  const [renaming, setRenaming] = useState<AvatarId | null>(null)
  /** 👥 饭桌玩到一半按了返回：先问「饭桌还没玩完，要结束吗？」。 */
  const [leaveAsk, setLeaveAsk] = useState(false)
  const [shake, setShake] = useState<ShakeCapability>('PROBING')

  // ---------------------------------------------------------------- 提示条
  const showNotice = useCallback((message: string) => setNotice({ id: Date.now() + Math.random(), text: message }), [])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), RESULTS.NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // ---------------------------------------------------------------- 设置
  const openSettings = (expand: boolean) => {
    setKeyDraft(store.home.apiKeyOverride)
    setSettings({ open: true, expand })
  }
  const closeSettings = () => {
    setUnsavedAsk(false)
    setSettings({ open: false, expand: false })
  }
  const requestCloseSettings = () => {
    if (keyDraft !== store.home.apiKeyOverride) setUnsavedAsk(true)
    else closeSettings()
  }

  // ---------------------------------------------------------------- 搜索（先过定位权限）
  const startSearch = (choice: SearchChoice) => {
    store.dismissDemoUndo()
    store.requestSearch(choice)
  }

  // ---------------------------------------------------------------- 返回键（功能清单 2.4）
  // 只有锁住的「就这一家吧！」才问「大家都同意重来？」：那一局不在了（回到列表、新的一局）就不问了。
  const restartOpen = restartAsk && state.duel?.locked === true
  useEffect(() => {
    if (state.duel?.locked !== true) setRestartAsk(false)
  }, [state.duel?.locked])
  // 饭桌的两个对话框：饭桌不在了（或已经不在第一页 / 已经不算玩到一半）就不显示。
  const table = state.table
  const renamePlayer = renaming != null && table?.phase === 'SETUP' ? (table.avatars.find((p) => p.avatar === renaming) ?? null) : null
  const leaveOpen = leaveAsk && table != null && tableInProgress(table)
  useEffect(() => {
    if (renamePlayer == null && renaming != null) setRenaming(null)
  }, [renamePlayer == null, renaming])
  useEffect(() => {
    if (!leaveOpen && leaveAsk) setLeaveAsk(false)
  }, [leaveOpen, leaveAsk])
  const uiDialogOpen =
    settings.open || unsavedAsk || fortuneOpen || radiusOpen || helpOpen || manualText != null || restartOpen || renamePlayer != null || leaveOpen
  const closeTopDialog = () => {
    if (manualText != null) setManualText(null)
    else if (restartOpen) setRestartAsk(false)
    else if (leaveOpen) setLeaveAsk(false)
    else if (renamePlayer != null) setRenaming(null)
    else if (helpOpen) setHelpOpen(false)
    else if (unsavedAsk) setUnsavedAsk(false)
    else if (settings.open) requestCloseSettings()
    else if (fortuneOpen) setFortuneOpen(false)
    else if (radiusOpen) setRadiusOpen(false)
    else if (state.mealPrompt) store.declineMealRegret()
    else if (home.randomPick) store.dismissRandomPick()
    else if (home.explainLocation) store.declineLocationExplanation()
  }
  const goBack = () => {
    switch (backStep(store.getState(), uiDialogOpen)) {
      case 'CLOSE_DIALOG':
        closeTopDialog()
        break
      case 'ASK_LEAVE_TABLE':
        setLeaveAsk(true)
        break
      case 'CLOSE_TABLE':
        store.closeTable()
        break
      case 'CLOSE_DUEL':
        store.closeDuel()
        break
      case 'BACK_HOME':
        store.backToHome()
        break
      case 'LEAVE':
        break
    }
  }
  const goBackRef = useRef(goBack)
  goBackRef.current = goBack
  const historyRef = useRef<BackHistory | null>(null)
  useEffect(() => {
    const history = new BackHistory(() => goBackRef.current())
    historyRef.current = history
    return () => {
      history.dispose()
      if (historyRef.current === history) historyRef.current = null
    }
  }, [])
  const hasLayer =
    ui.kind !== 'HOME' || state.duel != null || state.table != null || uiDialogOpen || home.randomPick != null || state.mealPrompt != null || home.explainLocation
  useEffect(() => {
    historyRef.current?.sync(hasLayer)
  })
  const requestBack = useCallback(() => {
    if (!historyRef.current?.requestBack()) goBackRef.current()
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      requestBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestBack])

  // 根本不能定位（不是 https、浏览器没有定位功能）：第一次打开不弹「先跟你说一声」，首页卡片直接说原因和办法。
  useEffect(() => {
    if (env !== 'OK' && store.home.explainLocation) store.declineLocationExplanation()
  }, [env, store])

  // 游戏层、饭桌打开时，结果页底栏的提示不再留着（回到列表时不会又冒出来）。
  const layerOpen = state.duel != null || state.table != null
  useEffect(() => {
    if (layerOpen) setNotice(null)
  }, [layerOpen])

  // 换主画面时回到最上面。
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [ui.kind])

  // ---------------------------------------------------------------- 📳 摇一摇（31.10）
  useEffect(() => {
    if (!supportsShake() || !coarsePointer) {
      setShake('UNSUPPORTED')
      return
    }
    // 先听一下：安卓 Chrome 不用问就会送来读数 → 能用；iPhone 要用户按一下「开启摇一摇」才有读数。
    let done = false
    const onMotion = (event: DeviceMotionEvent) => {
      if (done || event.accelerationIncludingGravity?.x == null) return
      done = true
      setShake('READY')
    }
    window.addEventListener('devicemotion', onMotion)
    const timer = setTimeout(() => {
      if (!done) setShake(hasMotionPermissionApi() ? 'NEEDS_PERMISSION' : 'UNSUPPORTED')
    }, SHAKE_PROBE_MS)
    return () => {
      done = true
      clearTimeout(timer)
      window.removeEventListener('devicemotion', onMotion)
    }
  }, [coarsePointer])
  const allowShake = () => {
    void requestShakePermission().then((ok) => {
      setShake(ok ? 'READY' : 'UNSUPPORTED')
      if (!ok) showNotice(webText('web_shake_unsupported'))
    })
  }
  const homeWindowOpen = uiDialogOpen
  const listening = shake === 'READY' && shouldListenForShake(state, homeWindowOpen, pageVisible)
  useEffect(() => {
    if (!listening) return
    return listenForShake((strength) => store.onShake(strength))
  }, [listening, store])

  // ---------------------------------------------------------------- 画面上的动作
  const onLocationAction = (action: LocationCardAction) => {
    if (action === 'HOW_TO') setHelpOpen(true)
    else if (action === 'RETRY') store.refreshLocation()
    else if (store.askForLocation(null) === 'BLOCKED') setHelpOpen(true)
  }

  const onErrorAction = (button: ErrorButton) => {
    switch (button.action) {
      case 'OPEN_SETTINGS':
        openSettings(true)
        break
      case 'RETRY':
        store.retry()
        break
      case 'GRANT_LOCATION':
        if (store.askForLocation(ui.kind === 'ERROR' ? ui.choice : null) === 'BLOCKED') setHelpOpen(true)
        break
      case 'LOCATION_HELP':
        setHelpOpen(true)
        break
      case 'EXPAND_RADIUS':
        if (button.radiusKm != null) store.searchWithRadius(button.radiusKm)
        break
      case 'SEARCH_ANY_CUISINE':
        store.searchAnyCuisine()
        break
      case 'RESCUE_REROLL':
        store.rescueReroll()
        break
      case 'TURN_ON_DEMO':
        store.setDemoMode(true)
        break
    }
  }

  const onShared = (result: ShareResult) => {
    if (result === 'COPIED') showNotice(webText('web_share_copied'))
  }

  /** 结果页的分享（发到群里投票）：复制了 → 底栏提示；复制也不行 → 显示文字让人长按复制。 */
  const onResultsShared = (result: ShareResult, sharedText: string) => {
    if (result === 'COPIED') showNotice(webText('web_share_copied'))
    else if (result === 'MANUAL') setManualText(sharedText)
  }

  // 提示条：结果页（没有对话框时）放在底栏里，永远不盖按钮；其他时候浮在底栏上方。
  const anyDialog = uiDialogOpen || state.mealPrompt != null
  // 游戏层开着时底栏被盖住：结果页的提示就不显示（不会跑到游戏画面上）。
  // 又窄又矮（浏览器放大 200%）时底栏跟着内容滑，提示改成浮在下面（不然滑到上面就看不到）。
  // 游戏层开着时底栏被盖住：提示改成浮在下面（例如「就这一家吧！」按「导航过去」打不开地图）。
  const noticeInBar = ui.kind === 'RESULTS' && !anyDialog && !zoomedNarrow && state.duel == null && state.table == null

  const onRandomSettled = useCallback((round: number) => store.onRandomPickSettled(round), [store])

  // ---------------------------------------------------------------- 画面
  let screen
  switch (ui.kind) {
    case 'HOME':
      screen = (
        <HomeScreen
          state={state}
          store={store}
          env={env}
          shake={shake}
          onEat={(meal: MealId) => startSearch({ cuisine: home.selectedCuisine, meal })}
          onOpenSettings={openSettings}
          onOpenFortune={() => setFortuneOpen(true)}
          onOpenRadius={() => setRadiusOpen(true)}
          onLocationAction={onLocationAction}
          onAllowShake={allowShake}
        />
      )
      break
    case 'LOADING':
      screen = <LoadingScreen choice={ui.choice} phase={ui.phase} isDemo={ui.isDemo} onCancel={() => store.backToHome()} />
      break
    case 'RESULTS':
      screen = (
        <ResultsScreen
          state={state}
          results={ui}
          store={store}
          notice={noticeInBar ? (notice?.text ?? null) : null}
          onNotice={showNotice}
          onShared={onResultsShared}
          onAskRestart={() => setRestartAsk(true)}
          onAskRename={setRenaming}
        />
      )
      break
    case 'ERROR':
      screen = <ErrorScreen choice={ui.choice} error={ui.error} demoMode={home.demoMode} env={env} onAction={onErrorAction} onHome={() => store.backToHome()} />
      break
  }

  const randomPick = ui.kind !== 'LOADING' ? home.randomPick : null

  return (
    <div className="app" data-screen={ui.kind.toLowerCase()}>
      <TopBar
        demo={home.demoMode}
        showBack={ui.kind !== 'HOME' || state.duel != null || state.table != null}
        onBack={requestBack}
        onSettings={() => openSettings(false)}
      />
      <main className="app__main" key={ui.kind}>
        {screen}
      </main>

      {randomPick && (
        <RandomPickDialog
          pick={randomPick}
          reducedMotion={reducedMotion}
          onSettled={onRandomSettled}
          onGo={() => {
            const choice = store.acceptRandomPick()
            if (choice) startSearch(choice)
          }}
          onAgain={() => store.rerollRandomPick()}
          onEarlier={(choice) => store.returnToEarlierPick(choice)}
          onCancel={() => store.dismissRandomPick()}
        />
      )}

      {fortuneOpen && ui.kind === 'HOME' && home.fortune && (
        <FortuneDialog
          fortune={home.fortune}
          demoMode={home.demoMode}
          reducedMotion={reducedMotion}
          onDrawn={() => store.drawFortune()}
          onGo={() => {
            setFortuneOpen(false)
            const choice = store.acceptFortune()
            if (choice) startSearch(choice)
          }}
          onShared={onShared}
          onClose={() => setFortuneOpen(false)}
        />
      )}

      {radiusOpen && ui.kind === 'HOME' && (
        <RadiusDialog
          radiusKm={home.radiusKm}
          onPick={(km) => {
            store.setRadius(km)
            setRadiusOpen(false)
          }}
          onCancel={() => setRadiusOpen(false)}
        />
      )}

      {home.explainLocation && (
        <LocationExplainDialog env={env} onAccept={() => void store.acceptLocationExplanation()} onDecline={() => store.declineLocationExplanation()} />
      )}

      {helpOpen && (
        <LocationHelpDialog
          env={env}
          onClose={() => setHelpOpen(false)}
          onRetry={() => {
            setHelpOpen(false)
            void store.retryAfterLocationHelp()
          }}
        />
      )}

      {settings.open && (
        <SettingsDialog
          home={home}
          expandAdvanced={settings.expand}
          keyDraft={keyDraft}
          shake={shake}
          translatorAvailable={translatorAvailable}
          onKeyDraft={setKeyDraft}
          onSaveKey={(key) => store.saveApiKey(key)}
          onDemoMode={(on) => store.setDemoMode(on)}
          onShakeEnabled={(on) => store.setShakeEnabled(on)}
          onAllowShake={allowShake}
          onClearVisits={() => store.clearVisits()}
          onNotice={showNotice}
          onRequestClose={requestCloseSettings}
        />
      )}
      {settings.open && unsavedAsk && (
        <UnsavedKeyDialog
          onSave={() => {
            store.saveApiKey(keyDraft)
            showNotice(text('settings_key_saved'))
            closeSettings()
          }}
          onDiscard={closeSettings}
        />
      )}

      {restartOpen && (
        <RestartDialog
          onConfirm={() => {
            setRestartAsk(false)
            store.agreeToRestart()
          }}
          onCancel={() => setRestartAsk(false)}
        />
      )}

      {renamePlayer != null && (
        <RenameDialog
          key={renamePlayer.avatar}
          player={renamePlayer}
          onSave={(name) => {
            store.renameAvatar(renamePlayer.avatar, name)
            setRenaming(null)
          }}
          onDismiss={() => setRenaming(null)}
        />
      )}

      {leaveOpen && (
        <LeaveTableDialog
          onLeave={() => {
            setLeaveAsk(false)
            store.closeTable()
          }}
          onStay={() => setLeaveAsk(false)}
        />
      )}

      {manualText != null && <ManualCopyDialog value={manualText} onClose={() => setManualText(null)} />}

      <Snackbar notice={noticeInBar ? null : notice} onClose={() => setNotice(null)} />
    </div>
  )
}
