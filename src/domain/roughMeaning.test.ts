import { describe, expect, it } from 'vitest'
import { findTraditional } from '../test/helpers.ts'
import { roughMeaning, roughMeaningParts } from './roughMeaning.ts'

describe('店名的「大概意思」（手机浏览器没有内建翻译时的小词表）', () => {
  it('马来文 / 英文店名：认得的词按出现顺序拼起来，几个词连在一起的先认', () => {
    expect(roughMeaning('Restoran Nasi Kandar Pelita')).toBe('餐厅、扁担饭')
    expect(roughMeaning('Nasi Lemak Wanjo')).toBe('椰浆饭')
    expect(roughMeaning('Kedai Kopi Ah Seng')).toBe('咖啡店')
    expect(roughMeaning('Ikan Bakar Pak Din')).toBe('烤鱼')
    expect(roughMeaning('Lot 10 Hutong Food Court')).toBe('美食中心')
    expect(roughMeaning("Ah Fatt's Chicken Rice & Noodle House")).toBe('鸡饭、面馆')
    expect(roughMeaning('Sakura Ramen House')).toBe('拉面')
    expect(roughMeaning('Warung Ayam Penyet')).toBe('小食档、印尼炸鸡')
  })

  it('同一个意思只写一次；大小写、符号、数字都不影响', () => {
    expect(roughMeaning('RESTORAN restaurant 88 Mee-Mee')).toBe('餐厅、面')
    expect(roughMeaningParts('Café de Kopi')).toEqual(['咖啡馆', '咖啡'])
  })

  it('只认整个词：Mile High Cafe 的 Mi 不是「面」，Teahouse 不是「茶」', () => {
    expect(roughMeaning('Mile High Cafe')).toBe('咖啡馆')
    expect(roughMeaning('Teahouse Ichiban')).toBeNull()
  })

  it('中文店名、空的、认不出任何词 → null（只显示原名）', () => {
    expect(roughMeaning('阿明海南鸡饭')).toBeNull()
    expect(roughMeaning('Nasi 阿明')).toBeNull()
    expect(roughMeaning('')).toBeNull()
    expect(roughMeaning(null)).toBeNull()
    expect(roughMeaning('Pelita')).toBeNull()
  })

  it('WEB-06 词表的中文全部是简体', () => {
    const samples = ['Restoran Nasi Kandar', 'Char Kuey Teow Bak Kut Teh Yong Tau Foo', 'Kopitiam Steamboat Claypot Dessert Bakery']
    for (const name of samples) {
      const meaning = roughMeaning(name)
      expect(meaning).not.toBeNull()
      expect(findTraditional(meaning ?? '')).toEqual([])
    }
  })
})
