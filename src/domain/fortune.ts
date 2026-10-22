/**
 * 📜 今日饭签（安卓 domain/Fortune.kt）：同一台设备同一天永远同一支，连续 40 天不重复，不同设备抽到的不同。
 * 今天的签 = KotlinRandom(phoneSeed).shuffled([0…39])[floorMod(epochDay(今天), 40)]，按手机当地日期。
 */
import { FORTUNE_LEVELS, FORTUNE_STICKS, type FortuneStickData } from '../data/fortunes.ts'
import { KotlinRandom } from '../data/kotlinRandom.ts'
import type { SearchChoice } from './model.ts'
import { floorMod, localEpochDay } from './time.ts'

export const STICK_COUNT = FORTUNE_STICKS.length

const ORDERS = new Map<string, number[]>()

function orderFor(phoneSeed: bigint): number[] {
  const key = phoneSeed.toString()
  let order = ORDERS.get(key)
  if (!order) {
    order = new KotlinRandom(phoneSeed).shuffled(FORTUNE_STICKS.map((_, i) => i))
    if (ORDERS.size > 100) ORDERS.clear()
    ORDERS.set(key, order)
  }
  return order
}

/** 第 epochDay 天（1970-01-01 起）这台设备的签（下标 0–39）。 */
export function fortuneIndexFor(epochDay: number, phoneSeed: bigint): number {
  return orderFor(phoneSeed)[floorMod(epochDay, STICK_COUNT)] as number
}

/** 某个时刻（手机时区的当地日期）的签。 */
export function fortuneIndexAt(epochMillis: number, zone: string, phoneSeed: bigint): number {
  return fortuneIndexFor(localEpochDay(epochMillis, zone), phoneSeed)
}

export function fortuneStick(index: number): FortuneStickData {
  const stick = FORTUNE_STICKS[index]
  if (!stick) throw new Error('没有这支签：' + index)
  return stick
}

/** 签上的「菜系 + 饭/面/都可以」（「照签去找」就搜它）。 */
export function fortuneChoice(index: number): SearchChoice {
  const stick = fortuneStick(index)
  return { cuisine: stick.cuisine, meal: stick.meal }
}

/** 食物名 =「宜」第一项（「云吞面、走路去」→「云吞面」）。 */
export function fortuneFood(index: number): string {
  return fortuneStick(index).yi.split('、')[0] ?? ''
}

export function fortuneLevelName(index: number): string {
  return FORTUNE_LEVELS[fortuneStick(index).level].name
}

export function fortuneLevelEmoji(index: number): string {
  return FORTUNE_LEVELS[fortuneStick(index).level].emoji
}
