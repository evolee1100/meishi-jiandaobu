/**
 * 结果页（安卓 ui/ResultsScreen.kt，功能清单第十一节）：
 * 顶上固定的演示条 → 可以滑的列表（表头、计票板、救援卡、这一页的店卡、看完了、重新选择）→ 固定在下面的底栏。
 * 手机横屏（很矮）时底栏变成右边一栏（宽 280）。游戏层（剪刀石头布等）盖在列表和底栏上面，标题栏和演示条照样看得到。
 *
 * 结果页上的一切（翻页、只看营业中、❤️、游戏、投票、分享、导航）都不发请求、不耗额度；
 * 只有「扩大到 X 公里」「重新搜索」（各 1 次搜索，按钮上先写清楚）和画面上新出现的店拿照片（每家最多 1 次，状态层管）。
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import {
  MIN_BASKET,
  MIN_PLACES,
  canGo,
  hasMore,
  planDuel,
  reachableCount,
  resultItem,
  resultsView,
  statusOf,
  type AppState,
  type ResultItem,
  type ResultsState,
} from '../app/state.ts'
import type { MainStore } from '../app/store.ts'
import { choiceEmoji, listEndTexts, pageButton, shareVote, text } from '../app/texts.ts'
import { HOURS, RESULTS } from '../data/constants.ts'
import { directionsUrl, placePageUrl } from '../domain/mapsLinks.ts'
import type { AvatarId, Place } from '../domain/model.ts'
import { clockZoned } from '../domain/openingHours.ts'
import { isShownAt } from '../domain/visits.ts'
import { openExternal, shareText, type ShareResult } from '../platform/device.ts'
import { fontScale, useMediaQuery, usePublishedHeight, useReducedMotion } from '../ui/media.ts'
import { PhraseText } from '../ui/PhraseText.tsx'
import { MealPromptDialog } from '../dialogs/ShareDialogs.tsx'
import { GameLayer } from './game/GameLayer.tsx'
import { PlaceCard } from './results/PlaceCard.tsx'
import { RescueCard } from './results/RescueCard.tsx'
import { ResultsBar } from './results/ResultsBar.tsx'
import { ResultsHeader } from './results/ResultsHeader.tsx'
import { VoteBoard } from './results/VoteBoard.tsx'

/** 手机横屏（很矮又够宽）：底栏改成右边一栏（安卓 SIDE_BAR_MAX_HEIGHT / SIDE_BAR_MIN_WIDTH）。 */
export const SIDE_BAR_QUERY = `(max-height: ${RESULTS.SIDE_BAR_MAX_HEIGHT_DP}px) and (min-width: ${RESULTS.SIDE_BAR_MIN_WIDTH_DP}px)`

export interface ResultsScreenProps {
  readonly state: AppState
  readonly results: ResultsState
  readonly store: MainStore
  /** 现在要在底栏里显示的提示（3 秒后 App 会清掉）。 */
  readonly notice: string | null
  readonly onNotice: (message: string) => void
  /** 分享的结果（复制了 → 提示；复制不了 → 显示文字让人长按复制）。 */
  readonly onShared: (result: ShareResult, sharedText: string) => void
  /** 「就这一家吧！」锁住时的「大家都同意重来？」：先问一次（对话框由 App 管，返回键可以关）。 */
  readonly onAskRestart: () => void
  /** 👥 饭桌第一页点头像改名字（对话框由 App 管）。 */
  readonly onAskRename: (avatar: AvatarId) => void
}

/** 窄屏大字（宽 < 400 而且字体 > 1.15 倍）：小照片、评分行短写、不摇 ✊，字有更多地方。 */
function useTight(ref: RefObject<HTMLElement | null>): boolean {
  const [tight, setTight] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setTight(el.clientWidth < RESULTS.NARROW_WIDTH_DP && fontScale() > RESULTS.LARGE_FONT_SCALE)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return tight
}

