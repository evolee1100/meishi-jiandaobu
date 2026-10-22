/**
 * 一次搜索要发哪些关键词、用哪些 Google 类型校对菜系、FIELD_MASK（安卓 data/SearchConfig.kt）。
 */
import { PLACES_API, QUOTA } from '../data/constants.ts'
import { cuisineData } from './cuisine.ts'
import type { CuisineId, Place, SearchChoice } from './model.ts'
import { applyCuisineFilter, rankedPlaces } from './ranking.ts'

/** 请求头 X-Goog-FieldMask，一个字都不能改（多要字段 = 更贵的计费项目）。 */
export const FIELD_MASK: string = PLACES_API.FIELD_MASK

/** 每次搜索最多 3 个关键词；每月额度一律按 3 个算。 */
export const QUERIES_PER_SEARCH: number = QUOTA.QUERIES_PER_SEARCH

/** 这个组合的关键词（1–3 个，中文 / 英文 / 马来文混用），同时发出。 */
export function queriesFor(choice: SearchChoice): readonly string[] {
  return cuisineData(choice.cuisine).queries[choice.meal]
}

const MATCH_TYPES = new Map<CuisineId, ReadonlySet<string>>()

/** 菜系校对用的 Google 类型（不限是空的）。 */
export function matchTypesFor(cuisine: CuisineId): ReadonlySet<string> {
  let types = MATCH_TYPES.get(cuisine)
  if (!types) {
    types = new Set(cuisineData(cuisine).matchTypes)
    MATCH_TYPES.set(cuisine, types)
  }
  return types
}

/** 画面上显示的顺序：先按 Google 类型软过滤菜系，再排名。真实和演示的结果都一样。 */
export function rankedFor(choice: SearchChoice, places: readonly Place[]): Place[] {
  return rankedPlaces(applyCuisineFilter(places, matchTypesFor(choice.cuisine)))
}
