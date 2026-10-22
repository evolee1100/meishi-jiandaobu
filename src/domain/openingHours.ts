/**
 * 营业时间：某个时刻开着没、开到几点、快关门、来不及（安卓 domain/OpeningHours.kt）。
 * 全部在手机里算：搜索时 Google 一起送来的每周时段 + 下次开门 / 关门时间，之后时间怎么走都不再请求。
 */
import { HOURS } from '../data/constants.ts'
import type { OpeningHours, Place, WeeklyPeriod } from './model.ts'
import { travelMinutes } from './travel.ts'
import { floorMod, isValidZone, localFields, MINUTE_MS, truncateToMinute, type ZonedTime } from './time.ts'

export const MINUTES_PER_DAY = 24 * 60
export const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY

/** [day] 0 = 星期日 … 6 = 星期六（Google 的写法），[hour] 可以是 24（= 半夜）。 */
export function minuteOfWeek(day: number, hour: number, minute: number): number {
  return floorMod(day * MINUTES_PER_DAY + hour * 60 + minute, MINUTES_PER_WEEK)
}

/** 一个每周时段；没有关门（closeDay = null）= 24 小时营业。 */
export function weeklyPeriod(
  openDay: number,
  openHour: number,
  openMinute: number,
  closeDay: number | null,
  closeHour: number | null = 0,
  closeMinute: number | null = 0,
): WeeklyPeriod {
  return [
    minuteOfWeek(openDay, openHour, openMinute),
    closeDay == null ? null : minuteOfWeek(closeDay, closeHour ?? 0, closeMinute ?? 0),
  ]
}

export function emptyHours(): OpeningHours {
  return { periods: [], nextOpenMillis: null, nextCloseMillis: null }
}

export function isEmptyHours(hours: OpeningHours): boolean {
  return hours.periods.length === 0 && hours.nextOpenMillis == null && hours.nextCloseMillis == null
}

// ------------------------------------------------------------------ 状态

export type OpenStatus =
  /** 完全没有营业资料 =「营业时间不明」。 */
  | { readonly kind: 'UNKNOWN' }
  /** 营业中；closesAt = null 是不知道几点关；allDay =「24 小时营业」。 */
  | { readonly kind: 'OPEN'; readonly closesAt: ZonedTime | null; readonly allDay: boolean }
  /** 休息中；opensAt = null 是不知道几点开。 */
  | { readonly kind: 'CLOSED'; readonly opensAt: ZonedTime | null }

export const UNKNOWN: OpenStatus = { kind: 'UNKNOWN' }

export function open(closesAt: ZonedTime | null = null, allDay = false): OpenStatus {
  return { kind: 'OPEN', closesAt, allDay }
}

export function closed(opensAt: ZonedTime | null = null): OpenStatus {
  return { kind: 'CLOSED', opensAt }
}

export function isClosed(status: OpenStatus): boolean {
  return status.kind === 'CLOSED'
}

/** 到关门还有几分钟（整分钟、往上取整、至少 1）；不是营业中、不知道几点关、24 小时营业、已经到了 → null。 */
export function minutesUntilClose(status: OpenStatus, now: ZonedTime): number | null {
  if (status.kind !== 'OPEN' || status.closesAt == null || status.allDay) return null
  const seconds = Math.floor((status.closesAt.epochMillis - now.epochMillis) / 1000)
  return seconds <= 0 ? null : Math.floor((seconds + 59) / 60)
}

/** 一个钟头内关门（橙色「⏰ 还有 35 分钟关门」）。 */
export function isClosingSoon(status: OpenStatus, now: ZonedTime): boolean {
  const minutes = minutesUntilClose(status, now)
  return minutes != null && minutes <= HOURS.CLOSING_SOON_MINUTES
}

/** 半小时内关门：小贩档多半已经不收单（「可能停止点餐了」）。 */
export function mayHaveStoppedOrders(status: OpenStatus, now: ZonedTime): boolean {
  const minutes = minutesUntilClose(status, now)
  return minutes != null && minutes <= HOURS.LAST_ORDERS_MINUTES
}

