/**
 * 🎡 转盘怎么画（安卓 ui/LuckyWheel.kt 的计算部分，功能清单 12.7）：半径、圆心、每格的扇形、指针、
 * 格子上的字放多大、从哪里开始写。画面（SVG）只照这里算出来的数字画。
 *
 * - 半径 = 边长 / 2 × 0.92；圆心比正中往下 0.04 × 半径；
 * - 第 i 格从正上方（−90°）+ 旋转角 + i × (360 / 格数) 开始，顺时针；
 * - 字沿半径排：从「内圈」（有中间的「转！」0.37 × 半径，没有 0.12 × 半径；格子太窄时再往外推，
 *   免得相邻两格的字碰在一起）写到 0.94 × 半径；放不下先一号一号缩小（最小 9），再放不下才「…」；
 * - 店名先截到 5 个字加「…」（谁来做 6 个字）；左半边的字转 180°，永远是正的；
 * - 指针：顶上一个三角形，尖在圆心上方 0.9 × 半径，底边在圆心上方 1.06 × 半径，左右 ± 0.08 × 半径。
 */
import { GAME_SYMBOLS } from '../data/uiLiterals.ts'
import { codePointLength, takeCodePoints } from './chineseText.ts'
import { segmentDegrees, shortWheelLabel } from './spin.ts'

/** 转盘上的一格：emoji（演示店自己的、头像、手势）和名字。 */
export interface WheelSegment {
  readonly emoji: string
  readonly label: string
}

/** 字从哪里开始（占半径的比例）：有中间的「转！」要让开它；没有就靠近中间，名字有更多地方。 */
export const HUB_INNER = 0.37
export const NO_HUB_INNER = 0.12
/** 字写到哪里（占半径的比例，在外圈里面）。 */
export const LABEL_OUTER = 0.94
/** 字一号一号缩小，最小 9（再乘上字体放大的倍数，最多 1.15）。 */
export const MIN_LABEL_PX = 9
/** 格子不会跟着系统字体变大：字最多跟着放大 15%。 */
export const MAX_LABEL_SCALE = 1.15
/** 字的行高（emoji 比字高）。 */
export const LABEL_LINE_HEIGHT = 1.2
/** 相邻两格的字之间至少留 2 像素。 */
export const LABEL_GAP_PX = 2

export interface WheelGeometry {
  readonly radius: number
  readonly cx: number
  readonly cy: number
}

/** 边长 side 的转盘：半径、圆心（比正中往下一点，顶上留给指针）。 */
export function wheelGeometry(side: number): WheelGeometry {
  const radius = (side / 2) * 0.92
  return { radius, cx: side / 2, cy: side / 2 + radius * 0.04 }
}

function point(g: WheelGeometry, degrees: number, r = g.radius): [number, number] {
  const rad = (degrees * Math.PI) / 180
  return [g.cx + r * Math.cos(rad), g.cy + r * Math.sin(rad)]
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString()
}

/** 第 i 格（还没转的时候）的扇形 SVG 路径：从圆心到外圈，从 −90° + i × 格角开始顺时针。 */
export function slicePath(g: WheelGeometry, index: number, segments: number): string {
  const sweep = segmentDegrees(segments)
  if (segments <= 1) {
    // 只有一格：整个圆（两个半圆）
    const [x0, y0] = point(g, -90)
    const [x1, y1] = point(g, 90)
    return `M ${round(x0)} ${round(y0)} A ${round(g.radius)} ${round(g.radius)} 0 1 1 ${round(x1)} ${round(y1)} A ${round(g.radius)} ${round(g.radius)} 0 1 1 ${round(x0)} ${round(y0)} Z`
  }
  const start = -90 + index * sweep
  const [x0, y0] = point(g, start)
  const [x1, y1] = point(g, start + sweep)
  const large = sweep > 180 ? 1 : 0
  return `M ${round(g.cx)} ${round(g.cy)} L ${round(x0)} ${round(y0)} A ${round(g.radius)} ${round(g.radius)} 0 ${large} 1 ${round(x1)} ${round(y1)} Z`
}

/** 指针（顶上的三角形）的三个点。 */
export function pointerPoints(g: WheelGeometry): string {
  const tipY = g.cy - g.radius + g.radius * 0.1
  const baseY = g.cy - g.radius - g.radius * 0.06
  const half = g.radius * 0.08
  return `${round(g.cx)},${round(tipY)} ${round(g.cx - half)},${round(baseY)} ${round(g.cx + half)},${round(baseY)}`
}

