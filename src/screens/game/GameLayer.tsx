/**
 * 游戏层（安卓 ui/DuelOverlay.kt，功能清单第十二、十三节）：盖在结果列表和底栏上面（标题栏、演示条照样看得到），
 * 用页面底色挡住下面，下面按不到。出现时淡入 + 从下面滑上来。
 *
 * 一局的阶段：选择（剪刀石头布、还没按「转！」的转盘）→ 转 → 揭晓（停一下看谁赢）→ 结果「就这一家吧！」。
 * 每个随机结果都在状态层按下去的那一刻决定好了，这里只把动画播到那个结果；中途离开也已经算这一餐的决定。
 * 已经播完的一局再打开直接显示结果（「看一看」、从地图回来、重新整理）；新的一局一定从头开始。
 * 刚揭晓才放彩带（等 0.3 秒、飞 2 秒，画在字和店卡后面）；「减少动画」时卷轴、转盘直接停在结果、不放彩带，流程照样走完。
 * 手机横屏（很矮又够宽）改成左右两栏，不用滑就同时看到 App 的手和你的三个手势（或结果和按钮）。
 * 游戏都在手机里玩：不发请求、不扣免费次数。
 *
 * 👥 饭桌模式（还没出结果时）由 ../table/TableLayer.tsx 画；饭桌出了结果以后，「就这一家吧！」也在这里显示。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { resultItem, type DuelState, type ResultItem, type ResultsState, type TableState } from '../../app/state.ts'
import type { MainStore } from '../../app/store.ts'
import { text } from '../../app/texts.ts'
import { directionsUrl } from '../../domain/mapsLinks.ts'
import type { AvatarId, Place } from '../../domain/model.ts'
import type { DayStats } from '../../domain/taskDeck.ts'
import { openExternal, vibrate } from '../../platform/device.ts'
import { useMediaQuery } from '../../ui/media.ts'
import { TableLayer } from '../table/TableLayer.tsx'
import { Confetti } from './Confetti.tsx'
import { DuelResult } from './DuelResult.tsx'
import { hasWheel, initialPhase, phaseKey, revealMillis, type DuelPhase } from './phase.ts'
import { RouletteBoard } from './RouletteBoard.tsx'
import { RpsBoard } from './RpsBoard.tsx'
import { WheelBoard } from './WheelBoard.tsx'

/** 手机横屏（很矮又够宽）：左右两栏（安卓：游戏层高 < 480 而且宽 ≥ 520；网页按整个画面的高算，扣掉标题栏和演示条）。 */
export const GAME_TWO_PANE_QUERY = '(max-height: 579.98px) and (min-width: 520px)'
/** 比较矮的手机（例如 iPhone SE）：紧凑一点（App 的手 96、照片 88、间距 8）。 */
export const GAME_COMPACT_QUERY = '(max-height: 699.98px)'

export interface GameLayerProps {
  readonly results: ResultsState
  readonly duel: DuelState | null
  readonly table: TableState | null
  readonly store: MainStore
  readonly todayStats: DayStats
  readonly reducedMotion: boolean
  readonly onNotice: (message: string) => void
  /** 分享、复制都不行：显示文字让人长按复制。 */
  readonly onManualCopy: (message: string) => void
  /** 「大家都同意重来？」：先问一次（对话框由 App 管，返回键可以关）。 */
  readonly onAskRestart: () => void
  /** 👥 饭桌第一页点头像改名字（对话框由 App 管，返回键可以关）。 */
  readonly onAskRename: (avatar: AvatarId) => void
}

export function GameLayer({ results, duel, table, store, todayStats, reducedMotion, onNotice, onManualCopy, onAskRestart, onAskRename }: GameLayerProps) {
  if (duel) {
    return (
      <DuelLayer
        duel={duel}
        results={results}
        store={store}
        todayStats={todayStats}
        reducedMotion={reducedMotion}
        onNotice={onNotice}
        onManualCopy={onManualCopy}
        onAskRestart={onAskRestart}
      />
    )
  }
  if (table) return <TableLayer table={table} results={results} store={store} reducedMotion={reducedMotion} onAskRename={onAskRename} />
  return null
}

/** 这局的店：现在的结果里找，找不到（之前那次搜索的局）就用那局带着的资料。 */
function placesOf(duel: DuelState, results: ResultsState): ResultItem[] | null {
  const items = duel.placeIds.map((id) => resultItem(results, id) ?? duel.snapshot.find((item) => item.place.id === id) ?? null)
  return items.every((item) => item != null) ? (items as ResultItem[]) : null
}

