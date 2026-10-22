import { describe, expect, it } from 'vitest'
import { QUOTA } from '../data/constants.ts'
import { MEALS } from '../data/cuisines.ts'
import { findTraditional } from '../test/helpers.ts'
import { containsCjk } from './chineseText.ts'
import { allChoices, ALL_CUISINES, choiceEmoji, choiceLabel, choiceLabelParts, cuisineData, SPECIFIC_CUISINES } from './cuisine.ts'
import { matchTypesFor, QUERIES_PER_SEARCH, queriesFor } from './searchConfig.ts'

describe('七、菜系、关键词表、标题', () => {
  it('QUERY-01 39 个组合各有 1–3 个关键词：不重复、不空、前后没空格、英文不超过 2 个词、中文不超过 5 个字、没有饭店面包、没有繁体', () => {
    const choices = allChoices()
    expect(choices).toHaveLength(39)
    for (const choice of choices) {
      const queries = queriesFor(choice)
      const label = `${choice.cuisine}/${choice.meal}`
      expect(queries.length, label).toBeGreaterThanOrEqual(1)
      expect(queries.length, label).toBeLessThanOrEqual(3)
      expect(new Set(queries).size, label).toBe(queries.length)
      for (const query of queries) {
        expect(query.trim(), label).not.toBe('')
        expect(query.trim(), label).toBe(query)
        expect(query.split(/\s+/).length, query).toBeLessThanOrEqual(2)
        if (containsCjk(query)) expect(query.length, query).toBeLessThanOrEqual(5)
        expect(query.includes('饭店') || query.includes('面包'), query).toBe(false)
        expect(findTraditional(query)).toEqual([])
      }
    }
  })

  it('QUERY-02 每个组合都至少有一个中文词和一个英文/马来文词', () => {
    for (const choice of allChoices()) {
      const queries = queriesFor(choice)
      expect(queries.some(containsCjk), `${choice.cuisine}/${choice.meal}`).toBe(true)
      expect(queries.some((q) => !containsCjk(q)), `${choice.cuisine}/${choice.meal}`).toBe(true)
    }
  })

  it('QUERY-03 不限+饭 / 面 / 都可以 的关键词', () => {
    expect(queriesFor({ cuisine: 'ANY', meal: 'RICE' })).toEqual(['饭', 'rice restaurant', 'nasi'])
    expect(queriesFor({ cuisine: 'ANY', meal: 'NOODLE' })).toEqual(['面', 'noodle restaurant', 'mee'])
    expect(queriesFor({ cuisine: 'ANY', meal: 'ANY' })).toEqual(['餐厅', 'restaurant', 'kedai makan'])
  })

  it('QUERY-04 用了本地叫法', () => {
    expect(queriesFor({ cuisine: 'JAPANESE', meal: 'NOODLE' })).toEqual(['拉面', 'ramen', 'udon'])
    expect(queriesFor({ cuisine: 'CHINESE', meal: 'ANY' })).toContain('煮炒')
    expect(queriesFor({ cuisine: 'INDIAN_MAMAK', meal: 'RICE' })).toContain('nasi kandar')
    expect(queriesFor({ cuisine: 'HOT_POT', meal: 'ANY' })).toContain('steamboat')
    expect(queriesFor({ cuisine: 'THAI', meal: 'ANY' })).toContain('tomyam')
  })

  it('QUERY-05 12 个菜系都有校对用的 Google 类型（都以 _restaurant 结尾或 steak_house），不限没有', () => {
    expect(matchTypesFor('ANY').size).toBe(0)
    for (const cuisine of SPECIFIC_CUISINES) {
      const types = [...matchTypesFor(cuisine)]
      expect(types.length, cuisine).toBeGreaterThan(0)
      expect(types.every((t) => /^[a-z_]+$/.test(t) && (t.endsWith('_restaurant') || t === 'steak_house')), cuisine).toBe(true)
    }
    expect(matchTypesFor('JAPANESE').has('japanese_restaurant')).toBe(true)
    expect([...matchTypesFor('HOT_POT')]).toEqual(['hot_pot_restaurant'])
  })

  it('QUERY-06 每次搜索最多 3 个请求，所以每月 900 个 = 300 次搜索', () => {
    expect(QUERIES_PER_SEARCH).toBe(3)
    expect(Math.max(...allChoices().map((c) => queriesFor(c).length))).toBe(3)
    expect(QUOTA.SEARCHES_PER_MONTH).toBe(300)
    expect(QUOTA.TEXT_SEARCH_MONTHLY_LIMIT / QUERIES_PER_SEARCH).toBe(300)
  })

  it('QUERY-07 13 个菜系名字和 emoji 都不重复、简体、不用 🍚🍜🍽️；泰国是带 VS16 的 🌶️；饭/面/都可以', () => {
    expect(ALL_CUISINES).toHaveLength(13)
    expect(SPECIFIC_CUISINES).toHaveLength(12)
    const names = ALL_CUISINES.map((c) => cuisineData(c).zhName)
    const emojis = ALL_CUISINES.map((c) => cuisineData(c).emoji)
    expect(new Set(names).size).toBe(13)
    expect(new Set(emojis).size).toBe(13)
    const mealEmojis = MEALS.map((m) => m.emoji)
    for (const c of ALL_CUISINES) {
      expect(findTraditional(cuisineData(c).zhName)).toEqual([])
      expect(mealEmojis).not.toContain(cuisineData(c).emoji)
    }
    expect(cuisineData('THAI').emoji).toBe('🌶️')
    expect(MEALS.map((m) => m.label)).toEqual(['饭', '面', '都可以'])
  })

  it('QUERY-08 标题名：日本餐・面、中餐、饭、不限+都可以是空的；分段是 [印度/嘛嘛档, 面]', () => {
    expect(choiceLabel({ cuisine: 'JAPANESE', meal: 'NOODLE' })).toBe('日本餐・面')
    expect(choiceLabel({ cuisine: 'CHINESE', meal: 'ANY' })).toBe('中餐')
    expect(choiceLabel({ cuisine: 'ANY', meal: 'RICE' })).toBe('饭')
    expect(choiceLabel({ cuisine: 'ANY', meal: 'ANY' })).toBe('')
    expect(choiceLabelParts({ cuisine: 'INDIAN_MAMAK', meal: 'NOODLE' })).toEqual(['印度/嘛嘛档', '面'])
  })

  it('QUERY-09 组合的 emoji：有菜系用菜系的，不限用饭/面/都可以的', () => {
    expect(choiceEmoji({ cuisine: 'JAPANESE', meal: 'NOODLE' })).toBe('🍣')
    expect(choiceEmoji({ cuisine: 'ANY', meal: 'NOODLE' })).toBe('🍜')
    expect(choiceEmoji({ cuisine: 'ANY', meal: 'ANY' })).toBe('🍽️')
  })
})
