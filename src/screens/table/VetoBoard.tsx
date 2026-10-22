/**
 * ✂️ 每人划一刀（安卓 TableOverlay.VetoScreen / FittedCards / VetoCard，功能清单 14.3、14.4）。
 *
 * - 上面固定的说明：「🎲 抽签：🐼 → 🐯 → 🐔」、有裁判时「🐷、🐶 这次当裁判 😆」、大标题（先留两行高，每一刀都不跳动）、
 *   一排（位置永远留着）：「还要划 2 刀」/「点错了？撤销」/「看结果 🎉」；
 * - 下面的卡片：按一张 → 震一下 → 划掉（红色印章「✂️ 不吃！」→ 沿锯齿线撕成两半 → 收起，1.2 秒）；
 *   划完 3 秒内可以「撤销」，这 3 秒谁都不能再划（手机正在交给下一个人）；3 秒过了自动轮到下一位，
 *   最后一刀的 3 秒过了自动进「就这一家吧！」。
 * - 只剩两家（最后一刀）：整个画面加红框、标题变红，手机震两下。
 * - 卡片自动选版面：完整 → 紧凑 → 两栏小卡，用第一个全部放得下的（连两栏都放不下才让画面滑）；
 *   同一组卡片只会越来越密，不会变回去（标题变短时，下一个人手指下的卡片不会跑掉）；一张卡收起来（或撤销回来）算新的一组。
 * - 手机横屏：左边说明、右边卡片。
 * 全部在手机里玩，不发请求、不扣免费次数。
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { statusOf, tablePlayers, type ResultItem, type ResultsState, type TableState } from '../../app/state.ts'
import { choiceEmoji, describeHours, shortName, text, vetoHeadline, walkText } from '../../app/texts.ts'
import { TABLE } from '../../data/constants.ts'
import { formatFixed } from '../../data/javaFormat.ts'
import { PREFIXES, SEPARATORS } from '../../data/uiLiterals.ts'
import { formatDistance } from '../../domain/geo.ts'
import type { Place } from '../../domain/model.ts'
import { clockZoned, type OpenStatus } from '../../domain/openingHours.ts'
import { formatPrice } from '../../domain/priceFormat.ts'
import {
  avatarEmoji,
  playerLabel,
  vetoCurrentPlayer,
  vetoCutterOf,
  vetoIsFinished,
  vetoIsLastCut,
  vetoReferees,
  vetoRemaining,
  vetoTurns,
  vetoWinner,
} from '../../domain/table.ts'
import type { ZonedTime } from '../../domain/time.ts'
import { onAnimationDone, playAnimation } from '../../lib/motion.ts'
import { vibrate, vibrateTwice } from '../../platform/device.ts'
import { FitText } from '../../ui/FitText.tsx'
import { PhraseText } from '../../ui/PhraseText.tsx'
import { SeparatedFlow, type FlowPiece } from '../../ui/SeparatedFlow.tsx'
import { hoursToneClass, PlaceThumb, PriceHoursLine } from '../results/PlaceParts.tsx'

/** 卡片的三种版面，从宽松到紧密。 */
export type VetoLayout = 'FULL' | 'COMPACT' | 'GRID'
const LAYOUTS: readonly VetoLayout[] = ['FULL', 'COMPACT', 'GRID']

export interface VetoBoardProps {
  readonly table: TableState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly twoPane: boolean
  readonly reducedMotion: boolean
  readonly onCut: (placeId: string) => void
  readonly onUndo: () => void
  readonly onExpireUndo: () => void
  readonly onFinish: () => void
}

