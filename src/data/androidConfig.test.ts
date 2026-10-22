import androidConfigRaw from '../test/golden/androidConfig.json?raw'
import { describe, expect, it } from 'vitest'
import { AVATARS, HANDS, voteMarkers } from './avatars.ts'
import { CUISINES, MEALS } from './cuisines.ts'
import { DAY_PARTS } from './dayParts.ts'
import { DUEL_LINES } from './duelLines.ts'
import { FORTUNE_LEVELS, FORTUNE_STICKS } from './fortunes.ts'
import { PLACES_API, QUOTA } from './constants.ts'
import { weight } from '../domain/randomPicker.ts'
import { QUERIES_PER_SEARCH } from '../domain/searchConfig.ts'
import type { DayPartId } from './types.ts'

/**
 * 网页的规则数据和安卓第四版「一条不差」：标准答案是安卓编译后的真实代码在 JVM 上导出的（web-移植资料/校验/export）。
 * 菜系、关键词、Google 类型、时段权重、多给的菜系、FIELD_MASK、每次搜索的请求数、40 支饭签、头像、手势、投票编号、台词。
 */
interface GoldenCuisine {
  id: string
  zhName: string
  emoji: string
  unsuitableMeals: string[]
  matchTypes: string[]
  queries: Record<string, string[]>
  weights: Record<DayPartId, number>
}

const golden = JSON.parse(androidConfigRaw) as {
  cuisines: GoldenCuisine[]
  meals: { id: string; label: string; emoji: string }[]
  boosted: Record<DayPartId, string[]>
  fieldMask: string
  queriesPerSearch: number
  searchesPerMonth: number
  sticks: { level: string; levelEmoji: string; cuisine: string; meal: string }[]
  avatars: { id: string; emoji: string }[]
  hands: { id: string; emoji: string }[]
  voteMarkers6: string[]
  voteMarkers3: string[]
  duelLines: { id: string; verdict: string }[]
  fortuneLevels: { id: string; emoji: string }[]
}

describe('规则数据和安卓第四版的 JVM 标准答案一样', () => {
  it('13 个菜系：顺序、中文名、emoji、不合理组合、校对用的 Google 类型、每个组合的关键词', () => {
    expect(CUISINES.map((c) => c.id)).toEqual(golden.cuisines.map((c) => c.id))
    for (const [i, g] of golden.cuisines.entries()) {
      const c = CUISINES[i]
      if (!c) throw new Error('少了菜系 ' + g.id)
      expect({ zhName: c.zhName, emoji: c.emoji, unsuitableMeals: c.unsuitableMeals, matchTypes: c.matchTypes, queries: c.queries }, g.id).toEqual({
        zhName: g.zhName,
        emoji: g.emoji,
        unsuitableMeals: g.unsuitableMeals,
        matchTypes: g.matchTypes,
        queries: g.queries,
      })
    }
  })

  it('随便挑：每个菜系在五个时段的权重、每个时段多给机会的菜系', () => {
    for (const g of golden.cuisines) {
      for (const part of Object.keys(g.weights) as DayPartId[]) {
        expect(weight(part, g.id as never), `${g.id} ${part}`).toBe(g.weights[part])
      }
    }
    for (const part of DAY_PARTS) expect([...part.boosted], part.id).toEqual(golden.boosted[part.id])
  })

  it('饭 / 面 / 都可以；FIELD_MASK；每次搜索最多 3 个请求、每月 300 次搜索', () => {
    expect(MEALS.map((m) => ({ id: m.id, label: m.label, emoji: m.emoji }))).toEqual(golden.meals)
    expect(PLACES_API.FIELD_MASK).toBe(golden.fieldMask)
    expect(QUERIES_PER_SEARCH).toBe(golden.queriesPerSearch)
    expect(QUOTA.SEARCHES_PER_MONTH).toBe(golden.searchesPerMonth)
    expect(QUOTA.TEXT_SEARCH_MONTHLY_LIMIT / QUOTA.QUERIES_PER_SEARCH).toBe(golden.searchesPerMonth)
  })

  it('40 支饭签的签运和「宜」的组合、5 种签运', () => {
    expect(FORTUNE_STICKS.map((s) => ({ level: s.level, levelEmoji: FORTUNE_LEVELS[s.level].emoji, cuisine: s.cuisine, meal: s.meal }))).toEqual(golden.sticks)
    expect(Object.entries(FORTUNE_LEVELS).map(([id, l]) => ({ id, emoji: l.emoji }))).toEqual(golden.fortuneLevels)
  })

  it('6 个头像、3 个手势、投票编号、15 句台词（各属哪一组）', () => {
    expect(AVATARS.map((a) => ({ id: a.id, emoji: a.emoji }))).toEqual(golden.avatars)
    expect(HANDS.map((h) => ({ id: h.id, emoji: h.emoji }))).toEqual(golden.hands)
    expect(voteMarkers(6)).toEqual(golden.voteMarkers6)
    expect(voteMarkers(3)).toEqual(golden.voteMarkers3)
    expect(DUEL_LINES.map((l) => ({ id: l.id, verdict: l.verdict }))).toEqual(golden.duelLines)
  })
})