/** 量字有多宽（像素）：画面用 canvas 量；测试用简单的估算。 */
export type MeasureText = (text: string, px: number) => number

export interface LabelOptions {
  readonly radius: number
  /** 有没有中间的「转！」。 */
  readonly hub: boolean
  /** 名字最多几个字（店名 5，谁来做 6）。 */
  readonly labelChars: number
  /** 系统字体放大几倍（根字号 ÷ 16）。 */
  readonly fontScale: number
  readonly measure: MeasureText
}

/** 一格上的字：写什么、多大、从离圆心多远开始写、多宽。 */
export interface WheelLabel {
  readonly text: string
  readonly px: number
  readonly inner: number
  readonly width: number
}

/** 4 格以下 15、5–6 格 13（随系统字体放大，最多 15%）。 */
export function baseLabelPx(segments: number, fontScale: number): number {
  return (segments <= 4 ? 15 : 13) * Math.min(Math.max(fontScale, 0), MAX_LABEL_SCALE)
}

/**
 * 每一格的字：先用原来的字号；放不下（从内圈到 0.94 × 半径）就一号一号缩小，最小 9；
 * 还放不下才把名字截短加「…」。短的名字保持原来的大小。
 */
export function wheelLabels(segments: readonly WheelSegment[], options: LabelOptions): WheelLabel[] {
  const { radius, hub, labelChars, fontScale, measure } = options
  if (segments.length === 0 || radius <= 0) return []
  const scale = Math.min(Math.max(fontScale, 0), MAX_LABEL_SCALE)
  const sweep = segmentDegrees(segments.length)
  // 相邻两格中线之间的距离（每离圆心 1 像素）
  const spread = 2 * Math.sin(((Math.min(sweep, 180) / 2) * Math.PI) / 180)
  const outer = radius * LABEL_OUTER
  const base = baseLabelPx(segments.length, fontScale)
  const smallest = Math.min(base, MIN_LABEL_PX * scale)
  const innerFor = (px: number) => Math.max(radius * (hub ? HUB_INNER : NO_HUB_INNER), (px * LABEL_LINE_HEIGHT) / spread + LABEL_GAP_PX)
  return segments.map((segment) => {
    const full = `${segment.emoji} ${shortWheelLabel(segment.label, labelChars)}`
    let px = base
    let width = measure(full, px)
    while (width > outer - innerFor(px) && px - 1 >= smallest) {
      px -= 1
      width = measure(full, px)
    }
    const inner = innerFor(px)
    const room = Math.max(outer - inner, 1)
    if (width <= room) return { text: full, px, inner, width }
    // 最小的字也放不下：名字一个字一个字截短，加「…」
    const name = shortWheelLabel(segment.label, labelChars).replace(new RegExp(`${GAME_SYMBOLS.ellipsis}$`), '')
    for (let n = codePointLength(name) - 1; n >= 0; n--) {
      const cut = `${segment.emoji} ${takeCodePoints(name, n)}${GAME_SYMBOLS.ellipsis}`
      const cutWidth = measure(cut, px)
      if (cutWidth <= room || n === 0) return { text: cut, px, inner, width: Math.min(cutWidth, room) }
    }
    return { text: full, px, inner, width }
  })
}

/**
 * 转了 rotation 度以后，第 i 格的字怎么摆：沿着格子的中线（角度 mid），左半边（90°–270°）转 180° 才是正的。
 * 回传 SVG 的 transform 和字的 x（text-anchor 永远是 start）。
 */
export function labelPlacement(
  g: WheelGeometry,
  label: WheelLabel,
  index: number,
  segments: number,
  rotation: number,
): { transform: string; x: number; flipped: boolean } {
  const sweep = segmentDegrees(segments)
  const mid = -90 + rotation + (index + 0.5) * sweep
  const normalized = ((mid % 360) + 360) % 360
  const flipped = normalized > 90 && normalized < 270
  const angle = flipped ? mid + 180 : mid
  const x = flipped ? g.cx - label.inner - label.width : g.cx + label.inner
  return { transform: `rotate(${round(angle)} ${round(g.cx)} ${round(g.cy)})`, x, flipped }
}
