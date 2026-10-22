import kotlinRandomRaw from '../test/golden/kotlinRandom.json?raw'
import { describe, expect, it } from 'vitest'
import { KotlinRandom } from '../data/kotlinRandom.ts'
import { KL, klMillis, seeded, testPlace } from '../test/helpers.ts'
import { isReasonable, isSpecific } from './cuisine.ts'
import { fortuneChoice, fortuneIndexAt, fortuneIndexFor, fortuneStick, STICK_COUNT } from './fortune.ts'
import type { SearchChoice } from './model.ts'
import { pick } from './randomPicker.ts'
import { matchTypesFor } from './searchConfig.ts'
import { ShakeDetector, SHAKE_THRESHOLD, spinMillisFor } from './shake.ts'
import { epochDayOfIsoDate } from './time.ts'
import {
  addVisit,
  cuisineOfVisit,
  daysAgo,
  decodeVisits,
  encodeVisits,
  isShownAt,
  lastVisits,
  prunedVisits,
  recentCuisines,
  streak,
  visit,
} from './visits.ts'

const DAY = epochDayOfIsoDate('2026-10-06') as number

describe('二十五、📜 今日饭签', () => {
  it('FORTUNE-01 同一部手机同一天抽 100 次都是同一支', () => {
    const first = fortuneIndexFor(DAY, 42n)
    for (let i = 0; i < 100; i++) expect(fortuneIndexFor(DAY, 42n)).toBe(first)
    // 同一天的任何时刻（按手机当地日期）都一样。
    expect(fortuneIndexAt(klMillis(6, 0, 1), KL, 42n)).toBe(first)
    expect(fortuneIndexAt(klMillis(6, 23, 59), KL, 42n)).toBe(first)
  })

  it('FORTUNE-02 4 个种子各连续 30 天：30 天 30 支都不一样，相邻两天不重复', () => {
    for (const seed of [1n, 42n, -7n, 20261004n]) {
      const month = Array.from({ length: 30 }, (_, i) => fortuneIndexFor(DAY + i, seed))
      expect(new Set(month).size).toBe(30)
      expect(month.every((m, i) => i === 0 || m !== month[i - 1])).toBe(true)
    }
  })

  it('FORTUNE-03 20 部不同的手机同一天至少抽到 10 种不同的签', () => {
    const sticks = new Set(Array.from({ length: 20 }, (_, i) => fortuneIndexFor(DAY, BigInt(i + 1) * 7919n)))
    expect(sticks.size).toBeGreaterThanOrEqual(10)
  })

  it('FORTUNE-04 40 支签，每支的「宜」都是合理组合、有具体菜系，五种签运都有', () => {
    expect(STICK_COUNT).toBe(40)
    const levels = new Set<string>()
    for (let i = 0; i < STICK_COUNT; i++) {
      const choice = fortuneChoice(i)
      expect(isReasonable(choice), `${i}`).toBe(true)
      expect(isSpecific(choice.cuisine)).toBe(true)
      levels.add(fortuneStick(i).level)
    }
    expect(levels).toEqual(new Set(['TOP', 'GREAT', 'GOOD', 'MIDDLE', 'SMALL']))
  })

  it('FORTUNE-05 晚餐摇 30,000 次：签上的组合（越南餐・面）出现的比例是没抽签时的 2.2 倍以上', () => {
    const favoured: SearchChoice = { cuisine: 'VIETNAMESE', meal: 'NOODLE' }
    const share = (fortune: SearchChoice | null) => {
      const random = seeded(5)
      let n = 0
      for (let i = 0; i < 30_000; i++) {
        const p = pick(random, { dayPart: 'DINNER', favoured: fortune })
        if (p.cuisine === favoured.cuisine && p.meal === favoured.meal) n++
      }
      return n / 30_000
    }
    const plain = share(null)
    const boosted = share(favoured)
    expect(boosted).toBeGreaterThan(plain * 2.2)
  })

  it('WEB-10 KotlinRandom 和 golden/kotlinRandom.json 一样；饭签下标 = shuffled(0..39, KotlinRandom(phoneSeed))[epochDay mod 40]，按本地日期', () => {
    const golden = JSON.parse(kotlinRandomRaw) as {
      sequences: {
        seed: string
        nextInt: number[]
        nextInt7: number[]
        nextInt1to99: number[]
        nextInt16: number[]
        nextDouble: number[]
        nextDouble150to1400: number[]
        nextFloat: number[]
        nextLong: string[]
        shuffled40: number[]
      }[]
      fortuneIndex: { seed: string; day: string; index: number }[]
    }
    expect(golden.sequences.length).toBeGreaterThanOrEqual(10)
    for (const s of golden.sequences) {
      const r = new KotlinRandom(BigInt(s.seed))
      expect(Array.from({ length: 12 }, () => r.nextInt()), s.seed).toEqual(s.nextInt)
      expect(Array.from({ length: 12 }, () => r.nextInt(7))).toEqual(s.nextInt7)
      expect(Array.from({ length: 12 }, () => r.nextInt(1, 99))).toEqual(s.nextInt1to99)
      expect(Array.from({ length: 12 }, () => r.nextInt(16))).toEqual(s.nextInt16)
      expect(Array.from({ length: 8 }, () => r.nextDouble())).toEqual(s.nextDouble)
      expect(Array.from({ length: 8 }, () => r.nextDouble(150, 1400))).toEqual(s.nextDouble150to1400)
      expect(Array.from({ length: 8 }, () => Math.fround(r.nextFloat()))).toEqual(s.nextFloat.map((x) => Math.fround(x)))
      expect(Array.from({ length: 4 }, () => r.nextLong().toString())).toEqual(s.nextLong)
      expect(new KotlinRandom(BigInt(s.seed)).shuffled(Array.from({ length: 40 }, (_, i) => i))).toEqual(s.shuffled40)
    }
    expect(golden.fortuneIndex.length).toBeGreaterThan(0)
    for (const f of golden.fortuneIndex) {
      expect(fortuneIndexFor(epochDayOfIsoDate(f.day) as number, BigInt(f.seed)), `${f.seed} ${f.day}`).toBe(f.index)
      // 本地日期：吉隆坡那天的早上 7 点（UTC 还是前一天 23 点）也是同一支。
      const [y, m, d] = f.day.split('-').map(Number) as [number, number, number]
      expect(fortuneIndexAt(klMillis(d, 7, 0, m, y), KL, BigInt(f.seed))).toBe(f.index)
    }
  })
})

