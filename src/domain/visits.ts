/**
 * 👣 吃过的记录（安卓 domain/Visits.kt）：只记「店的编号、菜系、时间」（Google 不准长期保存店名、地址、照片，编号可以）。
 * 一餐只算一次、最多 50 笔、60 天；用来写「👣 今天中午去过」、少摇上一餐的菜系、连吃提醒。
 */
import { VISITS } from '../data/constants.ts'
import { SPECIFIC_CUISINES, isSpecific } from './cuisine.ts'
import { isDemoId, type CuisineId, type Place } from './model.ts'
import { calendarDaysBetween, DAY_MS } from './time.ts'

export interface Visit {
  readonly placeId: string
  readonly cuisine: CuisineId | null
  readonly atMillis: number
}

export function visit(placeId: string, cuisine: CuisineId | null, atMillis: number): Visit {
  return { placeId, cuisine, atMillis }
}

/** 演示店的记录：另外放，永远不算进真实的「上一餐」「连吃」。 */
export function isDemoVisit(v: Visit): boolean {
  return isDemoId(v.placeId)
}

/** 2 个钟头内的导航算同一餐，只留最后一次（比较前三名的路线、连按两下、卡片导航后又按导航过去）。 */
function onePerMeal(newestFirst: readonly Visit[]): Visit[] {
  const kept: Visit[] = []
  for (const v of newestFirst) {
    const last = kept[kept.length - 1]
    if (!last || last.atMillis - v.atMillis >= VISITS.SAME_MEAL_MS) kept.push(v)
  }
  return kept
}

function newestFirst(visits: readonly Visit[]): Visit[] {
  // 稳定排序：同一时间的保持原顺序（和 Kotlin sortedByDescending 一样）。
  return [...visits].sort((a, b) => b.atMillis - a.atMillis)
}

/**
 * 整理：只留「现在往前 60 天」到「现在往后 12 小时」之间的（手机时间被调回去过时先留着）、新的在前、一餐一笔、最多 50 笔。
 */
export function prunedVisits(visits: readonly Visit[], nowMillis: number): Visit[] {
  const kept = visits.filter((v) => {
    const age = nowMillis - v.atMillis
    return age >= -VISITS.FUTURE_TOLERANCE_MS && age <= VISITS.MAX_AGE_DAYS * DAY_MS
  })
  return onePerMeal(newestFirst(kept)).slice(0, VISITS.MAX_ENTRIES)
}

/** 记一笔导航；同一餐早一点的那笔让给它。 */
export function addVisit(visits: readonly Visit[], v: Visit): Visit[] {
  return prunedVisits([v, ...visits], v.atMillis)
}

/** 每家店最后一次去的时间。 */
export function lastVisits(visits: readonly Visit[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const v of visits) {
    const known = map.get(v.placeId)
    if (known === undefined || v.atMillis > known) map.set(v.placeId, v.atMillis)
  }
  return map
}

/** 上一餐：5 个钟头内（含刚好 5 小时）最近的那一笔。 */
export function lastMeal(visits: readonly Visit[], nowMillis: number): Visit | null {
  let best: Visit | null = null
  for (const v of visits) {
    const age = nowMillis - v.atMillis
    if (age < 0 || age > VISITS.RECENT_MS) continue
    if (!best || v.atMillis > best.atMillis) best = v
  }
  return best
}

/** 上一餐的菜系（没有或不知道 → 空）。 */
export function recentCuisines(visits: readonly Visit[], nowMillis: number): CuisineId[] {
  const cuisine = lastMeal(visits, nowMillis)?.cuisine
  return cuisine ? [cuisine] : []
}

/** 最近 3 餐都是同一个菜系 → 那个菜系（连吃提醒），否则 null。 */
export function streak(visits: readonly Visit[]): CuisineId | null {
  const last = onePerMeal(newestFirst(visits)).slice(0, VISITS.STREAK)
  if (last.length < VISITS.STREAK) return null
  const cuisine = (last[0] as Visit).cuisine
  if (cuisine == null) return null
  return last.every((v) => v.cuisine === cuisine) ? cuisine : null
}

/** 要不要显示「👣 …去过」：不晚于「结果的时钟 + 10 分钟」才显示（手机时间被调回去时不说「今天」）。 */
export function isShownAt(visitMillis: number, nowMillis: number): boolean {
  return visitMillis <= nowMillis + VISITS.CLOCK_LAG_MS
}

/** 按日历算隔了几天：0 = 今天、1 = 昨天…（不会是负的）。 */
export function daysAgo(visitMillis: number, nowMillis: number, zone: string): number {
  return Math.max(calendarDaysBetween(visitMillis, nowMillis, zone), 0)
}

/**
 * 这一笔算哪个菜系：搜的是具体菜系就是它；搜「不限」→ 按菜系表顺序找第一个「Google 类型包含这家店 primaryType」的，
 * 再找第一个「包含这家店任何一个 types」的；都没有 → null。
 */
export function cuisineOfVisit(place: Place, searched: CuisineId, matchTypes: (c: CuisineId) => ReadonlySet<string>): CuisineId | null {
  if (isSpecific(searched)) return searched
  const primary = place.primaryType
  if (primary != null) {
    const byPrimary = SPECIFIC_CUISINES.find((c) => matchTypes(c).has(primary))
    if (byPrimary) return byPrimary
  }
  return SPECIFIC_CUISINES.find((c) => place.types.some((t) => matchTypes(c).has(t))) ?? null
}

/** 存进 localStorage 的样子：只有 placeId、cuisine、atMillis 三个字段（菜系不知道就不写）。 */
export function encodeVisits(visits: readonly Visit[]): string {
  return JSON.stringify(
    visits.map((v) => (v.cuisine == null ? { placeId: v.placeId, atMillis: v.atMillis } : { placeId: v.placeId, cuisine: v.cuisine, atMillis: v.atMillis })),
  )
}

const CUISINE_IDS = new Set<string>(['ANY', ...SPECIFIC_CUISINES])

/** 读回来；读坏了（格式不对、别的版本存的）当空的。 */
export function decodeVisits(text: string | null): Visit[] {
  if (!text) return []
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    const visits: Visit[] = []
    for (const entry of parsed) {
      if (typeof entry !== 'object' || entry == null) return []
      const { placeId, cuisine, atMillis } = entry as Record<string, unknown>
      if (typeof placeId !== 'string' || typeof atMillis !== 'number' || !Number.isFinite(atMillis)) return []
      if (cuisine != null && (typeof cuisine !== 'string' || !CUISINE_IDS.has(cuisine))) return []
      visits.push({ placeId, cuisine: (cuisine as CuisineId | undefined) ?? null, atMillis })
    }
    return visits
  } catch {
    return []
  }
}
