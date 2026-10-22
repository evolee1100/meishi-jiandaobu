/**
 * 「就这一家吧！」下面那句台词（赢、输、平手、帮我挑一家/转盘、饭桌/投票各一组），以及「🔒 这一餐定了」下面那句。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：domain/RockPaperScissors.kt（DuelLine / DuelLines）、ui/Texts.kt（duelLineRes / lockLineRes）
 */

import type { DuelVerdictId } from './types';

/**
 * 每句台词只属于一组（verdict）。怎么挑（安卓 DuelLines.pick）：
 * - 输了、而且赢的那家是素食店（primaryType 或 types 里有 vegetarian_restaurant / vegan_restaurant）→ 固定 LOSE_VEGETARIAN「乖乖去吃素吧 🥦」；
 * - 否则在这一组里（不含 LOSE_VEGETARIAN）平均随机挑一句；
 * - TABLE_2「剩下的就是缘分 🍀」只在 ✂️ 每人划一刀之后可以出现，🙈 暗中出拳和群投票不用它。
 * 台词在开局（或定下来）那一刻就由逻辑层抽好存在结果里，画面只负责显示。
 */
export const DUEL_LINES: { id: string; verdict: DuelVerdictId; key: string; text: string }[] = [
  { id: 'WIN_1', verdict: 'WIN', key: 'line_win_1', text: '你赢了！就吃你挑的 😎' },
  { id: 'WIN_2', verdict: 'WIN', key: 'line_win_2', text: '手气真好，冲！' },
  { id: 'WIN_3', verdict: 'WIN', key: 'line_win_3', text: '赢了就听你的，走吧 🏃' },
  { id: 'LOSE_1', verdict: 'LOSE', key: 'line_lose_1', text: '哈哈你输了，乖乖去吃吧 😜' },
  { id: 'LOSE_2', verdict: 'LOSE', key: 'line_lose_2', text: '愿赌服输，不准反悔！' },
  { id: 'LOSE_3', verdict: 'LOSE', key: 'line_lose_3', text: '输的人请喝茶 🧋' },
  { id: 'LOSE_VEGETARIAN', verdict: 'LOSE', key: 'line_lose_vegetarian', text: '乖乖去吃素吧 🥦' },
  { id: 'TIE_1', verdict: 'TIE', key: 'line_tie_1', text: '想到一块去了，就吃你出的这家 💕' },
  { id: 'TIE_2', verdict: 'TIE', key: 'line_tie_2', text: '连 App 都想吃这家，就它了 😆' },
  { id: 'ROULETTE_1', verdict: 'ROULETTE', key: 'line_roulette_1', text: '命运选中了它 ✨' },
  { id: 'ROULETTE_2', verdict: 'ROULETTE', key: 'line_roulette_2', text: '老天帮你挑好了，就它吧 🙏' },
  { id: 'ROULETTE_3', verdict: 'ROULETTE', key: 'line_roulette_3', text: '停在哪家，就去哪家 🎯' },
  { id: 'TABLE_1', verdict: 'TABLE', key: 'line_table_1', text: '大家一起定的，谁都不准抱怨 🤝' },
  { id: 'TABLE_2', verdict: 'TABLE', key: 'line_table_2', text: '剩下的就是缘分 🍀' },
  { id: 'TABLE_3', verdict: 'TABLE', key: 'line_table_3', text: '民主的力量 ✊' },
];

/** 素食店的类型（输到素食店专用台词）。 */
export const VEGETARIAN_TYPES = ['vegetarian_restaurant', 'vegan_restaurant'];

/**
 * 反悔用完（或饭桌/投票定的）以后，「🔒 这一餐定了」下面那句（安卓 lockLineRes）：
 * 饭桌模式 / 投票 → lock_table；剪刀石头布赢 → lock_win，平手 → lock_tie，输 → duel_accept；
 * 帮我挑一家、转盘 → lock_roulette。
 */
export const LOCK_LINE_KEYS = {
  TABLE: 'lock_table',
  WIN: 'lock_win',
  TIE: 'lock_tie',
  LOSE: 'duel_accept',
  ROULETTE: 'lock_roulette',
} as const;
export const LOCK_LINES = {
  TABLE: '大家一起定的，不能反悔 🤝',
  WIN: '赢了就听你的，就这么定了 🤝',
  TIE: '心有灵犀，就这么定了 🤝',
  LOSE: '愿赌服输，就这家了 🤝',
  ROULETTE: '老天帮你挑的，就这么定了 🤝',
} as const;
