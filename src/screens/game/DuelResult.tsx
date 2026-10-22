/**
 * 🎉「就这一家吧！」（安卓 ui/ResultPage.kt，功能清单第十三节）：所有玩法（剪刀石头布、帮我挑一家、转盘、饭桌、投票）的结果。
 * 单栏从上到下：判定大字 →「就这一家吧！🎉」（刚揭晓时弹出来）→ 台词 → 记录 → 赢家卡 → 导航过去 →
 * 「不服！再来一局（只剩 1 次）」+ 回到列表（或「🔒 这一餐定了」+ 回到列表）→ 📤 告诉朋友 →（锁住时）大家都同意重来？→
 * 今天的战绩 → 🃏 任务卡 → 🎯 谁来做。
 * 双栏（手机横屏）：左边赢家卡 + 任务卡，右边判定 + 按钮（「导航过去」永远看得到）。
 *
 * 彩带在字和店卡后面飞：所有字、透明的按钮都垫了页面底色（.backdrop / .btn--page），字缝里不会透出彩带。
 * 告诉朋友：有系统分享面板就用（只传文字）；没有就复制，再给一个「用 WhatsApp 发」；复制也不行就显示文字让人长按复制。
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { allowsRegret, canGo, duelOutcome, MIN_PLACES, rankIn, statusOf, type DuelState, type ResultItem, type ResultsState } from '../../app/state.ts'
import { choiceEmoji, decisionRecord, decisionVerdict, duelLineText, lockLine, rushText, shareDecision, text, webText } from '../../app/texts.ts'
import { GAME_SYMBOLS, PREFIXES } from '../../data/uiLiterals.ts'
import type { HandId, Place } from '../../domain/model.ts'
import { clockZoned } from '../../domain/openingHours.ts'
import { handEmoji, handForPlaceIndex, handName, winningHand } from '../../domain/rps.ts'
import type { DayStats } from '../../domain/taskDeck.ts'
import type { ZonedTime } from '../../domain/time.ts'
import { playAnimation } from '../../lib/motion.ts'
import { openExternal, shareText, whatsAppShareUrl } from '../../platform/device.ts'
import { Icon } from '../../ui/Icon.tsx'
import { PhraseText } from '../../ui/PhraseText.tsx'
import { PlaceName, PlaceThumb, PriceHoursLine, RatingLine, SmallTag } from '../results/PlaceParts.tsx'
import { TaskCardSection } from './TaskCard.tsx'

export interface DuelResultProps {
  readonly duel: DuelState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly compact: boolean
  readonly twoPane: boolean
  readonly todayStats: DayStats
  /** 刚揭晓（不是再显示）：「就这一家吧！🎉」弹出来。 */
  readonly fresh: boolean
  readonly reducedMotion: boolean
  readonly onNavigate: (place: Place) => void
  readonly onDuelAgain: () => void
  readonly onClose: () => void
  readonly onAskRestart: () => void
  /** 分享、复制都不行：显示文字让人长按复制。 */
  readonly onManualCopy: (message: string) => void
  readonly onDrawTask: () => void
  readonly onSpinTask: (people: number) => void
  readonly onTaskWheelStopped: () => void
}

/** 赢的手势：剪刀石头布赢（或平手）的那个；暗中出拳没打平时，赢家那家代表的手势。 */
function winningHandOf(duel: DuelState): HandId | null {
  const outcome = duelOutcome(duel)
  if (outcome) return winningHand(outcome)
  if (duel.mode === 'SECRET_HANDS' && duel.tiedIndices.length === 0 && duel.winnerIndex != null) return handForPlaceIndex(duel.winnerIndex)
  return null
}

/** 店卡左上角的小徽章：赢的手势，或 🎡 / ✂️ / 📊 / 🎲。 */
function badgeOf(duel: DuelState, hand: HandId | null): string {
  if (hand) return handEmoji(hand)
  switch (duel.mode) {
    case 'WHEEL':
      return GAME_SYMBOLS.winnerBadge.WHEEL
    case 'VETO':
      return GAME_SYMBOLS.winnerBadge.VETO
    case 'VOTE':
      return GAME_SYMBOLS.winnerBadge.VOTE
    case 'SECRET_HANDS':
      return GAME_SYMBOLS.winnerBadge.SECRET_HANDS_TIE
    default:
      return GAME_SYMBOLS.winnerBadge.ROULETTE
  }
}

