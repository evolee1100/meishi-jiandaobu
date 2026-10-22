/**
 * 🎡 幸运大转盘（安卓 ui/LuckyWheel.kt，功能清单 12.7、13.7）：自己用 SVG 画，不用套件。
 * - viewBox 跟着量到的边长走（1 单位 = 1 像素），整个 SVG 宽 100%、按容器缩放，最大 maxSize；
 * - 每格一个颜色（深色模式换深色那一套）、emoji + 名字沿半径排，左半边的字转 180° 永远是正的；
 * - 停在哪是状态层先抽好的（WheelSpin）：按了「转！」才从 0° 转到那里，3–4 秒、前快后很长的慢停，
 *   每经过一条线轻震一下（「咔咔」），停下重震一下，停的那格闪亮（亮度 0→1→0.4→1→0.4→1，之后一直亮）；
 * - 减少动画、或已经转过（再显示结果）→ 直接停在结果、一直亮。
 * 转的时候每一帧直接改 SVG（不经过 React），手机上也很顺。整个转盘读屏只念标题（description）。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { WHEEL } from '../../data/constants.ts'
import { segmentAt, stopRotation, type WheelSpin } from '../../domain/spin.ts'
import {
  labelPlacement,
  pointerPoints,
  slicePath,
  wheelGeometry,
  wheelLabels,
  type WheelLabel,
  type WheelSegment,
} from '../../domain/wheelLayout.ts'
import { wheelEasing } from '../../lib/easing.ts'
import { vibrate } from '../../platform/device.ts'
import { fontScale } from '../../ui/media.ts'
import { measureTextWidth } from '../../ui/measureText.ts'

export type { WheelSegment }

/** 停下以后那一格怎么闪：亮度 0 → 1（180 毫秒）→ 0.4（180）→ 1（180）→ 0.4（180）→ 1（200）。 */
const GLOW_STEPS: readonly (readonly [number, number])[] = [
  [1, 180],
  [0.4, 180],
  [1, 180],
  [0.4, 180],
  [1, 200],
]

export interface LuckyWheelProps {
  readonly segments: readonly WheelSegment[]
  /** 停在哪（还没按「转！」是 null，转盘停在 0°）。 */
  readonly spin: WheelSpin | null
  /** 现在才转（刚按了「转！」、刚抽好）：从 0° 转过去；false = 直接停在结果。 */
  readonly play: boolean
  readonly reducedMotion: boolean
  /** 转盘停好了（play 时转完才叫；直接停在结果时也叫一次）。 */
  readonly onStopped?: () => void
  /** 中间有「转！」（字要让开它）。 */
  readonly hub?: boolean
  /** 中间的东西（「转！」圆钮）。 */
  readonly center?: ReactNode
  /** 名字最多几个字（店名 5、谁来做 6）。 */
  readonly labelChars?: number
  /** 读屏念的（整个转盘一句）。 */
  readonly description: string
  /** 最大边长（像素）。 */
  readonly maxSize: number
  readonly className?: string
  readonly testId?: string
}

function spinKey(spin: WheelSpin | null): string {
  return spin ? `${spin.target}:${spin.segments}:${spin.millis}:${spin.offset}` : ''
}