// ------------------------------------------------------------------ 📳 摇一摇

const G = Math.fround(9.81)
type Reading = [number, number, number]

function feed(detector: ShakeDetector, samples: Reading[], startMs = 0): number[] {
  const found: number[] = []
  samples.forEach(([x, y, z], i) => {
    const s = detector.onReading(startMs + i * 20, x, y, z)
    if (s != null) found.push(s)
  })
  return found
}

const still = (seconds: number): Reading[] => Array.from({ length: Math.trunc(seconds * 50) }, () => [0, G, 0])

function hardShake(strength = 30): Reading[] {
  return [
    ...Array.from({ length: 6 }, (): Reading => [strength, G, 0]),
    ...Array.from({ length: 6 }, (): Reading => [-strength, G, 0]),
    ...Array.from({ length: 6 }, (): Reading => [strength, G, 0]),
    ...Array.from({ length: 6 }, (): Reading => [0, G, 0]),
  ]
}

describe('二十六、📳 摇一摇', () => {
  it('SHAKE-01 假的感应器数据：走路、坐巴士、轻轻晃、放到桌上（一下重击 + 同方向的小弹跳）都不触发', () => {
    const f = Math.fround
    const walking = Array.from({ length: 500 }, (_, i): Reading => {
      const t = i / 50
      return [f(1.5 * Math.sin(2 * Math.PI * 1.8 * t)), f(9.81 + 4 * Math.sin(2 * Math.PI * 1.8 * t)), f(0.5)]
    })
    expect(feed(new ShakeDetector(), walking)).toEqual([])
    const random = seeded(3)
    const bus = Array.from({ length: 1000 }, (): Reading => {
      const x = f(f(random.nextFloat() * 6) - 3)
      const y = f(f(G + f(random.nextFloat() * 6)) - 3)
      const z = f(f(random.nextFloat() * 4) - 2)
      return [x, y, z]
    })
    expect(feed(new ShakeDetector(), bus)).toEqual([])
    const wiggle = Array.from({ length: 300 }, (_, i): Reading => [f(7 * Math.sin((2 * Math.PI * 3.0 * i) / 50)), G, 0])
    expect(feed(new ShakeDetector(), wiggle)).toEqual([])
    const table: Reading[] = [...still(0.5), [0, f(G + 25), 0], [0, f(G + 18), 0], ...still(0.1), [0, f(G + 16), 0], ...still(1.0)]
    expect(feed(new ShakeDetector(), table)).toEqual([])
  })

  it('SHAKE-02 用力来回甩两下触发一次（力度 ≥ 14）；1.5 秒内接着甩不算；之后再甩又算一次', () => {
    const detector = new ShakeDetector()
    const once = feed(detector, [...still(0.5), ...hardShake()])
    expect(once).toHaveLength(1)
    expect(once[0]).toBeGreaterThanOrEqual(SHAKE_THRESHOLD)
    expect(SHAKE_THRESHOLD).toBe(14)
    expect(feed(detector, [...hardShake(), ...hardShake()], 1000)).toEqual([])
    expect(feed(detector, [...still(0.3), ...hardShake()], 4000)).toHaveLength(1)
  })

  it('SHAKE-03 力度 14 → 转 1.1 秒，80 → 2 秒，25 → 中间', () => {
    expect(spinMillisFor(SHAKE_THRESHOLD)).toBe(1100)
    expect(spinMillisFor(80)).toBe(2000)
    const middle = spinMillisFor(25)
    expect(middle).toBeGreaterThan(1100)
    expect(middle).toBeLessThan(2000)
  })
})

