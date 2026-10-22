import { describe, expect, it } from 'vitest'
import { testPlace } from '../test/helpers.ts'
import { firstRank, hasMore, isFirstPage, lastRank, PHOTO_NONE, remainingAfter, visiblePage, type ResultItem, type ResultsPage } from './state.ts'

/** p1…pN；closed 的 openNow=false、unknown 的 null，其他营业中。 */
function ranked(n: number, closed: number[] = [], unknown: number[] = []): ResultItem[] {
  return Array.from({ length: n }, (_, k) => {
    const i = k + 1
    const open = closed.includes(i) ? false : unknown.includes(i) ? null : true
    return { rank: i, place: { ...testPlace(`p${i}`), openNow: open }, photo: PHOTO_NONE, translatedName: null, translatedType: null }
  })
}

const ids = (view: ResultsPage) => view.items.map((item) => item.place.id)
const ranks = (view: ResultsPage) => view.items.map((item) => item.rank)

describe('十四、结果页：一页 3 家（ResultsPager）', () => {
  it('RESULTS-15 一页 3 家按排名：第 1 页 1–3、第 2 页 4–6、最后一页 7–8（没有更多），后面还剩几家算得对', () => {
    const all = ranked(8)
    const first = visiblePage(all, false, 0)
    expect(ids(first)).toEqual(['p1', 'p2', 'p3'])
    expect(ranks(first)).toEqual([1, 2, 3])
    expect(isFirstPage(first)).toBe(true)
    expect(remainingAfter(first)).toBe(5)
    expect(hasMore(first)).toBe(true)

    const second = visiblePage(all, false, 1)
    expect(ids(second)).toEqual(['p4', 'p5', 'p6'])
    expect(firstRank(second)).toBe(4)
    expect(lastRank(second)).toBe(6)
    expect(remainingAfter(second)).toBe(2)

    const last = visiblePage(all, false, 2)
    expect(ids(last)).toEqual(['p7', 'p8'])
    expect(ranks(last)).toEqual([7, 8])
    expect(hasMore(last)).toBe(false)
    expect(last.total).toBe(8)
  })

  it('RESULTS-16 刚好 3 家没有下一页；6 家第 2 页后没有；1 家；0 家（第 0 页、一共 0）', () => {
    const three = visiblePage(ranked(3), false, 0)
    expect(three.items).toHaveLength(3)
    expect(hasMore(three)).toBe(false)

    const six = ranked(6)
    expect(hasMore(visiblePage(six, false, 0))).toBe(true)
    expect(hasMore(visiblePage(six, false, 1))).toBe(false)
    expect(ids(visiblePage(six, false, 1))).toEqual(['p4', 'p5', 'p6'])

    const one = visiblePage(ranked(1), false, 0)
    expect(ids(one)).toEqual(['p1'])
    expect(hasMore(one)).toBe(false)

    const none = visiblePage([], false, 0)
    expect(none.items).toEqual([])
    expect(none.total).toBe(0)
    expect(none.page).toBe(0)
  })

  it('RESULTS-17 页数超出范围时夹到最后一页（或第一页）', () => {
    const all = ranked(7)
    expect(visiblePage(all, false, 9).page).toBe(2)
    expect(ids(visiblePage(all, false, 9))).toEqual(['p7'])
    expect(visiblePage(all, false, -3).page).toBe(0)
  })

  it('RESULTS-18 只看营业中隐藏休息中的、保留不明的，名次在过滤后重新从 1 排，隐藏数和剩余数对', () => {
    const all = ranked(6, [1, 4], [2])
    const view = visiblePage(all, true, 0)
    expect(ids(view)).toEqual(['p2', 'p3', 'p5'])
    expect(ranks(view)).toEqual([1, 2, 3])
    expect(view.hiddenClosed).toBe(2)
    expect(view.total).toBe(4)
    expect(remainingAfter(view)).toBe(1)

    const off = visiblePage(all, false, 0)
    expect(off.hiddenClosed).toBe(0)
    expect(ids(off)).toEqual(['p1', 'p2', 'p3'])
  })

  it('RESULTS-19 过滤和换页一起用：每页名次接着排（4–6、7），超出的页夹回最后一页', () => {
    const all = ranked(10, [2, 3, 9])
    const pages = [0, 1, 2].map((p) => visiblePage(all, true, p))
    expect(ids(pages[0]!)).toEqual(['p1', 'p4', 'p5'])
    expect(ids(pages[1]!)).toEqual(['p6', 'p7', 'p8'])
    expect(ranks(pages[1]!)).toEqual([4, 5, 6])
    expect(ids(pages[2]!)).toEqual(['p10'])
    expect(ranks(pages[2]!)).toEqual([7])
    expect(hasMore(pages[2]!)).toBe(false)
    expect(pages[2]!.total).toBe(7)
    expect(visiblePage(all, true, 3).page).toBe(2)
  })

  it('RESULTS-20 全部在休息：空的一页，但知道隐藏了几家', () => {
    const view = visiblePage(ranked(4, [1, 2, 3, 4]), true, 0)
    expect(view.items).toEqual([])
    expect(view.hiddenClosed).toBe(4)
    expect(view.total).toBe(0)
    expect(hasMore(view)).toBe(false)
  })
})
