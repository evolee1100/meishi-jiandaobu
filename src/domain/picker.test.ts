import { describe, expect, it } from 'vitest'
import { klMillis, seeded } from '../test/helpers.ts'
import { ALL_MEALS, allChoices, isReasonable, isSpecific, SPECIFIC_CUISINES } from './cuisine.ts'
import { ALL_DAY_PARTS, dayPartAt, dayPartOfHour } from './dayPart.ts'
import type { CuisineId, DayPartId, SearchChoice } from './model.ts'
import { boosted, lessLikely, pick, pickNote, weight } from './randomPicker.ts'
import { spinTarget } from './spin.ts'
import { lastMeal, recentCuisines, visit } from './visits.ts'

const key = (c: SearchChoice) => `${c.cuisine}/${c.meal}`

function spin(dayPart: DayPartId | null, times: number, seed = 2026, excludeCuisine: CuisineId | null = null): SearchChoice[] {
  const random = seeded(seed)
  let previous: SearchChoice | null = null
  const out: SearchChoice[] = []
  for (let i = 0; i < times; i++) {
    previous = pick(random, { exclude: previous, dayPart, excludeCuisine })
    out.push(previous)
  }
  return out
}

function countBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) map.set(keyOf(item), (map.get(keyOf(item)) ?? 0) + 1)
  return map
}

function noRepeats(picks: readonly SearchChoice[]): boolean {
  return picks.every((p, i) => i === 0 || key(p) !== key(picks[i - 1] as SearchChoice))
}

const reasonableChoices = () => allChoices().filter((c) => isSpecific(c.cuisine) && isReasonable(c))

describe('三十、时段边界', () => {
  it('HOME-01 04:59 宵夜、05:00 早餐、09:59 早餐、10:00 午餐、13:59 午餐、14:00 下午茶、16:59 下午茶、17:00 晚餐、20:59 晚餐、21:00 宵夜、23:59 和 00:00 宵夜', () => {
    const at = (h: number, m: number) => dayPartAt(klMillis(6, h, m), 'Asia/Kuala_Lumpur')
    expect(at(4, 59)).toBe('SUPPER')
    expect(at(5, 0)).toBe('BREAKFAST')
    expect(at(9, 59)).toBe('BREAKFAST')
    expect(at(10, 0)).toBe('LUNCH')
    expect(at(13, 59)).toBe('LUNCH')
    expect(at(14, 0)).toBe('TEA')
    expect(at(16, 59)).toBe('TEA')
    expect(at(17, 0)).toBe('DINNER')
    expect(at(20, 59)).toBe('DINNER')
    expect(at(21, 0)).toBe('SUPPER')
    expect(at(23, 59)).toBe('SUPPER')
    expect(at(0, 0)).toBe('SUPPER')
    expect(dayPartOfHour(0)).toBe('SUPPER')
  })
})

