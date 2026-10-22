/**
 * 「想找多远的店？」（功能清单 3.4）：四个大按钮，现在的范围是实心、其他空心；点一个马上换、马上记住、关窗口，不搜索。
 */
import { text } from '../app/texts.ts'
import { QUICK_KM } from '../domain/radius.ts'
import { Dialog } from '../ui/Dialog.tsx'

const QUICK_KEYS = ['radius_quick_walk', 'radius_quick_near', 'radius_quick_far', 'radius_quick_drive'] as const

export function RadiusDialog({ radiusKm, onPick, onCancel }: { readonly radiusKm: number; readonly onPick: (km: number) => void; readonly onCancel: () => void }) {
  return (
    <Dialog labelledBy="radius-title" onDismiss={onCancel} className="dialog--alert" testId="radius-dialog">
      <h2 id="radius-title" className="dialog__title dialog__title--plain">
        {text('radius_dialog_title')}
      </h2>
      <div className="radius-options">
        {QUICK_KM.map((km, index) => (
          <button
            key={km}
            type="button"
            className={`btn btn--block btn--big ${km === radiusKm ? 'btn--filled' : 'btn--outlined'}`}
            aria-pressed={km === radiusKm}
            onClick={() => onPick(km)}
          >
            {text(QUICK_KEYS[index] ?? 'radius_quick_near')}
          </button>
        ))}
      </div>
      <p className="dialog__note">{text('radius_dialog_note')}</p>
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={onCancel}>
          {text('cancel')}
        </button>
      </div>
    </Dialog>
  )
}
