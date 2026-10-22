/**
 * 「演示模式已经关掉了　撤销」（底栏的一部分，不会盖住三个大按钮）：8 秒后自己收起（HOME.DEMO_UNDO_MS）。
 */
import { useEffect } from 'react'
import { text } from '../app/texts.ts'
import { HOME } from '../data/constants.ts'

export function DemoUndoStrip({ visible, onUndo, onExpire }: { readonly visible: boolean; readonly onUndo: () => void; readonly onExpire: () => void }) {
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(onExpire, HOME.DEMO_UNDO_MS)
    return () => clearTimeout(timer)
    // onExpire 每次画面都是新的函数，只看 visible
  }, [visible])

  return (
    <div className={`undo-strip${visible ? ' is-open' : ''}`} aria-live="polite">
      <div className="undo-strip__clip">
        {visible && (
          <div className="undo-strip__body">
            <span className="undo-strip__text">{text('demo_turned_off')}</span>
            <button type="button" className="undo-strip__action" onClick={onUndo}>
              {text('demo_undo')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
