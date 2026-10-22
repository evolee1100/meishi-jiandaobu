/**
 * 缓动曲线（不加动画库）：CSS 的 cubic-bezier() 写成 JS 函数，给每一帧自己算位置的动画用
 * （转盘要每一帧知道指针在第几格才能「咔咔」震，字也要一直是正的）。
 * 同一条曲线写在 CSS / Web Animations 里时，用同样的四个数字，样子完全一样。
 */

/** CSS cubic-bezier(x1, y1, x2, y2)：输入 0–1 的时间比例，回传 0–1（可以超出一点）的进度。 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx

  /** 找出 x(s) = x 的 s：先用牛顿法，不收敛再二分。 */
  const solve = (x: number): number => {
    let s = x
    for (let i = 0; i < 8; i++) {
      const error = sampleX(s) - x
      if (Math.abs(error) < 1e-7) return s
      const slope = slopeX(s)
      if (Math.abs(slope) < 1e-6) break
      s -= error / slope
    }
    let low = 0
    let high = 1
    s = x
    for (let i = 0; i < 40; i++) {
      const value = sampleX(s)
      if (Math.abs(value - x) < 1e-7) return s
      if (value < x) low = s
      else high = s
      s = (low + high) / 2
    }
    return s
  }

  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return sampleY(solve(t))
  }
}

/** EaseOutQuart：先快后慢（安卓 Compose 的 EaseOutQuart，CSS 写作 cubic-bezier(0.25, 1, 0.5, 1)）。 */
export function easeOutQuart(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return 1 - Math.pow(1 - t, 4)
}

/** 🎡 转盘：开始快，长长地慢慢停（安卓 LuckyWheel.WheelEasing）。 */
export const wheelEasing = cubicBezier(0.12, 0.75, 0.2, 1)