// ------------------------------------------------------------------ 👣 吃过的记录

const HOUR = 3_600_000
const D = 24 * HOUR
const NOW = 1_790_000_000_000
const MINUTE = 60_000

describe('二十七、👣 吃过的记录、连吃提醒', () => {
  it('VISIT-01 最多 50 餐、新的在前；61 天前的和超过 12 小时的「未来」记录丢掉；手机时钟被调回几个钟头的「未来」记录先留着、但不显示', () => {
    let visits: ReturnType<typeof prunedVisits> = []
    for (let i = 0; i < 70; i++) visits = addVisit(visits, visit(`p${i}`, 'CHINESE', NOW - (70 - i) * 5 * HOUR))
    expect(visits).toHaveLength(50)
    expect(visits[0]?.placeId).toBe('p69')
    const old = [visit('old', null, NOW - 61 * D), visit('ok', null, NOW - 59 * D), visit('future', null, NOW + D)]
    expect(prunedVisits(old, NOW).map((v) => v.placeId)).toEqual(['ok'])
    const fewHoursAhead = visit('lunch', 'CHINESE', NOW + 5 * HOUR)
    expect(prunedVisits([...old, fewHoursAhead], NOW).map((v) => v.placeId)).toEqual(['lunch', 'ok'])
    expect(isShownAt(fewHoursAhead.atMillis, NOW)).toBe(false)
  })

  it('VISIT-02 每笔只有 placeId、cuisine、atMillis 三个字段（JSON 一模一样）', () => {
    expect(encodeVisits([visit('ChIJabc', 'SEAFOOD', NOW)])).toBe(`[{"placeId":"ChIJabc","cuisine":"SEAFOOD","atMillis":${NOW}}]`)
    const decoded = decodeVisits(encodeVisits([visit('ChIJabc', 'SEAFOOD', NOW), visit('x', null, NOW - 1)]))
    expect(decoded).toEqual([visit('ChIJabc', 'SEAFOOD', NOW), visit('x', null, NOW - 1)])
    expect(Object.keys(decoded[0] as object).sort()).toEqual(['atMillis', 'cuisine', 'placeId'])
    expect(decodeVisits('not json')).toEqual([])
    expect(decodeVisits('[{"placeId":1}]')).toEqual([])
    expect(decodeVisits(null)).toEqual([])
  })

  it('VISIT-03 按日历算第几天：今天中午 = 0、昨天 = 1、3 天前 = 3；昨晚 23:50 在今天 00:10 看是「昨天」', () => {
    const today2pm = klMillis(6, 14)
    const noon = klMillis(6, 12, 30)
    expect(daysAgo(noon, today2pm, KL)).toBe(0)
    expect(daysAgo(noon - D, today2pm, KL)).toBe(1)
    expect(daysAgo(noon - 3 * D, today2pm, KL)).toBe(3)
    expect(daysAgo(klMillis(5, 23, 50), klMillis(6, 0, 10), KL)).toBe(1)
  })

  it('VISIT-04 比画面时钟晚 1.5 分钟的导航照样显示（时钟会落后一点）；晚 10 个钟头的（时钟被调回去）先不显示', () => {
    expect(isShownAt(NOW + 90_000, NOW)).toBe(true)
    expect(isShownAt(NOW - 3 * D, NOW)).toBe(true)
    expect(isShownAt(NOW + 10 * HOUR, NOW)).toBe(false)
  })

  it('VISIT-05 一餐只算一次：几分钟内导航 a、b、c、c 只留 c；三餐中餐才提醒；1:50 内算同一餐、2:10 算两餐；旧版本（每次都记）读成一餐', () => {
    let visits: ReturnType<typeof prunedVisits> = []
    ;['a', 'b', 'c', 'c'].forEach((id, i) => {
      visits = addVisit(visits, visit(id, 'CHINESE', NOW + i * 3 * MINUTE))
    })
    expect(visits.map((v) => v.placeId)).toEqual(['c'])
    expect(streak(visits)).toBeNull()
    expect(recentCuisines(visits, NOW + 10 * MINUTE)).toEqual(['CHINESE'])
    visits = addVisit(visits, visit('d', 'CHINESE', NOW + 7 * 60 * MINUTE))
    expect(streak(visits)).toBeNull()
    visits = addVisit(visits, visit('e', 'CHINESE', NOW + 24 * 60 * MINUTE))
    expect(streak(visits)).toBe('CHINESE')
    expect(prunedVisits([visit('x', null, NOW), visit('y', null, NOW + 110 * MINUTE)], NOW)).toHaveLength(1)
    expect(prunedVisits([visit('x', null, NOW), visit('y', null, NOW + 130 * MINUTE)], NOW)).toHaveLength(2)
    const old = [visit('a', 'CHINESE', NOW), visit('b', 'CHINESE', NOW - MINUTE), visit('c', 'CHINESE', NOW - 2 * MINUTE)]
    expect(streak(old)).toBeNull()
    expect(prunedVisits(old, NOW).map((v) => v.placeId)).toEqual(['a'])
  })

  it('VISIT-06 最近吃的菜系、连吃 3 餐才算、每家店最后一次去的时间；菜系：具体菜系就算那个，不限按店的类型（先看 primaryType）对到第一个菜系，对不上就没有', () => {
    const visits = [visit('a', 'CHINESE', NOW - 1000), visit('b', 'CHINESE', NOW - 2 * D), visit('c', 'CHINESE', NOW - 3 * D), visit('d', 'MALAY', NOW - 4 * D)]
    expect(recentCuisines(visits, NOW)).toEqual(['CHINESE'])
    expect(streak(visits)).toBe('CHINESE')
    expect(streak(visits.slice(1))).toBeNull()
    expect(streak(visits.slice(0, 2))).toBeNull()
    expect(streak([visit('x', null, NOW), visit('y', null, NOW - 1), visit('z', null, NOW - 2)])).toBeNull()
    expect(lastVisits([...visits.slice(0, 2), visit('a', null, NOW - 9 * D)])).toEqual(
      new Map([
        ['a', NOW - 1000],
        ['b', NOW - 2 * D],
      ]),
    )
    const chickenRice = { ...testPlace('chicken'), primaryType: 'chinese_restaurant', types: ['chinese_restaurant', 'restaurant'] }
    expect(cuisineOfVisit(chickenRice, 'SEAFOOD', matchTypesFor)).toBe('SEAFOOD')
    expect(cuisineOfVisit(chickenRice, 'ANY', matchTypesFor)).toBe('CHINESE')
    expect(cuisineOfVisit(testPlace('plain'), 'ANY', matchTypesFor)).toBeNull()
  })
})
