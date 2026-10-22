/**
 * 五个时段：时间范围、首页问候、随便挑的时段说明和各菜系权重、分享文字的「今晚/午餐…」。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：domain/DayPart.kt、domain/RandomPicker.kt（weight / boosted）、ui/HomeScreen.kt（GreetingChip）、ui/Texts.kt（dayPartPickRes / ShareText.mealRes）
 */

import type { CuisineId, DayPartId } from './types';

export interface DayPartData {
  id: DayPartId;
  fromHour: number;
  toHour: number;
  greetingKey: string;
  greeting: string;
  diceNoteKey: string;
  diceNote: string;
  shareMealKey: string;
  shareMeal: string;
  boosted: CuisineId[];
  weights: Record<Exclude<CuisineId, 'ANY'>, number>;
}

/** 顺序：早餐、午餐、下午茶、晚餐、宵夜。 */
export const DAY_PARTS: DayPartData[] = [
  {
    id: 'BREAKFAST',
    /** 小时范围（含两端），按设备本地时间：05:00–09:59。 */
    fromHour: 5,
    toHour: 9,
    /** 首页问候。 */
    greetingKey: 'greeting_breakfast',
    greeting: '🌅 早安！早餐想吃什么？',
    /** 随便挑对话框里的时段说明（只在没有更重要的说明时显示）。 */
    diceNoteKey: 'random_daypart_breakfast',
    diceNote: '🌅 早餐时间，多给点心、椰浆饭和云吞面一点机会',
    /** 「发到群里投票」开头的「X吃哪家？」。 */
    shareMealKey: 'share_meal_breakfast',
    shareMeal: '早餐',
    /** 这个时段「多给机会」的菜系：刚吃过也不会被少给（RandomPicker.boosted）。 */
    boosted: ["HK_DIM_SUM","MALAY","CHINESE"],
    /** 随便挑第一步选菜系的相对权重（0 = 永远不会摇到）。 */
    weights: {"CHINESE":4,"HK_DIM_SUM":5,"MALAY":4,"INDIAN_MAMAK":4,"JAPANESE":0.5,"KOREAN":0.5,"THAI":0.5,"VIETNAMESE":1,"WESTERN":1,"HOT_POT":0,"SEAFOOD":0,"VEGETARIAN":1},
  },
  {
    id: 'LUNCH',
    /** 小时范围（含两端），按设备本地时间：10:00–13:59。 */
    fromHour: 10,
    toHour: 13,
    /** 首页问候。 */
    greetingKey: 'greeting_lunch',
    greeting: '☀\uFE0F 午餐时间到！',
    /** 随便挑对话框里的时段说明（只在没有更重要的说明时显示）。 */
    diceNoteKey: 'random_daypart_lunch',
    diceNote: '☀\uFE0F 午餐时间，多给杂饭、马来餐和嘛嘛档一点机会',
    /** 「发到群里投票」开头的「X吃哪家？」。 */
    shareMealKey: 'share_meal_lunch',
    shareMeal: '午餐',
    /** 这个时段「多给机会」的菜系：刚吃过也不会被少给（RandomPicker.boosted）。 */
    boosted: ["CHINESE","MALAY","INDIAN_MAMAK"],
    /** 随便挑第一步选菜系的相对权重（0 = 永远不会摇到）。 */
    weights: {"CHINESE":5,"HK_DIM_SUM":2,"MALAY":4,"INDIAN_MAMAK":4,"JAPANESE":2,"KOREAN":1.5,"THAI":2,"VIETNAMESE":1,"WESTERN":1.5,"HOT_POT":1,"SEAFOOD":1,"VEGETARIAN":1.5},
  },
  {
    id: 'TEA',
    /** 小时范围（含两端），按设备本地时间：14:00–16:59。 */
    fromHour: 14,
    toHour: 16,
    /** 首页问候。 */
    greetingKey: 'greeting_tea',
    greeting: '☕ 下午茶时间～',
    /** 随便挑对话框里的时段说明（只在没有更重要的说明时显示）。 */
    diceNoteKey: 'random_daypart_tea',
    diceNote: '☕ 下午茶时间，多给港式点心和西餐一点机会',
    /** 「发到群里投票」开头的「X吃哪家？」。 */
    shareMealKey: 'share_meal_tea',
    shareMeal: '下午茶',
    /** 这个时段「多给机会」的菜系：刚吃过也不会被少给（RandomPicker.boosted）。 */
    boosted: ["HK_DIM_SUM","WESTERN"],
    /** 随便挑第一步选菜系的相对权重（0 = 永远不会摇到）。 */
    weights: {"CHINESE":1.5,"HK_DIM_SUM":5,"MALAY":2,"INDIAN_MAMAK":2,"JAPANESE":2,"KOREAN":1,"THAI":1,"VIETNAMESE":1,"WESTERN":4,"HOT_POT":0.5,"SEAFOOD":0.5,"VEGETARIAN":1},
  },
  {
    id: 'DINNER',
    /** 小时范围（含两端），按设备本地时间：17:00–20:59。 */
    fromHour: 17,
    toHour: 20,
    /** 首页问候。 */
    greetingKey: 'greeting_dinner',
    greeting: '🌆 晚餐吃什么好？',
    /** 随便挑对话框里的时段说明（只在没有更重要的说明时显示）。 */
    diceNoteKey: 'random_daypart_dinner',
    diceNote: '🌆 晚餐时间，火锅和海鲜多一点机会',
    /** 「发到群里投票」开头的「X吃哪家？」。 */
    shareMealKey: 'share_meal_dinner',
    shareMeal: '今晚',
    /** 这个时段「多给机会」的菜系：刚吃过也不会被少给（RandomPicker.boosted）。 */
    boosted: ["HOT_POT","SEAFOOD"],
    /** 随便挑第一步选菜系的相对权重（0 = 永远不会摇到）。 */
    weights: {"CHINESE":2,"HK_DIM_SUM":2,"MALAY":2,"INDIAN_MAMAK":2,"JAPANESE":2,"KOREAN":2,"THAI":2,"VIETNAMESE":2,"WESTERN":2,"HOT_POT":3,"SEAFOOD":3,"VEGETARIAN":2},
  },
  {
    id: 'SUPPER',
    /** 小时范围（含两端），按设备本地时间：21:00–04:59（跨半夜）。 */
    fromHour: 21,
    toHour: 4,
    /** 首页问候。 */
    greetingKey: 'greeting_supper',
    greeting: '宵夜时间 🌙',
    /** 随便挑对话框里的时段说明（只在没有更重要的说明时显示）。 */
    diceNoteKey: 'random_daypart_supper',
    diceNote: '🌙 宵夜时间，多给嘛嘛档和煮炒一点机会',
    /** 「发到群里投票」开头的「X吃哪家？」。 */
    shareMealKey: 'share_meal_supper',
    shareMeal: '宵夜',
    /** 这个时段「多给机会」的菜系：刚吃过也不会被少给（RandomPicker.boosted）。 */
    boosted: ["INDIAN_MAMAK","CHINESE"],
    /** 随便挑第一步选菜系的相对权重（0 = 永远不会摇到）。 */
    weights: {"CHINESE":3,"HK_DIM_SUM":1,"MALAY":2,"INDIAN_MAMAK":6,"JAPANESE":0.5,"KOREAN":0.5,"THAI":3,"VIETNAMESE":1,"WESTERN":0.5,"HOT_POT":2,"SEAFOOD":3,"VEGETARIAN":0.5},
  },
];