export function ResultsScreen({ state, results, store, notice, onNotice, onShared, onAskRestart, onAskRename }: ResultsScreenProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  usePublishedHeight(stripRef, '--demo-strip-h')
  const tight = useTight(rootRef)
  const side = useMediaQuery(SIDE_BAR_QUERY)
  const reduced = useReducedMotion()
  const view = resultsView(results)
  const now = clockZoned(results.clock) ?? { epochMillis: Date.now(), zone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  const plan = planDuel(results)
  const rescue = reachableCount(results) < MIN_PLACES
  const page = pageButton(view)
  const layerOpen = state.duel != null || state.table != null
  const demoMode = state.home.demoMode

  // 营业状态跟着手机的时间走（「还有 35 分钟关门」会倒数）：每 30 秒问一次，分钟变了状态层才重算。
  useEffect(() => {
    const timer = setInterval(() => store.onClockTick(), HOURS.CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [store])

  // 换页、拨「只看营业中」以后：滑回最上面，看到新的标题和第一张新卡。
  const listKey = `${results.page}/${results.openNowOnly}`
  const lastListKey = useRef(listKey)
  useEffect(() => {
    if (lastListKey.current === listKey) return
    lastListKey.current = listKey
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }, [listKey, reduced])

  // 游戏层打开时盖住列表（从最上面看起）；关掉回到列表时，滑到的位置不变。
  const savedScroll = useRef(0)
  const layerWasOpen = useRef(layerOpen)
  useLayoutEffect(() => {
    if (layerOpen === layerWasOpen.current) return
    layerWasOpen.current = layerOpen
    if (layerOpen) {
      savedScroll.current = window.scrollY
      window.scrollTo(0, 0)
    } else {
      window.scrollTo(0, savedScroll.current)
    }
  }, [layerOpen])

  // ---------------------------------------------------------------- 按钮
  const onToggleBasket = (placeId: string) => {
    switch (store.toggleBasket(placeId)) {
      case 'FULL':
        onNotice(text('basket_full'))
        break
      case 'CLOSED':
        onNotice(text('basket_closed'))
        break
      case 'TOO_LATE':
        onNotice(text('basket_too_late'))
        break
      case 'ADDED_TABLE_HINT':
        onNotice(text('basket_table_hint'))
        break
      default:
        break
    }
  }

  /** 店名 / 照片 → 店家的 Google 地图页面（免费的普通网址）；演示店没有。 */
  const onOpenPage = (place: Place) => {
    const url = placePageUrl(place)
    if (url == null) onNotice(text('maps_demo_no_page'))
    else if (!openExternal(url)) onNotice(text('maps_open_failed'))
  }

  /** 导航：先记一笔「吃过」，再用新分页打开 Google 地图路线（手机会交给地图 App）。 */
  const onNavigate = (place: Place) => {
    store.onNavigate(place)
    if (!openExternal(directionsUrl(place))) onNotice(text('maps_open_failed'))
  }

  /** 📤 发到群里投票：圈了 ≥ 2 家用圈的店，否则这一页；先出计票板，再打开分享（要在点按里直接调用）。 */
  const onShareVote = () => {
    const places: ResultItem[] =
      results.basket.length >= MIN_BASKET
        ? results.basket.map((id) => resultItem(results, id)).filter((item): item is ResultItem => item != null)
        : [...view.items]
    if (places.length === 0) return
    const message = shareVote(
      places,
      places.map((item) => statusOf(results, item.place)),
      now,
      results.isDemo,
    )
    store.startVoteCount(places.map((item) => item.place.id))
    void shareText(message).then((result) => onShared(result, message))
  }

  const onOpenTable = () => {
    if (!store.openTable()) onNotice(text('decide_none_basket'))
  }

  // ---------------------------------------------------------------- 画面
  const end = view.items.length > 0 && !hasMore(view) ? listEndTexts(view, results.trimmedCount) : null

  return (
    <div ref={rootRef} className={`screen results${side ? ' results--side' : ''}${tight ? ' results--tight' : ''}`}>
      {results.isDemo && (
        <div ref={stripRef} className="demo-strip">
          <PhraseText className="demo-strip__text" text={text('demo_results_banner')} />
        </div>
      )}

      {layerOpen && (
        <GameLayer
          results={results}
          duel={state.duel}
          table={state.table}
          store={store}
          todayStats={state.todayStats}
          reducedMotion={reduced}
          onNotice={onNotice}
          onManualCopy={(message) => onShared('MANUAL', message)}
          onAskRestart={onAskRestart}
          onAskRename={onAskRename}
        />
      )}

      <div className="results__layout" hidden={layerOpen} inert={layerOpen}>
        <div className="results__list">
          <ResultsHeader
            results={results}
            meal={state.meal}
            demoMode={demoMode}
            onShowMeal={() => store.showMealDecision()}
            onExpand={() => store.expandRadius()}
            onSearchAgain={() => store.retry()}
            onOpenNowOnly={(on) => store.setOpenNowOnly(on)}
            onShareVote={onShareVote}
          />
          {results.vote && (
            <VoteBoard
              vote={results.vote}
              results={results}
              onChange={(index, add) => store.changeVote(index, add)}
              onFinish={() => store.finishVote()}
              onClose={() => store.closeVote()}
            />
          )}
          {rescue && (
            <RescueCard
              results={results}
              hiddenClosed={view.hiddenClosed}
              demoMode={demoMode}
              onReroll={() => store.rescueReroll()}
              onExpand={() => store.expandRadius()}
              onShowAll={() => store.showClosedToo()}
            />
          )}
          <ol className="place-list">
            {view.items.map((item) => {
              const lastVisit = state.lastVisits.get(item.place.id) ?? null
              return (
                <li key={item.place.id} className="place-list__item">
                  <PlaceCard
                    item={item}
                    status={statusOf(results, item.place)}
                    canGo={canGo(results, item.place)}
                    now={now}
                    emoji={item.place.placeholderEmoji ?? choiceEmoji(results.choice)}
                    inBasket={results.basket.includes(item.place.id)}
                    lastVisit={lastVisit != null && isShownAt(lastVisit, now.epochMillis) ? lastVisit : null}
                    tight={tight}
                    onToggleBasket={() => onToggleBasket(item.place.id)}
                    onNavigate={() => onNavigate(item.place)}
                    onOpenPage={() => onOpenPage(item.place)}
                  />
                </li>
              )
            })}
          </ol>
          {end && (
            <div className="list-end">
              <p className="list-end__done">{end.done}</p>
              {end.note && <PhraseText as="p" className="list-end__note" text={end.note} />}
            </div>
          )}
          <footer className="results-foot">
            <button type="button" className="btn btn--outlined btn--block btn--tall results-foot__reselect" onClick={() => store.backToHome()}>
              {text('reselect')}
            </button>
            <p className="results-foot__source">{text(results.isDemo ? 'data_source_demo' : 'data_source')}</p>
          </footer>
        </div>

        <ResultsBar
          results={results}
          plan={plan}
          page={page ? { label: page.label, onClick: () => (page.action === 'NEXT' ? store.nextPage() : store.firstPage()) } : null}
          rescue={rescue}
          pageHasItems={view.items.length > 0}
          notice={layerOpen ? null : notice}
          tight={tight}
          side={side}
          onDecide={() => store.openDuel()}
          onClearBasket={() => store.clearBasket()}
          onOpenTable={onOpenTable}
          onUndoClear={() => store.undoClearBasket()}
          onDismissUndo={() => store.dismissBasketUndo()}
        />
      </div>

      {state.mealPrompt && (
        <MealPromptDialog placeName={state.mealPrompt.placeName} onConfirm={() => store.confirmMealRegret()} onDecline={() => store.declineMealRegret()} />
      )}
    </div>
  )
}
