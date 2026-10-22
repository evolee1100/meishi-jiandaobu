/**
 * 画面和分享要用的句子（安卓 ui/Texts.kt：HoursText、VisitText、DecisionText、ShareText，加上各画面挑哪句字的规则）。
 * 文字一律从 data/strings.ts 拿（网页改写过的先用 data/webText.ts），这里只决定「用哪一句、填什么」。
 * 回传的字保留排版用的隐形字符（不换行空格、字连接符、断点）；分享文字已经清理好。
 */
import { CLOCK_PART_KEYS, VISIT_PART_KEYS, WEEKDAY_KEYS } from '../data/dayParts.ts'
import { QUOTA } from '../data/constants.ts'
import { formatFixed, formatGrouped } from '../data/javaFormat.ts'
import { formatString, STRINGS, type StringKey } from '../data/strings.ts'
import { SEPARATORS, ERROR_EMOJI, PREFIXES } from '../data/uiLiterals.ts'
import { WEB_TEXTS, webString, type WebTextKey } from '../data/webText.ts'
import { choiceLabel, choiceLabelParts, cuisineData, cuisineName, isSpecific, mealData } from '../domain/cuisine.ts'
import { dayPartAt, dayPartData } from '../domain/dayPart.ts'
import { fortuneFood, fortuneLevelEmoji, fortuneLevelName, fortuneStick } from '../domain/fortune.ts'
import { formatDistance, formatKm } from '../domain/geo.ts'
import type { DayPartId, HandId, SearchChoice } from '../domain/model.ts'
import { shareUrl } from '../domain/mapsLinks.ts'
import { isClosingSoon, mayHaveStoppedOrders, closesBeforeArrival as closesBefore, minutesUntilClose, type OpenStatus } from '../domain/openingHours.ts'
import { cleanForShare } from '../domain/phrases.ts'
import { formatPrice } from '../domain/priceFormat.ts'
import { largerRadius } from '../domain/radius.ts'
import type { PickNote } from '../domain/randomPicker.ts'
import { handEmoji, handName, isTie, lineText, verdictOf, winningHand } from '../domain/rps.ts'
import { avatarEmoji, judgeSecretHands, outcomeCutter, playerLabel, type TableOutcome } from '../domain/table.ts'
import { taskAssignee, taskCardText, type TaskDraw } from '../domain/taskDeck.ts'
import { calendarDaysBetween, HOUR_MS, localFields, type ZonedTime } from '../domain/time.ts'
import { isOnFoot, travelMinutes, walkingMinutes } from '../domain/travel.ts'
import { daysAgo } from '../domain/visits.ts'
import { voteMarkersOf } from '../domain/vote.ts'
import { problemOf, type HttpProblem, type SearchError } from './searchError.ts'
import {
  firstRank,
  isFirstPage,
  isTableMode,
  lastRank,
  reachableCount,
  remainingAfter,
  duelOutcome,
  type DuelPlan,
  type DuelState,
  type LocationStatus,
  type ResultItem,
  type ResultsPage,
  type ResultsState,
} from './state.ts'

/** 取一条文字并填参数（网页改写过的用改写稿）。 */
export function text(key: StringKey, ...args: ReadonlyArray<string | number>): string {
  return formatString(webString(key, STRINGS), ...args)
}

/** 网页新加的文字。 */
export function webText(key: WebTextKey, ...args: ReadonlyArray<string | number>): string {
  return formatString(WEB_TEXTS[key], ...args)
}

function key(name: string): StringKey {
  return name as StringKey
}

// ================================================================ 首页的定位

/** 首页底下的状态行：定位中 / 已取得位置（大概位置另一句）；有问题时是 null（改在上面显示卡片）。 */
export function locationStatusLine(status: LocationStatus): string | null {
  if (status.kind === 'LOCATING') return text('loc_locating')
  if (status.kind === 'READY') return text(status.approximate ? 'loc_ready_approx' : 'loc_ready')
  return null
}

/** 定位卡片的按钮：ASK = 显示自己的定位说明再让浏览器问；HOW_TO = 浏览器挡住了（或根本不能定位），显示「怎么打开？」的说明；RETRY = 再定位一次。 */
export type LocationCardAction = 'ASK' | 'HOW_TO' | 'RETRY'

/**
 * 网页能不能定位：OK；INSECURE = 不是 https 打开的（浏览器不让网页定位）；UNSUPPORTED = 浏览器没有定位功能。
 * 后两种不管权限是什么状态都定位不了，卡片和错误页改说清楚原因和办法（不叫人去设置里「允许」）。
 */
export type LocationEnvironment = 'OK' | 'INSECURE' | 'UNSUPPORTED'

export interface LocationCardModel {
  readonly text: string
  /** 第二行小字：为什么要定位、或者怎么办。 */
  readonly explain: string | null
  readonly button: string
  readonly action: LocationCardAction
}