describe('十六、🎲 随便挑', () => {
  it('PICK-01 卷轴停的位置：2、3、12 格，任何起点、目标、圈数，都停在目标格、至少转够圈数、而且是第一个这样的位置', () => {
    for (const count of [2, 3, 12]) {
      for (let current = 0; current <= 40; current++) {
        for (let target = 0; target < count; target++) {
          for (let loops = 0; loops <= 6; loops++) {
            const stop = spinTarget(current, count, target, loops)
            expect(((stop % count) + count) % count).toBe(target)
            expect(stop).toBeGreaterThanOrEqual(current + loops * count)
            expect(stop).toBeLessThan(current + (loops + 1) * count)
          }
        }
      }
    }
  })

  it('PICK-02 例子：从 0 起 3 格目标 2 转 5 圈 → 17；12 格目标 5 转 3 圈 → 41；从 41 接着转 1 圈到 5 → 53', () => {
    expect(spinTarget(0, 3, 2, 5)).toBe(17)
    expect(spinTarget(0, 12, 5, 3)).toBe(41)
    expect(spinTarget(41, 12, 5, 1)).toBe(53)
  })

  it('PICK-03 不合理的组合只有 火锅+饭、西餐+饭、越南餐+饭；火锅+面（麻辣烫）是合理的', () => {
    const unreasonable = allChoices().filter((c) => !isReasonable(c)).map(key)
    expect(new Set(unreasonable)).toEqual(new Set(['HOT_POT/RICE', 'WESTERN/RICE', 'VIETNAMESE/RICE']))
    expect(isReasonable({ cuisine: 'HOT_POT', meal: 'NOODLE' })).toBe(true)
  })

  it('PICK-04 摇 5,000 次：从不摇到不限和怪组合，12 个菜系和 3 个饭面都出现过，每个菜系次数差不多（330–510 次）', () => {
    const random = seeded(20261003)
    const picks = Array.from({ length: 5000 }, () => pick(random))
    expect(picks.some((p) => p.cuisine === 'ANY')).toBe(false)
    expect(picks.every(isReasonable)).toBe(true)
    expect(new Set(picks.map((p) => p.cuisine))).toEqual(new Set(SPECIFIC_CUISINES))
    expect(new Set(picks.map((p) => p.meal))).toEqual(new Set(ALL_MEALS))
    for (const [cuisine, n] of countBy(picks, (p) => p.cuisine)) {
      expect(n, cuisine).toBeGreaterThanOrEqual(330)
      expect(n, cuisine).toBeLessThanOrEqual(510)
    }
  })

  it('PICK-05 「再摇一次」连续 5,000 次从不和上一次一样', () => {
    const random = seeded(99)
    let previous = pick(random)
    for (let i = 0; i < 5000; i++) {
      const next = pick(random, { exclude: previous })
      expect(key(next)).not.toBe(key(previous))
      expect(isReasonable(next)).toBe(true)
      expect(next.cuisine).not.toBe('ANY')
      previous = next
    }
  })

  it('PICK-06 同一个随机种子摇出一模一样的结果（随机数可以注入）', () => {
    const a = seeded(5)
    const b = seeded(5)
    expect(Array.from({ length: 20 }, () => pick(a))).toEqual(Array.from({ length: 20 }, () => pick(b)))
  })

  it('PICK-07 少给机会：晚餐时刚吃过泰国餐 → 少给；中餐任何时段都不少给；宵夜的嘛嘛档不少给（晚餐会）；签上的、被排除的不少给；没吃过不少给；不会同时多给又少给', () => {
    expect(lessLikely('THAI', 'DINNER')).toEqual(['THAI'])
    for (const part of ALL_DAY_PARTS) expect(lessLikely('CHINESE', part)).toEqual([])
    expect(lessLikely('INDIAN_MAMAK', 'SUPPER')).toEqual([])
    expect(lessLikely('INDIAN_MAMAK', 'DINNER')).toEqual(['INDIAN_MAMAK'])
    expect(lessLikely('THAI', 'DINNER', 'THAI')).toEqual([])
    expect(lessLikely('THAI', 'DINNER', null, 'THAI')).toEqual([])
    expect(lessLikely(null, 'DINNER')).toEqual([])
    for (const part of ALL_DAY_PARTS) {
      for (const cuisine of SPECIFIC_CUISINES) {
        expect(lessLikely(cuisine, part).some((c) => boosted(part).has(c)), `${cuisine} ${part}`).toBe(false)
      }
    }
  })

  it('PICK-08 上一餐 = 5 个钟头内的（刚好 5 小时算，多 1 毫秒不算），9 小时前的不算', () => {
    const hour = 3_600_000
    const now = 1_790_000_000_000
    const visits = [visit('a', 'THAI', now - 4 * hour), visit('b', 'JAPANESE', now - 9 * hour)]
    expect(lastMeal(visits, now)?.cuisine).toBe('THAI')
    expect(recentCuisines(visits, now)).toEqual(['THAI'])
    expect(lastMeal(visits, now + 2 * hour)).toBeNull()
    expect(lastMeal([visit('x', 'THAI', now - 5 * hour - 1)], now)).toBeNull()
    expect(lastMeal([visit('x', 'THAI', now - 5 * hour)], now)?.placeId).toBe('x')
  })

  it('PICK-09 说明只一行，优先顺序：这次不摇… > 饭签 > 刚才吃过… > 时段说明；都没有就不显示', () => {
    expect(pickNote('JAPANESE', 0, 'CHINESE', 'SUPPER', ['THAI'])).toEqual({ kind: 'EXCLUDED', cuisine: 'JAPANESE' })
    expect(pickNote(null, 3, 'CHINESE', 'SUPPER', ['THAI'])).toEqual({ kind: 'FORTUNE', stickIndex: 3 })
    expect(pickNote(null, null, null, 'SUPPER', ['THAI'])).toEqual({ kind: 'EATEN_RECENTLY', cuisine: 'THAI' })
    expect(pickNote(null, null, null, 'SUPPER', [])).toEqual({ kind: 'TIME_OF_DAY', dayPart: 'SUPPER' })
    expect(pickNote(null, null, null, null, ['THAI'])).toEqual({ kind: 'EATEN_RECENTLY', cuisine: 'THAI' })
    expect(pickNote(null, null, null, null, [])).toBeNull()
  })

  it('PICK-10 有饭签时，5 个时段各摇 3,000 次：都合理、不连续重复、只摇权重 > 0 的菜系', () => {
    const random = seeded(8)
    for (const part of ALL_DAY_PARTS) {
      let previous: SearchChoice | null = null
      for (let i = 0; i < 3000; i++) {
        const p: SearchChoice = pick(random, { exclude: previous, dayPart: part, favoured: { cuisine: 'HOT_POT', meal: 'NOODLE' } })
        expect(isReasonable(p)).toBe(true)
        expect(previous && key(previous)).not.toBe(key(p))
        expect(weight(part, p.cuisine)).toBeGreaterThan(0)
        previous = p
      }
    }
  })

  it('PICK-11 凌晨 2 点摇 10,000 次：嘛嘛档 > 15%、日本餐 < 5%、嘛嘛档是日本餐 5 倍以上、从不连续重复、都合理', () => {
    const picks = spin('SUPPER', 10_000)
    const counts = countBy(picks, (p) => p.cuisine)
    const mamak = (counts.get('INDIAN_MAMAK') ?? 0) / 10_000
    const japanese = (counts.get('JAPANESE') ?? 0) / 10_000
    expect(mamak).toBeGreaterThan(0.15)
    expect(japanese).toBeLessThan(0.05)
    expect(mamak).toBeGreaterThan(japanese * 5)
    expect(noRepeats(picks)).toBe(true)
    expect(picks.every((p) => isReasonable(p) && isSpecific(p.cuisine))).toBe(true)
  })

  it('PICK-12 早上 7 点摇 10,000 次：没有火锅和海鲜，点心/马来/嘛嘛档/中餐超过 7,000 次，不连续重复', () => {
    const picks = spin('BREAKFAST', 10_000)
    expect(picks.some((p) => p.cuisine === 'HOT_POT' || p.cuisine === 'SEAFOOD')).toBe(false)
    const favourites = new Set(['HK_DIM_SUM', 'MALAY', 'INDIAN_MAMAK', 'CHINESE'])
    expect(picks.filter((p) => favourites.has(p.cuisine)).length).toBeGreaterThan(7000)
    expect(noRepeats(picks)).toBe(true)
  })

  it('PICK-13 宵夜、午餐、下午茶、晚餐各摇 20,000 次，每个合理组合都摇得到；早餐除了火锅和海鲜都摇得到', () => {
    const reasonable = new Set(reasonableChoices().map(key))
    for (const part of ['SUPPER', 'LUNCH', 'TEA', 'DINNER'] as const) {
      expect(new Set(spin(part, 20_000).map(key)), part).toEqual(reasonable)
    }
    const breakfast = new Set(reasonableChoices().filter((c) => c.cuisine !== 'HOT_POT' && c.cuisine !== 'SEAFOOD').map(key))
    expect(new Set(spin('BREAKFAST', 20_000).map(key))).toEqual(breakfast)
  })

  it('PICK-14 午餐中餐是韩国餐 2 倍以上；下午茶点心是泰国餐 3 倍以上、西餐是泰国餐 2 倍以上；晚餐火锅比韩国餐多', () => {
    const share = (part: DayPartId, cuisine: CuisineId) => spin(part, 10_000).filter((p) => p.cuisine === cuisine).length / 10_000
    expect(share('LUNCH', 'CHINESE')).toBeGreaterThan(share('LUNCH', 'KOREAN') * 2)
    expect(share('TEA', 'HK_DIM_SUM')).toBeGreaterThan(share('TEA', 'THAI') * 3)
    expect(share('TEA', 'WESTERN')).toBeGreaterThan(share('TEA', 'THAI') * 2)
    expect(share('DINNER', 'HOT_POT')).toBeGreaterThan(share('DINNER', 'KOREAN'))
  })

  it('PICK-15 「换个菜系再摇」：12 个菜系 × 5 个时段各摇 2,000 次，从不摇到被排除的菜系', () => {
    for (const cuisine of SPECIFIC_CUISINES) {
      for (const part of ALL_DAY_PARTS) {
        expect(spin(part, 2000, 2026, cuisine).some((p) => p.cuisine === cuisine), `${cuisine} ${part}`).toBe(false)
      }
    }
  })

  it('PICK-16 被少给的菜系出现次数约为原来的三分之一（比例 0.25–0.45）', () => {
    const random = seeded(4)
    const normal = Array.from({ length: 30_000 }, () => pick(random, { dayPart: 'DINNER' })).filter((p) => p.cuisine === 'CHINESE').length
    const less = Array.from({ length: 30_000 }, () => pick(random, { dayPart: 'DINNER', lessLikely: ['CHINESE'] })).filter((p) => p.cuisine === 'CHINESE').length
    const ratio = less / normal
    expect(ratio).toBeGreaterThanOrEqual(0.25)
    expect(ratio).toBeLessThanOrEqual(0.45)
  })
})
