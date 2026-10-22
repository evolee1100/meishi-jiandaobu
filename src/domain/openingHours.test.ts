import { describe, expect, it } from 'vitest'
import { describeHours, fullHoursLabel } from '../app/texts.ts'
import { normalizeResults } from '../app/session.ts'
import { toPlace, parseTimestamp } from '../services/placesRepository.ts'
import { KL, klAt, klMillis, plain, testPlace } from '../test/helpers.ts'
import type { OpeningHours, Place, WeeklyPeriod } from './model.ts'
import {
  canGoAt,
  closed,
  fromPeriods,
  isAllDay,
  isClosed,
  isClosingSoon,
  minutesUntilClose,
  open,
  openStatus,
  placeStatus,
  NO_CLOCK,
  statusAt,
  statusClockOf,
  UNKNOWN,
  weeklyPeriod,
} from './openingHours.ts'

const center = { latitude: 3.144, longitude: 101.6979 }

/** Google periods 的写法：每天 openH:00–closeH:00（关门早于开门 = 第二天）。 */
function dailyPeriods(openH: number, closeH: number, skipDays: number[] = []): unknown[] {
  return [0, 1, 2, 3, 4, 5, 6]
    .filter((d) => !skipDays.includes(d))
    .map((day) => {
      const closeDay = closeH <= openH ? (day + 1) % 7 : day
      return {
        open: { day, hour: openH, minute: 0, date: { year: 2026, month: 10, day: 4 + day } },
        close: { day: closeDay, hour: closeH, minute: 0, date: { year: 2026, month: 10, day: 4 + closeDay } },
      }
    })
}

function place(hours: unknown | null): Place {
  const dto = {
    id: 'ChIJtest',
    displayName: { text: '测试店' },
    location: { latitude: 3.145, longitude: 101.698 },
    rating: 4.5,
    userRatingCount: 300,
    types: ['restaurant', 'food'],
    ...(hours == null ? {} : { currentOpeningHours: hours }),
  }
  const p = toPlace(dto, center)
  if (!p) throw new Error('bad place')
  return p
}

/** 每天 openH:openM–closeH:closeM（关门不晚于开门 = 半夜后）。 */
function daily(openH: number, openM: number, closeH: number, closeM: number): WeeklyPeriod[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const overnight = closeH * 60 + closeM <= openH * 60 + openM
    return weeklyPeriod(day, openH, openM, overnight ? (day + 1) % 7 : day, closeH, closeM)
  })
}