/** 时段：05–09 早餐，10–13 午餐，14–16 下午茶，17–20 晚餐，其余（21–04）宵夜。 */
export function dayPartOf(hour: number): DayPartId {
  if (hour >= 5 && hour <= 9) return 'BREAKFAST';
  if (hour >= 10 && hour <= 13) return 'LUNCH';
  if (hour >= 14 && hour <= 16) return 'TEA';
  if (hour >= 17 && hour <= 20) return 'DINNER';
  return 'SUPPER';
}

/**
 * 营业时间文字里「几点」前面的时段词（安卓 HoursText.clock）：按小时
 * 0 → 半夜，1–4 → 凌晨，5–8 → 早上，9–11 → 上午，12 → 中午，13–17 → 下午，18–23 → 晚上。
 * 时间用 12 小时制「h:mm」（0 点和 12 点写 12），例如「凌晨 2:00」「晚上 10:00」「半夜 12:30」。
 */
export const CLOCK_PART_KEYS: { fromHour: number; toHour: number; key: string; template: string }[] = [
  { fromHour: 0, toHour: 0, key: 'time_midnight', template: '半夜\u00A0%1$s' },
  { fromHour: 1, toHour: 4, key: 'time_dawn', template: '凌晨\u00A0%1$s' },
  { fromHour: 5, toHour: 8, key: 'time_morning', template: '早上\u00A0%1$s' },
  { fromHour: 9, toHour: 11, key: 'time_forenoon', template: '上午\u00A0%1$s' },
  { fromHour: 12, toHour: 12, key: 'time_noon', template: '中午\u00A0%1$s' },
  { fromHour: 13, toHour: 17, key: 'time_afternoon', template: '下午\u00A0%1$s' },
  { fromHour: 18, toHour: 23, key: 'time_evening', template: '晚上\u00A0%1$s' },
];

/**
 * 「👣 今天中午去过」里的时段词（安卓 VisitText.partOfDay）：按去的那一刻的小时
 * 0–4 凌晨，5–9 早上，10–13 中午，14–16 下午，其余（17–23）晚上。注意和上面营业时间的分法不一样。
 */
export const VISIT_PART_KEYS: { fromHour: number; toHour: number; key: string; word: string }[] = [
  { fromHour: 0, toHour: 4, key: 'visit_part_dawn', word: '凌晨' },
  { fromHour: 5, toHour: 9, key: 'visit_part_morning', word: '早上' },
  { fromHour: 10, toHour: 13, key: 'visit_part_noon', word: '中午' },
  { fromHour: 14, toHour: 16, key: 'visit_part_afternoon', word: '下午' },
  { fromHour: 17, toHour: 23, key: 'visit_part_evening', word: '晚上' },
];

/** 星期几（安卓 HoursText.weekdayRes；ISO：1 = 星期一 … 7 = 星期日）。 */
export const WEEKDAY_KEYS: Record<number, string> = {
  1: 'day_monday', 2: 'day_tuesday', 3: 'day_wednesday', 4: 'day_thursday', 5: 'day_friday', 6: 'day_saturday', 7: 'day_sunday',
};

/** 结果页「半夜」排序：21:00 到 06:00（不含）之间、而且「只看营业中」开着时，确定营业中的店排在营业时间不明的前面。 */
export const NIGHT_FROM_HOUR = 21;
export const NIGHT_UNTIL_HOUR = 6;
