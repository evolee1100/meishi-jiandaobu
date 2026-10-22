import { describe, expect, it } from 'vitest'
import { DUEL, TABLE, WHEEL } from '../data/constants.ts'
import { confettiFrame, confettiPieces } from './confetti.ts'
import { shortWheelLabel } from './spin.ts'

/**
 * 画面检查（SCREEN 组）里不涉及画面的规则部分：转盘格子上的名字怎么截、彩带怎么飞。
 * 画面本身（转盘中间有没有钮、彩带画在字下面、关掉动画不放）等做画面时用组件 / 浏览器测试。
 */
describe('画面用到的规则（SCREEN-02、SCREEN-04 的规则部分）', () => {
  it('转盘上的名字：店名 5 个字加「…」；谁来做的名字最多 6 个字写全（JennyL、陈大伯的女儿），emoji 算 1 个字', () => {
    expect(WHEEL.LABEL_CHARS).toBe(5)
    expect(TABLE.MAX_NAME_LENGTH).toBe(6)
    expect(shortWheelLabel('JennyL', TABLE.MAX_NAME_LENGTH)).toBe('JennyL')
    expect(shortWheelLabel('陈大伯的女儿', TABLE.MAX_NAME_LENGTH)).toBe('陈大伯的女儿')
    expect(shortWheelLabel('阿南达香蕉叶饭餐厅')).toBe('阿南达香蕉…')
    expect(shortWheelLabel('阿明鸡饭')).toBe('阿明鸡饭')
    expect(shortWheelLabel('🐼熊猫小玲阿德', TABLE.MAX_NAME_LENGTH)).toBe('🐼熊猫小玲阿…')
  })

  it('彩带：结果出现后等 300 毫秒、飞 2000 毫秒；32 片，用这局的编号当种子（同一局每次都一样），emoji 轮流 🎉 ✨ 🎊 ⭐ 🎈 ✨ 🎉 🎊；从左下、右下、两边低处往中间飞', () => {
    expect(DUEL.CONFETTI_DELAY_MS).toBe(300)
    expect(DUEL.CONFETTI_MS).toBe(2000)
    const pieces = confettiPieces(7)
    expect(pieces).toHaveLength(32)
    expect(confettiPieces(7)).toEqual(pieces)
    expect(confettiPieces(8)).not.toEqual(pieces)
    expect(pieces.slice(0, 8).map((p) => p.emoji)).toEqual(['🎉', '✨', '🎊', '⭐', '🎈', '✨', '🎉', '🎊'])
    pieces.forEach((p, k) => {
      const side = k % 4
      const fromLeft = side === 0 || side === 2
      if (fromLeft) {
        expect(p.x0).toBeGreaterThanOrEqual(0)
        expect(p.x0).toBeLessThan(0.12)
        expect(p.vx).toBeGreaterThan(0) // 往中间飞
      } else {
        expect(p.x0).toBeGreaterThanOrEqual(0.88)
        expect(p.x0).toBeLessThan(1)
        expect(p.vx).toBeLessThan(0)
      }
      expect(Math.abs(p.vx)).toBeGreaterThanOrEqual(0.15)
      expect(Math.abs(p.vx)).toBeLessThan(0.5)
      if (side < 2) expect(p.y0).toBe(1.02)
      else {
        expect(p.y0).toBeGreaterThanOrEqual(0.62)
        expect(p.y0).toBeLessThan(0.87)
      }
      expect(p.vy).toBeLessThanOrEqual(-1.15)
      expect(p.vy).toBeGreaterThan(-1.75)
      expect(p.delay).toBeGreaterThanOrEqual(0)
      expect(p.delay).toBeLessThan(0.15)
      expect(Math.abs(p.spin)).toBeLessThanOrEqual(360)
    })
  })

  it('彩带怎么动：延迟到了才出现；位置 = 起点 + 速度 × t + ½ × 1.9 × t²；1.6 秒后开始淡出；掉出画面 40 像素以下就不画', () => {
    const piece = { emoji: '🎉', x0: 0.1, y0: 1.02, vx: 0.3, vy: -1.5, delay: 0.1, spin: 100 }
    expect(confettiFrame(piece, 0.05, 400, 800)).toBeNull() // 还没轮到它
    const frame = confettiFrame(piece, 0.55, 400, 800) // 扣掉延迟后正好一半 = 1 秒
    if (!frame) throw new Error('应该看得到')
    expect(frame.x).toBeCloseTo((0.1 + 0.3 * 1) * 400, 6)
    expect(frame.y).toBeCloseTo((1.02 - 1.5 * 1 + 0.5 * 1.9 * 1) * 800, 6)
    expect(frame.rotation).toBeCloseTo(100, 6)
    expect(frame.alpha).toBe(1)
    const late = confettiFrame({ ...piece, vy: -2.2, y0: 0.62 }, 0.91, 400, 800) // t = 1.8 秒
    expect(late?.alpha).toBeCloseTo(0.5, 6)
    expect(confettiFrame({ ...piece, vy: -0.2 }, 1, 400, 800)).toBeNull() // 掉出画面
  })
})
