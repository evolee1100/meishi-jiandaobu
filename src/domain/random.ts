/**
 * 随机数：一律用 Kotlin Random（XorWow）的逐位移植 KotlinRandom，可以注入固定种子，
 * 测试和安卓第四版「同一个种子、同一个结果」。
 */
import { KotlinRandom } from '../data/kotlinRandom.ts'

export { KotlinRandom } from '../data/kotlinRandom.ts'

/** 只用到的几个方法（测试也可以换成别的实现）。 */
export type RandomSource = Pick<KotlinRandom, 'nextInt' | 'nextDouble' | 'nextFloat' | 'nextBoolean' | 'nextLong'>

/** Kotlin List.random(random)。 */
export function pickOne<T>(random: RandomSource, items: readonly T[]): T {
  if (items.length === 0) throw new Error('Collection is empty.')
  return items[random.nextInt(items.length)] as T
}

/** Kotlin List.shuffled(random)：从最后一个往前，和 [0, i] 里随机一个交换。 */
export function shuffled<T>(random: RandomSource, items: readonly T[]): T[] {
  const list = items.slice()
  for (let i = list.length - 1; i >= 1; i--) {
    const j = random.nextInt(i + 1)
    const tmp = list[i] as T
    list[i] = list[j] as T
    list[j] = tmp
  }
  return list
}

/** [from, to] 两端都含的随机整数（Kotlin random.nextInt(range.first, range.last + 1)）。 */
export function nextInRange(random: RandomSource, range: readonly [number, number]): number {
  return random.nextInt(range[0], range[1] + 1)
}

/** 一个随机的 64 位种子（浏览器用 crypto，测试里不会用到）。 */
export function randomSeed(): bigint {
  try {
    const words = new Uint32Array(2)
    globalThis.crypto.getRandomValues(words)
    return BigInt.asIntN(64, (BigInt(words[0] ?? 0) << 32n) | BigInt(words[1] ?? 0))
  } catch {
    return BigInt(Math.floor(Math.random() * 2 ** 31)) * 4_294_967_296n + BigInt(Math.floor(Math.random() * 2 ** 32))
  }
}

/** 新的随机数来源（不给种子 = 每次打开网页都不一样）。 */
export function createRandom(seed?: number | bigint): KotlinRandom {
  return new KotlinRandom(seed ?? randomSeed())
}