/** 首页上面的定位问题卡片（安卓 HomeScreen.LocationProblemCard）；没有问题是 null。 */
export function locationCard(status: LocationStatus, env: LocationEnvironment = 'OK'): LocationCardModel | null {
  if (status.kind === 'LOCATING' || status.kind === 'READY') return null
  if (env === 'INSECURE') {
    return { text: webText('web_location_insecure'), explain: webText('web_location_insecure_help'), button: text('action_open_app_settings'), action: 'HOW_TO' }
  }
  if (env === 'UNSUPPORTED') {
    return { text: webText('web_location_unsupported'), explain: webText('web_location_unsupported_help'), button: text('action_open_app_settings'), action: 'HOW_TO' }
  }
  switch (status.kind) {
    case 'WAITING_PERMISSION':
      return { text: text('loc_waiting'), explain: null, button: text('action_grant_location'), action: 'ASK' }
    case 'PERMISSION_DENIED':
      return status.permanently
        ? { text: text('loc_denied_permanent'), explain: text('permission_explain'), button: text('action_open_app_settings'), action: 'HOW_TO' }
        : { text: text('loc_denied'), explain: text('permission_explain'), button: text('action_grant_location'), action: 'ASK' }
    case 'SERVICES_OFF':
    case 'UNAVAILABLE':
      // 网页分不出「定位服务没开」：都说「暂时拿不到你的位置」+ 怎么办 + 重试。
      return { text: text('loc_unavailable'), explain: webText('web_location_unavailable_hint'), button: text('action_retry'), action: 'RETRY' }
  }
}

/** 「怎么打开定位？」小窗口的内容：浏览器挡住了 → 安卓 / iPhone 各一段步骤；不是 https / 浏览器不能定位 → 说原因和办法。 */
export function locationHelp(env: LocationEnvironment): { title: string; steps: string[]; canRetry: boolean } {
  if (env === 'INSECURE') return { title: webText('web_location_help_title'), steps: [webText('web_location_insecure'), webText('web_location_insecure_help')], canRetry: false }
  if (env === 'UNSUPPORTED') return { title: webText('web_location_help_title'), steps: [webText('web_location_unsupported'), webText('web_location_unsupported_help')], canRetry: false }
  return { title: webText('web_location_help_title'), steps: [webText('web_location_help_android'), webText('web_location_help_iphone')], canRetry: true }
}

// ================================================================ 时间、营业时间

/** 「凌晨 2:00」：12 小时制 h:mm（0 点写 12），前面加时段词，中间是不换行空格。 */
export function clockText(hour: number, minute: number): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const digits = `${hour12}:${String(minute).padStart(2, '0')}`
  const part = CLOCK_PART_KEYS.find((p) => hour >= p.fromHour && hour <= p.toHour) ?? CLOCK_PART_KEYS[CLOCK_PART_KEYS.length - 1]
  return text(key(part?.key ?? 'time_evening'), digits)
}

function clockAt(at: ZonedTime): string {
  const f = localFields(at.epochMillis, at.zone)
  return clockText(f.hour, f.minute)
}

/** 带日子的时间：同一天不写；明天「明天早上 7:00」；2–6 天后「星期一早上 7:00」；7 天以上「10月20日早上 7:00」。 */
function withDay(at: ZonedTime, now: ZonedTime): string {
  const time = clockAt(at)
  const days = calendarDaysBetween(now.epochMillis, at.epochMillis, at.zone)
  if (days <= 0) return time
  if (days === 1) return text('day_tomorrow', time)
  const f = localFields(at.epochMillis, at.zone)
  if (days < 7) return text(key(WEEKDAY_KEYS[f.dayOfWeek] ?? 'day_sunday'), time)
  return text('day_date', f.month, f.day, time)
}

/** 关门时间：24 小时内的不写哪天（「开到凌晨 2:00」）。 */
export function closeMoment(at: ZonedTime, now: ZonedTime): string {
  return Math.trunc((at.epochMillis - now.epochMillis) / HOUR_MS) < 24 ? clockAt(at) : withDay(at, now)
}

/** 开门时间：「下午 5:00」「明天早上 7:00」「星期一早上 7:00」「10月20日早上 7:00」。 */
export function openMoment(at: ZonedTime, now: ZonedTime): string {
  return withDay(at, now)
}

export type HoursTone = 'OPEN' | 'CLOSING_SOON' | 'CLOSED' | 'UNKNOWN'

/** 营业行：彩色的那段（label）和后面的细节；dotted = 中间用「 · 」，否则空一点。 */
export interface HoursLabel {
  readonly tone: HoursTone
  readonly label: string
  readonly detail: string | null
  readonly dotted: boolean
}

/** 「营业中 · 开到晚上 10:00」。 */
export function fullHoursLabel(label: HoursLabel): string {
  return label.detail == null ? label.label : `${label.label}${SEPARATORS.dot}${label.detail}`
}

/** 营业行怎么说（店卡、分享）。 */
export function describeHours(status: OpenStatus, now: ZonedTime): HoursLabel {
  switch (status.kind) {
    case 'UNKNOWN':
      return { tone: 'UNKNOWN', label: text('open_unknown'), detail: null, dotted: false }
    case 'OPEN': {
      const minutes = minutesUntilClose(status, now)
      if (status.allDay) return { tone: 'OPEN', label: text('hours_all_day'), detail: null, dotted: false }
      if (minutes != null && mayHaveStoppedOrders(status, now)) {
        return { tone: 'CLOSING_SOON', label: text('hours_closing_soon', minutes), detail: text('hours_last_orders'), dotted: true }
      }
      if (minutes != null && isClosingSoon(status, now)) {
        return { tone: 'CLOSING_SOON', label: text('hours_closing_soon', minutes), detail: null, dotted: false }
      }
      if (status.closesAt != null) {
        return { tone: 'OPEN', label: text('open_now'), detail: text('hours_open_until', closeMoment(status.closesAt, now)), dotted: false }
      }
      return { tone: 'OPEN', label: text('open_now'), detail: null, dotted: false }
    }
    case 'CLOSED':
      return {
        tone: 'CLOSED',
        label: text('closed_now'),
        detail: status.opensAt ? text('hours_opens_at', openMoment(status.opensAt, now)) : null,
        dotted: false,
      }
  }
}

