/**
 * 🃏 饭桌任务卡：24 张普通卡 + 免死金牌。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：domain/TaskDeck.kt、ui/Texts.kt（TASK_CARD_RES / taskCardText）、res/values/strings.xml（task_*）
 */

/** 24 张普通任务卡，下标 0–23（安卓 TaskDeck.draw 返回的数字就是这个下标）。 */
export const TASK_CARDS: { index: number; key: string; text: string }[] = [
  { index: 0, key: 'task_card_01', text: '请大家喝拉茶 🧋' },
  { index: 1, key: 'task_card_02', text: '负责排队打包 🥡' },
  { index: 2, key: 'task_card_03', text: '负责点菜 📝' },
  { index: 3, key: 'task_card_04', text: '负责拍美食照发群 📸' },
  { index: 4, key: 'task_card_05', text: '坐最里面 🪑' },
  { index: 5, key: 'task_card_06', text: '帮大家拿餐具、纸巾 🥢' },
  { index: 6, key: 'task_card_07', text: '今天不准抱怨好不好吃 🤐' },
  { index: 7, key: 'task_card_08', text: '请大家吃煎蕊 🍧' },
  { index: 8, key: 'task_card_09', text: '负责找停车位 🚗' },
  { index: 9, key: 'task_card_10', text: '负责叫饮料 🥤' },
  { index: 10, key: 'task_card_11', text: '请大家吃炸香蕉 🍌' },
  { index: 11, key: 'task_card_12', text: '先付钱，等下大家再转给你 💸' },
  { index: 12, key: 'task_card_13', text: '帮大家倒茶 🍵' },
  { index: 13, key: 'task_card_14', text: '去问老板今天什么最好吃 👨\u200D🍳' },
  { index: 14, key: 'task_card_15', text: '最后一个起筷 🥢' },
  { index: 15, key: 'task_card_16', text: '吃饭时不准看手机 📵' },
  { index: 16, key: 'task_card_17', text: '负责收拾桌面 🧻' },
  { index: 17, key: 'task_card_18', text: '给每道菜打分 ⭐' },
  { index: 18, key: 'task_card_19', text: '讲一个笑话给大家听 😂' },
  { index: 19, key: 'task_card_20', text: '下一餐由你来选 🎯' },
  { index: 20, key: 'task_card_21', text: '帮大家拿酱料、辣椒 🌶\uFE0F' },
  { index: 21, key: 'task_card_22', text: '负责记账 🧮' },
  { index: 22, key: 'task_card_23', text: '请大家吃甜品 🍮' },
  { index: 23, key: 'task_card_24', text: '多打包一份给家人 🏠' },
];

/** 抽到这个数字 = 免死金牌（安卓 TaskDeck.FREE_PASS）。 */
export const FREE_PASS = -1;
export const FREE_PASS_TEXT = '🎉 免死金牌：今天谁都不用做！';
/** 免死金牌的机会：大约 5%（先掷一次 [0,1) 小数 < 0.05 就是免死金牌，否则再在 24 张里平均抽一张）。 */
export const FREE_PASS_CHANCE = 0.05;
export const TASK_DECK_SIZE = 24;
