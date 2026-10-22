/**
 * 加载页（安卓 ui/StatusScreens.kt LoadingScreen，功能清单第九节）：大 emoji 一直摆、一直放大缩小，
 * 「正在帮你找附近最好吃的中餐・饭…」、定位中 / 演示 / 真实的小字、不确定进度的横条、「取消」回首页。
 */
import { choiceEmoji, loadingNote, loadingTitle, text } from '../app/texts.ts'
import type { LoadingPhase } from '../app/state.ts'
import type { SearchChoice } from '../domain/model.ts'
import { PhraseText } from '../ui/PhraseText.tsx'

export function LoadingScreen({ choice, phase, isDemo, onCancel }: { readonly choice: SearchChoice; readonly phase: LoadingPhase; readonly isDemo: boolean; readonly onCancel: () => void }) {
  return (
    <div className="screen status-screen loading-screen" aria-busy="true">
      <div className="status-screen__body">
        <span className="loading-emoji" aria-hidden="true">
          <span className="loading-emoji__inner">{choiceEmoji(choice)}</span>
        </span>
        <PhraseText as="h2" className="status-screen__title" text={loadingTitle(choice)} />
        <p className="status-screen__message" aria-live="polite">
          {loadingNote(phase, isDemo)}
        </p>
        <div className="progress" role="progressbar" aria-label={loadingTitle(choice)}>
          <span className="progress__bar" />
        </div>
        <button type="button" className="btn btn--text" onClick={onCancel}>
          {text('cancel')}
        </button>
      </div>
    </div>
  )
}