export function LuckyWheel({
  segments,
  spin,
  play,
  reducedMotion,
  onStopped,
  hub = true,
  center,
  labelChars = WHEEL.LABEL_CHARS,
  description,
  maxSize,
  className,
  testId,
}: LuckyWheelProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const turnRef = useRef<SVGGElement>(null)
  const labelRefs = useRef<(SVGTextElement | null)[]>([])
  const glowFillRef = useRef<SVGPathElement>(null)
  const glowRingRef = useRef<SVGPathElement>(null)
  const onStoppedRef = useRef(onStopped)
  onStoppedRef.current = onStopped

  // 一开始就停在结果（再显示，或减少动画）：转角、亮度都直接是最后的样子。
  const showsEnd = spin != null && (!play || reducedMotion)
  const rotation = useRef(showsEnd && spin ? stopRotation(0, spin) : 0)
  const glow = useRef(showsEnd ? 1 : 0)
  // 已经停好、也告诉过外面了：只有「再显示」才是。减少动画时一打开就要转的（投票平票、谁来做）还是要叫一次 onStopped，
  // 不然外面会一直等在「转啊转…」。
  const stoppedRef = useRef(spin != null && !play)
  const [stopped, setStopped] = useState(showsEnd)
  /** 每转完一次加 1：闪亮动画（和转的动画分开，play 变回 false 也不会被打断）。 */
  const [glowRun, setGlowRun] = useState(0)

  // 边长：量容器（跟着屏幕、字体变）。
  const [side, setSide] = useState(maxSize)
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => {
      const width = el.clientWidth
      if (width > 0) setSide((previous) => (Math.abs(previous - width) < 0.5 ? previous : width))
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const g = wheelGeometry(side)
  const scale = fontScale()
  const segmentsKey = segments.map((s) => `${s.emoji} ${s.label}`).join('\n')
  const labels: WheelLabel[] = useMemo(() => {
    const family = svgRef.current ? getComputedStyle(svgRef.current).fontFamily : 'system-ui, sans-serif'
    return wheelLabels(segments, {
      radius: g.radius,
      hub,
      labelChars,
      fontScale: scale,
      measure: (value, px) => measureTextWidth(value, px, family),
    })
    // 只在格子、大小、字体倍数变了才重新量
  }, [segmentsKey, g.radius, hub, labelChars, scale])

  const n = segments.length
  const highlight = stopped && spin ? spin.target : null

  /** 把现在的转角画上去（转盘本身 + 每一格的字，左半边的字转正）。 */
  const drawRotation = () => {
    const angle = rotation.current
    turnRef.current?.setAttribute('transform', `rotate(${angle.toFixed(3)} ${g.cx} ${g.cy})`)
    labels.forEach((label, i) => {
      const el = labelRefs.current[i]
      if (!el) return
      const place = labelPlacement(g, label, i, n, angle)
      el.setAttribute('transform', place.transform)
      el.setAttribute('x', place.x.toFixed(2))
    })
  }
  const drawRef = useRef(drawRotation)
  drawRef.current = drawRotation

  const drawGlow = () => {
    const value = glow.current
    glowFillRef.current?.setAttribute('fill-opacity', String(0.35 * value))
    glowRingRef.current?.setAttribute('stroke-opacity', String(value))
    glowRingRef.current?.setAttribute('stroke-width', String(6 * value))
  }
  const drawGlowRef = useRef(drawGlow)
  drawGlowRef.current = drawGlow

  // 转：按了「转！」才从 0° 转到先抽好的位置；不转就直接停在那里。
  const key = spinKey(spin)
  useEffect(() => {
    if (!spin) {
      rotation.current = 0
      drawRef.current()
      return
    }
    const stop = stopRotation(0, spin)
    if (!play || reducedMotion) {
      rotation.current = stop
      drawRef.current()
      if (!stoppedRef.current) {
        stoppedRef.current = true
        glow.current = 1
        setStopped(true)
        drawGlowRef.current()
        if (play) onStoppedRef.current?.()
      }
      return
    }
    stoppedRef.current = false
    setStopped(false)
    rotation.current = 0
    drawRef.current()
    const startedAt = performance.now()
    let lastSegment = segmentAt(0, spin.segments)
    let frame = 0
    const step = () => {
      const t = Math.min((performance.now() - startedAt) / spin.millis, 1)
      rotation.current = stop * wheelEasing(t)
      drawRef.current()
      // 「咔咔」：指针每经过一条线轻震一下
      const segment = segmentAt(rotation.current, spin.segments)
      if (segment !== lastSegment) {
        lastSegment = segment
        if (t < 1) vibrate('light')
      }
      if (t < 1) {
        frame = requestAnimationFrame(step)
        return
      }
      rotation.current = stop
      drawRef.current()
      vibrate('heavy')
      stoppedRef.current = true
      glow.current = 0
      setStopped(true)
      setGlowRun((run) => run + 1)
      onStoppedRef.current?.()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // 同一个结果只转一次；play 变回 false（转完了）不会重转
  }, [key, play, reducedMotion])

  // 停的那一格闪几下，然后一直亮。
  useEffect(() => {
    if (glowRun === 0) return
    if (reducedMotion) {
      glow.current = 1
      drawGlowRef.current()
      return
    }
    let frame = 0
    let from = 0
    let stepIndex = 0
    let stepStart = performance.now()
    const tick = () => {
      const [to, ms] = GLOW_STEPS[stepIndex] as readonly [number, number]
      const t = Math.min((performance.now() - stepStart) / ms, 1)
      glow.current = from + (to - from) * t
      drawGlowRef.current()
      if (t >= 1) {
        from = to
        stepIndex++
        stepStart = performance.now()
        if (stepIndex >= GLOW_STEPS.length) return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      glow.current = 1
      drawGlowRef.current()
    }
  }, [glowRun, reducedMotion])

  // 大小、字变了：照现在的转角重画字的位置。
  useLayoutEffect(() => {
    drawRef.current()
  }, [labels, side])

  const angle = rotation.current
  const pointer = pointerPoints(g)
  return (
    <div
      ref={boxRef}
      className={`lucky-wheel${className ? ' ' + className : ''}${stopped ? ' is-stopped' : ''}`}
      style={{ maxWidth: `${maxSize}px`, ['--hub-y' as string]: `${(g.cy / side) * 100}%` }}
      data-testid={testId}
      data-stopped={stopped ? 'true' : 'false'}
    >
      <svg ref={svgRef} className="lucky-wheel__svg" viewBox={`0 0 ${side} ${side}`} role="img" aria-label={description} focusable="false">
        <g ref={turnRef} transform={`rotate(${angle.toFixed(3)} ${g.cx} ${g.cy})`}>
          {segments.map((_, i) => (
            <path key={i} className={`lucky-wheel__slice lucky-wheel__slice--${i % 6}`} d={slicePath(g, i, n)} />
          ))}
          {segments.map((_, i) => (
            <path key={`line-${i}`} className="lucky-wheel__line" d={slicePath(g, i, n)} />
          ))}
          {highlight != null && (
            <>
              <path ref={glowFillRef} className="lucky-wheel__glow" d={slicePath(g, highlight, n)} fillOpacity={0.35 * glow.current} />
              <path
                ref={glowRingRef}
                className="lucky-wheel__ring"
                d={slicePath(g, highlight, n)}
                strokeOpacity={glow.current}
                strokeWidth={6 * glow.current}
              />
            </>
          )}
        </g>
        {labels.map((label, i) => {
          const place = labelPlacement(g, label, i, n, angle)
          return (
            <text
              key={i}
              ref={(el) => {
                labelRefs.current[i] = el
              }}
              className="lucky-wheel__label"
              x={place.x}
              y={g.cy}
              transform={place.transform}
              fontSize={label.px}
              dominantBaseline="central"
            >
              {label.text}
            </text>
          )
        })}
        <circle className="lucky-wheel__rim" cx={g.cx} cy={g.cy} r={g.radius} />
        <polygon className="lucky-wheel__pointer" points={pointer} />
      </svg>
      {center && <div className="lucky-wheel__center">{center}</div>}
    </div>
  )
}