describe('九、营业时间：计算（时间固定在 2026-10-06 星期二吉隆坡）', () => {
  it('HOURS-01 营业中、有下次关门时间：19:30 搜，开到 22:00；21:25 时快关门、还有 35 分钟', () => {
    const p = place({ openNow: true, periods: dailyPeriods(11, 22), weekdayDescriptions: ['星期一: 11:00 – 22:00'], nextCloseTime: '2026-10-06T14:00:00Z' })
    expect(p.openNow).toBe(true)
    const hours = p.openingHours as OpeningHours
    expect(hours.periods).toHaveLength(7)
    expect(hours.nextCloseMillis).toBe(klMillis(6, 22))
    expect(hours.nextOpenMillis).toBeNull()
    const status = placeStatus(p, klAt(6, 19, 30))
    expect(status).toEqual(open(klAt(6, 22)))
    expect(isClosingSoon(status, klAt(6, 19, 30))).toBe(false)
    expect(isClosingSoon(status, klAt(6, 21, 25))).toBe(true)
    expect(minutesUntilClose(status, klAt(6, 21, 25))).toBe(35)
  })

  it('HOURS-02 只有一个星期日 00:00 开门、没有关门的时段 = 24 小时营业；连 day/hour 都省略的写法也一样', () => {
    const p = place({ openNow: true, periods: [{ open: { day: 0, hour: 0, minute: 0 } }], weekdayDescriptions: ['星期一: 24 小时营业'] })
    for (const time of [klAt(6, 2), klAt(6, 12), klAt(10, 23, 59)]) expect(placeStatus(p, time)).toEqual(open(null, true))
    const bare = place({ openNow: true, periods: [{ open: {} }] })
    expect(placeStatus(bare, klAt(6, 4))).toEqual(open(null, true))
  })

  it('HOURS-03 跨半夜：星期二 23:30 开到星期三 02:00；星期日 01:00 还是星期六晚上那一段；02:00 整点已经休息', () => {
    const p = place({ openNow: true, periods: dailyPeriods(17, 2), nextCloseTime: '2026-10-06T18:00:00Z' })
    expect(placeStatus(p, klAt(6, 23, 30))).toEqual(open(klAt(7, 2)))
    const periods = (p.openingHours as OpeningHours).periods
    expect(fromPeriods(periods, klAt(11, 1))).toEqual(open(klAt(11, 2)))
    expect(fromPeriods(periods, klAt(10, 23))).toEqual(open(klAt(11, 2)))
    expect(fromPeriods(periods, klAt(7, 2))).toEqual(closed(klAt(7, 17)))
  })

  it('HOURS-04 休息中、有下次开门时间：15:30 显示 17:00 开', () => {
    const p = place({ openNow: false, periods: dailyPeriods(17, 2), nextOpenTime: '2026-10-06T09:00:00Z' })
    expect(p.openNow).toBe(false)
    const status = placeStatus(p, klAt(6, 15, 30))
    expect(status).toEqual(closed(klAt(6, 17)))
    expect(isClosed(status)).toBe(true)
  })

  it('HOURS-05 完全没有营业资料 = 不明；只有 openNow=true 没有时间 = 营业中（不知道开到几点）', () => {
    const p = place(null)
    expect(p.openNow).toBeNull()
    expect(p.openingHours).toBeNull()
    expect(placeStatus(p, klAt(6, 12))).toEqual(UNKNOWN)
    const flagOnly = place({ openNow: true })
    expect(flagOnly.openingHours).toBeNull()
    expect(placeStatus(flagOnly, klAt(6, 12))).toEqual(open())
  })

  it('HOURS-06 9:50 搜、10:05 再看：10 点关门的店变成休息中、明天 7:00 开；没有时钟用 openNow；只有关门时间没有时段的过了就是休息中', () => {
    const p = place({ openNow: true, periods: dailyPeriods(7, 10), nextCloseTime: '2026-10-06T02:00:00Z' })
    expect(isClosingSoon(placeStatus(p, klAt(6, 9, 50)), klAt(6, 9, 50))).toBe(true)
    expect(placeStatus(p, klAt(6, 10, 5))).toEqual(closed(klAt(7, 7)))
    expect(isClosed(statusAt(p, statusClockOf(klMillis(6, 10, 5), KL)))).toBe(true)
    expect(isClosed(statusAt(p, statusClockOf(klMillis(6, 9, 50), KL)))).toBe(false)
    expect(statusAt(p, NO_CLOCK)).toEqual(open())
    const noPeriods = place({ openNow: true, nextCloseTime: '2026-10-06T02:00:00Z' })
    expect(placeStatus(noPeriods, klAt(6, 10, 5))).toEqual(closed())
  })

  it('HOURS-07 中午休息的店（11:00–14:30、17:00–02:00）：14:20 还有 10 分钟；14:45 休息中 · 下午 5:00 开；17:05 营业中 · 开到凌晨 2:00，可以玩', () => {
    const hours: OpeningHours = { periods: [...daily(11, 0, 14, 30), ...daily(17, 0, 2, 0)], nextOpenMillis: null, nextCloseMillis: klMillis(6, 14, 30) }
    expect(minutesUntilClose(openStatus(true, hours, klAt(6, 14, 20)), klAt(6, 14, 20))).toBe(10)
    expect(openStatus(true, hours, klAt(6, 14, 45))).toEqual(closed(klAt(6, 17)))
    expect(plain(fullHoursLabel(describeHours(openStatus(true, hours, klAt(6, 14, 45)), klAt(6, 14, 45))))).toBe('休息中 · 下午 5:00 开')
    const evening = openStatus(true, hours, klAt(6, 17, 5))
    expect(evening).toEqual(open(klAt(7, 2)))
    expect(plain(fullHoursLabel(describeHours(evening, klAt(6, 17, 5))))).toBe('营业中 · 开到凌晨 2:00')
    const seafood = { ...testPlace('seafood'), openNow: true, openingHours: hours }
    const clock = statusClockOf(klMillis(6, 17, 10), KL)
    expect(isClosed(statusAt(seafood, clock))).toBe(false)
    expect(canGoAt(seafood, clock)).toBe(true)
  })

  it('HOURS-08 早餐档（06:00–09:30）：05:40 是 6:00 开；8:00 开到 9:30；9:45 休息中 · 明天早上 6:00 开、不能去；没有时段只能把开关翻过来', () => {
    const hours: OpeningHours = { periods: daily(6, 0, 9, 30), nextOpenMillis: klMillis(6, 6), nextCloseMillis: null }
    expect(openStatus(false, hours, klAt(6, 5, 40))).toEqual(closed(klAt(6, 6)))
    expect(openStatus(false, hours, klAt(6, 8))).toEqual(open(klAt(6, 9, 30)))
    const later = openStatus(false, hours, klAt(6, 9, 45))
    expect(later).toEqual(closed(klAt(7, 6)))
    expect(plain(fullHoursLabel(describeHours(later, klAt(6, 9, 45))))).toBe('休息中 · 明天早上 6:00 开')
    const stall = { ...testPlace('breakfast'), openNow: false, openingHours: hours }
    expect(canGoAt(stall, statusClockOf(klMillis(6, 9, 45), KL))).toBe(false)
    expect(openStatus(false, { periods: [], nextOpenMillis: klMillis(6, 6), nextCloseMillis: null }, klAt(6, 9, 45))).toEqual(open())
  })

  it('HOURS-09 星期五休息的店，星期四下午显示星期六 7:00 开；时间戳带小数秒或时区都读得懂，读不懂返回空', () => {
    const p = place({ openNow: false, periods: dailyPeriods(7, 14, [5]) })
    expect(placeStatus(p, klAt(8, 15))).toEqual(closed(klAt(10, 7)))
    expect(parseTimestamp('2026-10-06T14:00:00.000Z')).not.toBeNull()
    expect(parseTimestamp('2026-10-06T14:00:00Z')).toBe(parseTimestamp('2026-10-06T22:00:00+08:00'))
    expect(parseTimestamp('not a time')).toBeNull()
    expect(parseTimestamp('')).toBeNull()
  })

  it('HOURS-10 首尾相接的时段当成一段（只有星期一、二全天开：星期一中午开到星期三 00:00），不算 24 小时；七天首尾相接才算', () => {
    const periods = [weeklyPeriod(1, 0, 0, 2, 0, 0), weeklyPeriod(2, 0, 0, 3, 0, 0)]
    expect(fromPeriods(periods, klAt(5, 12))).toEqual(open(klAt(7, 0)))
    expect(isAllDay(periods)).toBe(false)
    const everyDay = [0, 1, 2, 3, 4, 5, 6].map((d) => weeklyPeriod(d, 0, 0, (d + 1) % 7, 0, 0))
    expect(isAllDay(everyDay)).toBe(true)
    expect(fromPeriods(everyDay, klAt(6, 3))).toEqual(open(null, true))
  })

  it('HOURS-11 旧版本存下的结果（没有营业时间字段）照样读得出来，openNow=false 当作休息中', () => {
    const old = {
      kind: 'RESULTS',
      choice: { cuisine: 'ANY', meal: 'RICE' },
      radiusKm: 1.5,
      ranked: [
        {
          rank: 1,
          photo: { kind: 'NONE' },
          place: { id: 'x', name: '旧店', address: null, location: { latitude: 1, longitude: 2 }, distanceMeters: 300, rating: 4, userRatingCount: 10, priceLevel: null, priceRange: null, openNow: false, businessStatus: null, photoName: null, photoAuthor: null, googleMapsUri: null, primaryType: null, primaryTypeDisplayName: null, types: [] },
        },
      ],
    }
    const results = normalizeResults(old)
    const p = results?.ranked[0]?.place
    expect(p?.openingHours).toBeNull()
    expect(p && isClosed(statusAt(p, statusClockOf(klMillis(6, 12), KL)))).toBe(true)
  })
})
