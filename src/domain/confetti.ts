/**
 * 彩带（安卓 ui/ResultPage.kt ConfettiBurst 的计算部分）：用这局的编号当随机种子，32 片，
 * 飞 2 秒、重力 1.9（画面高 / 秒²）。画面只负责把每一片画在算出来的位置；关掉动画就不放。
 */
import { DUEL } from '../data/constants.ts'
import { GAME_SYMBOLS } from '../data/uiLiterals.ts'
import { KotlinRandom } from '../data/kotlinRandom.ts'

export interface ConfettiPiece {
  readonly emoji: string
  /** 起点（画面宽 / 高的比例）。 */
  readonly x0: number
  readonly y0: number
  /** 速度（画面宽 / 高 每秒）。 */
  readonly vx: number
  readonly vy: number
  /** 晚多少才开始（进度的比例 0–0.15）。 */
  readonly delay: number
  /** 转速（度 / 秒）。 */
  readonly spin: number
}

/** 32 片彩带（rand 的顺序：x、y（只有两边低处的才抽）、速度 x、速度 y、延迟、转速）。 */
export function confettiPieces(seed: number): ConfettiPiece[] {
  const random = new KotlinRandom(seed)
  const pieces: ConfettiPiece[] = []
  for (let k = 0; k < DUEL.CONFETTI_PIECES; k++) {
    const side = k % 4
    const fromLeft = side === 0 || side === 2
    const x0 = fromLeft ? random.nextFloat() * 0.12 : 0.88 + random.nextFloat() * 0.12
    const y0 = side < 2 ? 1.02 : 0.62 + random.nextFloat() * 0.25
    const speedX = 0.15 + random.nextFloat() * 0.35
    const vx = fromLeft ? speedX : -speedX
    const vy = -(1.15 + random.nextFloat() * 0.6)
    const delay = random.nextFloat() * 0.15
    const spin = (random.nextFloat() - 0.5) * 720
    pieces.push({ emoji: GAME_SYMBOLS.confetti[k % GAME_SYMBOLS.confetti.length] as string, x0, y0, vx, vy, delay, spin })
  }
  return pieces
}

/**
 * 进度 progress（0–1，飞 2 秒的线性进度）时，一片在画面上的位置（像素）、转角、透明度；还没开始或掉出画面 → null。
 * 每片的左上角放在 (x − 20, y − 20)。
 */
export function confettiFrame(piece: ConfettiPiece, progress: number, width: number, height: number): { x: number; y: number; rotation: number; alpha: number } | null {
  const total = DUEL.CONFETTI_MS / 1000
  const local = (progress - piece.delay) / (1 - piece.delay)
  if (local <= 0) return null
  const t = Math.min(local, 1) * total
  const x = (piece.x0 + piece.vx * t) * width
  const y = (piece.y0 + piece.vy * t + 0.5 * DUEL.CONFETTI_GRAVITY * t * t) * height
  if (y > height + 40) return null
  const alpha = t > 1.6 ? Math.max((total - t) / 0.4, 0) : 1
  return { x, y, rotation: piece.spin * t, alpha }
}
