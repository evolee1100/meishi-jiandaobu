/**
 * 📜 今日饭签：40 支签（签运、对应的「菜系 + 饭/面」、宜、忌）和 5 种签运。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：domain/Fortune.kt、ui/Texts.kt（FORTUNE_YI_RES / FORTUNE_JI_RES / fortuneFood）、res/values/strings.xml（fortune_*）
 */

import type { CuisineId, FortuneLevelId, MealId } from './types';

export interface FortuneLevelData {
  /** 签运名字：上上签、大吉、上签、中签、小吉。 */
  name: string;
  emoji: string;
  key: string;
}

/** 五种签运，只有好签（没有人想吃饭前抽到坏签）。 */
export const FORTUNE_LEVELS: Record<FortuneLevelId, FortuneLevelData> = {
  TOP: { name: '上上签', emoji: '🎉', key: 'fortune_level_top' },
  GREAT: { name: '大吉', emoji: '✨', key: 'fortune_level_great' },
  GOOD: { name: '上签', emoji: '😄', key: 'fortune_level_good' },
  MIDDLE: { name: '中签', emoji: '🙂', key: 'fortune_level_middle' },
  SMALL: { name: '小吉', emoji: '🍀', key: 'fortune_level_small' },
};

export interface FortuneStickData {
  index: number;
  level: FortuneLevelId;
  /** 签上「宜」对应的搜索组合（「照签去找」就搜它；当天随便挑多给它机会）。全部是合理组合，没有「火锅・饭」。 */
  cuisine: CuisineId;
  meal: MealId;
  /** 小标签和随便挑说明里用的食物名 = 「宜」的第一项（「、」之前）：「📜 上上签：宜云吞面」。 */
  food: string;
  yi: string;
  ji: string;
  yiKey: string;
  jiKey: string;
}

/**
 * 40 支签，顺序就是安卓 Fortune.STICKS 的顺序（下标 0–39）。
 * 今天抽哪一支：order = shuffled(0..39, KotlinRandom(phoneSeed))；index = order[floorMod(epochDay(今天), 40)]
 * （phoneSeed = 这台设备第一次用时随机生成、存起来的 64 位整数；epochDay = 1970-01-01 起的天数，按设备本地日期）。
 * 所以同一台设备同一天永远同一支，连续 40 天不重复，不同设备抽到的不同。
 */