/** 走到 / 骑到、再留 20 分钟点菜之前就会关门（剩下的分钟 < 路上分钟 + 20）。 */
export function closesBeforeArrival(status: OpenStatus, now: ZonedTime, travel: number): boolean {
  const minutes = minutesUntilClose(status, now)
  return minutes != null && minutes < travel + HOURS.ORDER_MARGIN_MINUTES
}

// ------------------------------------------------------------------ 计算

/** 当地时间从星期日 00:00 起的第几分钟。 */
export function minuteOfWeekAt(now: ZonedTime): number {
  const f = localFields(now.epochMillis, now.zone)
  return minuteOfWeek(f.dayOfWeek % 7, f.hour, f.minute)
}

/** [开, 关)（分钟，关可以超过一周的长度）；24 小时的时段（没有关门）不算在内。 */
function intervals(periods: readonly WeeklyPeriod[]): [number, number][] {
  const result: [number, number][] = []
  for (const [openAt, closeAt] of periods) {
    if (closeAt == null) continue
    result.push([openAt, closeAt <= openAt ? closeAt + MINUTES_PER_WEEK : closeAt])
  }
  return result
}

/** 时段整周都覆盖：有没关门的时段，或者从星期日 00:00 起首尾相接一直接到一周结束。 */
export function isAllDay(periods: readonly WeeklyPeriod[]): boolean {
  if (periods.some((p) => p[1] == null)) return true
  const list = intervals(periods)
  let reached = 0
  let progressed = true
  while (progressed && reached < MINUTES_PER_WEEK) {
    progressed = false
    for (const [start, end] of list) {
      if (start <= reached && end > reached) {
        reached = end
        progressed = true
      }
    }
  }
  return reached >= MINUTES_PER_WEEK
}

function plusMinutes(base: ZonedTime, minutes: number): ZonedTime {
  return { epochMillis: base.epochMillis + minutes * MINUTE_MS, zone: base.zone }
}

/** 只看每周时段的状态；没有时段 → null。 */
export function fromPeriods(periods: readonly WeeklyPeriod[], now: ZonedTime): OpenStatus | null {
  if (periods.length === 0) return null
  if (isAllDay(periods)) return open(null, true)
  const list = intervals(periods)
  const nowMinute = minuteOfWeekAt(now)
  const base: ZonedTime = { epochMillis: truncateToMinute(now.epochMillis, now.zone), zone: now.zone }
  // 在某一段里吗？（也包括上星期开始、跨过星期日 00:00 的那一段）
  for (const m of [nowMinute, nowMinute + MINUTES_PER_WEEK]) {
    const hit = list.find(([start, end]) => m >= start && m < end)
    if (!hit) continue
    let end = hit[1]
    // 首尾相接的时段当成一段（某几天 24 小时营业的店）。
    let steps = 0
    while (steps++ < list.length) {
      const next = list.find(([start]) => start === floorMod(end, MINUTES_PER_WEEK))
      if (!next) break
      end += next[1] - next[0]
    }
    return open(plusMinutes(base, end - m))
  }
  // 休息中：最近的一次开门（刚好现在开门的算下星期，因为现在不在任何一段里）。
  let wait = Number.POSITIVE_INFINITY
  for (const [start] of list) {
    const delta = floorMod(start - nowMinute, MINUTES_PER_WEEK)
    wait = Math.min(wait, delta === 0 ? MINUTES_PER_WEEK : delta)
  }
  return closed(plusMinutes(base, wait))
}

function at(epochMillis: number, zone: string): ZonedTime {
  return { epochMillis, zone }
}

/**
 * 某个时刻开着没：Google 的下次关门 / 开门时间还没到就照它；过了就看每周时段
 * （午休后又开、早餐档又关了）；连时段都没有就把搜索时的开关翻过来。
 */
