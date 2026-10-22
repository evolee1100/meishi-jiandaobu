/** 安卓的 6 个小图标（Material Symbols，颜色跟着文字走）。字串是写死在程序里的，不是外来的内容。 */
import { UI_ICONS, type UiIconName } from '../data/icons.ts'

export function Icon({ name, className }: { readonly name: UiIconName; readonly className?: string }) {
  return <span className={className ? `icon ${className}` : 'icon'} aria-hidden="true" dangerouslySetInnerHTML={{ __html: UI_ICONS[name] }} />
}