function DuelLayer({
  duel,
  results,
  store,
  todayStats,
  reducedMotion,
  onNotice,
  onManualCopy,
  onAskRestart,
}: Omit<GameLayerProps, 'duel' | 'table' | 'onAskRename'> & { readonly duel: DuelState }) {
  const twoPane = useMediaQuery(GAME_TWO_PANE_QUERY)
  const compact = useMediaQuery(GAME_COMPACT_QUERY)
  const places = placesOf(duel, results)

  // 阶段跟着状态层的这一局走（新的一局、出了拳、转盘抽好了都重新算），画面只把它往前推。
  const key = phaseKey(duel)
  const [phaseState, setPhaseState] = useState<{ key: string; phase: DuelPhase }>(() => ({ key, phase: initialPhase(duel) }))
  const phase = phaseState.key === key ? phaseState.phase : initialPhase(duel)
  const setPhase = (next: DuelPhase) => setPhaseState({ key, phase: next })
  /** 刚揭晓的那一局（才放彩带、「就这一家吧！」才弹）。 */
  const [celebrated, setCelebrated] = useState(-1)

  // 店不见了（不应该发生）：直接关掉，不留空白页。
  useEffect(() => {
    if (!places) store.closeDuel()
  }, [places == null, store])

  // 揭晓：停一下看谁赢，再进「就这一家吧！」（轻震一下；画面播完了 → 再打开直接看结果）。
  const round = duel.round
  useEffect(() => {
    if (phase !== 'REVEAL') return
    const toResult = () => {
      setPhaseState({ key, phase: 'RESULT' })
      setCelebrated(round)
      vibrate('light')
      store.onDuelAnimationDone(round)
    }
    const ms = revealMillis(duel)
    if (ms === 0) {
      toResult()
      return
    }
    const timer = setTimeout(toResult, ms)
    return () => clearTimeout(timer)
  }, [phase, key])

  // 游戏画面换成结果（或新的一局）：从最上面看起。
  const showResult = phase === 'RESULT'
  const sceneKey = `${round}-${showResult}`
  const lastScene = useRef(sceneKey)
  useLayoutEffect(() => {
    if (lastScene.current === sceneKey) return
    lastScene.current = sceneKey
    window.scrollTo(0, 0)
  }, [sceneKey])

  if (!places) return null

  const stopped = () => {
    vibrate('heavy')
    if (phase === 'SPIN') setPhase('REVEAL')
  }
  const onNavigate = (place: Place) => {
    store.onNavigate(place)
    if (!openExternal(directionsUrl(place))) onNotice(text('maps_open_failed'))
  }

  let content
  if (showResult) {
    content = (
      <DuelResult
        duel={duel}
        places={places}
        results={results}
        compact={compact}
        twoPane={twoPane}
        todayStats={todayStats}
        fresh={celebrated === round}
        reducedMotion={reducedMotion}
        onNavigate={onNavigate}
        onDuelAgain={() => store.duelAgain()}
        onClose={() => store.closeDuel()}
        onAskRestart={onAskRestart}
        onManualCopy={onManualCopy}
        onDrawTask={() => store.drawTaskCard()}
        onSpinTask={(people) => store.spinTaskWheel(people)}
        onTaskWheelStopped={() => store.onTaskWheelStopped()}
      />
    )
  } else if (duel.mode === 'ROCK_PAPER_SCISSORS') {
    content = (
      <RpsBoard
        duel={duel}
        places={places}
        results={results}
        phase={phase}
        compact={compact}
        twoPane={twoPane}
        onPlayHand={(hand) => store.playHand(hand)}
        onHandStopped={stopped}
        onSwitchToTable={() => {
          if (!store.openTable(true)) onNotice(text('decide_none_basket'))
        }}
      />
    )
  } else if (hasWheel(duel)) {
    content = (
      <WheelBoard
        duel={duel}
        places={places}
        results={results}
        phase={phase}
        twoPane={twoPane}
        reducedMotion={reducedMotion}
        onSpin={() => store.spinWheel()}
        onStopped={() => {
          if (phase === 'SPIN') setPhase('REVEAL')
        }}
      />
    )
  } else if (duel.mode === 'ROULETTE') {
    content = <RouletteBoard duel={duel} places={places} results={results} phase={phase} twoPane={twoPane} reducedMotion={reducedMotion} onStopped={stopped} />
  } else {
    content = null
  }

  return (
    <section
      className={`game-layer${twoPane ? ' game-layer--two-pane' : ''}${compact ? ' game-layer--compact' : ''}`}
      aria-labelledby="game-title"
      data-testid="game-layer"
      data-phase={phase.toLowerCase()}
    >
      {/* 彩带画在内容下面（先画）；刚揭晓才放，减少动画时不画 */}
      {showResult && celebrated === round && !reducedMotion && <Confetti seed={round} />}
      <div key={sceneKey} className={`game-scene${showResult ? ' game-scene--result' : ''}`}>
        <div className="game-column">{content}</div>
      </div>
    </section>
  )
}
