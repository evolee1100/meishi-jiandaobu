/**
 * 定位的两个小窗口（功能清单 4.1、31.4）：
 * - 「先跟你说一声」：第一次打开 / 按吃饭时还没允许定位，先用中文说明，按「好，去允许」才让浏览器问；
 * - 「怎么打开定位？」：浏览器挡住了定位时，安卓 / iPhone 各一段步骤 +「我改好了，再试一次」；
 *   不是 https 打开的、或浏览器不能定位时，说清楚原因和办法。
 */
import { locationHelp, text, webText, type LocationEnvironment } from '../app/texts.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { PhraseText } from '../ui/PhraseText.tsx'

export function LocationExplainDialog({
  env,
  onAccept,
  onDecline,
}: {
  readonly env: LocationEnvironment
  readonly onAccept: () => void
  readonly onDecline: () => void
}) {
  if (env !== 'OK') {
    const help = locationHelp(env)
    return (
      <Dialog labelledBy="explain-title" onDismiss={onDecline} className="dialog--alert" testId="location-explain">
        <h2 id="explain-title" className="dialog__title dialog__title--plain">
          {text('location_explain_title')}
        </h2>
        {help.steps.map((step) => (
          <PhraseText key={step} as="p" className="dialog__body" text={step} />
        ))}
        <div className="dialog__actions">
          <button type="button" className="btn btn--filled" onClick={onDecline}>
            {webText('web_location_got_it')}
          </button>
        </div>
      </Dialog>
    )
  }
  return (
    <Dialog labelledBy="explain-title" onDismiss={onDecline} className="dialog--alert" testId="location-explain">
      <h2 id="explain-title" className="dialog__title dialog__title--plain">
        {text('location_explain_title')}
      </h2>
      <PhraseText as="p" className="dialog__body" text={text('location_explain_text')} />
      <PhraseText as="p" className="dialog__body dialog__body--next" text={text('location_explain_next')} />
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={onDecline}>
          {text('location_explain_later')}
        </button>
        <button type="button" className="btn btn--filled" onClick={onAccept}>
          {text('location_explain_ok')}
        </button>
      </div>
    </Dialog>
  )
}

export function LocationHelpDialog({ env, onRetry, onClose }: { readonly env: LocationEnvironment; readonly onRetry: () => void; readonly onClose: () => void }) {
  const help = locationHelp(env)
  return (
    <Dialog labelledBy="help-title" onDismiss={onClose} className="dialog--alert" testId="location-help">
      <h2 id="help-title" className="dialog__title dialog__title--plain">
        {help.title}
      </h2>
      {help.steps.map((step) => (
        <PhraseText key={step} as="p" className="dialog__body" text={step} />
      ))}
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={onClose}>
          {text('settings_close')}
        </button>
        {help.canRetry && (
          <button type="button" className="btn btn--filled" onClick={onRetry}>
            {webText('web_location_help_retry')}
          </button>
        )}
      </div>
    </Dialog>
  )
}