export function openStatus(openNow: boolean | null, hours: OpeningHours | null, now: ZonedTime): OpenStatus {
  const periods = hours?.periods ?? []
  const zone = now.zone
  const nowMillis = now.epochMillis
  if (periods.length > 0 && isAllDay(periods) && openNow !== false) return open(null, true)
  const nextClose = hours?.nextCloseMillis ?? null
  const nextOpen = hours?.nextOpenMillis ?? null
  if (openNow === true) {
    if (nextClose != null && nowMillis < nextClose) return open(at(nextClose, zone))
    if (nextClose != null) {
      return fromPeriods(periods, now) ?? closed(nextOpen != null && nextOpen > nowMillis ? at(nextOpen, zone) : null)
    }
    return fromPeriods(periods, now) ?? open()
  }
  if (openNow === false) {
    if (nextOpen != null && nowMillis < nextOpen) return closed(at(nextOpen, zone))
    if (nextOpen != null) return fromPeriods(periods, now) ?? open()
    return fromPeriods(periods, now) ?? closed()
  }
  return fromPeriods(periods, now) ?? UNKNOWN
}

export function placeStatus(place: Place, now: ZonedTime): OpenStatus {
  return openStatus(place.openNow, place.openingHours, now)
}

/** 演示店用：照每周时段，像 Google 一样只给一个（开着给下次关门、关着给下次开门）。 */
export function nextTimes(periods: readonly WeeklyPeriod[], now: ZonedTime): { nextOpenMillis: number | null; nextCloseMillis: number | null } {
  const status = fromPeriods(periods, now)
  if (status?.kind === 'OPEN') return { nextOpenMillis: null, nextCloseMillis: status.closesAt?.epochMillis ?? null }
  if (status?.kind === 'CLOSED') return { nextOpenMillis: status.opensAt?.epochMillis ?? null, nextCloseMillis: null }
  return { nextOpenMillis: null, nextCloseMillis: null }
}

// ------------------------------------------------------------------ 结果的时钟

/**
 * 画面上的营业状态是按哪个时刻（和手机时区）算的：跟结果放在一起，列表、筛选、游戏才永远一致。
 * epochMillis = 0 表示「照 Google 搜索时说的」。
 */
export interface StatusClock {
  readonly epochMillis: number
  readonly zoneId: string
}

export const NO_CLOCK: StatusClock = { epochMillis: 0, zoneId: '' }

export function statusClockOf(epochMillis: number, zone: string): StatusClock {
  return { epochMillis, zoneId: zone }
}

export function clockZoned(clock: StatusClock): ZonedTime | null {
  if (clock.epochMillis <= 0 || !clock.zoneId) return null
  if (!isValidZone(clock.zoneId)) return null
  return { epochMillis: clock.epochMillis, zone: clock.zoneId }
}

/** 这家店在结果时钟那一刻的状态；没有时钟就照 Google 搜索时的 openNow。 */
export function statusAt(place: Place, clock: StatusClock): OpenStatus {
  const now = clockZoned(clock)
  if (now) return placeStatus(place, now)
  if (place.openNow === true) return open()
  if (place.openNow === false) return closed()
  return UNKNOWN
}

/**
 * 「能去」：不是休息中（营业中、营业时间不明都算），而且不会在走到、点好菜之前关门。
 * 只有能去的店才能圈 ❤️、进游戏。
 */
export function canGoAt(place: Place, clock: StatusClock): boolean {
  const status = statusAt(place, clock)
  if (isClosed(status)) return false
  const now = clockZoned(clock)
  if (!now) return true
  return !closesBeforeArrival(status, now, travelMinutes(place.distanceMeters))
}

/** 开着，但走到、点菜之前就会关门。 */
export function closesBeforeArrivalAt(place: Place, clock: StatusClock): boolean {
  const now = clockZoned(clock)
  if (!now) return false
  return closesBeforeArrival(statusAt(place, clock), now, travelMinutes(place.distanceMeters))
}
