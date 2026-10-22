/**
 * 时段（安卓 domain/DayPart.kt）：按手机当地时间的小时，05–09 早餐、10–13 午餐、14–16 下午茶、17–20 晚餐、其余宵夜。
 * 问候、随便挑、分享文字的「今晚 / 午餐…」、自动回首页都用它。
 */
import { DAY_PARTS, dayPartOf, type DayPartData } from '../data/dayParts.ts'
import type { DayPartId } from './model.ts'
import { localFields } from './time.ts'

export const ALL_DAY_PARTS: readonly DayPartId[] = DAY_PARTS.map((d) => d.id)

const BY_ID = new Map<DayPartId, DayPartData>(DAY_PARTS.map((d) => [d.id, d]))

export function dayPartData(id: DayPartId): DayPartData {
  const data = BY_ID.get(id)
  if (!data) throw new Error('没有这个时段：' + id)
  return data
}

/** 按小时（0–23）。 */
export function dayPartOfHour(hour: number): DayPartId {
  return dayPartOf(hour)
}

/** 按某个时刻在某个时区的当地小时。 */
export function dayPartAt(epochMillis: number, zone: string): DayPartId {
  return dayPartOf(localFields(epochMillis, zone).hour)
}
