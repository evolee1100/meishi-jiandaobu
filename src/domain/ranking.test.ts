import { describe, expect, it } from 'vitest'
import { seeded, testPlace } from '../test/helpers.ts'
import type { Place } from './model.ts'
import { applyCuisineFilter, isEatery, priorMean, rank, rankedPlaces, score } from './ranking.ts'
import { matchTypesFor } from './searchConfig.ts'

const japanese = matchTypesFor('JAPANESE')

function typed(id: string, types: string[], primary = 'restaurant', rating: number | null = 4.2): Place {
  return { ...testPlace(id, { rating }), primaryType: primary, types: [...types, 'restaurant', 'food'] }
}

describe('八、排名、菜系软过滤、吃饭的地方', () => {
  it('RANK-01 有 3 家以上被标成日本餐类型时，只留这些', () => {
    const places = [
      typed('ramen', ['ramen_restaurant'], 'ramen_restaurant'),
      typed('sushi', ['sushi_restaurant', 'japanese_restaurant']),
      typed('donburi', ['japanese_restaurant']),
      typed('kopitiam', ['coffee_shop']),
      typed('mamak', ['indian_restaurant']),
    ]
    expect(applyCuisineFilter(places, japanese).map((p) => p.id)).toEqual(['ramen', 'sushi', 'donburi'])
  })

  it('RANK-02 标对类型的不到 3 家时一家都不去掉', () => {
    const places = [typed('ramen', ['ramen_restaurant']), typed('stall', []), typed('japanese', ['japanese_restaurant']), typed('other', ['coffee_shop'])]
    expect(applyCuisineFilter(places, japanese)).toEqual(places)
  })

  it('RANK-03 primaryType 对得上也算', () => {
    const places = [
      { ...testPlace('a'), primaryType: 'japanese_restaurant', types: ['food'] },
      { ...testPlace('b'), primaryType: 'ramen_restaurant', types: ['food'] },
      { ...testPlace('c'), primaryType: 'sushi_restaurant', types: ['food'] },
      testPlace('d'),
    ]
    expect(applyCuisineFilter(places, japanese).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('RANK-04 没有评分（排不了名）的店不算进那 3 家，所以不过滤', () => {
    const places = [typed('ramen', ['ramen_restaurant']), typed('sushi', ['sushi_restaurant']), typed('unrated', ['japanese_restaurant'], 'restaurant', null), typed('stall', [])]
    expect(applyCuisineFilter(places, japanese)).toEqual(places)
  })

  it('RANK-05 不限从不过滤；空列表还是空', () => {
    const places = [typed('a', ['japanese_restaurant']), typed('b', ['thai_restaurant'])]
    expect(applyCuisineFilter(places, matchTypesFor('ANY'))).toEqual(places)
    expect(applyCuisineFilter([], japanese)).toEqual([])
  })

  it('RANK-06 餐厅、面档、外卖店、咖啡店、美食中心、嘛嘛档、只标 restaurant 或只标 food 的小贩档都算吃饭的地方', () => {
    expect(isEatery(['malaysian_restaurant', 'restaurant', 'food'], 'malaysian_restaurant')).toBe(true)
    expect(isEatery(['chinese_noodle_restaurant', 'food'], 'chinese_noodle_restaurant')).toBe(true)
    expect(isEatery(['noodle_shop', 'food', 'point_of_interest'], 'noodle_shop')).toBe(true)
    expect(isEatery(['meal_takeaway', 'food'], 'meal_takeaway')).toBe(true)
    expect(isEatery(['coffee_shop', 'cafe', 'food'], 'coffee_shop')).toBe(true)
    expect(isEatery(['food_court', 'food'], 'food_court')).toBe(true)
    expect(isEatery(['indian_restaurant', 'halal_restaurant', 'restaurant'], 'indian_restaurant')).toBe(true)
    expect(isEatery(['restaurant', 'food'], null)).toBe(true)
    expect(isEatery(['food', 'point_of_interest', 'establishment'], null)).toBe(true)
  })

  it('RANK-07 酒店（饭店）、住宿、面包店、杂货店、米行、食品店、只有 point_of_interest 的都不算', () => {
    expect(isEatery(['hotel', 'lodging', 'restaurant'], 'hotel')).toBe(false)
    expect(isEatery(['lodging', 'point_of_interest'], 'lodging')).toBe(false)
    expect(isEatery(['bakery', 'food', 'store'], 'bakery')).toBe(false)
    expect(isEatery(['grocery_store', 'food', 'store'], 'grocery_store')).toBe(false)
    expect(isEatery(['wholesaler', 'store', 'point_of_interest'], 'wholesaler')).toBe(false)
    expect(isEatery(['food_store', 'food', 'store'], null)).toBe(false)
    expect(isEatery(['point_of_interest', 'establishment'], null)).toBe(false)
  })

  it('RANK-08 4.5★/800 条排在 4.9★/40 条前面，前 3 名是 popular、newcomer、c，一共看了 5 家', () => {
    const result = rank([
      testPlace('newcomer', { rating: 4.9, reviews: 40 }),
      testPlace('popular', { rating: 4.5, reviews: 800 }),
      testPlace('a', { rating: 4.0, reviews: 300 }),
      testPlace('b', { rating: 3.6, reviews: 150 }),
      testPlace('c', { rating: 4.1, reviews: 90 }),
    ])
    expect(result.top.map((p) => p.id)).toEqual(['popular', 'newcomer', 'c'])
    expect(result.consideredCount).toBe(5)
  })

  it('RANK-09 只有这两家时 4.5★/800 条照样赢（平均 4.7 被限制在 4.2）', () => {
    const result = rank([testPlace('newcomer', { rating: 4.9, reviews: 40 }), testPlace('popular', { rating: 4.5, reviews: 800 })])
    expect(result.top.map((p) => p.id)).toEqual(['popular', 'newcomer'])
    expect(priorMean(result.top)).toBeCloseTo(4.2, 9)
  })

  it('RANK-10 随机加 0–11 家别的店，跑 500 轮，4.5★/800 条永远在 4.9★/40 条前面', () => {
    const random = seeded(1)
    for (let round = 0; round < 500; round++) {
      const n = random.nextInt(0, 12)
      const others = Array.from({ length: n }, (_, i) => testPlace(`o${round}-${i}`, { rating: 3.0 + random.nextDouble() * 2.0, reviews: random.nextInt(30, 3000) }))
      const sorted = rankedPlaces([...others, testPlace('newcomer', { rating: 4.9, reviews: 40 }), testPlace('popular', { rating: 4.5, reviews: 800 })]).map((p) => p.id)
      expect(sorted.indexOf('popular'), `round ${round}`).toBeLessThan(sorted.indexOf('newcomer'))
    }
  })

  it('RANK-11 C = 候选平均星数，最高 4.2；没有候选 = 4.0', () => {
    expect(priorMean([testPlace('a', { rating: 3.8 }), testPlace('b', { rating: 4.2 })])).toBeCloseTo(4.0, 9)
    expect(priorMean([testPlace('a', { rating: 4.6 }), testPlace('b', { rating: 4.8 })])).toBeCloseTo(4.2, 9)
    expect(priorMean([])).toBe(4.0)
  })

  it('RANK-12 排序结果包含全部合格的店，最好的在前，前 3 就是排名结果', () => {
    const many = Array.from({ length: 10 }, (_, i) => testPlace(`p${i + 1}`, { rating: 3.5 + (i + 1) * 0.1, reviews: 100 + i + 1 }))
    expect(rankedPlaces(many).map((p) => p.id)).toEqual(Array.from({ length: 10 }, (_, i) => `p${10 - i}`))
    expect(rank(many).top).toEqual(rankedPlaces(many).slice(0, 3))
  })

  it('RANK-13 分数 = v/(v+100)×R + 100/(v+100)×C', () => {
    expect(score(4.5, 800, 4.0)).toBeCloseTo(4.4444, 4)
    expect(score(4.9, 40, 4.0)).toBeCloseTo(4.2571, 4)
    expect(score(4.5, 800, 4.0)).toBeGreaterThan(score(4.9, 40, 4.0))
    expect(score(5.0, 0, 4.0)).toBeCloseTo(4.0, 9)
  })

  it('RANK-14 永久倒闭、暂停营业、没有评分的店不出现；没有 businessStatus 的照样算', () => {
    const result = rank([
      testPlace('closed', { rating: 5.0, reviews: 5000, businessStatus: 'CLOSED_PERMANENTLY' }),
      testPlace('temp', { rating: 5.0, reviews: 5000, businessStatus: 'CLOSED_TEMPORARILY' }),
      testPlace('unrated', { rating: null, reviews: null }),
      testPlace('ok1', { rating: 4.0, reviews: 100 }),
      testPlace('ok2', { rating: 4.1, reviews: 100, businessStatus: null }),
      testPlace('ok3', { rating: 4.2, reviews: 100 }),
    ])
    expect(new Set(result.top.map((p) => p.id))).toEqual(new Set(['ok1', 'ok2', 'ok3']))
    expect(result.consideredCount).toBe(3)
  })

  it('RANK-15 评价 ≥ 30 的不到 3 家时放宽到 ≥ 10，5 条评价的照样不算', () => {
    const result = rank([
      testPlace('r50', { rating: 4.2, reviews: 50 }),
      testPlace('r35', { rating: 4.3, reviews: 35 }),
      testPlace('r20', { rating: 4.4, reviews: 20 }),
      testPlace('r15', { rating: 4.0, reviews: 15 }),
      testPlace('r5', { rating: 5.0, reviews: 5 }),
    ])
    expect(result.consideredCount).toBe(4)
    expect(result.top.some((p) => p.id === 'r5')).toBe(false)
    expect(result.top).toHaveLength(3)
  })

  it('RANK-16 一直放宽到 ≥ 1 条；0 条评价永远不合格；只剩 2 家就返回 2 家', () => {
    const result = rank([testPlace('r3', { rating: 4.8, reviews: 3 }), testPlace('r2', { rating: 4.0, reviews: 2 }), testPlace('r0', { rating: 4.9, reviews: 0 })])
    expect(result.consideredCount).toBe(2)
    expect(result.top.map((p) => p.id)).toEqual(['r3', 'r2'])
  })

  it('RANK-17 有 3 家 ≥ 30 条时就用 30 的门槛，29 条的 5.0★ 不算', () => {
    const result = rank([
      testPlace('a', { rating: 4.0, reviews: 30 }),
      testPlace('b', { rating: 4.0, reviews: 31 }),
      testPlace('c', { rating: 4.0, reviews: 32 }),
      testPlace('d', { rating: 5.0, reviews: 29 }),
    ])
    expect(result.consideredCount).toBe(3)
    expect(result.top.some((p) => p.id === 'd')).toBe(false)
  })

  it('RANK-18 分数一样时评价多的在前，再一样时近的在前', () => {
    const result = rank([
      testPlace('far', { rating: 4.0, reviews: 200, distanceMeters: 900 }),
      testPlace('near', { rating: 4.0, reviews: 200, distanceMeters: 100 }),
      testPlace('most', { rating: 4.0, reviews: 900, distanceMeters: 1200 }),
      testPlace('few', { rating: 4.0, reviews: 40, distanceMeters: 50 }),
    ])
    expect(result.top.map((p) => p.id)).toEqual(['most', 'near', 'far'])
  })

  it('RANK-19 最多取 3 家；空的输入返回空、看了 0 家', () => {
    const many = Array.from({ length: 10 }, (_, i) => testPlace(`p${i + 1}`, { rating: 3.5 + (i + 1) * 0.1, reviews: 100 + i + 1 }))
    expect(rank(many).top).toHaveLength(3)
    expect(rank(many).top.map((p) => p.id)).toEqual(['p10', 'p9', 'p8'])
    const empty = rank([])
    expect(empty.top).toEqual([])
    expect(empty.consideredCount).toBe(0)
  })
})
