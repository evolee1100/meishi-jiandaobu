/**
 * 📳 摇一摇（安卓 domain/ShakeDetector.kt）：只认「用力来回甩两下」（像甩骰子），走路、坐巴士、轻轻晃、放到桌上都不算；
 * 成立一次后 1.5 秒内不再算。网页把 devicemotion 的 accelerationIncludingGravity（米/秒²，含重力）喂进来。
 * 安卓用 32 位浮点（Float），这里用 Math.fround 照算，结果和安卓一样。
 */
import { SHAKE } from '../data/constants.ts'

const f = Math.fround

type Vec = [number, number, number]

function dot(a: Vec, b: Vec): number {
  return f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]))
}

export const SHAKE_THRESHOLD = SHAKE.THRESHOLD

export class ShakeDetector {
  private gravity: Vec | null = null
  private lastPeakAt = Number.NEGATIVE_INFINITY
  private lastPeak: Vec | null = null
  private lastPeakStrength = 0
  private inPeak = false
  private peakVector: Vec = [0, 0, 0]
  private peakStrength = 0
  private peakAt = 0
  private cooldownUntil = Number.NEGATIVE_INFINITY

  /** 一次读数（米/秒²，含重力）。这次读数凑成一次摇一摇就回传力度（最大的那一下，去掉重力），否则 null。 */
  onReading(timeMillis: number, xIn: number, yIn: number, zIn: number): number | null {
    const x = f(xIn)
    const y = f(yIn)
    const z = f(zIn)
    if (!this.gravity) this.gravity = [x, y, z]
    const g = this.gravity
    const alpha = f(SHAKE.GRAVITY_ALPHA)
    g[0] = f(g[0] + f(alpha * f(x - g[0])))
    g[1] = f(g[1] + f(alpha * f(y - g[1])))
    g[2] = f(g[2] + f(alpha * f(z - g[2])))
    const linear: Vec = [f(x - g[0]), f(y - g[1]), f(z - g[2])]
    const strength = f(Math.sqrt(dot(linear, linear)))
    if (timeMillis < this.cooldownUntil) {
      this.inPeak = false
      this.lastPeak = null
      return null
    }
    if (strength < SHAKE.THRESHOLD) return this.inPeak ? this.endPeak(timeMillis) : null
    // 刚甩完一下又反方向甩（中间没有平静的读数）：前一下结束了。
    if (this.inPeak && dot(linear, this.peakVector) < 0) {
      const done = this.endPeak(timeMillis)
      if (done != null) return done
    }
    if (!this.inPeak) {
      this.inPeak = true
      this.peakAt = timeMillis
      this.peakStrength = strength
      this.peakVector = linear
    } else if (strength > this.peakStrength) {
      this.peakStrength = strength
      this.peakVector = linear
    }
    return null
  }

  /** 一下甩完了：和上一下方向相反、相隔 90–900 毫秒 → 成立。 */
  private endPeak(timeMillis: number): number | null {
    this.inPeak = false
    const previous = this.lastPeak
    const gap = this.peakAt - this.lastPeakAt
    if (previous && dot(previous, this.peakVector) < 0 && gap >= SHAKE.MIN_GAP_MS && gap <= SHAKE.MAX_GAP_MS) {
      const hardest = Math.max(this.lastPeakStrength, this.peakStrength)
      this.lastPeak = null
      this.cooldownUntil = timeMillis + SHAKE.COOLDOWN_MS
      return hardest
    }
    this.lastPeak = this.peakVector
    this.lastPeakAt = this.peakAt
    this.lastPeakStrength = this.peakStrength
    return null
  }
}

/** 摇得越用力转得越久：力度 14 → 1,100 毫秒，40 以上 → 2,000 毫秒，中间线性（取整）。 */
export function spinMillisFor(strength: number): number {
  const t = Math.min(Math.max(f(f(f(strength) - SHAKE.THRESHOLD) / f(SHAKE.STRENGTH_FOR_MAX - SHAKE.THRESHOLD)), 0), 1)
  return Math.trunc(f(SHAKE.SPIN_MIN_MS + f(t * (SHAKE.SPIN_MAX_MS - SHAKE.SPIN_MIN_MS))))
}
