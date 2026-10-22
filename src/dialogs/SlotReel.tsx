/**
 * 老虎机的卷轴（安卓 ui/SlotReel.kt + domain/SpinPlan.kt，功能清单 5.7）。
 * 结果已经由状态层决定好，卷轴只是转到那一格：
 * - 「位置」用第几格算（可以有小数），画出位置前后各一格：每格往上移 (格号 − 小数部分) × 格高，透明度 1 − 0.5 × |偏移|；
 * - 停在「≥ 现在 + 圈数 × 格数、而且 mod 格数 = 目标」的最小整数（spinTarget），缓动 EaseOutQuart；
 * - 停下时窗口弹一下（1.06）、边框变主色、手机重震一下；再摇一次从现在的位置接着转；
 * - 减少动画、或这一轮已经停好过（settled）→ 直接停在结果。
 * 每一帧直接改 DOM（不经过 React），手机上也很顺。
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { spinTarget } from '../domain/spin.ts'
import { floorMod } from '../domain/time.ts'
import { playAnimation } from '../lib/motion.ts'
import { vibrate } from '../platform/device.ts'

export interface ReelItem {
  readonly emoji: string
  readonly label: string
}

export interface SlotReelProps {
  readonly items: readonly ReelItem[]
  readonly target: number
  /** 每摇一次就变：变了就从现在的位置转到新的目标。 */
  readonly round: number
  readonly millis: number
  readonly loops: number
  /** 直接停在结果（减少动画、已经停好过）。 */
  readonly instant: boolean
  readonly onStopped: (round: number) => void
  readonly className?: string
}

/** EaseOutQuart：先快后慢（cubic-bezier(0.25, 1, 0.5, 1)）。 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4)
}

const OFFSETS = [-1, 0, 1] as const

export function SlotReel({ items, target, round, millis, loops, instant, onStopped, className }: SlotReelProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const position = useRef(0)
  const onStoppedRef = useRef(onStopped)
  onStoppedRef.current = onStopped
  const [stopped, setStopped] = useState(false)

  const draw = (pos: number) => {
    const n = items.length
    const base = Math.floor(pos)
    const frac = pos - base
    OFFSETS.forEach((k, slot) => {
      const cell = cellRefs.current[slot]
      if (!cell) return
      const item = items[floorMod(base + k, n)]
      const offset = k - frac
      cell.style.transform = `translateY(${(offset * 100).toFixed(3)}%)`
      cell.style.opacity = String(Math.max(0, 1 - 0.5 * Math.min(Math.abs(offset), 1)))
      const emoji = cell.firstElementChild as HTMLElement | null
      const label = cell.lastElementChild as HTMLElement | null
      if (item && emoji && emoji.textContent !== item.emoji) emoji.textContent = item.emoji
      if (item && label && label.textContent !== item.label) label.textContent = item.label
    })
  }

  useLayoutEffect(() => {
    const n = items.length
    if (instant) {
      const current = Math.round(position.current)
      position.current = current + floorMod(target - current, n)
      draw(position.current)
      setStopped(true)
      onStoppedRef.current(round)
      return
    }
    setStopped(false)
    const from = position.current
    const to = spinTarget(Math.round(from), n, target, loops)
    const startedAt = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min((now - startedAt) / millis, 1)
      position.current = from + (to - from) * easeOutQuart(t)
      draw(position.current)
      if (t < 1) {
        frame = requestAnimationFrame(step)
        return
      }
      position.current = to
      draw(to)
      setStopped(true)
      vibrate('heavy')
      if (windowRef.current) {
        playAnimation(windowRef.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], {
          duration: 320,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        })
      }
      onStoppedRef.current(round)
    }
    draw(from)
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // 只在新的一轮（或改成直接停）时转；items、millis、loops 每轮固定
  }, [round, instant])

  return (
    <div ref={windowRef} className={`reel${stopped ? ' is-stopped' : ''}${className ? ' ' + className : ''}`} aria-hidden="true">
      {OFFSETS.map((k, slot) => (
        <div
          key={k}
          className="reel__cell"
          ref={(el) => {
            cellRefs.current[slot] = el
          }}
        >
          <span className="reel__emoji" />
          <span className="reel__label" />
        </div>
      ))}
    </div>
  )
}
