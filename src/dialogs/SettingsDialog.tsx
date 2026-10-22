/**
 * ⚙️ 设置（安卓 ui/SettingsDialog.kt，功能清单第十九节）：一般（不用懂技术）在前，「进阶：Google 密钥」收起来。
 * 演示开关、摇一摇、清除记录一按就生效；密钥要按「保存密钥」，关窗口时有没保存的密钥会先问。
 * 密钥只存在这个浏览器的 localStorage，输入框每打一个字 / 贴上时就清理（全角 → 半角，只留密钥会有的字）。
 * 手机键盘弹出来时，输入框和「保存密钥」会滚到看得见的地方。
 */
import { useEffect, useRef, useState } from 'react'
import type { HomeState } from '../app/state.ts'
import { text, webText } from '../app/texts.ts'
import { QUOTA } from '../data/constants.ts'
import { HOME_SYMBOLS } from '../data/uiLiterals.ts'
import { cleanApiKey } from '../domain/apiKeys.ts'
import { copyText } from '../platform/device.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { Icon } from '../ui/Icon.tsx'
import { PhraseText } from '../ui/PhraseText.tsx'
import type { ShakeCapability } from '../screens/HomeScreen.tsx'

export interface SettingsDialogProps {
  readonly home: HomeState
  readonly expandAdvanced: boolean
  readonly keyDraft: string
  readonly shake: ShakeCapability
  readonly translatorAvailable: boolean
  readonly onKeyDraft: (key: string) => void
  readonly onSaveKey: (key: string) => void
  readonly onDemoMode: (on: boolean) => void
  readonly onShakeEnabled: (on: boolean) => void
  readonly onAllowShake: () => void
  readonly onClearVisits: () => void
  readonly onNotice: (message: string) => void
  readonly onRequestClose: () => void
}

/** 这个网站的网址（填进 Google Cloud 密钥的「网站限制」）：浏览器跨网站请求只送出网域，所以用「网域/*」。 */
export function siteRestriction(loc: Pick<Location, 'origin'> = window.location): string {
  return `${loc.origin}/*`
}

/**
 * 「网站限制」要填的两行（研究结论：允许整个网域要填「网域/*」和「网域」两条；只填带仓库路径的那条会被 Google 挡下来，
 * 因为浏览器跨网站请求只送出网域）。
 */
export function siteRestrictions(loc: Pick<Location, 'origin'> = window.location): string[] {
  return [`${loc.origin}/*`, loc.origin]
}

/** 「📖 怎么申请密钥？一步一步来」的步骤（网页版的说明书）。 */
export const KEY_GUIDE_STEPS = [
  'web_key_guide_1',
  'web_key_guide_2',
  'web_key_guide_3',
  'web_key_guide_4',
  'web_key_guide_5',
  'web_key_guide_6',
  'web_key_guide_7',
] as const

