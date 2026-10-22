/**
 * 菜系、饭 / 面 / 都可以、标题里怎么称呼（安卓 domain/Cuisine.kt、Place.kt 的 Meal、ChoiceLabel）。
 * 资料（中文名、emoji、不合理组合）都在 data/cuisines.ts。
 */
import { CHOICE_SEPARATOR, CUISINES, MEALS, type CuisineData, type MealData } from '../data/cuisines.ts'
import type { CuisineId, MealId, SearchChoice } from './model.ts'

const BY_ID = new Map<CuisineId, CuisineData>(CUISINES.map((c) => [c.id, c]))
const MEAL_BY_ID = new Map<MealId, MealData>(MEALS.map((m) => [m.id, m]))

/** 全部 13 个（含「不限」），首页格子顺序。 */
export const ALL_CUISINES: readonly CuisineId[] = CUISINES.map((c) => c.id)

/** 12 个具体菜系（不含「不限」），随便挑只在这里面摇。 */
export const SPECIFIC_CUISINES: readonly CuisineId[] = ALL_CUISINES.filter((id) => id !== 'ANY')

/** 饭、面、都可以（安卓 Meal.entries 的顺序）。 */
export const ALL_MEALS: readonly MealId[] = MEALS.map((m) => m.id)

export function cuisineData(id: CuisineId): CuisineData {
  const data = BY_ID.get(id)
  if (!data) throw new Error('没有这个菜系：' + id)
  return data
}

export function mealData(id: MealId): MealData {
  const data = MEAL_BY_ID.get(id)
  if (!data) throw new Error('没有这个饭/面：' + id)
  return data
}

export function cuisineName(id: CuisineId): string {
  return cuisineData(id).zhName
}

export function cuisineEmoji(id: CuisineId): string {
  return cuisineData(id).emoji
}

/** 不是「不限」。 */
export function isSpecific(id: CuisineId): boolean {
  return id !== 'ANY'
}

/** 这个菜系配这个饭/面合理（火锅+饭、西餐+饭、越南餐+饭不合理）。 */
export function suits(cuisine: CuisineId, meal: MealId): boolean {
  return !cuisineData(cuisine).unsuitableMeals.includes(meal)
}

export function isReasonable(choice: SearchChoice): boolean {
  return suits(choice.cuisine, choice.meal)
}

/** 这次搜索的 emoji：有菜系用菜系的，不限用饭 / 面 / 都可以的。 */
export function choiceEmoji(choice: SearchChoice): string {
  return isSpecific(choice.cuisine) ? cuisineEmoji(choice.cuisine) : mealData(choice.meal).emoji
}

/** 标题里的几段：[菜系名（不限不写）, 饭/面（都可以不写）]。 */
export function choiceLabelParts(choice: SearchChoice): string[] {
  const parts: string[] = []
  if (isSpecific(choice.cuisine)) parts.push(cuisineName(choice.cuisine))
  if (choice.meal !== 'ANY') parts.push(mealData(choice.meal).label)
  return parts
}

/** 「日本餐・面」「中餐」「饭」，不限 + 都可以是空的。 */
export function choiceLabel(choice: SearchChoice): string {
  return choiceLabelParts(choice).join(CHOICE_SEPARATOR)
}

/** 13 × 3 = 39 个组合（菜系顺序 × 饭/面/都可以）。 */
export function allChoices(): SearchChoice[] {
  return ALL_CUISINES.flatMap((cuisine) => ALL_MEALS.map((meal) => ({ cuisine, meal })))
}

/** 「已选：🥢 中餐」那种「emoji + 空格 + 名字」。 */
export function cuisineChipLabel(id: CuisineId): string {
  return `${cuisineEmoji(id)} ${cuisineName(id)}`
}

/** 「刚才摇到：」胶囊上的「🍣 日本餐・面」：emoji + 空格 + 名称。 */
export function choiceChipLabel(choice: SearchChoice): string {
  return `${choiceEmoji(choice)} ${choiceLabel(choice)}`
}