/**
 * 「就这一家吧！」下面那句（一小时内关门才说）：来不及「⏰ 只剩 2 分钟，走过去要 18 分钟，来不及了」；
 * 半小时内「赶得到，不过可能已经停止点餐了…」；其他「赶得及！冲！🏃」。
 */
export function rushText(status: OpenStatus, distanceMeters: number, now: ZonedTime): string | null {
  const left = minutesUntilClose(status, now)
  if (left == null || !isClosingSoon(status, now)) return null
  const travel = travelMinutes(distanceMeters)
  if (closesBefore(status, now, travel)) {
    return text(isOnFoot(distanceMeters) ? 'hours_too_late_walk' : 'hours_too_late_ride', left, travel)
  }
  if (mayHaveStoppedOrders(status, now)) return text('hours_rush_last_orders')
  return text('hours_rush')
}

/** 「走路约 9 分钟」（short：「约 9 分钟」）；超过 2 公里 → null。 */
export function walkText(distanceMeters: number, short = false): string | null {
  const minutes = walkingMinutes(distanceMeters)
  return minutes == null ? null : text(short ? 'walk_minutes_short' : 'walk_minutes', minutes)
}

// ================================================================ 👣 去过

/**
 * 「👣 刚刚导航过」（1 小时内，包括「未来」几分钟）、「👣 今天中午去过」、「👣 昨晚去过」/「👣 昨天下午去过」（昨天、不到 12 小时）、
 * 「👣 昨天去过」、「👣 3 天前去过」。
 */
export function visitText(visitMillis: number, nowMillis: number, zone: string): string {
  const ago = nowMillis - visitMillis
  if (ago < 60 * 60 * 1000) return text('visit_just_now')
  const days = daysAgo(visitMillis, nowMillis, zone)
  const hour = localFields(visitMillis, zone).hour
  const part = VISIT_PART_KEYS.find((p) => hour >= p.fromHour && hour <= p.toHour) ?? VISIT_PART_KEYS[VISIT_PART_KEYS.length - 1]
  const partKey = part?.key ?? 'visit_part_evening'
  if (days === 0) return text('visit_today', text(key(partKey)))
  if (days === 1 && ago < 12 * 60 * 60 * 1000) {
    return partKey === 'visit_part_evening' ? text('visit_last_night') : text('visit_yesterday_part', text(key(partKey)))
  }
  if (days === 1) return text('visit_yesterday')
  return text('visit_days_ago', days)
}

// ================================================================ 店名、店卡

/** 「樱花拉面屋（Sakura Ramen House）」：机翻过就中文名 + 招牌原名，否则原名。 */
export function displayName(item: ResultItem): string {
  return item.translatedName != null ? `${item.translatedName}（${item.place.name}）` : item.place.name
}

/** 「樱花拉面屋」：卡片上的名字（机翻优先）。 */
export function shortName(item: ResultItem): string {
  return item.translatedName ?? item.place.name
}

/** 评分行的几段：「⭐ 4.6（1,234 条评价）」「🚶 520 米」「走路约 7 分钟」（没评分「暂无评分」）。 */
export function ratingLinePieces(item: ResultItem, shortWalk = false): string[] {
  const place = item.place
  const pieces: string[] = []
  if (place.rating != null) {
    pieces.push(`${PREFIXES.rating}${formatFixed(place.rating, 1)}${text('review_count', formatGrouped(place.userRatingCount ?? 0))}`)
  } else {
    pieces.push(text('no_rating'))
  }
  pieces.push(`${PREFIXES.walk}${formatDistance(place.distanceMeters)}`)
  const walk = walkText(place.distanceMeters, shortWalk)
  if (walk) pieces.push(walk)
  return pieces
}

/** 价钱（有才写）。 */
export function priceText(item: ResultItem): string | null {
  return formatPrice(item.place.priceRange, item.place.priceLevel)
}

/** 「第 4 名」的读屏、奖牌（第 1–3 名）。 */
export function rankBadge(rank: number): { medal: string | null; a11y: string } {
  const medals = ['🥇', '🥈', '🥉']
  return { medal: medals[rank - 1] ?? null, a11y: text('rank_badge', rank) }
}

// ================================================================ 首页、随便挑、饭签

export function greeting(dayPart: DayPartId): string {
  return text(key(dayPartData(dayPart).greetingKey))
}

/** 菜系说明：「🥢 中餐会帮你找：…」。 */
export function cuisineHint(cuisine: SearchChoice['cuisine']): string {
  return text(key(cuisineData(cuisine).hintKey))
}

