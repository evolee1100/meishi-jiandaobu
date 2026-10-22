/**
 * 小提示条（安卓 Toast / Snackbar）：出现在底栏上方，不盖住按钮，几秒后自己收起；读屏会念（aria-live）。
 * 可以带一个文字按钮（例如「撤销」）。
 */
import { createPortal } from 'react-dom'
import { PhraseText } from './PhraseText.tsx'

export interface Notice {
  readonly id: number
  readonly text: string
  readonly action?: { readonly label: string; readonly run: () => void }
}

export function Snackbar({ notice, onClose }: { readonly notice: Notice | null; readonly onClose: () => void }) {
  return createPortal(
    <div className="snackbar-holder" aria-live="polite" aria-atomic="true">
      {notice && (
        <div key={notice.id} className="snackbar" role="status">
          <PhraseText className="snackbar__text" text={notice.text} />
          {notice.action && (
            <button
              type="button"
              className="snackbar__action"
              onClick={() => {
                notice.action?.run()
                onClose()
              }}
            >
              {notice.action.label}
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}
