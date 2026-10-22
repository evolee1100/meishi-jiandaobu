/**
 * 🎉 彩带（安卓 ResultPage.ConfettiBurst，功能清单 13.8）：结果出现后等 0.3 秒（判定大字和台词先站稳），
 * 32 片从左下、右下和两边低处往上喷，飞 2 秒，重力往下拉，1.6 秒后淡出。
 * 画在所有字和店卡「下面」（画面上的层次比内容低，字和透明按钮都垫了页面底色，彩带不会从字缝透出来）。
 * 每一片的路线由 domain/confetti.ts 算好（用这局的编号当种子，同一局每次都一样），
 * 这里转成 Web Animations 的关键帧交给浏览器播，不占用 JavaScript。减少动画时根本不画（由外面决定）。
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DUEL } from '../../data/constants.ts'
import { confettiFrame, confettiPieces } from '../../domain/confetti.ts'

/** 每片取几个点（线性连起来，看起来就是抛物线）。 */
const SAMPLES = 24

export function Confetti({ seed }: { readonly seed: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const pieces = useMemo(() => confettiPieces(seed), [seed])

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const width = box.clientWidth
    const height = box.clientHeight
    const animations: Animation[] = []
    pieces.forEach((piece, index) => {
      const el = box.children[index] as HTMLElement | undefined
      if (!el || typeof el.animate !== 'function') return
      const keyframes: Keyframe[] = []
      let last = `translate(-200px, ${height + 200}px)`
      for (let s = 0; s <= SAMPLES; s++) {
        // 扣掉这一片的延迟以后，0 → 1 的进度（第一个点稍微大于 0，才看得到起点）
        const local = Math.max(s / SAMPLES, 0.0001)
        const progress = piece.delay + local * (1 - piece.delay)
        const frame = confettiFrame(piece, progress, width, height)
        if (frame) last = `translate(${(frame.x - 20).toFixed(1)}px, ${(frame.y - 20).toFixed(1)}px) rotate(${frame.rotation.toFixed(1)}deg)`
        // 掉出画面以后不画：停在最后的位置、透明
        keyframes.push({ offset: s / SAMPLES, transform: last, opacity: frame ? frame.alpha : 0 })
      }
      animations.push(
        el.animate(keyframes, {
          duration: DUEL.CONFETTI_MS * (1 - piece.delay),
          delay: DUEL.CONFETTI_DELAY_MS + DUEL.CONFETTI_MS * piece.delay,
          easing: 'linear',
          fill: 'forwards',
        }),
      )
    })
    return () => animations.forEach((animation) => animation.cancel())
  }, [pieces])

  return (
    <div ref={boxRef} className="confetti" aria-hidden="true" data-testid="confetti">
      {pieces.map((piece, index) => (
        <span key={index} className="confetti__piece">
          {piece.emoji}
        </span>
      ))}
    </div>
  )
}