/** 随便挑那一行（只说最重要的一句）。 */
export function pickNoteText(note: PickNote | null): string | null {
  if (!note) return null
  switch (note.kind) {
    case 'EXCLUDED':
      return text('random_excluded', cuisineName(note.cuisine))
    case 'FORTUNE':
      return text('random_fortune_note', fortuneFood(note.stickIndex))
    case 'EATEN_RECENTLY':
      return text('random_less_likely_one', cuisineName(note.cuisine))
    case 'TIME_OF_DAY':
      return text(key(dayPartData(note.dayPart).diceNoteKey))
  }
}

/** 随便挑的结果「日本餐・面！」（都可以不写饭面）。 */
export function randomResultValue(choice: SearchChoice): string {
  return text('random_result_value', choiceLabel(choice))
}

/** 首页的饭签胶囊：还没抽「📜 抽今日饭签」，抽过「📜 上签：宜寿司」。 */
export function fortuneChip(stickIndex: number, drawn: boolean): string {
  return drawn ? text('fortune_chip_drawn', fortuneLevelName(stickIndex), fortuneFood(stickIndex)) : text('fortune_chip_draw')
}

/** 「照签去找 🍜」：签上是饭或面就用 🍚 / 🍜，「都可以」用菜系的 emoji。 */
export function fortuneGoLabel(stickIndex: number): string {
  const stick = fortuneStick(stickIndex)
  const emoji = stick.meal === 'ANY' ? cuisineData(stick.cuisine).emoji : mealData(stick.meal).emoji
  return text('fortune_go', emoji)
}

/** 加载页的标题：「正在帮你找附近最好吃的中餐・饭…」（不限 + 都可以 = 「店」）。 */
export function loadingTitle(choice: SearchChoice): string {
  return text('loading_title', choiceLabel(choice) || text('loading_any'))
}

// ================================================================ 结果页

/** 标题的几段（只能在「・」后面换行）：「附近最强 3 家」「日本餐」「面」。 */
export function resultsTitleParts(view: ResultsPage, choice: SearchChoice): string[] {
  let first: string
  if (view.items.length === 0) first = text('results_title_none')
  else if (isFirstPage(view)) first = text('results_title_top', view.items.length)
  else if (view.items.length === 1) first = text('results_title_page_single', firstRank(view))
  else first = text('results_title_page', firstRank(view), lastRank(view))
  return [first, ...choiceLabelParts(choice)]
}

/** 副标题：「从 21 家里按评分排名」和「范围 1.5 公里」（一行放得下才用「 · 」连）。 */
export function resultsSubtitle(results: ResultsState): { found: string; range: string; oneLine: string } {
  const found = text('results_subtitle_found', results.ranked.length + results.trimmedCount)
  const range = text('results_subtitle_range', formatKm(results.radiusKm))
  return { found, range, oneLine: `${found}${SEPARATORS.dot}${range}` }
}

/** 「扩大到 3 公里（用 1 次）」/ 演示「扩大到 3 公里（演示不扣次数）」；已经 5 公里 → null。按的是现在的演示开关。 */
export function expandRangeLabel(radiusKm: number, demoMode: boolean): string | null {
  const larger = largerRadius(radiusKm)
  return larger == null ? null : text(demoMode ? 'expand_range_demo' : 'expand_range', formatKm(larger))
}

/** 翻页按钮：后面还有 ≥ 3 家「🔄 换 3 家」；1–2 家「🔄 剩下 2 家」；看完了而且不是第一页「↩️ 回到前 3 名」；只有一页 → null。 */
export function pageButton(view: ResultsPage): { label: string; action: 'NEXT' | 'FIRST' } | null {
  const after = remainingAfter(view)
  if (after > 0) return { label: after >= view.pageSize ? text('more') : text('more_last', after), action: 'NEXT' }
  if (!isFirstPage(view)) return { label: text('bar_back_to_top'), action: 'FIRST' }
  return null
}

/** 看完了：「已经看完全部 N 家」，恢复时丢掉过店：「已经看完前 N 家」+ 小字。 */
export function listEndTexts(view: ResultsPage, trimmedCount: number): { done: string; note: string | null } {
  if (trimmedCount > 0) return { done: text('more_done_trimmed', view.total), note: text('more_trimmed_note', trimmedCount) }
  return { done: text('more_done', view.total), note: null }
}

/** 决定按钮的字；没有游戏 → 提示块的字（「这一页能去的店不到 2 家」/「你圈的店里能去的不到 2 家」）。 */
export function decideButton(plan: DuelPlan): { label: string; playable: boolean; wobblyFist: boolean } {
  if (plan.mode == null) return { label: text(plan.fromBasket ? 'decide_none_basket' : 'decide_none'), playable: false, wobblyFist: false }
  const rps = plan.mode === 'ROCK_PAPER_SCISSORS'
  if (plan.mode === 'WHEEL') return { label: text('decide_basket_wheel', plan.candidateIds.length), playable: true, wobblyFist: false }
  if (plan.fromBasket && rps) return { label: text('decide_basket_rps'), playable: true, wobblyFist: false }
  if (plan.fromBasket) return { label: text('decide_basket_roulette'), playable: true, wobblyFist: false }
  if (rps) return { label: text('decide_rps_bar'), playable: true, wobblyFist: true }
  return { label: text('decide_roulette'), playable: true, wobblyFist: false }
}

