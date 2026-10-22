/**
 * 饭桌模式的 6 个头像（🐯🐼🐵🐔🐷🐶 和默认名字）、三个手势（✊✌️🖐️）、群投票的编号。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：domain/TableGame.kt（Avatar / TableRules）、domain/RockPaperScissors.kt（Hand）、domain/VoteTally.kt（VoteMarkers）、ui/Texts.kt
 */

import type { AvatarId, HandId } from './types';

/**
 * 6 个头像，顺序固定。选了 N 个人就用前 N 个（🐯 老虎 永远是第一个）。
 * 玩家可以给头像改名（最多 6 个字，按 Unicode 码点算，一个 emoji 算 1 个；换行变空格、前后空白去掉），
 * 只存在这台设备；名字是空的就用这里的默认名。显示成「🐼 熊猫」（emoji + 空格 + 名字）。
 */
export const AVATARS: { id: AvatarId; emoji: string; name: string; key: string }[] = [
  { id: 'TIGER', emoji: '🐯', name: '老虎', key: 'avatar_tiger' },
  { id: 'PANDA', emoji: '🐼', name: '熊猫', key: 'avatar_panda' },
  { id: 'MONKEY', emoji: '🐵', name: '猴子', key: 'avatar_monkey' },
  { id: 'CHICK', emoji: '🐔', name: '小鸡', key: 'avatar_chick' },
  { id: 'PIG', emoji: '🐷', name: '小猪', key: 'avatar_pig' },
  { id: 'DOG', emoji: '🐶', name: '小狗', key: 'avatar_dog' },
];

/**
 * 三个手势：手势代表「这一局候选里的第几家」——✊ = 第 1 家、✌️ = 第 2 家、🖐️ = 第 3 家。
 * 规则：石头赢剪刀，剪刀赢布，布赢石头。
 * 注意 ✌️ 和 🖐️ 带 \uFE0F。
 */
export const HANDS: { id: HandId; emoji: string; name: string; key: string; placeIndex: number }[] = [
  { id: 'ROCK', emoji: '✊', name: '石头', key: 'hand_rock', placeIndex: 0 },
  { id: 'SCISSORS', emoji: '✌\uFE0F', name: '剪刀', key: 'hand_scissors', placeIndex: 1 },
  { id: 'PAPER', emoji: '🖐\uFE0F', name: '布', key: 'hand_paper', placeIndex: 2 },
];

/** 群投票 / 计票板的编号：3 家以内用 ✊✌️🖐️，4–6 家用 1️⃣–6️⃣（只有 1 家时分享文字用 👉）。 */
export const VOTE_MARKERS_UP_TO_3 = ['✊', '✌\uFE0F', '🖐\uFE0F'];
export const VOTE_MARKERS_NUMBERS = ['1\uFE0F\u20E3', '2\uFE0F\u20E3', '3\uFE0F\u20E3', '4\uFE0F\u20E3', '5\uFE0F\u20E3', '6\uFE0F\u20E3'];
export function voteMarkers(count: number): string[] {
  return count <= 3 ? VOTE_MARKERS_UP_TO_3.slice(0, count) : VOTE_MARKERS_NUMBERS.slice(0, count);
}
