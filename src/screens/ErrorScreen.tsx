/**
 * 错误页（安卓 ui/StatusScreens.kt ErrorScreen，功能清单第十节）：大图案 → 标题 → 正文 →（Google 错误）原文 →
 * 按钮们（主按钮 + 小字、次按钮 + 小字、🎲 换个菜系再摇）→ 最下面「返回首页」。按钮下面先写清楚会不会用次数。
 */
import type { SearchError } from '../app/searchError.ts'
import { errorScreen, text, type ErrorButton, type LocationEnvironment } from '../app/texts.ts'
import type { SearchChoice } from '../domain/model.ts'
import { PhraseText } from '../ui/PhraseText.tsx'

export interface ErrorScreenProps {
  readonly choice: SearchChoice | null
  readonly error: SearchError
  readonly demoMode: boolean
  readonly env: LocationEnvironment
  readonly onAction: (button: ErrorButton) => void
  readonly onHome: () => void
}

export function ErrorScreen({ choice, error, demoMode, env, onAction, onHome }: ErrorScreenProps) {
  const model = errorScreen(choice, error, demoMode, env)
  const button = (b: ErrorButton | null, style: string) =>
    b && (
      <div className="status-screen__action">
        <button type="button" className={`btn btn--block btn--tall ${style}`} onClick={() => onAction(b)}>
          {b.label}
        </button>
        {b.note && <PhraseText as="p" className="status-screen__note" text={b.note} />}
      </div>
    )
  return (
    <div className="screen status-screen error-screen">
      <div className="status-screen__body">
        <span className="error-emoji" aria-hidden="true">
          {model.emoji}
        </span>
        <PhraseText as="h2" className="status-screen__title" text={model.title} />
        <PhraseText as="p" className="status-screen__message" text={model.message} />
        {model.detail && <p className="status-screen__detail">{model.detail}</p>}
        {button(model.primary, 'btn--filled')}
        {button(model.secondary, 'btn--outlined')}
        {button(model.reroll, 'btn--tonal')}
        <button type="button" className="btn btn--text" onClick={onHome}>
          {text('back_home')}
        </button>
      </div>
    </div>
  )
}