export const FORTUNE_STICKS: FortuneStickData[] = [
  { index: 0, level: 'TOP', cuisine: 'CHINESE', meal: 'NOODLE', food: '云吞面', yi: '云吞面、走路去', ji: '排队超过 20\u00A0分钟', yiKey: 'fortune_yi_01', jiKey: 'fortune_ji_01' }, // 云吞面
  { index: 1, level: 'MIDDLE', cuisine: 'INDIAN_MAMAK', meal: 'ANY', food: '嘛嘛档拉茶', yi: '嘛嘛档拉茶', ji: '吃太饱开会', yiKey: 'fortune_yi_02', jiKey: 'fortune_ji_02' }, // 嘛嘛档拉茶
  { index: 2, level: 'SMALL', cuisine: 'CHINESE', meal: 'ANY', food: '老字号煮炒', yi: '老字号煮炒', ji: '网红店排长龙', yiKey: 'fortune_yi_03', jiKey: 'fortune_ji_03' }, // 老字号煮炒
  { index: 3, level: 'GREAT', cuisine: 'CHINESE', meal: 'RICE', food: '海南鸡饭', yi: '海南鸡饭、多加一份鸡', ji: '说「随便」', yiKey: 'fortune_yi_04', jiKey: 'fortune_ji_04' }, // 海南鸡饭
  { index: 4, level: 'GOOD', cuisine: 'MALAY', meal: 'RICE', food: '椰浆饭', yi: '椰浆饭、加个荷包蛋', ji: '睡过头没吃早餐', yiKey: 'fortune_yi_05', jiKey: 'fortune_ji_05' }, // 椰浆饭
  { index: 5, level: 'TOP', cuisine: 'HK_DIM_SUM', meal: 'ANY', food: '点心', yi: '点心、慢慢叹茶', ji: '赶时间', yiKey: 'fortune_yi_06', jiKey: 'fortune_ji_06' }, // 点心
  { index: 6, level: 'MIDDLE', cuisine: 'CHINESE', meal: 'RICE', food: '杂饭', yi: '杂饭、多夹一样菜', ji: '犹豫超过 3\u00A0分钟', yiKey: 'fortune_yi_07', jiKey: 'fortune_ji_07' }, // 杂饭
  { index: 7, level: 'SMALL', cuisine: 'CHINESE', meal: 'RICE', food: '瓦煲鸡饭', yi: '瓦煲鸡饭', ji: '饿着肚子等位', yiKey: 'fortune_yi_08', jiKey: 'fortune_ji_08' }, // 瓦煲鸡饭
  { index: 8, level: 'GOOD', cuisine: 'CHINESE', meal: 'NOODLE', food: '板面', yi: '板面、多加辣', ji: '穿白衣服', yiKey: 'fortune_yi_09', jiKey: 'fortune_ji_09' }, // 板面
  { index: 9, level: 'GREAT', cuisine: 'HK_DIM_SUM', meal: 'RICE', food: '烧腊饭', yi: '烧腊饭、叉烧要半肥瘦', ji: '喊减肥', yiKey: 'fortune_yi_10', jiKey: 'fortune_ji_10' }, // 烧腊饭
  { index: 10, level: 'MIDDLE', cuisine: 'HK_DIM_SUM', meal: 'NOODLE', food: '牛腩面', yi: '牛腩面', ji: '边吃边开会', yiKey: 'fortune_yi_11', jiKey: 'fortune_ji_11' }, // 牛腩面
  { index: 11, level: 'TOP', cuisine: 'MALAY', meal: 'NOODLE', food: '叻沙', yi: '叻沙、汤喝光', ji: '怕辣', yiKey: 'fortune_yi_12', jiKey: 'fortune_ji_12' }, // 叻沙
  { index: 12, level: 'SMALL', cuisine: 'MALAY', meal: 'NOODLE', food: '马来卤面', yi: '马来卤面', ji: '跟老板讲价', yiKey: 'fortune_yi_13', jiKey: 'fortune_ji_13' }, // 马来卤面
  { index: 13, level: 'GOOD', cuisine: 'MALAY', meal: 'RICE', food: '马来杂饭', yi: '马来杂饭、多淋咖喱', ji: '只吃白饭', yiKey: 'fortune_yi_14', jiKey: 'fortune_ji_14' }, // 马来杂饭
  { index: 14, level: 'GREAT', cuisine: 'INDIAN_MAMAK', meal: 'ANY', food: '印度煎饼', yi: '印度煎饼、配咖喱', ji: '空腹喝咖啡', yiKey: 'fortune_yi_15', jiKey: 'fortune_ji_15' }, // 印度煎饼
  { index: 15, level: 'MIDDLE', cuisine: 'INDIAN_MAMAK', meal: 'RICE', food: '扁担饭', yi: '扁担饭、什么汁都淋一点', ji: '穿浅色裤子', yiKey: 'fortune_yi_16', jiKey: 'fortune_ji_16' }, // 扁担饭
  { index: 16, level: 'TOP', cuisine: 'INDIAN_MAMAK', meal: 'RICE', food: '香蕉叶饭', yi: '香蕉叶饭、用手吃', ji: '怕弄脏手', yiKey: 'fortune_yi_17', jiKey: 'fortune_ji_17' }, // 香蕉叶饭
  { index: 17, level: 'SMALL', cuisine: 'INDIAN_MAMAK', meal: 'NOODLE', food: '嘛嘛炒面', yi: '嘛嘛炒面', ji: '一个人吃三份', yiKey: 'fortune_yi_18', jiKey: 'fortune_ji_18' }, // 嘛嘛炒面
  { index: 18, level: 'GOOD', cuisine: 'JAPANESE', meal: 'RICE', food: '寿司', yi: '寿司、坐吧台', ji: '点太多吃不完', yiKey: 'fortune_yi_19', jiKey: 'fortune_ji_19' }, // 寿司
  { index: 19, level: 'GREAT', cuisine: 'JAPANESE', meal: 'NOODLE', food: '拉面', yi: '拉面、汤要热', ji: '边吃边滑手机', yiKey: 'fortune_yi_20', jiKey: 'fortune_ji_20' }, // 拉面
  { index: 20, level: 'MIDDLE', cuisine: 'JAPANESE', meal: 'RICE', food: '丼饭', yi: '丼饭', ji: '吃太快', yiKey: 'fortune_yi_21', jiKey: 'fortune_ji_21' }, // 丼饭
  { index: 21, level: 'SMALL', cuisine: 'KOREAN', meal: 'RICE', food: '韩式拌饭', yi: '韩式拌饭、拌匀一点', ji: '挑食', yiKey: 'fortune_yi_22', jiKey: 'fortune_ji_22' }, // 韩式拌饭
  { index: 22, level: 'GOOD', cuisine: 'KOREAN', meal: 'NOODLE', food: '炸酱面', yi: '炸酱面', ji: '约会前吃', yiKey: 'fortune_yi_23', jiKey: 'fortune_ji_23' }, // 炸酱面
  { index: 23, level: 'TOP', cuisine: 'KOREAN', meal: 'ANY', food: '韩式烤肉', yi: '韩式烤肉、约朋友一起', ji: '一个人默默吃', yiKey: 'fortune_yi_24', jiKey: 'fortune_ji_24' }, // 韩式烤肉
  { index: 24, level: 'GREAT', cuisine: 'THAI', meal: 'ANY', food: '冬炎', yi: '冬炎、酸辣开胃', ji: '不敢吃辣', yiKey: 'fortune_yi_25', jiKey: 'fortune_ji_25' }, // 冬炎
  { index: 25, level: 'MIDDLE', cuisine: 'THAI', meal: 'RICE', food: '打抛饭', yi: '打抛饭、加荷包蛋', ji: '点了又后悔', yiKey: 'fortune_yi_26', jiKey: 'fortune_ji_26' }, // 打抛饭
  { index: 26, level: 'SMALL', cuisine: 'THAI', meal: 'NOODLE', food: '船面', yi: '船面、来两碗', ji: '只叫一碗', yiKey: 'fortune_yi_27', jiKey: 'fortune_ji_27' }, // 船面
  { index: 27, level: 'GOOD', cuisine: 'VIETNAMESE', meal: 'NOODLE', food: '越南河粉', yi: '越南河粉、多放九层塔', ji: '吃太油', yiKey: 'fortune_yi_28', jiKey: 'fortune_ji_28' }, // 越南河粉
  { index: 28, level: 'MIDDLE', cuisine: 'VIETNAMESE', meal: 'ANY', food: '越南菜', yi: '越南菜、清清淡淡', ji: '大鱼大肉', yiKey: 'fortune_yi_29', jiKey: 'fortune_ji_29' }, // 越南菜
  { index: 29, level: 'SMALL', cuisine: 'WESTERN', meal: 'ANY', food: '炸鸡扒', yi: '炸鸡扒、配薯条', ji: '数卡路里', yiKey: 'fortune_yi_30', jiKey: 'fortune_ji_30' }, // 炸鸡扒
  { index: 30, level: 'GOOD', cuisine: 'WESTERN', meal: 'NOODLE', food: '意大利面', yi: '意大利面、多加芝士', ji: '抢别人最后一口', yiKey: 'fortune_yi_31', jiKey: 'fortune_ji_31' }, // 意大利面
  { index: 31, level: 'TOP', cuisine: 'HOT_POT', meal: 'ANY', food: '打边炉', yi: '打边炉、约多几个人', ji: '一个人吃火锅', yiKey: 'fortune_yi_32', jiKey: 'fortune_ji_32' }, // 打边炉
  { index: 32, level: 'GREAT', cuisine: 'HOT_POT', meal: 'NOODLE', food: '麻辣烫', yi: '麻辣烫、自己选料', ji: '选太多吃不完', yiKey: 'fortune_yi_33', jiKey: 'fortune_ji_33' }, // 麻辣烫
  { index: 33, level: 'MIDDLE', cuisine: 'SEAFOOD', meal: 'ANY', food: '咖喱鱼头', yi: '咖喱鱼头', ji: '怕咖喱沾到衣服', yiKey: 'fortune_yi_34', jiKey: 'fortune_ji_34' }, // 咖喱鱼头
  { index: 34, level: 'GOOD', cuisine: 'SEAFOOD', meal: 'RICE', food: '海鲜炒饭', yi: '海鲜炒饭', ji: '看价钱看太久', yiKey: 'fortune_yi_35', jiKey: 'fortune_ji_35' }, // 海鲜炒饭
  { index: 35, level: 'SMALL', cuisine: 'SEAFOOD', meal: 'NOODLE', food: '虾面', yi: '虾面、汤要浓', ji: '加太多冰', yiKey: 'fortune_yi_36', jiKey: 'fortune_ji_36' }, // 虾面
  { index: 36, level: 'GREAT', cuisine: 'VEGETARIAN', meal: 'RICE', food: '素食杂饭', yi: '素食杂饭、清清肠胃', ji: '大吃大喝', yiKey: 'fortune_yi_37', jiKey: 'fortune_ji_37' }, // 素食杂饭
  { index: 37, level: 'MIDDLE', cuisine: 'VEGETARIAN', meal: 'NOODLE', food: '素食面', yi: '素食面', ji: '说「没有肉不好吃」', yiKey: 'fortune_yi_38', jiKey: 'fortune_ji_38' }, // 素食面
  { index: 38, level: 'GOOD', cuisine: 'SEAFOOD', meal: 'NOODLE', food: '鱼头米粉', yi: '鱼头米粉、加点奶', ji: '急着回公司', yiKey: 'fortune_yi_39', jiKey: 'fortune_ji_39' }, // 鱼头米粉
  { index: 39, level: 'SMALL', cuisine: 'HK_DIM_SUM', meal: 'ANY', food: '茶餐厅', yi: '茶餐厅、来杯奶茶', ji: '喝太多咖啡', yiKey: 'fortune_yi_40', jiKey: 'fortune_ji_40' }, // 茶餐厅
];
