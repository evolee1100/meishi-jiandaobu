/**
 * 「是不是吃饭的地方」、菜系软过滤、贝叶斯加权排名（安卓 domain/FoodTypes.kt、CuisineTypeFilter.kt、Ranking.kt）。
 */
import { RANKING } from '../data/constants.ts'
import { EATERY_TYPES, NON_EATERY_PRIMARY_TYPES, SHOP_TYPES } from '../data/foodTypes.ts'
import type { Place } from './model.ts'

const EATERY = new Set(EATERY_TYPES)
const NON_EATERY_PRIMARY = new Set(NON_EATERY_PRIMARY_TYPES)
const SHOP = new Set(SHOP_TYPES)

/**
 * 是不是可以坐下来吃 / 买熟食的地方：酒店（饭店）、面包店、杂货店、米行……不是；
 * 餐厅、外卖、美食中心、面档、咖啡店（kopitiam）……是；只标 food 的小贩档也是。
 */
export function isEatery(types: readonly string[], primaryType: string | null): boolean {
  if (primaryType != null && NON_EATERY_PRIMARY.has(primaryType)) return false
  const explicit =
    types.some((t) => EATERY.has(t) || t.endsWith('_restaurant')) ||
    (primaryType != null && (EATERY.has(primaryType) || primaryType.endsWith('_restaurant')))
  if (explicit) return true
  return types.includes('food') && !types.some((t) => SHOP.has(t))
}

// ------------------------------------------------------------------ 排名

/** 还在营业（或不知道）而且有评分：才排得上名。 */
export function isEligible(place: Place): boolean {
  return (place.businessStatus == null || place.businessStatus === 'OPERATIONAL') && place.rating != null
}

function reviews(place: Place): number {
  return place.userRatingCount ?? 0
}

/** C：候选店的平均星数，最高只算 4.2（没有候选 = 4.0）。 */
export function priorMean(candidates: readonly Place[]): number {
  const ratings = candidates.map((p) => p.rating).filter((r): r is number => r != null)
  const mean = ratings.length === 0 ? RANKING.FALLBACK_MEAN_RATING : ratings.reduce((sum, r) => sum + r, 0) / ratings.length
  return Math.min(mean, RANKING.MAX_PRIOR_MEAN)
}

/** 分数 = v/(v+m) × 星数 + m/(v+m) × C（m = 100）。 */
export function score(rating: number, reviewCount: number, meanRating: number, m: number = RANKING.PRIOR_WEIGHT): number {
  const v = Math.max(reviewCount, 0)
  return (v / (v + m)) * rating + (m / (v + m)) * meanRating
}

function candidatesForTiers(eligible: readonly Place[]): Place[] {
  let last: Place[] = []
  for (const minReviews of RANKING.REVIEW_TIERS) {
    last = eligible.filter((p) => reviews(p) >= minReviews)
    if (last.length >= RANKING.MIN_CANDIDATES) return last
  }
  return last
}

/** 全部排得上名的店，最好的在前（「换 3 家」一页一页往下看的就是它）。 */
export function rankedPlaces(places: readonly Place[]): Place[] {
  const candidates = candidatesForTiers(places.filter(isEligible))
  if (candidates.length === 0) return []
  const mean = priorMean(candidates)
  const keyed = candidates.map((place) => ({
    place,
    // 乘 10⁹ 再四舍五入：小数误差不会决定名次（Kotlin roundToLong = Math.round）。
    score: Math.round(score(place.rating ?? 0, reviews(place), mean) * 1e9),
  }))
  keyed.sort(
    (a, b) =>
      b.score - a.score || reviews(b.place) - reviews(a.place) || a.place.distanceMeters - b.place.distanceMeters,
  )
  return keyed.map((k) => k.place)
}

/** 前 topN 名 + 一共看了几家（安卓 Ranking.rank）。 */
export function rank(places: readonly Place[], topN = 3): { top: Place[]; consideredCount: number } {
  const sorted = rankedPlaces(places)
  return { top: sorted.slice(0, topN), consideredCount: sorted.length }
}

// ------------------------------------------------------------------ 菜系软过滤

/** primaryType 或 types 里有这个菜系的任何一个类型。 */
export function matchesCuisine(place: Place, matchTypes: ReadonlySet<string>): boolean {
  return (place.primaryType != null && matchTypes.has(place.primaryType)) || place.types.some((t) => matchTypes.has(t))
}

/**
 * 对得上、而且排得上名的店至少 3 家 → 只留对得上的；不到 3 家 → 一家都不去掉（很多小贩档只标 restaurant）。
 * 不限（没有类型）不过滤。
 */
export function applyCuisineFilter(places: readonly Place[], matchTypes: ReadonlySet<string>): Place[] {
  if (matchTypes.size === 0) return [...places]
  const matching = places.filter((p) => matchesCuisine(p, matchTypes))
  return matching.filter(isEligible).length >= RANKING.CUISINE_FILTER_MIN_MATCHES ? matching : [...places]
}
