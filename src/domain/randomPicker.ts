/**
 * 🎲 随便挑：帮用户摇一个「菜系 + 饭/面/都可以」（安卓 domain/RandomPicker.kt）。全部在手机里决定，不花钱；
 * 只有按「就它了」以后的搜索才算次数。
 */
import { RANDOM_PICK } from '../data/constants.ts'
import { dayPartData } from './dayPart.ts'
import { ALL_MEALS, isSpecific, SPECIFIC_CUISINES, suits } from './cuisine.ts'
import { sameChoice, type CuisineId, type DayPartId, type MealId, type SearchChoice } from './model.ts'
import { pickOne, type RandomSource } from './random.ts'

export const RECENTLY_EATEN_FACTOR = RANDOM_PICK.RECENTLY_EATEN_FACTOR
export const FORTUNE_FACTOR = RANDOM_PICK.FORTUNE_FACTOR
export const FORTUNE_MEAL_WEIGHT = RANDOM_PICK.FORTUNE_MEAL_WEIGHT

/** 每个菜系在每个时段的相对权重（0 = 永远不会摇到；没有时段 = 一样机会）。 */
export function weight(dayPart: DayPartId | null, cuisine: CuisineId): number {
  if (!isSpecific(cuisine)) return 0
  if (dayPart == null) return 1
  return dayPartData(dayPart).weights[cuisine as Exclude<CuisineId, 'ANY'>]
}

/** 这个时段「多给机会」的菜系：刚吃过也不会被少给。 */
export function boosted(dayPart: DayPartId | null): ReadonlySet<CuisineId> {
  return new Set(dayPart == null ? [] : dayPartData(dayPart).boosted)
}

/**
 * 「少给」哪个菜系：上一餐（5 个钟头内）的菜系，但永远不是中餐、不是这个时段多给的、不是今天饭签的、不是这次不摇的。
 * 所以没有菜系会同时「多给」又「少给」。
 */
export function lessLikely(
  lastMeal: CuisineId | null,
  dayPart: DayPartId | null,
  favoured: CuisineId | null = null,
  excluded: CuisineId | null = null,
): CuisineId[] {
  if (lastMeal == null || !isSpecific(lastMeal)) return []
  if (lastMeal === 'CHINESE' || boosted(dayPart).has(lastMeal) || lastMeal === favoured || lastMeal === excluded) return []
  return [lastMeal]
}

/** 按权重抽一个下标：r = random() × 总和，从第一个往后扣，r < 权重就是它（跳过权重 0 的）。 */
export function weightedIndex(random: RandomSource, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = random.nextDouble() * total
  for (let index = 0; index < weights.length; index++) {
    const w = weights[index] as number
    if (w <= 0) continue
    if (roll < w) return index
    roll -= w
  }
  for (let index = weights.length - 1; index >= 0; index--) if ((weights[index] as number) > 0) return index
  return -1
}

export interface PickOptions {
  /** 对话框里现在显示的那个（「再摇一次」一定会变）。 */
  exclude?: SearchChoice | null
  dayPart?: DayPartId | null
  /** 这次不摇的菜系（「换个菜系再摇」「连吃 3 次…」）。 */
  excludeCuisine?: CuisineId | null
  /** 上一餐的菜系：机会 × 1/3。 */
  lessLikely?: readonly CuisineId[]
  /** 演示模式：只摇「能玩」的组合（有 2 家以上能去）；一个都没有就照普通规则。 */
  playable?: (choice: SearchChoice) => boolean
  /** 今天饭签上的组合：菜系机会 × 2，饭/面权重 2。 */
  favoured?: SearchChoice | null
}

/**
 * 两步：先在 12 个具体菜系里按时段权重抽一个（永远不摇「不限」），再在这个菜系合理的饭/面/都可以里抽一个。
 */
export function pick(random: RandomSource, options: PickOptions = {}): SearchChoice {
  const exclude = options.exclude ?? null
  const dayPart = options.dayPart ?? null
  const excludeCuisine = options.excludeCuisine ?? null
  const less = new Set(options.lessLikely ?? [])
  const playable = options.playable ?? (() => true)
  const favoured = options.favoured ?? null
  for (const onlyPlayable of [true, false]) {
    const meals: MealId[][] = SPECIFIC_CUISINES.map((cuisine) =>
      ALL_MEALS.filter((meal) => {
        const choice = { cuisine, meal }
        return suits(cuisine, meal) && !sameChoice(choice, exclude) && (!onlyPlayable || playable(choice))
      }),
    )
    const weights = SPECIFIC_CUISINES.map((cuisine, index) => {
      if (cuisine === excludeCuisine || (meals[index] as MealId[]).length === 0) return 0
      if (less.has(cuisine)) return weight(dayPart, cuisine) * RECENTLY_EATEN_FACTOR
      if (cuisine === favoured?.cuisine) return weight(dayPart, cuisine) * FORTUNE_FACTOR
      return weight(dayPart, cuisine)
    })
    // 万一全部机会都没了（表里不会发生），就让能摇的菜系一样机会。
    const usable = weights.some((w) => w > 0)
      ? weights
      : SPECIFIC_CUISINES.map((cuisine, index) => (cuisine === excludeCuisine || (meals[index] as MealId[]).length === 0 ? 0 : 1))
    if (!usable.some((w) => w > 0)) continue
    const index = weightedIndex(random, usable)
    const cuisine = SPECIFIC_CUISINES[index] as CuisineId
    const options2 = meals[index] as MealId[]
    const meal =
      favoured != null && favoured.cuisine === cuisine && options2.includes(favoured.meal)
        ? (options2[weightedIndex(random, options2.map((m) => (m === favoured.meal ? FORTUNE_MEAL_WEIGHT : 1)))] as MealId)
        : pickOne(random, options2)
    return { cuisine, meal }
  }
  throw new Error('no cuisine left to draw')
}

/**
 * 对话框里那一行（只说最重要的一句）：这次不摇… > 饭签 > 刚才吃过… > 时段说明。
 */
export type PickNote =
  | { readonly kind: 'EXCLUDED'; readonly cuisine: CuisineId }
  | { readonly kind: 'FORTUNE'; readonly stickIndex: number }
  | { readonly kind: 'EATEN_RECENTLY'; readonly cuisine: CuisineId }
  | { readonly kind: 'TIME_OF_DAY'; readonly dayPart: DayPartId }

export function pickNote(
  excluded: CuisineId | null,
  fortuneStick: number | null,
  fortuneCuisine: CuisineId | null,
  dayPart: DayPartId | null,
  lessLikelyCuisines: readonly CuisineId[],
): PickNote | null {
  if (excluded != null) return { kind: 'EXCLUDED', cuisine: excluded }
  if (fortuneStick != null && fortuneCuisine != null) return { kind: 'FORTUNE', stickIndex: fortuneStick }
  const first = lessLikelyCuisines[0]
  if (first != null) return { kind: 'EATEN_RECENTLY', cuisine: first }
  if (dayPart != null) return { kind: 'TIME_OF_DAY', dayPart }
  return null
}