export function VetoBoard({ table, places, results, twoPane, reducedMotion, onCut, onUndo, onExpireUndo, onFinish }: VetoBoardProps) {
  const veto = table.veto
  const players = tablePlayers(table)
  const label = (index: number) => {
    const player = players[index]
    return player ? playerLabel(player) : ''
  }
  const nameOf = (id: string) => {
    const item = places.find((p) => p.place.id === id)
    return item ? shortName(item) : id
  }

  const cuts = veto?.cuts ?? []
  const finished = veto ? vetoIsFinished(veto) : false
  const lastCut = veto ? vetoIsLastCut(veto) : false
  // 撤销期间谁都不能再划，所以最后一刀一定有自己的场面：红框、震两下。
  const lastCutNow = lastCut && !table.undoable && !finished

  useEffect(() => {
    if (lastCutNow) vibrateTwice()
  }, [lastCutNow, cuts.length])

  // 「点错了？撤销」3 秒；最后一刀的 3 秒过了 →「就这一家吧！」。
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  const expireRef = useRef(onExpireUndo)
  expireRef.current = onExpireUndo
  useEffect(() => {
    if (!table.undoable) return
    const timer = setTimeout(() => (finished ? finishRef.current() : expireRef.current()), TABLE.CUT_UNDO_MS)
    return () => clearTimeout(timer)
  }, [cuts.length, table.undoable, finished])

  // 被划掉、已经收起来的卡（撤销回来的不算）。
  const [folded, setFolded] = useState<readonly string[]>([])
  useEffect(() => {
    setFolded((list) => (list.every((id) => cuts.includes(id)) ? list : list.filter((id) => cuts.includes(id))))
  }, [cuts])

  if (!veto) return null

  const remaining = vetoRemaining(veto)
  const winner = vetoWinner(veto)
  const canCut = !finished && !table.undoable
  const lastCutId = cuts[cuts.length - 1] ?? null
  const current = vetoCurrentPlayer(veto)
  const heading = vetoHeadline({
    undoable: table.undoable,
    finished,
    lastCut,
    lastCutter: lastCutId != null ? label(vetoCutterOf(veto, cuts.length - 1)) : null,
    lastCutName: lastCutId != null ? nameOf(lastCutId) : null,
    current: label(current ?? 0),
  })
  const referees = vetoReferees(veto)
  const cutsLeft = vetoTurns(veto).length - cuts.length
  const shown = places.filter((item) => !cuts.includes(item.place.id) || !folded.includes(item.place.id))
  const now: ZonedTime = clockZoned(results.clock) ?? { epochMillis: Date.now(), zone: Intl.DateTimeFormat().resolvedOptions().timeZone }

  const header = (
    <div className="veto-header">
      <p className="veto-header__line">{text('veto_order', veto.order.map((i) => avatarEmoji(players[i]?.avatar ?? 'TIGER')).join(SEPARATORS.orderArrow))}</p>
      {referees.length > 0 && (
        <p className="veto-header__line">{text('veto_referees', referees.map((i) => avatarEmoji(players[i]?.avatar ?? 'TIGER')).join(SEPARATORS.list))}</p>
      )}
      <div className="veto-heading" aria-live="polite">
        <PhraseText as="h2" id="game-title" className={`veto-heading__text${lastCutNow ? ' is-last-cut' : ''}`} text={heading} />
      </div>
      <div className="veto-undo-row">
        {!table.undoable && !finished && <p className="veto-undo-row__left">{text('veto_left', cutsLeft)}</p>}
        {table.undoable && (
          <>
            <span className="veto-undo-row__question">{text('veto_undo_question')}</span>
            <button type="button" className="btn btn--text veto-undo-row__undo" onClick={onUndo}>
              {text('veto_undo')}
            </button>
          </>
        )}
        {finished && (
          <button type="button" className="btn btn--filled veto-undo-row__result" onClick={onFinish}>
            {text('veto_see_result')}
          </button>
        )}
      </div>
    </div>
  )

  const fitKey = `${table.round}|${twoPane}|${shown.length}`
  const cards = (layout: VetoLayout) => {
    const card = (item: ResultItem) => {
      const id = item.place.id
      return (
        <VetoCard
          key={id}
          item={item}
          status={statusOf(results, item.place)}
          now={now}
          emoji={item.place.placeholderEmoji ?? choiceEmoji(results.choice)}
          layout={layout}
          cut={cuts.includes(id)}
          winner={finished && id === winner}
          enabled={canCut && remaining.includes(id)}
          reducedMotion={reducedMotion}
          onCut={() => {
            vibrate('heavy')
            onCut(id)
          }}
          onFolded={() => setFolded((list) => (list.includes(id) ? list : [...list, id]))}
        />
      )
    }
    if (layout === 'GRID') {
      const rows: ResultItem[][] = []
      for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2))
      return rows.map((row) => (
        <div key={row.map((item) => item.place.id).join('|')} className="veto-grid-row">
          {row.map(card)}
          {row.length === 1 && <span className="veto-grid-row__gap" aria-hidden="true" />}
        </div>
      ))
    }
    return shown.map(card)
  }

  return (
    <div className={`veto-board${twoPane ? ' veto-board--two-pane' : ''}${lastCutNow ? ' is-last-cut' : ''}`} data-testid="veto-board">
      {lastCutNow && <div className="veto-frame" aria-hidden="true" />}
      {header}
      <FittedCards fitKey={fitKey}>{cards}</FittedCards>
    </div>
  )
}

