/**
 * 📜 今日饭签（安卓 ui/FortuneDialog.kt，功能清单 6.3）。
 * 今天第一次打开（而且没有减少动画）：手机轻震 → 签筒摇 900 毫秒 → 重震 → 掉出一支签 → 停 450 毫秒 → 签纸打开。
 * 签纸打开的那一刻才记成「今天抽过」（不然首页的胶囊会提前剧透签运）。抽过了、或减少动画：直接显示签纸。
 * 签纸深色模式也用同样的米黄纸色。全部在手机里，不花钱；只有「照签去找」会搜索（算 1 次，演示不扣）。
 */
import { useEffect, useRef, useState } from 'react'
import type { FortuneState } from '../app/state.ts'
import { fortuneGoLabel, shareFortune, text, webText } from '../app/texts.ts'
import { HOME_SYMBOLS } from '../data/uiLiterals.ts'
import { fortuneLevelEmoji, fortuneLevelName, fortuneStick } from '../domain/fortune.ts'
import { playAnimation } from '../lib/motion.ts'
import { shareText, vibrate, type ShareResult } from '../platform/device.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { PhraseText } from '../ui/PhraseText.tsx'

type Phase = 'SHAKING' | 'DROPPING' | 'OPEN'

/** 签筒摇的关键帧（以底部中心为轴）：0° → −14° → +14° → −14° → +14° → −8° → 0°。 */
const SHAKE_FRAMES: Keyframe[] = [
  { transform: 'rotate(0deg)', offset: 0 },
  { transform: 'rotate(-14deg)', offset: 100 / 900 },
  { transform: 'rotate(14deg)', offset: 250 / 900 },
  { transform: 'rotate(-14deg)', offset: 400 / 900 },
  { transform: 'rotate(14deg)', offset: 550 / 900 },
  { transform: 'rotate(-8deg)', offset: 700 / 900 },
  { transform: 'rotate(0deg)', offset: 1 },
]
const SHAKE_MS = 900
const DROP_MS = 600
const REST_MS = 450
const UNFOLD_MS = 380

export interface FortuneDialogProps {
  readonly fortune: FortuneState
  readonly demoMode: boolean
  readonly reducedMotion: boolean
  /** 签纸打开了：记成今天抽过。 */
  readonly onDrawn: () => void
  readonly onGo: () => void
  readonly onShared: (result: ShareResult) => void
  readonly onClose: () => void
}

export function FortuneDialog({ fortune, demoMode, reducedMotion, onDrawn, onGo, onShared, onClose }: FortuneDialogProps) {
  const [phase, setPhase] = useState<Phase>(() => (fortune.drawn || reducedMotion ? 'OPEN' : 'SHAKING'))
  const [manualText, setManualText] = useState<string | null>(null)
  const tubeRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef<HTMLDivElement>(null)
  const slipRef = useRef<HTMLDivElement>(null)
  const onDrawnRef = useRef(onDrawn)
  onDrawnRef.current = onDrawn
  const stick = fortuneStick(fortune.stickIndex)

  // 动画的时间顺序（只在打开时决定一次）。
  useEffect(() => {
    if (phase !== 'SHAKING') return
    vibrate('light')
    if (tubeRef.current) playAnimation(tubeRef.current, SHAKE_FRAMES, { duration: SHAKE_MS, easing: 'ease-in-out' })
    const timers = [
      setTimeout(() => {
        vibrate('heavy')
        setPhase('DROPPING')
      }, SHAKE_MS),
      setTimeout(() => setPhase('OPEN'), SHAKE_MS + DROP_MS + REST_MS),
    ]
    return () => timers.forEach(clearTimeout)
    // 只在打开时跑一次
  }, [])

  // 掉出一支签：从筒口往右下飞（向右 40、向下 120、转 70°），有一点弹性。
  useEffect(() => {
    if (phase !== 'DROPPING' || !stickRef.current) return
    playAnimation(
      stickRef.current,
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(40px, 120px) rotate(70deg)', opacity: 1 },
      ],
      { duration: DROP_MS, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'forwards' },
    )
  }, [phase])

  // 签纸打开的那一刻才记成「今天抽过」。
  useEffect(() => {
    if (phase !== 'OPEN') return
    if (!fortune.drawn) onDrawnRef.current()
    if (slipRef.current && !fortune.drawn) {
      playAnimation(
        slipRef.current,
        [
          { transform: 'scaleY(0.2)', opacity: 0 },
          { transform: 'scaleY(1)', opacity: 1 },
        ],
        { duration: UNFOLD_MS, easing: 'ease-out' },
      )
    }
    // 只在签纸刚打开时
  }, [phase])

  const share = async () => {
    const shared = shareFortune(fortune.stickIndex)
    const result = await shareText(shared)
    if (result === 'MANUAL') setManualText(shared)
    onShared(result)
  }

  const open = phase === 'OPEN'
  return (
    <Dialog labelledBy="fortune-title" onDismiss={onClose} className={`dialog--card fortune-dialog${open ? ' is-open' : ''}`} testId="fortune-dialog">
      <h2 id="fortune-title" className="dialog__title fortune-dialog__title">
        {text('fortune_title')}
      </h2>
      {!open ? (
        <div className="fortune-stage" aria-live="polite">
          <div className="fortune-tube-area" aria-hidden="true">
            <div ref={tubeRef} className="fortune-tube">
              <div className="fortune-tube__sticks">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className={`fortune-tube__stick${i % 2 === 1 ? ' is-short' : ''}`} />
                ))}
              </div>
              <div className="fortune-tube__body">{HOME_SYMBOLS.fortuneTube}</div>
            </div>
            {phase === 'DROPPING' && <div ref={stickRef} className="fortune-falling-stick" />}
          </div>
          <p className="fortune-stage__text">{text('fortune_shaking')}</p>
        </div>
      ) : (
        <div className="fortune-open">
          <div className="fortune-open__slip">
            <div ref={slipRef} className="fortune-slip" aria-live="polite">
              <p className="fortune-slip__level">
                {fortuneLevelName(fortune.stickIndex)} {fortuneLevelEmoji(fortune.stickIndex)}
              </p>
              <PhraseText as="p" className="fortune-slip__yi" text={text('fortune_yi', stick.yi)} />
              <PhraseText as="p" className="fortune-slip__ji" text={text('fortune_ji', stick.ji)} />
            </div>
            <PhraseText as="p" className="fortune-small" text={text('fortune_same_day')} />
          </div>
          <div className="fortune-open__actions">
            <button type="button" className="btn btn--filled btn--block btn--tall" onClick={onGo}>
              {fortuneGoLabel(fortune.stickIndex)}
            </button>
            <PhraseText as="p" className="fortune-small" text={text(demoMode ? 'fortune_go_note_demo' : 'fortune_go_note')} />
            <button type="button" className="btn btn--tonal btn--block" onClick={() => void share()}>
              {text('fortune_share')}
            </button>
            {manualText && (
              <div className="manual-copy">
                <p className="fortune-small">{webText('web_share_copy_failed')}</p>
                <textarea className="manual-copy__text" readOnly value={manualText} rows={4} onFocus={(e) => e.currentTarget.select()} />
              </div>
            )}
            <button type="button" className="btn btn--text btn--block" onClick={onClose}>
              {text('fortune_close')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
