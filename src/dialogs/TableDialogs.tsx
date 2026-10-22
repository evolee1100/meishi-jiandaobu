/**
 * 👥 饭桌模式的两个对话框（安卓 TableOverlay.RenameDialog、MainScreen 离开时问的那个，功能清单 14.1、14.2）。
 * 都由 App 管（返回键 / Esc 一次只关一层）。
 *
 * 改名字：最多 6 个字（emoji 算 1 个，按 Unicode 字符数）；打字时去掉换行，超过 6 个字的输入（包括贴上）整个不收。
 * 用中文输入法打拼音时，拼音还没选字前（composition）先照收，选好字以后再按 6 个字的规矩检查（不然打不了中文）。
 * 【好】保存（状态层再清理一次：连续空白换成一个空格、去前后空白、截到 6 个字）；【用回原来的名字】存空的（= 原名）。
 * 名字只存在这个浏览器（localStorage），不会发到别的地方。
 */
import { useRef, useState, type CompositionEvent, type FormEvent } from 'react'
import { text } from '../app/texts.ts'
import { codePointLength } from '../domain/chineseText.ts'
import { avatarDefaultName, MAX_NAME_LENGTH, playerLabel, type TablePlayer } from '../domain/table.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { PhraseText } from '../ui/PhraseText.tsx'

/** 打字时：去掉换行；超过 6 个字 → 不收（null = 维持原来的字）。 */
export function acceptNameInput(typed: string): string | null {
  const oneLine = typed.replace(/[\r\n]/g, '')
  return codePointLength(oneLine) <= MAX_NAME_LENGTH ? oneLine : null
}

export interface RenameDialogProps {
  readonly player: TablePlayer
  readonly onSave: (name: string) => void
  readonly onDismiss: () => void
}

export function RenameDialog({ player, onSave, onDismiss }: RenameDialogProps) {
  const [value, setValue] = useState(player.customName)
  /** 上一次照规矩收下的字（输入法选字后太长，就退回这个）。 */
  const accepted = useRef(player.customName)
  const composing = useRef(false)

  const onInput = (event: FormEvent<HTMLInputElement>) => {
    const typed = event.currentTarget.value
    if (composing.current) {
      setValue(typed)
      return
    }
    const next = acceptNameInput(typed)
    if (next == null) return
    accepted.current = next
    setValue(next)
  }

  const onCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    composing.current = false
    const next = acceptNameInput(event.currentTarget.value)
    const kept = next ?? accepted.current
    accepted.current = kept
    setValue(kept)
  }

  return (
    <Dialog labelledBy="rename-title" onDismiss={onDismiss} className="dialog--alert rename-dialog" testId="rename-dialog" initialFocus="input">
      <h2 id="rename-title" className="dialog__title dialog__title--plain">
        {text('table_rename_title', playerLabel(player))}
      </h2>
      <form
        className="rename-dialog__form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(composing.current ? accepted.current : value)
        }}
      >
        <label className="key-field">
          <span className="key-field__label">{text('table_rename_label')}</span>
          <span className="key-field__row">
            <input
              className="key-field__input rename-dialog__input"
              type="text"
              value={value}
              placeholder={avatarDefaultName(player.avatar)}
              autoComplete="off"
              enterKeyHint="done"
              onChange={onInput}
              onCompositionStart={() => {
                composing.current = true
              }}
              onCompositionEnd={onCompositionEnd}
            />
          </span>
        </label>
        <PhraseText as="p" className="dialog__note" text={text('table_rename_note')} />
        <div className="dialog__actions">
          <button type="button" className="btn btn--text" onClick={() => onSave('')}>
            {text('table_rename_reset')}
          </button>
          <button type="submit" className="btn btn--text">
            {text('table_rename_save')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** 「饭桌还没玩完，要结束吗？」【继续玩】【结束】（点外面 = 继续玩）。 */
export function LeaveTableDialog({ onLeave, onStay }: { readonly onLeave: () => void; readonly onStay: () => void }) {
  return (
    <Dialog labelledBy="leave-table-title" onDismiss={onStay} className="dialog--alert" testId="leave-table">
      <h2 id="leave-table-title" className="dialog__title dialog__title--plain">
        {text('table_leave_title')}
      </h2>
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={onStay}>
          {text('table_leave_no')}
        </button>
        <button type="button" className="btn btn--text" onClick={onLeave}>
          {text('table_leave_yes')}
        </button>
      </div>
    </Dialog>
  )
}
