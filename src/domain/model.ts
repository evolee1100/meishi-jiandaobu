/**
 * 共用的资料类型：一家店（Place）、价钱、营业时段……名字和安卓第四版 domain/Place.kt、OpeningHours.kt 一样。
 * 都是普通的 JSON 物件（可以直接存进 sessionStorage），不放方法；规则写在各自的模块里。
 */
import type { CuisineId, MealId, SearchChoice, WeeklyPeriod } from '../data/types.ts'

export type { CuisineId, MealId, SearchChoice, WeeklyPeriod } from '../data/types.ts'
export type { AvatarId, DayPartId, DuelModeId, DuelVerdictId, FortuneLevelId, HandId } from '../data/types.ts'

export interface LatLng {
  readonly latitude: number
  readonly longitude: number
}

/** 西南角（low）和东北角（high）。 */
export interface GeoBounds {
  readonly low: LatLng
  readonly high: LatLng
}

/** Google 的价钱等级（PRICE_LEVEL_* 去掉前缀）。 */
export type PriceLevel = 'FREE' | 'INEXPENSIVE' | 'MODERATE' | 'EXPENSIVE' | 'VERY_EXPENSIVE'

/** Google Money：units 是 int64（JSON 里是字符串），这里已经读成数字。 */
export interface Money {
  readonly currencyCode: string | null
  readonly units: number
}

/** 价钱范围；end 是 null =「XX 以上」。 */
export interface PriceRange {
  readonly start: Money | null
  readonly end: Money | null
}

/**
 * 同一个文字搜索请求带回来的营业时间（不用再请求）：每周时段、下次开门 / 下次关门（毫秒）。
 * 之后时间怎么走，都在手机里重算。
 */
export interface OpeningHours {
  readonly periods: readonly WeeklyPeriod[]
  /** Google 的 nextOpenTime（只在现在休息时才有）。 */
  readonly nextOpenMillis: number | null
  /** Google 的 nextCloseTime（只在现在营业时才有）。 */
  readonly nextCloseMillis: number | null
}

/** 一家吃饭的地方（已经从 Google 的回复转好，带着离你多远）。 */
export interface Place {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly location: LatLng
  readonly distanceMeters: number
  readonly rating: number | null
  readonly userRatingCount: number | null
  readonly priceLevel: PriceLevel | null
  readonly priceRange: PriceRange | null
  readonly openNow: boolean | null
  /** Google 的 businessStatus（OPERATIONAL、CLOSED_TEMPORARILY…），没有就是 null。 */
  readonly businessStatus: string | null
  /** 第一张照片的资源名（places/…/photos/…）；只在这次打开网页时有用，不能长期保存。 */
  readonly photoName: string | null
  /** 第一张照片第一个作者的名字（照片显示出来时一定要写「📷 作者」）。 */
  readonly photoAuthor: string | null
  readonly googleMapsUri: string | null
  readonly primaryType: string | null
  readonly primaryTypeDisplayName: string | null
  readonly types: readonly string[]
  /** 演示店自己的 emoji；真实的店是 null（用这次搜索的 emoji）。 */
  readonly placeholderEmoji: string | null
  /** 营业时间；旧版本存下的结果可能没有（当 null）。 */
  readonly openingHours: OpeningHours | null
}

export const DEMO_ID_PREFIX = 'demo_'

/** 演示假店：编号以 demo_ 开头，对 Google 没有意义。 */
export function isDemoPlace(place: { readonly id: string }): boolean {
  return place.id.startsWith(DEMO_ID_PREFIX)
}

export function isDemoId(id: string): boolean {
  return id.startsWith(DEMO_ID_PREFIX)
}

export function sameChoice(a: SearchChoice | null | undefined, b: SearchChoice | null | undefined): boolean {
  if (!a || !b) return a === b
  return a.cuisine === b.cuisine && a.meal === b.meal
}

export function choiceOf(cuisine: CuisineId, meal: MealId): SearchChoice {
  return { cuisine, meal }
}

/** 测试和演示店用：给出必填的几个字段，其余都是「没有」。 */
export function makePlace(fields: Partial<Place> & Pick<Place, 'id' | 'name' | 'location'>): Place {
  return {
    address: null,
    distanceMeters: 0,
    rating: null,
    userRatingCount: null,
    priceLevel: null,
    priceRange: null,
    openNow: null,
    businessStatus: null,
    photoName: null,
    photoAuthor: null,
    googleMapsUri: null,
    primaryType: null,
    primaryTypeDisplayName: null,
    types: [],
    placeholderEmoji: null,
    openingHours: null,
    ...fields,
  }
}
