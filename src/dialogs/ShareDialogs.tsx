/**
 * 结果页的小对话框：
 * - 「这一餐已经定了『…』。换一组店重新玩，会用掉唯一一次反悔，确定吗？」（愿赌服输，功能清单 15.2）；
 * - 「要所有人都点头哦！确定不算刚才那局？」（锁住的「就这一家吧！」按「大家都同意重来？」，15.4）；
 * - 分享、复制都不行时：把要发的文字放在框里让人长按复制，旁边也可以直接用 WhatsApp 发（WEB-19）。
 */
import { text, webText } from '../app/texts.ts'
import { openExternal, whatsAppShareUrl } from '../platform/device.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { PhraseText } from '../ui/PhraseText.tsx'

export function MealPromptDialog({ placeName, onConfirm, onDecline }: { readonly placeName: string; readonly onConfirm: () => void; readonly onDecline: () => void }) {
  return (
    <Dialog label={text('meal_banner', placeName)} onDismiss={onDecline} className="dialog--alert" testId="meal-prompt">
      <PhraseText as="p" className="dialog__body" text={text('meal_prompt_text', placeName)} />
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={onDecline}>
          {text('meal_prompt_decline')}
        </button>
        <button type="button" className="btn btn--text" onClick={onConfirm}>
          {text('meal_prompt_confirm')}
        </button>
      </div>
    </Dialog>
  )
}

export function RestartDialog({ onConfirm, onCancel }: { readonly onConfirm: () => void; readonly onCancel: () => void }) {
  return (
    <Dialog label={text('meal_restart')} onDismiss={onCancel} className="dialog--alert" testId="restart-dialog">
      <PhraseText as="p" className="dialog__body" text={text('meal_restart_confirm')} />
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={onCancel}>
          {text('meal_restart_no')}
        </button>
        <button type="button" className="btn btn--text" onClick={onConfirm}>
          {text('meal_restart_yes')}
        </button>
      </div>
    </Dialog>
  )
}

export function ManualCopyDialog({ value, onClose }: { readonly value: string; readonly onClose: () => void }) {
  return (
    <Dialog labelledBy="manual-copy-title" onDismiss={onClose} className="dialog--card" testId="manual-copy">
      <h2 id="manual-copy-title" className="dialog__title dialog__title--plain manual-copy-dialog__title">
        {webText('web_share_copy_failed')}
      </h2>
      <textarea className="manual-copy__text" readOnly value={value} rows={8} onFocus={(event) => event.currentTarget.select()} />
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={() => openExternal(whatsAppShareUrl(value))}>
          {webText('web_share_whatsapp')}
        </button>
        <button type="button" className="btn btn--text" onClick={onClose}>
          {text('settings_close')}
        </button>
      </div>
    </Dialog>
  )
}
