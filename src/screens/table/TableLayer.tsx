/**
 * 👥 饭桌模式（安卓 ui/TableOverlay.kt，功能清单第十四节）：一台手机传一圈，人人都有份。
 * 和游戏层一样盖在结果列表上（标题栏、演示条照样看得到），用页面底色挡住下面；出现、离开都是淡入淡出。
 * 第一页（几个人、谁、玩什么）→ ✂️ 每人划一刀 / 🙈 暗中出拳。每个结果都在状态层决定，这里只负责显示。
 * 手机横屏（很矮又够宽）改成左右两栏。全部在手机里玩：不发请求、不扣免费次数。
 * 离开（返回键、标题栏 ←）玩到一半要先问「饭桌还没玩完，要结束吗？」（由 App 管）。
 */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { resultItem, type ResultItem, type ResultsState, type TableState } from '../../app/state.ts'
import type { MainStore } from '../../app/store.ts'
import type { AvatarId } from '../../domain/model.ts'
import { useMediaQuery } from '../../ui/media.ts'
import { GAME_TWO_PANE_QUERY } from '../game/GameLayer.tsx'
import { SecretBoard } from './SecretBoard.tsx'
import { TableSetup } from './TableSetup.tsx'
import { VetoBoard } from './VetoBoard.tsx'

export interface TableLayerProps {
  readonly table: TableState
  readonly results: ResultsState
  readonly store: MainStore
  readonly reducedMotion: boolean
  /** 点头像改名字（对话框由 App 管，返回键可以关）。 */
  readonly onAskRename: (avatar: AvatarId) => void
}

export function TableLayer({ table, results, store, reducedMotion, onAskRename }: TableLayerProps) {
  const twoPane = useMediaQuery(GAME_TWO_PANE_QUERY)
  const items = table.placeIds.map((id) => resultItem(results, id))
  const places = items.every((item) => item != null) ? (items as ResultItem[]) : null

  // 店不见了（不应该发生）：直接关掉，不留空白页。
  useEffect(() => {
    if (!places) store.closeTable()
  }, [places == null, store])

  // 换一页（开始玩、交给下一个人、翻牌…）：从最上面看起。选好手势翻成「✔ 出好了」还是同一页（卡片要翻过去）。
  const secret = table.secret
  const step = secret?.step === 'CHOSEN' ? 'CHOOSING' : (secret?.step ?? '')
  const sceneKey = `${table.round}|${table.phase}|${step}|${secret?.turn ?? ''}`
  const lastScene = useRef(sceneKey)
  useLayoutEffect(() => {
    if (lastScene.current === sceneKey) return
    lastScene.current = sceneKey
    window.scrollTo(0, 0)
  }, [sceneKey])

  if (!places) return null

  let content
  switch (table.phase) {
    case 'SETUP':
      content = (
        <TableSetup
          table={table}
          places={places}
          twoPane={twoPane}
          onPlayers={(n) => store.setTablePlayers(n)}
          onRename={onAskRename}
          onStartVeto={() => store.startVeto()}
          onStartSecret={() => store.startSecretHands()}
        />
      )
      break
    case 'VETO':
      content = (
        <VetoBoard
          key={table.round}
          table={table}
          places={places}
          results={results}
          twoPane={twoPane}
          reducedMotion={reducedMotion}
          onCut={(id) => store.cutPlace(id)}
          onUndo={() => store.undoCut()}
          onExpireUndo={() => store.expireCutUndo()}
          onFinish={() => store.finishVeto()}
        />
      )
      break
    case 'SECRET':
      content = (
        <SecretBoard
          table={table}
          places={places}
          results={results}
          twoPane={twoPane}
          reducedMotion={reducedMotion}
          onTake={() => store.secretTakePhone()}
          onChoose={(hand) => store.secretChoose(hand)}
          onPass={() => store.secretPass()}
          onRedo={() => store.secretRedo()}
          onReveal={() => store.secretReveal()}
          onShowResult={() => store.showTableResult()}
        />
      )
      break
  }

  return (
    <section
      className={`game-layer table-layer${twoPane ? ' game-layer--two-pane table-layer--two-pane' : ''}`}
      aria-labelledby={table.phase === 'SETUP' ? 'table-title' : 'game-title'}
      data-testid="table-layer"
      data-phase={table.phase.toLowerCase()}
    >
      <div key={sceneKey} className="table-scene">
        {content}
      </div>
    </section>
  )
}