/** ❤️ 一行：圈 1 家「❤️ 再圈 1 家就能用它们来玩」，2 家起「❤️ 已圈 5 家：A、B…」。 */
export function basketRowText(results: ResultsState): string | null {
  const names = results.basket
    .map((id) => results.ranked.find((item) => item.place.id === id))
    .filter((item): item is ResultItem => item != null)
    .map(shortName)
  if (results.basket.length === 0) return null
  if (results.basket.length === 1) return text('basket_hint_one')
  return text('basket_count', results.basket.length) + names.join(SEPARATORS.list)
}

/** 救援卡怎么称呼刚才找的：有菜系用菜系名，不限 + 饭「卖饭的店」、面「面档」、都可以「店」。 */
export function rescueSubject(choice: SearchChoice): string {
  if (isSpecific(choice.cuisine)) return cuisineName(choice.cuisine)
  if (choice.meal === 'RICE') return text('rescue_subject_rice')
  if (choice.meal === 'NOODLE') return text('rescue_subject_noodle')
  return text('rescue_subject_any')
}

/** 救援卡的标题（能去的 < 2 家才有）；从不说「晚点再来」。 */
export function rescueTitle(results: ResultsState): string | null {
  const reachable = reachableCount(results)
  if (reachable >= 2) return null
  const what = rescueSubject(results.choice)
  if (reachable === 0) return text('rescue_all_closed', what)
  if (results.ranked.length === 1) return text('rescue_only_one', what)
  return text('rescue_one_open', what)
}

/** 「会用 1 次免费搜索」/「演示模式不扣次数」。 */
export function searchCostNote(demoMode: boolean): string {
  return text(demoMode ? 'rescue_expand_note_demo' : 'rescue_expand_note')
}

// ================================================================ 游戏

/** 「😴 已跳过休息中的『A』『B』」和「😴 已跳过快关门、过去来不及的『C』」（按现在的时间分）。 */
export function skippedNotes(names: { closed: readonly string[]; late: readonly string[] }): string[] {
  const notes: string[] = []
  if (names.closed.length > 0) notes.push(text('duel_skipped', names.closed.join(SEPARATORS.skippedJoin)))
  if (names.late.length > 0) notes.push(text('duel_skipped_late', names.late.join(SEPARATORS.skippedJoin)))
  return notes
}

/** 判决（「就这一家吧！」上面那句，App 在说话）。 */
export function decisionVerdict(duel: DuelState, places: readonly ResultItem[], rankOf: (placeId: string) => number): string {
  const winnerId = duel.winnerIndex == null ? null : (duel.placeIds[duel.winnerIndex] ?? null)
  const rank = winnerId == null ? 1 : rankOf(winnerId) > 0 ? rankOf(winnerId) : duel.placeIds.indexOf(winnerId) + 1
  switch (duel.mode) {
    case 'ROCK_PAPER_SCISSORS': {
      const outcome = duelOutcome(duel)
      if (!outcome) return ''
      if (isTie(outcome)) return text('duel_tie', handEmoji(outcome.user))
      return text('duel_judge', handEmoji(outcome.user), handEmoji(outcome.app), handName(winningHand(outcome)))
    }
    case 'ROULETTE':
      return text('roulette_process', rank)
    case 'WHEEL':
      return text('verdict_wheel', rank)
    case 'VETO':
      return text('verdict_veto', duel.table?.cuts.length ?? duel.placeIds.length - 1)
    case 'SECRET_HANDS':
      return secretVerdictText(duel.table)
    case 'VOTE': {
      const vote = duel.vote
      if (!vote) return ''
      if (duel.tiedIndices.length > 0) return text('verdict_vote_tie')
      const winner = places[duel.winnerIndex ?? 0]
      return text('verdict_vote', votePieces(voteMarkersOf(vote), vote.counts), winner ? shortName(winner) : '')
    }
  }
}

/** 第二行（小字）：谁划掉了什么、每人出了什么、打平时的票数；其他 → null。 */
export function decisionRecord(duel: DuelState, places: readonly ResultItem[]): string | null {
  switch (duel.mode) {
    case 'VETO': {
      const table = duel.table
      if (!table) return null
      return table.cuts
        .map((id, index) => {
          const item = places.find((p) => p.place.id === id)
          const name = item ? shortName(item) : id
          return text('veto_record_item', avatarEmoji(outcomeCutter(table, index, duel.placeIds.length).avatar), name)
        })
        .join(SEPARATORS.dot)
    }
    case 'SECRET_HANDS': {
      const table = duel.table
      if (!table) return null
      return table.players
        .slice(0, table.hands.length)
        .map((player, i) => avatarEmoji(player.avatar) + handEmoji(table.hands[i] as HandId))
        .join(SEPARATORS.secretRecordGap)
    }
    case 'VOTE':
      return duel.vote && duel.tiedIndices.length > 0 ? votePieces(voteMarkersOf(duel.vote), duel.vote.counts) : null
    default:
      return null
  }
}


