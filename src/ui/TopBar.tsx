/**
 * 标题栏（每个画面都有，功能清单 2.3）：中间「美食剪刀布」，演示模式开着时旁边一个小黑胶囊「演示」；
 * 不是首页时左边有返回箭头（跟返回键一样）；右边 ⚙️ 随时打开设置。
 */
import { useRef } from 'react'
import { text } from '../app/texts.ts'
import { Icon } from './Icon.tsx'
import { usePublishedHeight } from './media.ts'

export interface TopBarProps {
  readonly demo: boolean
  readonly showBack: boolean
  readonly onBack: () => void
  readonly onSettings: () => void
}

export function TopBar({ demo, showBack, onBack, onSettings }: TopBarProps) {
  const ref = useRef<HTMLElement>(null)
  // 实际高度（大字时可能比 3.5rem 高）：结果页的演示条固定在它下面
  usePublishedHeight(ref, '--topbar-height')
  return (
    <header ref={ref} className="topbar">
      <div className="topbar__side">
        {showBack && (
          <button type="button" className="icon-btn" aria-label={text('back')} onClick={onBack}>
            <Icon name="ARROW_BACK" />
          </button>
        )}
      </div>
      <div className="topbar__center">
        <h1 className="topbar__title">{text('app_name')}</h1>
        {demo && <span className="demo-badge">{text('demo_badge')}</span>}
      </div>
      <div className="topbar__side topbar__side--end">
        <button type="button" className="icon-btn" aria-label={text('settings')} onClick={onSettings}>
          <Icon name="SETTINGS" />
        </button>
      </div>
    </header>
  )
}