export function SettingsDialog(props: SettingsDialogProps) {
  const { home, keyDraft, shake } = props
  const [advanced, setAdvanced] = useState(props.expandAdvanced)
  const [showKey, setShowKey] = useState(false)
  // 还没有密钥的人多半要看步骤：一打开就展开；已经有密钥就收起来。
  const [guide, setGuide] = useState(props.home.apiKeySource === 'NONE')
  const keyRef = useRef<HTMLInputElement>(null)
  const saveRef = useRef<HTMLDivElement>(null)

  // 展开「进阶」后等 150 毫秒，把密钥框滚进画面。
  useEffect(() => {
    if (!advanced) return
    const timer = setTimeout(() => keyRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150)
    return () => clearTimeout(timer)
  }, [advanced])

  // 手机键盘弹出来（看得见的区域变矮）：把输入框和「保存密钥」一起滚进看得见的地方。
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const onResize = () => {
      if (document.activeElement === keyRef.current) saveRef.current?.scrollIntoView({ block: 'nearest' })
    }
    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [])

  const saved = home.apiKeyOverride
  const dirty = keyDraft !== saved
  const remaining = text('remaining_free', home.remainingSearches) + (home.demoMode ? text('settings_remaining_demo') : '')
  const usage = text(
    'settings_usage',
    home.remainingSearches,
    QUOTA.SEARCHES_PER_MONTH,
    QUOTA.QUERIES_PER_SEARCH,
    home.textSearchesUsed,
    QUOTA.TEXT_SEARCH_MONTHLY_LIMIT,
    home.photosUsed,
    QUOTA.PHOTO_MONTHLY_LIMIT,
  )
  const sites = siteRestrictions()
  const copySite = async (site: string) => {
    const result = await copyText(site)
    props.onNotice(result === 'COPIED' ? text('copied') : webText('web_share_copy_failed'))
  }

  return (
    <Dialog labelledBy="settings-title" onDismiss={props.onRequestClose} className="dialog--card settings-dialog" testId="settings-dialog">
      <h2 id="settings-title" className="dialog__title dialog__title--plain">
        {text('settings_title')}
      </h2>

      <button type="button" role="switch" aria-checked={home.demoMode} className="switch-block switch-block--demo" onClick={() => props.onDemoMode(!home.demoMode)}>
        <span className="switch-block__text">
          <PhraseText className="switch-block__title" text={text('demo_switch')} />
          <PhraseText className="switch-block__note" text={text('demo_switch_note')} />
        </span>
        <span className="switch" aria-hidden="true" />
      </button>

      <PhraseText as="p" className="settings-remaining" text={remaining} />

      <button
        type="button"
        role="switch"
        aria-checked={home.shakeEnabled}
        className="switch-block"
        onClick={() => props.onShakeEnabled(!home.shakeEnabled)}
      >
        <span className="switch-block__text">
          <span className="switch-block__title">{text('settings_shake')}</span>
          <PhraseText className="switch-block__note" text={text('settings_shake_note')} />
        </span>
        <span className="switch" aria-hidden="true" />
      </button>
      {home.shakeEnabled && shake === 'NEEDS_PERMISSION' && (
        <div className="settings-shake-ask">
          <button type="button" className="btn btn--tonal" onClick={props.onAllowShake}>
            📳 {webText('web_shake_allow')}
          </button>
          <PhraseText as="p" className="settings-small" text={webText('web_shake_permission_note')} />
        </div>
      )}
      {shake === 'UNSUPPORTED' && <PhraseText as="p" className="settings-small" text={webText('web_shake_unsupported')} />}

      {home.visitCount > 0 && (
        <div className="settings-visits">
          <PhraseText as="p" className="settings-small" text={text('settings_visits_note')} />
          <button
            type="button"
            className="btn btn--outlined btn--block"
            onClick={() => {
              props.onClearVisits()
              props.onNotice(text('settings_visits_cleared'))
            }}
          >
            {text('settings_clear_visits', home.visitCount)}
          </button>
        </div>
      )}

      <hr className="settings-divider" />
      <button type="button" className="settings-advanced" aria-expanded={advanced} onClick={() => setAdvanced((a) => !a)}>
        <span className="settings-advanced__text">
          <span className="switch-block__title">{text('settings_advanced')}</span>
          <span className="switch-block__note">{text('settings_advanced_note')}</span>
        </span>
        <span className="settings-advanced__arrow" aria-hidden="true">
          {advanced ? HOME_SYMBOLS.expanded : HOME_SYMBOLS.collapsed}
        </span>
      </button>

      {advanced && (
        <div className="settings-key">
          <PhraseText as="p" className="settings-small" text={text('settings_key_help')} />
          <label className="key-field">
            <span className="key-field__label">{text('settings_key_label')}</span>
            <span className="key-field__row">
              <input
                ref={keyRef}
                className="key-field__input"
                type={showKey ? 'text' : 'password'}
                value={keyDraft}
                placeholder={text('settings_key_placeholder')}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="done"
                onChange={(event) => props.onKeyDraft(cleanApiKey(event.target.value))}
                onFocus={() => setTimeout(() => saveRef.current?.scrollIntoView({ block: 'nearest' }), 300)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={text(showKey ? 'hide_key' : 'show_key')}
                aria-pressed={showKey}
                onClick={() => setShowKey((s) => !s)}
              >
                <Icon name={showKey ? 'VISIBILITY_OFF' : 'VISIBILITY'} />
              </button>
            </span>
          </label>
          <p className="settings-small">{text(home.apiKeySource === 'NONE' ? 'settings_key_source_none' : 'settings_key_source_in_app')}</p>
          <div ref={saveRef} className="settings-key__buttons">
            <button
              type="button"
              className="btn btn--filled"
              disabled={!dirty}
              onClick={() => {
                props.onSaveKey(keyDraft)
                props.onNotice(text('settings_key_saved'))
              }}
            >
              {text('settings_save_key')}
            </button>
            {saved !== '' && (
              <button
                type="button"
                className="btn btn--text"
                onClick={() => {
                  props.onKeyDraft('')
                  props.onSaveKey('')
                }}
              >
                {text('clear_key')}
              </button>
            )}
          </div>
          <PhraseText as="p" className="settings-small" text={webText('web_key_local_note')} />

          <button type="button" className="settings-guide__toggle" aria-expanded={guide} onClick={() => setGuide((g) => !g)}>
            <span className="settings-guide__title">{webText('web_key_guide_title')}</span>
            <span className="settings-advanced__arrow" aria-hidden="true">
              {guide ? HOME_SYMBOLS.expanded : HOME_SYMBOLS.collapsed}
            </span>
          </button>
          {guide && (
            <ol className="settings-guide">
              {KEY_GUIDE_STEPS.map((key) => (
                <PhraseText key={key} as="li" className="settings-guide__step" text={webText(key)} />
              ))}
            </ol>
          )}

          <PhraseText as="p" className="settings-subtitle" text={text('settings_restrict_title')} />
          <span className="site-row__label">{webText('web_site_label')}</span>
          {sites.map((site) => (
            <div key={site} className="site-row">
              <code className="site-row__url">{site}</code>
              <button type="button" className="icon-btn" aria-label={`${text('copy')} ${site}`} onClick={() => void copySite(site)}>
                <Icon name="CONTENT_COPY" />
              </button>
            </div>
          ))}
          <PhraseText as="p" className="settings-small" text={webText('web_site_note')} />

          <p className="settings-usage">{usage}</p>
          <PhraseText as="p" className="settings-small" text={webText('web_usage_local_note')} />
          {!props.translatorAvailable && <PhraseText as="p" className="settings-small" text={webText('web_translate_unavailable')} />}
        </div>
      )}

      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={props.onRequestClose}>
          {text('settings_close')}
        </button>
      </div>
    </Dialog>
  )
}

/** 「密钥还没保存，要保存吗？」【不保存】【保存】。 */
export function UnsavedKeyDialog({ onSave, onDiscard }: { readonly onSave: () => void; readonly onDiscard: () => void }) {
  return (
    <Dialog labelledBy="unsaved-title" className="dialog--alert" testId="unsaved-key">
      <h2 id="unsaved-title" className="dialog__title dialog__title--plain">
        {text('settings_unsaved_title')}
      </h2>
      <div className="dialog__actions">
        <button type="button" className="btn btn--text" onClick={onDiscard}>
          {text('settings_unsaved_discard')}
        </button>
        <button type="button" className="btn btn--filled" onClick={onSave}>
          {text('save')}
        </button>
      </div>
    </Dialog>
  )
}