/** 分享用的「怎么定的」（用户在说话）。 */
export function decisionShared(duel: DuelState, places: readonly ResultItem[]): string {
  const outcome = duelOutcome(duel)
  switch (duel.mode) {
    case 'ROCK_PAPER_SCISSORS':
      if (!outcome) return ''
      if (isTie(outcome)) return text('share_process_tie', handEmoji(outcome.user))
      return text('share_process_rps', handEmoji(outcome.user), handEmoji(outcome.app), handName(winningHand(outcome)))
    case 'ROULETTE':
      return text('share_process_roulette')
    case 'WHEEL':
      return text('share_process_wheel', duel.placeIds.length)
    default:
      return decisionVerdict(duel, places, () => 0)
  }
}

/** 「✊ 4 票、✌️ 2 票、🖐️ 1 票」。 */
export function votePieces(markers: readonly string[], counts: readonly number[]): string {
  return markers.map((marker, i) => text('vote_piece', marker, counts[i] ?? 0)).join(SEPARATORS.list)
}

function secretVerdictText(table: TableOutcome | null): string {
  if (!table || table.hands.length === 0) return ''
  const emojis = (hand: HandId) =>
    table.players
      .slice(0, table.hands.length)
      .filter((_, i) => table.hands[i] === hand)
      .map((p) => avatarEmoji(p.avatar))
      .join('')
  const verdict = judgeSecretHands(table.hands)
  switch (verdict.kind) {
    case 'ALL_SAME':
      return text('verdict_all_same', handEmoji(verdict.hand))
    case 'TWO_KINDS':
      return text('verdict_two_kinds', emojis(verdict.winner), handEmoji(verdict.winner), emojis(verdict.loser), handEmoji(verdict.loser), handName(verdict.winner))
    case 'MAJORITY':
      return text('verdict_majority', handEmoji(verdict.hand), verdict.count, handName(verdict.hand))
    case 'TIE':
      return text('verdict_tie')
  }
}

/** 「🔒 这一餐定了」下面那句：饭桌 / 投票、剪刀石头布赢 / 平 / 输、帮我挑一家 / 转盘。 */
export function lockLine(duel: DuelState): string {
  if (isTableMode(duel.mode)) return text('lock_table')
  if (duel.mode === 'ROCK_PAPER_SCISSORS') {
    const verdict = verdictOf(duelOutcome(duel))
    if (verdict === 'WIN') return text('lock_win')
    if (verdict === 'TIE') return text('lock_tie')
    return text('duel_accept')
  }
  return text('lock_roulette')
}

/** 台词的字。 */
export function duelLineText(line: string | null): string | null {
  return line == null ? null : lineText(line) || null
}

/** 「🐼 熊猫 请大家喝拉茶 🧋」：转了谁来做才写人。 */
export function taskText(task: TaskDraw): string {
  const card = taskCardText(task.card)
  const who = task.spun ? taskAssignee(task) : null
  return who ? text('share_task_assigned', playerLabel(who), card) : card
}

/** ✂️ 划刀页的大标题。 */
export function vetoHeadline(options: {
  undoable: boolean
  finished: boolean
  lastCut: boolean
  /** 最后一刀是谁划的（玩家的「🐼 熊猫」）和划掉的店名。 */
  lastCutter: string | null
  lastCutName: string | null
  /** 轮到谁（「🐯 老虎」）。 */
  current: string
}): string {
  const { undoable, finished, lastCut, lastCutter, lastCutName, current } = options
  if (undoable && lastCutter != null && lastCutName != null && finished) return text('veto_cut_final', lastCutter, lastCutName)
  if (undoable && lastCutter != null && lastCutName != null) return text('veto_cut', lastCutter, lastCutName, current)
  if (finished && lastCutter != null && lastCutName != null) return text('veto_cut_final', lastCutter, lastCutName)
  if (lastCut) return text('veto_last_cut', current)
  return text('veto_turn', current)
}

// ================================================================ 分享文字

function hoursFact(status: OpenStatus, now: ZonedTime): string | null {
  const label = describeHours(status, now)
  switch (label.tone) {
    case 'OPEN':
      return label.detail ?? label.label
    case 'CLOSING_SOON':
    case 'CLOSED':
      return fullHoursLabel(label)
    case 'UNKNOWN':
      return null
  }
}

/** 「⭐4.6 · 离我 520 米 · RM8–15 · 开到晚上 10:00」（投票才写价钱）。 */
function facts(item: ResultItem, status: OpenStatus | null, now: ZonedTime, withPrice: boolean): string {
  const place = item.place
  const parts: string[] = []
  if (place.rating != null) parts.push(PREFIXES.ratingShare + formatFixed(place.rating, 1))
  parts.push(text('share_distance', formatDistance(place.distanceMeters)))
  if (withPrice) {
    const price = formatPrice(place.priceRange, place.priceLevel)
    if (price) parts.push(price)
  }
  const hours = status ? hoursFact(status, now) : null
  if (hours) parts.push(hours)
  return parts.join(SEPARATORS.dot)
}

/**
 * 「📤 发到群里投票」：「今晚吃哪家？回 ✊✌️🖐️ 投票！」+ 每家一行 + 署名；地图链接全部放最后（前面空一行）。
 * 演示第一行「【演示数据，不是真实的店】」。1 家：「午餐就吃这家？回 👍 或 👎！」。
 */