export function DuelResult(props: DuelResultProps) {
  const { duel, places, results, compact, twoPane, todayStats } = props
  const item = duel.winnerIndex != null ? (places[duel.winnerIndex] ?? null) : null
  if (!item) return null
  const now: ZonedTime = clockZoned(results.clock) ?? { epochMillis: Date.now(), zone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  // 「不服」用这局的店里现在还能去的：至少 2 家才玩得了
  const canPlayAgain = places.filter((p) => canGo(results, p.place)).length >= MIN_PLACES
  const stats = duel.mode === 'ROCK_PAPER_SCISSORS' ? todayStats : null
  const title = <ResultTitle duel={duel} places={places} results={results} small={twoPane} fresh={props.fresh} reducedMotion={props.reducedMotion} />
  const card = <WinnerCard item={item} duel={duel} results={results} now={now} photo={twoPane || compact ? 88 : 112} />
  const buttons = <ResultButtons {...props} item={item} now={now} canPlayAgain={canPlayAgain} />
  const tasks = (
    <TaskCardSection
      duel={duel}
      stats={stats}
      reducedMotion={props.reducedMotion}
      onDraw={props.onDrawTask}
      onSpinTask={props.onSpinTask}
      onTaskWheelStopped={props.onTaskWheelStopped}
    />
  )
  if (twoPane) {
    return (
      <div className="game-panes game-panes--result">
        <div className="game-pane game-pane--start">
          {card}
          {tasks}
        </div>
        <div className="game-pane game-pane--end">
          {title}
          {buttons}
        </div>
      </div>
    )
  }
  return (
    <>
      {title}
      {card}
      {buttons}
      {tasks}
    </>
  )
}

/** 判定大字（锁住时「这一餐已经定了 🤝 愿赌服输」）、「就这一家吧！🎉」、台词、记录。 */
function ResultTitle({
  duel,
  places,
  results,
  small,
  fresh,
  reducedMotion,
}: {
  readonly duel: DuelState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly small: boolean
  readonly fresh: boolean
  readonly reducedMotion: boolean
}) {
  const popRef = useRef<HTMLParagraphElement>(null)
  // 刚揭晓：从 0.6 倍弹到 1（弹簧）；再显示直接是 1。
  useLayoutEffect(() => {
    const el = popRef.current
    if (!fresh || reducedMotion || !el) return
    playAnimation(
      el,
      [
        { transform: 'scale(0.6)', offset: 0 },
        { transform: 'scale(1.1)', offset: 0.35 },
        { transform: 'scale(0.97)', offset: 0.65 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: 520, easing: 'ease-out' },
    )
  }, [fresh, reducedMotion])
  const verdict = duel.locked ? text('meal_locked_title') : decisionVerdict(duel, places, (id) => rankIn(results, duel, id))
  const line = duel.locked ? null : duelLineText(duel.line)
  const record = decisionRecord(duel, places)
  return (
    <div className={`result-title${small ? ' result-title--small' : ''}`}>
      <PhraseText as="h2" id="game-title" className="backdrop result-title__verdict" text={verdict} />
      <p ref={popRef} className="backdrop result-title__main" aria-live="polite">
        {text('duel_result_title')}
      </p>
      {line && <PhraseText as="p" className="backdrop result-title__line" text={line} />}
      {record && <PhraseText as="p" className="backdrop result-title__record" text={record} />}
    </div>
  )
}

/** 今天吃的这家：照片（左上角怎么赢的小徽章）、店名（不能按）、评分、价钱营业、地址、从哪来的；一小时内关门再写赶不赶得及。 */
function WinnerCard({ item, duel, results, now, photo }: { readonly item: ResultItem; readonly duel: DuelState; readonly results: ResultsState; readonly now: ZonedTime; readonly photo: number }) {
  const place = item.place
  const status = statusOf(results, place)
  const hand = winningHandOf(duel)
  const badge = badgeOf(duel, hand)
  const rank = rankIn(results, duel, place.id)
  const from =
    rank > 0
      ? hand
        ? text('duel_result_from', handEmoji(hand), handName(hand), rank)
        : duel.mode === 'ROULETTE'
          ? text('roulette_result_from', rank)
          : `${badge} ${text('duel_rank', rank)}`
      : null
  const rush = rushText(status, place.distanceMeters, now)
  return (
    <article className="winner-card" aria-label={item.translatedName ?? place.name} style={{ ['--thumb' as string]: `${photo}px` }}>
      <div className="winner-card__row">
        <PlaceThumb item={item} emoji={place.placeholderEmoji ?? choiceEmoji(results.choice)}>
          <span className="winner-card__badge" aria-hidden="true">
            {badge}
          </span>
        </PlaceThumb>
        <div className="winner-card__body">
          <PlaceName item={item} extraTag={results.isDemo ? <SmallTag tone="inverse">{text('demo_tag')}</SmallTag> : undefined} />
          <RatingLine item={item} />
          <PriceHoursLine place={place} status={status} now={now} />
          {place.address && (
            <p className="winner-card__address">
              {PREFIXES.address}
              {place.address}
            </p>
          )}
          {from && <p className="winner-card__from">{from}</p>}
        </div>
      </div>
      {rush && <PhraseText as="p" className="winner-card__rush" text={rush} />}
    </article>
  )
}

/**
 * 导航过去；能反悔时「不服！再来一局（只剩 1 次）」+ 回到列表；否则「🔒 这一餐定了」（灰色小字，不是按钮）+ 回到列表；
 * 📤 告诉朋友；锁住时「大家都同意重来？」。
 */
function ResultButtons(props: DuelResultProps & { readonly item: ResultItem; readonly now: ZonedTime; readonly canPlayAgain: boolean }) {
  const { duel, item, places, results, now, canPlayAgain } = props
  // 复制好了（没有系统分享面板）：在按钮下面说一声，再给一个「用 WhatsApp 发」。
  const [copied, setCopied] = useState<string | null>(null)
  const canRegret = allowsRegret(duel.mode) && duel.regretsLeft > 0 && !duel.locked
  const onShare = () => {
    const message = shareDecision(item, duel, places, statusOf(results, item.place), now, results.isDemo)
    void shareText(message).then((result) => {
      if (result === 'COPIED') setCopied(message)
      else if (result === 'MANUAL') props.onManualCopy(message)
    })
  }
  return (
    <div className="result-buttons">
      <button type="button" className="btn btn--filled btn--block btn--tall result-buttons__navigate" onClick={() => props.onNavigate(item.place)}>
        <Icon name="DIRECTIONS" className="result-buttons__nav-icon" />
        <span>{text('duel_navigate')}</span>
      </button>
      {canRegret && canPlayAgain ? (
        <div className="result-buttons__row">
          <button type="button" className="btn btn--outlined btn--page result-buttons__regret" onClick={props.onDuelAgain}>
            <PhraseText text={text('duel_regret', duel.regretsLeft)} />
          </button>
          <button type="button" className="btn btn--text btn--page result-buttons__back" onClick={props.onClose}>
            {text('duel_back')}
          </button>
        </div>
      ) : (
        <>
          {!duel.locked && !canRegret && <SettledNote duel={duel} />}
          <button type="button" className="btn btn--text btn--page btn--block result-buttons__back" onClick={props.onClose}>
            {text('duel_back')}
          </button>
        </>
      )}
      <button type="button" className="btn btn--tonal btn--block result-buttons__share" onClick={onShare}>
        {text('duel_share')}
      </button>
      {copied != null && (
        <div className="share-copied backdrop" role="status">
          <PhraseText as="p" className="share-copied__text" text={webText('web_share_copied')} />
          <button type="button" className="btn btn--outlined btn--page share-copied__whatsapp" onClick={() => openExternal(whatsAppShareUrl(copied))}>
            {webText('web_share_whatsapp')}
          </button>
        </div>
      )}
      {duel.locked && (
        <button type="button" className="btn btn--text btn--page result-buttons__restart" onClick={props.onAskRestart}>
          {text('meal_restart')}
        </button>
      )}
    </div>
  )
}

/** 「🔒 这一餐定了」+ 怎么定的（灰色小字，不是按钮；读屏念成一句）。 */
function SettledNote({ duel }: { readonly duel: DuelState }) {
  const title = text('meal_settled')
  const line = lockLine(duel)
  return (
    <div className="settled-note backdrop" role="note" aria-label={`${title}，${line}`.replace(/​/g, '')}>
      <p className="settled-note__title" aria-hidden="true">
        {title}
      </p>
      <PhraseText as="p" className="settled-note__line" text={line} aria-hidden="true" />
    </div>
  )
}
