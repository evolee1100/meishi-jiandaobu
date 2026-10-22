/**
 * 数据文件共用的类型。名字和安卓第四版的枚举一模一样（大写英文 id），方便对照安卓源码和测试。
 * 只有类型，没有运行时代码；其他数据文件用 `import type` 引入。
 */

/** 安卓 domain/Cuisine.kt 的 13 个菜系（ANY = 不限）。顺序 = 首页格子顺序。 */
export type CuisineId =
  | 'ANY'
  | 'CHINESE'
  | 'HK_DIM_SUM'
  | 'MALAY'
  | 'INDIAN_MAMAK'
  | 'JAPANESE'
  | 'KOREAN'
  | 'THAI'
  | 'VIETNAMESE'
  | 'WESTERN'
  | 'HOT_POT'
  | 'SEAFOOD'
  | 'VEGETARIAN';

/** 安卓 domain/Place.kt 的 Meal：饭 / 面 / 都可以。 */
export type MealId = 'RICE' | 'NOODLE' | 'ANY';

/** 安卓 domain/DayPart.kt：按手机本地时间分的五个时段。 */
export type DayPartId = 'BREAKFAST' | 'LUNCH' | 'TEA' | 'DINNER' | 'SUPPER';

/** 安卓 domain/RockPaperScissors.kt 的 Hand：✊ = 第 1 家、✌️ = 第 2 家、🖐️ = 第 3 家。 */
export type HandId = 'ROCK' | 'SCISSORS' | 'PAPER';

/** 安卓 domain/TableGame.kt 的 Avatar：饭桌模式的六个头像。 */
export type AvatarId = 'TIGER' | 'PANDA' | 'MONKEY' | 'CHICK' | 'PIG' | 'DOG';

/** 安卓 domain/RockPaperScissors.kt 的 DuelVerdict：一局怎么定的（决定用哪一组台词）。 */
export type DuelVerdictId = 'WIN' | 'LOSE' | 'TIE' | 'ROULETTE' | 'TABLE';

/** 安卓 domain/Fortune.kt 的 FortuneLevel：饭签的签运（只有好签）。 */
export type FortuneLevelId = 'TOP' | 'GREAT' | 'GOOD' | 'MIDDLE' | 'SMALL';

/** 安卓 ui/UiState.kt 的 DuelMode：一局用什么玩法定下来。 */
export type DuelModeId = 'ROCK_PAPER_SCISSORS' | 'ROULETTE' | 'WHEEL' | 'VETO' | 'SECRET_HANDS' | 'VOTE';

/** 一个「菜系 + 饭/面/都可以」的组合（安卓 SearchChoice）。 */
export interface SearchChoice {
  cuisine: CuisineId;
  meal: MealId;
}

/**
 * 每周营业时段（安卓 domain/OpeningHours.kt 的 WeeklyPeriod）：
 * [开门, 关门]，单位是「从星期日 00:00 起算的分钟」（0 ≤ 开门 < 10080）。
 * 关门比开门小 = 跨到下一周（例如星期六 17:00 – 星期日 02:00）。
 * 关门为 null = 24 小时营业（Google 的写法：一个星期日 00:00 开门、没有关门的时段）。
 */
export type WeeklyPeriod = readonly [open: number, close: number | null];