export function shareVote(places: readonly ResultItem[], statuses: readonly (OpenStatus | null)[], now: ZonedTime, isDemo: boolean): string {
  const lines: string[] = []
  if (isDemo) lines.push(text('share_demo_header'))
  const meal = text(key(dayPartData(dayPartAt(now.epochMillis, now.zone)).shareMealKey))
  const markers = voteMarkersOf({ placeIds: places.map((p) => p.place.id), counts: [] })
  lines.push(places.length === 1 ? text('share_vote_title_one', meal) : text('share_vote_title', meal, markers.join('')))
  const marker = (index: number) => (places.length === 1 ? PREFIXES.singleShareMarker : (markers[index] ?? ''))
  places.forEach((item, index) => {
    lines.push(`${marker(index)} ${displayName(item)} ${facts(item, statuses[index] ?? null, now, true)}`)
  })
  lines.push(text('share_signature'))
  lines.push('')
  lines.push(text('share_map_header'))
  places.forEach((item, index) => lines.push(`${marker(index)} ${shareUrl(item.place)}`))
  return cleanForShare(lines.join('\n'))
}

/**
 * 「📤 告诉朋友」：「美食剪刀布帮我们决定了：今天吃『…』！」、怎么定的 —— 台词、记录、任务卡、资料（不写价钱）、署名；
 * 最后空一行再一行地图链接。
 */
export function shareDecision(
  item: ResultItem,
  duel: DuelState,
  places: readonly ResultItem[],
  status: OpenStatus | null,
  now: ZonedTime,
  isDemo: boolean,
): string {
  const lines: string[] = []
  if (isDemo) lines.push(text('share_demo_header'))
  lines.push(text('share_decision_title', displayName(item)))
  const how = decisionShared(duel, places)
  const line = duelLineText(duel.line)
  lines.push(line != null && how !== '' ? text('share_process_line', how, line) : how || (line ?? ''))
  const record = decisionRecord(duel, places)
  if (record != null) lines.push(record)
  if (duel.task) lines.push(text('share_task', taskText(duel.task)))
  lines.push(facts(item, status, now, false))
  lines.push(text('share_signature'))
  const body = lines.filter((l) => l.trim() !== '')
  return cleanForShare([...body, '', text('share_map', shareUrl(item.place))].join('\n'))
}

/** 「📤 发到群里比一比」：四行。 */
export function shareFortune(stickIndex: number): string {
  const stick = fortuneStick(stickIndex)
  return cleanForShare(text('fortune_share_text', fortuneLevelName(stickIndex), fortuneLevelEmoji(stickIndex), stick.yi, stick.ji))
}

// ================================================================ 错误页

export type ErrorAction =
  | 'OPEN_SETTINGS'
  | 'RETRY'
  | 'GRANT_LOCATION'
  /** 网页：浏览器挡住了定位 →「怎么打开？」的步骤。 */
  | 'LOCATION_HELP'
  | 'EXPAND_RADIUS'
  | 'SEARCH_ANY_CUISINE'
  | 'RESCUE_REROLL'
  /** 网页：存储被挡 →「🧪 开演示」。 */
  | 'TURN_ON_DEMO'

export interface ErrorButton {
  readonly label: string
  readonly action: ErrorAction
  /** 按钮下面的小字（会不会用次数）。 */
  readonly note: string | null
  /** 扩大范围要扩到几公里。 */
  readonly radiusKm?: number
}

export interface ErrorScreenModel {
  readonly emoji: string
  readonly title: string
  readonly message: string
  /** 「Google 原文：…」（只有 Google 错误）。 */
  readonly detail: string | null
  readonly primary: ErrorButton | null
  readonly secondary: ErrorButton | null
  /** 「🎲 换个菜系再摇」+「摇多少次都不扣免费次数」（附近没找到才有）。 */
  readonly reroll: ErrorButton | null
}

function httpHint(problem: HttpProblem): string {
  switch (problem) {
    case 'KEY_INVALID':
      return text('hint_key_invalid')
    case 'ANDROID_APP_BLOCKED':
      return text('hint_android_blocked')
    case 'REFERRER_BLOCKED':
      return webText('hint_referrer_blocked')
    case 'SERVICE_BLOCKED':
      return text('hint_service_blocked')
    case 'SERVICE_DISABLED':
      return text('hint_service_disabled')
    case 'BILLING':
      return text('hint_billing')
    case 'RATE_LIMITED':
      return text('hint_quota')
    case 'SERVER':
      return text('hint_server')
    case 'OTHER':
      return text('hint_generic')
  }
}

const RETRY_BUTTON = (): ErrorButton => ({ label: text('action_retry'), action: 'RETRY', note: null })