/**
 * 卡片放进标题下面剩下的地方，用第一个全部放得下的版面（量出来的，所以任何手机、任何字体大小都对：
 * 五六家又放大字时变紧凑或两栏，最后一家不会藏在画面下面）。连两栏都放不下才让画面滑。
 * 同一组卡片（fitKey：这一局、方向、几张卡）只会越来越密；剩下的地方取看过的最小值。
 */
function FittedCards({ fitKey, children }: { readonly fitKey: string; readonly children: (layout: VetoLayout) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const fit = useRef({ key: fitKey, room: Number.POSITIVE_INFINITY })
  const [state, setState] = useState({ key: fitKey, level: 0 })
  const level = state.key === fitKey ? state.level : 0
  if (fit.current.key !== fitKey) fit.current = { key: fitKey, room: Number.POSITIVE_INFINITY }
  const [, setResized] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    const layer = el.closest('.game-layer')
    const bottom = layer ? parseFloat(getComputedStyle(layer).paddingBottom) || 0 : 0
    const top = el.getBoundingClientRect().top + window.scrollY
    const room = window.innerHeight - top - bottom
    if (!(room > 0)) return
    fit.current.room = Math.min(fit.current.room, room)
    if (el.scrollHeight > fit.current.room + 0.5 && level < LAYOUTS.length - 1) setState({ key: fitKey, level: level + 1 })
    else if (state.key !== fitKey) setState({ key: fitKey, level })
  })

  // 转屏、窗口变大变小：重新量（从最宽松的版面开始）。
  useEffect(() => {
    const onResize = () => {
      fit.current = { key: fit.current.key, room: Number.POSITIVE_INFINITY }
      setState((s) => ({ key: s.key, level: 0 }))
      setResized((n) => n + 1)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const layout = LAYOUTS[level] ?? 'GRID'
  return (
    <div ref={ref} className={`veto-cards veto-cards--${layout.toLowerCase()}`} data-layout={layout.toLowerCase()}>
      {children(layout)}
    </div>
  )
}

/** 「⭐ 4.7 · 🚶 约 6 分钟 · RM25–40」（超过 2 公里写距离）；compact 时后面接营业状态（状态和细节一起换行）。 */
function VetoFacts({ place, withPrice = true, hours = null }: { readonly place: Place; readonly withPrice?: boolean; readonly hours?: { status: OpenStatus; now: ZonedTime } | null }) {
  const pieces: FlowPiece[] = []
  if (place.rating != null) pieces.push({ key: 'rating', node: `${PREFIXES.rating}${formatFixed(place.rating, 1)}` })
  pieces.push({ key: 'walk', node: `${PREFIXES.walk}${walkText(place.distanceMeters, true) ?? formatDistance(place.distanceMeters)}` })
  const price = withPrice ? formatPrice(place.priceRange, place.priceLevel) : null
  if (price) pieces.push({ key: 'price', node: price })
  if (hours) {
    const label = describeHours(hours.status, hours.now)
    pieces.push({
      key: 'hours',
      node: (
        <span className="veto-facts__hours">
          <span className={`price-hours__label ${hoursToneClass(label.tone)}`}>{label.label}</span>
          {label.detail != null && (
            <>
              {label.dotted ? SEPARATORS.dot : ' '}
              <span className="veto-facts__detail">{label.detail}</span>
            </>
          )}
        </span>
      ),
    })
  }
  return <SeparatedFlow className="veto-facts" pieces={pieces} />
}

interface VetoCardProps {
  readonly item: ResultItem
  readonly status: OpenStatus
  readonly now: ZonedTime
  readonly emoji: string
  readonly layout: VetoLayout
  readonly cut: boolean
  readonly winner: boolean
  readonly enabled: boolean
  readonly reducedMotion: boolean
  readonly onCut: () => void
  readonly onFolded: () => void
}

/**
 * 还在局里的一家（完整：照片 + 店名 + 两行；紧凑：店名 + 一行；两栏小卡：店名缩小字放进一行）。
 * 被划掉：红色印章「✂️ 不吃！」盖下去（0–20%）→ 沿锯齿线撕成左右两半往外飞、变淡（45–80%）→ 高度收到 0（80–100%）。
 * 撤销：马上回到完整的卡。减少动画：直接收起。
 */
function VetoCard({ item, status, now, emoji, layout, cut, winner, enabled, reducedMotion, onCut, onFolded }: VetoCardProps) {
  const slotRef = useRef<HTMLDivElement>(null)
  const foldedRef = useRef(onFolded)
  foldedRef.current = onFolded
  const name = shortName(item)

  useLayoutEffect(() => {
    const slot = slotRef.current
    if (!cut || !slot) return
    const height = slot.getBoundingClientRect().height
    const animation =
      reducedMotion || height <= 0
        ? null
        : playAnimation(
            slot,
            [
              { height: `${height}px`, offset: 0 },
              { height: `${height}px`, offset: 0.8 },
              { height: '0px', offset: 1 },
            ],
            { duration: TABLE.CUT_MS, easing: 'linear', fill: 'forwards' },
          )
    if (!animation) {
      foldedRef.current()
      return
    }
    const stop = onAnimationDone(animation, () => foldedRef.current())
    return () => {
      stop()
      animation.cancel()
    }
  }, [cut, reducedMotion])

  const body = (
    <span className="veto-card__body">
      {layout === 'FULL' && (
        <span className="veto-card__row">
          <span className="veto-card__thumb" style={{ ['--thumb' as string]: '52px' }}>
            <PlaceThumb item={item} emoji={emoji} />
          </span>
          <span className="veto-card__text">
            <span className="veto-card__name">{name}</span>
            <VetoFacts place={item.place} />
            <PriceHoursLine place={item.place} status={status} now={now} showPrice={false} />
          </span>
        </span>
      )}
      {layout === 'COMPACT' && (
        <span className="veto-card__text">
          <span className="veto-card__name">{name}</span>
          <VetoFacts place={item.place} hours={{ status, now }} />
        </span>
      )}
      {layout === 'GRID' && (
        <span className="veto-card__text">
          <FitText className="veto-card__name veto-card__name--fit" text={name} minPx={12} minRatio={0.7} />
          <VetoFacts place={item.place} withPrice={false} />
          <PriceHoursLine place={item.place} status={status} now={now} showPrice={false} />
        </span>
      )}
      {cut && (
        <span className="veto-card__stamp-box" aria-hidden="true">
          <span className="veto-card__stamp">{text('veto_stamp')}</span>
        </span>
      )}
    </span>
  )

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onCut()
  }

  return (
    <div ref={slotRef} className={`veto-slot${layout === 'GRID' ? ' veto-slot--grid' : ''}`}>
      <div
        role="button"
        tabIndex={enabled ? 0 : -1}
        aria-disabled={!enabled}
        aria-label={enabled ? text('veto_card_a11y', name) : undefined}
        className={`veto-card veto-card--${layout.toLowerCase()}${winner ? ' is-winner' : ''}${cut ? ' is-cut' : ''}${enabled ? ' is-enabled' : ''}`}
        onClick={enabled ? onCut : undefined}
        onKeyDown={onKeyDown}
        data-testid="veto-card"
      >
        {cut ? (
          <>
            <span className="veto-half veto-half--left" aria-hidden="true">
              {body}
            </span>
            <span className="veto-half veto-half--right" aria-hidden="true">
              {body}
            </span>
          </>
        ) : (
          body
        )}
      </div>
    </div>
  )
}
