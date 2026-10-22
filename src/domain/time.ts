/**
 * 带时区的时间（安卓用 java.time 的 ZonedDateTime / LocalDate）。
 *
 * 网页里时间一律是「毫秒 + 时区名」（例如 1791183600000 + 'Asia/Kuala_Lumpur'），
 * 需要「当地几点、星期几、哪一天」时才用 Intl 算出来。营业时间、问候、饭签、去过记录都按手机时区的当地时间算；
 * 用量的月份按美国洛杉矶时间算。测试一律把时区写死，不依赖跑测试那台电脑的时区。
 */

/** 某个时刻 + 时区：ZonedDateTime 的网页版。 */
export interface ZonedTime {
  readonly epochMillis: number
  readonly zone: string
}

/** 当地的年月日时分秒，和星期（ISO：1 = 星期一 … 7 = 星期日）。 */
export interface LocalFields {
  year: number
  /** 1–12 */
  month: number
  /** 1–31 */
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
  /** ISO：1 = 星期一 … 7 = 星期日（java.time DayOfWeek.getValue()）。 */
  dayOfWeek: number
  /** 1970-01-01 起的天数（LocalDate.toEpochDay()）。 */
  epochDay: number
}

export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(zone: string): Intl.DateTimeFormat {
  let dtf = formatters.get(zone)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      era: 'short',
    })
    formatters.set(zone, dtf)
  }
  return dtf
}

/** 时区名是不是浏览器认得的（ZoneId.of 失败 = 不认得）。 */
export function isValidZone(zone: string): boolean {
  if (!zone) return false
  try {
    formatterFor(zone)
    return true
  } catch {
    return false
  }
}

/** 这台设备（浏览器）的时区，例如 'Asia/Kuala_Lumpur'（安卓 ZoneId.systemDefault()）。 */
export function systemZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && isValidZone(zone) ? zone : 'UTC'
  } catch {
    return 'UTC'
  }
}

/** 按 15 分钟一格缓存时区的 UTC 偏移（时区切换都在整刻钟上），营业时间要算很多次，不能每次都用 Intl。 */
const offsetCache = new Map<string, number>()
const OFFSET_BUCKET_MS = 15 * MINUTE_MS

function computeOffsetMinutes(zone: string, epochMillis: number): number {
  const parts = formatterFor(zone).formatToParts(new Date(epochMillis))
  let year = 0
  let month = 1
  let day = 1
  let hour = 0
  let minute = 0
  let second = 0
  let bc = false
  for (const part of parts) {
    switch (part.type) {
      case 'year':
        year = Number(part.value)
        break
      case 'month':
        month = Number(part.value)
        break
      case 'day':
        day = Number(part.value)
        break
      case 'hour':
        hour = Number(part.value)
        break
      case 'minute':
        minute = Number(part.value)
        break
      case 'second':
        second = Number(part.value)
        break
      case 'era':
        bc = part.value.startsWith('B')
        break
      default:
        break
    }
  }
  if (bc) year = 1 - year
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const whole = Math.floor(epochMillis / 1000) * 1000
  return Math.round((asUtc - whole) / MINUTE_MS)
}

/** 某个时刻在某个时区的 UTC 偏移（分钟），例如吉隆坡 +480。 */
export function offsetMinutes(zone: string, epochMillis: number): number {
  if (zone === 'UTC' || zone === 'Etc/UTC') return 0
  const bucket = Math.floor(epochMillis / OFFSET_BUCKET_MS)
  const key = zone + '|' + bucket
  let offset = offsetCache.get(key)
  if (offset === undefined) {
    offset = computeOffsetMinutes(zone, bucket * OFFSET_BUCKET_MS)
    if (offsetCache.size > 50_000) offsetCache.clear()
    offsetCache.set(key, offset)
  }
  return offset
}

/** 当地的日期时间（Instant.atZone）。 */
export function localFields(epochMillis: number, zone: string): LocalFields {
  const shifted = epochMillis + offsetMinutes(zone, epochMillis) * MINUTE_MS
  const date = new Date(shifted)
  const epochDay = Math.floor(shifted / DAY_MS)
  const utcDay = date.getUTCDay() // 0 = 星期日
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
    dayOfWeek: utcDay === 0 ? 7 : utcDay,
    epochDay,
  }
}

/**
 * 当地的某年某月某日几点几分 → 时刻（LocalDateTime.atZone）。
 * 夏令时跳过的那一小时往后推、重复的那一小时取较早的一个（和 java.time 一样）。
 */
export function epochFromLocal(
  zone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number {
  const local = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  // 先用前后两个偏移试，取「换回当地时间对得上」的；都对不上（夏令时跳过的时间）就用较早的偏移往后推。
  const before = offsetMinutes(zone, local - DAY_MS)
  const after = offsetMinutes(zone, local + DAY_MS)
  const candidates = before === after ? [before] : [before, after]
  for (const offset of candidates) {
    const guess = local - offset * MINUTE_MS
    if (offsetMinutes(zone, guess) === offset) return guess
  }
  return local - before * MINUTE_MS
}

/** 1970-01-01 起的第几天 → 'YYYY-MM-DD'（LocalDate.toString()）。 */
export function isoDateOfEpochDay(epochDay: number): string {
  const date = new Date(epochDay * DAY_MS)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const year = y < 0 ? '-' + String(-y).padStart(4, '0') : String(y).padStart(4, '0')
  return `${year}-${m}-${d}`
}

/** 'YYYY-MM-DD' → 1970-01-01 起的第几天。 */
export function epochDayOfIsoDate(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS)
}

/** 当地日期 'YYYY-MM-DD'（Instant.atZone(zone).toLocalDate().toString()）。 */
export function localDate(epochMillis: number, zone: string): string {
  return isoDateOfEpochDay(localFields(epochMillis, zone).epochDay)
}

/** 当地日期的第几天（LocalDate.toEpochDay()）。 */
export function localEpochDay(epochMillis: number, zone: string): number {
  return localFields(epochMillis, zone).epochDay
}

/** 把秒和毫秒归零（ZonedDateTime.withSecond(0).withNano(0)）。 */
export function truncateToMinute(epochMillis: number, zone: string): number {
  const f = localFields(epochMillis, zone)
  return epochMillis - f.second * 1000 - f.millisecond
}

export function zoned(epochMillis: number, zone: string): ZonedTime {
  return { epochMillis, zone }
}

/** 两个当地日期之间差几天（ChronoUnit.DAYS.between(a.toLocalDate(), b.toLocalDate())）。 */
export function calendarDaysBetween(fromMillis: number, toMillis: number, zone: string): number {
  return localEpochDay(toMillis, zone) - localEpochDay(fromMillis, zone)
}

/** 一个整数取余数，结果永远不是负的（Math.floorMod）。 */
export function floorMod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}