/** 错误页的内容（安卓 ErrorScreen；网页：定位被挡改说浏览器、定位服务分不出来、多了存储被挡）。 */
export function errorScreen(choice: SearchChoice | null, error: SearchError, demoMode: boolean, env: LocationEnvironment = 'OK'): ErrorScreenModel {
  const base = { detail: null, primary: null, secondary: null, reroll: null }
  switch (error.kind) {
    case 'NO_API_KEY':
      return { ...base, emoji: ERROR_EMOJI.NoApiKey, title: text('err_no_key_title'), message: text('err_no_key_msg'), primary: { label: text('open_settings'), action: 'OPEN_SETTINGS', note: null } }
    case 'INVALID_API_KEY':
      return { ...base, emoji: ERROR_EMOJI.InvalidApiKey, title: text('err_invalid_key_title'), message: text('err_invalid_key_msg'), primary: { label: text('open_settings'), action: 'OPEN_SETTINGS', note: null } }
    case 'QUOTA_EXHAUSTED':
      return {
        ...base,
        emoji: ERROR_EMOJI.QuotaExhausted,
        title: text('err_quota_title'),
        message: text('err_quota_msg', QUOTA.SEARCHES_PER_MONTH, QUOTA.QUERIES_PER_SEARCH, QUOTA.TEXT_SEARCH_MONTHLY_LIMIT, QUOTA.GOOGLE_FREE_TEXT_SEARCH),
      }
    case 'STORAGE_BLOCKED':
      return {
        ...base,
        emoji: '🔒',
        title: webText('web_storage_blocked').split('，')[0] ?? webText('web_storage_blocked'),
        message: webText('web_storage_blocked'),
        primary: demoMode ? null : { label: text('no_key_demo_button'), action: 'TURN_ON_DEMO', note: text('rescue_expand_note_demo') },
      }
    case 'PERMISSION_NEEDED':
      if (env !== 'OK') {
        const help = locationHelp(env)
        return { ...base, emoji: ERROR_EMOJI.PermissionNeeded, title: (help.steps[0] ?? '').replace(/^📍\s*/u, ''), message: help.steps[1] ?? '', primary: null }
      }
      return error.permanently
        ? { ...base, emoji: ERROR_EMOJI.PermissionNeeded, title: text('err_permission_title'), message: text('err_permission_permanent_msg'), primary: { label: text('action_open_app_settings'), action: 'LOCATION_HELP', note: null }, secondary: RETRY_BUTTON() }
        : { ...base, emoji: ERROR_EMOJI.PermissionNeeded, title: text('err_permission_title'), message: text('permission_explain'), primary: { label: text('action_grant_location'), action: 'GRANT_LOCATION', note: null } }
    case 'LOCATION_SERVICES_OFF':
    case 'LOCATION_UNAVAILABLE':
      // 网页分不出「定位服务没开」：合成「拿不到你的位置」，正文提醒看看手机的定位开关。
      return { ...base, emoji: ERROR_EMOJI.LocationUnavailable, title: text('err_location_title'), message: text('err_location_msg'), primary: RETRY_BUTTON() }
    case 'NETWORK':
      return { ...base, emoji: ERROR_EMOJI.Network, title: text('err_network_title'), message: text('err_network_msg'), primary: RETRY_BUTTON() }
    case 'BAD_RESPONSE':
      return { ...base, emoji: ERROR_EMOJI.BadResponse, title: text('err_bad_response_title'), message: text('err_bad_response_msg'), primary: RETRY_BUTTON() }
    case 'HTTP': {
      const problem = problemOf(error)
      const settings: ErrorButton = { label: text('open_settings'), action: 'OPEN_SETTINGS', note: null }
      const withSettings = problem === 'KEY_INVALID' || problem === 'ANDROID_APP_BLOCKED' || problem === 'REFERRER_BLOCKED' || problem === 'SERVICE_BLOCKED'
      return {
        ...base,
        emoji: ERROR_EMOJI.Http,
        title: text('err_http_title', error.code),
        message: httpHint(problem),
        detail: error.googleMessage ? text('err_google_original', error.googleMessage) : null,
        primary: withSettings ? settings : problem === 'BILLING' ? null : RETRY_BUTTON(),
        secondary: withSettings ? RETRY_BUTTON() : null,
      }
    }
    case 'NO_RESULTS': {
      const km = formatKm(error.radiusKm)
      const specific = choice != null && isSpecific(choice.cuisine)
      let title: string
      if (specific) title = text('err_no_results_title_choice', km, choiceLabel(choice))
      else if (choice?.meal === 'RICE') title = text('err_no_results_title_rice', km)
      else if (choice?.meal === 'NOODLE') title = text('err_no_results_title_noodle', km)
      else title = text('err_no_results_title_any', km)
      const larger = error.largerRadiusKm
      return {
        emoji: ERROR_EMOJI.NoResults,
        title,
        message: larger != null ? text('err_no_results_msg') : text('err_no_results_max_msg'),
        detail: null,
        primary:
          larger != null
            ? { label: text('expand_radius', formatKm(larger)), action: 'EXPAND_RADIUS', note: searchCostNote(demoMode), radiusKm: larger }
            : null,
        secondary: specific
          ? { label: text('try_any_cuisine'), action: 'SEARCH_ANY_CUISINE', note: demoMode ? null : text('try_any_cuisine_note') }
          : null,
        reroll: { label: text('rescue_reroll'), action: 'RESCUE_REROLL', note: text('rescue_reroll_note') },
      }
    }
  }
}

/** 加载页小字：定位中 / 演示 / 真实。 */
export function loadingNote(phase: 'LOCATING' | 'SEARCHING', isDemo: boolean): string {
  if (phase === 'LOCATING') return text('loading_locating')
  return text(isDemo ? 'loading_demo' : 'loading_searching')
}

/** 这次搜索的 emoji（加载页的大图、没照片的店的占位图）。 */
export { choiceEmoji } from '../domain/cuisine.ts'
