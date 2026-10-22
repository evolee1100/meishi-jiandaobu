/**
 * 店的小零件（安卓 ResultsScreen.kt 里给别的画面共用的：RankBadge、PlaceThumb、PlaceName、RatingLine、PriceHoursLine、
 * SmallTag）。结果页的店卡用，之后「就这一家吧！」、划刀卡也会用。
 *
 * 店名一律机翻优先：机翻过 →「樱花拉面屋」+ 小标签「机翻」+ 下面一行招牌原名；
 * 没有机翻（手机浏览器没有内建翻译）的英文 / 马来文店名 → 原名 + 下面一行小词表的「大概意思：餐厅、扁担饭」。
 */
import { useState, type ReactNode } from 'react'
import { describeHours, rankBadge, ratingLinePieces, text, webText, type HoursTone } from '../../app/texts.ts'
import type { ResultItem } from '../../app/state.ts'
import type { Place } from '../../domain/model.ts'
import type { OpenStatus } from '../../domain/openingHours.ts'
import { formatPrice } from '../../domain/priceFormat.ts'
import type { ZonedTime } from '../../domain/time.ts'
import { roughMeaning } from '../../domain/roughMeaning.ts'
import { SeparatedFlow, type FlowPiece } from '../../ui/SeparatedFlow.tsx'

/** 营业状态的颜色（营业中绿、快关门橙，深色模式自动换深色版本；休息中 / 不明是灰）。 */
export function hoursToneClass(tone: HoursTone): string {
  return `tone-${tone.toLowerCase()}`
}

/** 🥇🥈🥉，第 4 名起是主色的数字；读屏念「第 4 名」。 */
export function RankBadge({ rank, className }: { readonly rank: number; readonly className?: string }) {
  const badge = rankBadge(rank)
  return (
    <span className={`rank-badge${badge.medal ? ' rank-badge--medal' : ''}${className ? ' ' + className : ''}`} role="img" aria-label={badge.a11y}>
      <span aria-hidden="true">{badge.medal ?? rank}</span>
    </span>
  )
}

export interface PlaceThumbProps {
  readonly item: ResultItem
  /** 没有照片时的 emoji：演示店用自己的，真实店用这次搜索的。 */
  readonly emoji: string
  /** 按照片 → 店家页面（键盘、读屏用店名那个按钮，照片本身不另外占一个焦点）。 */
  readonly onOpen?: () => void
  /** 照片真的显示出来了（才写「📷 作者」）。 */
  readonly onImageShown?: (shown: boolean) => void
  readonly children?: ReactNode
}

/**
 * 方形的照片：已经拿到的照片网址直接用（不会因为这里再花一次额度），否则 emoji；正在拿（收费的请求在跑）右下角一个小转圈。
 * 照片来自 googleusercontent（不带密钥）。
 */
export function PlaceThumb({ item, emoji, onOpen, onImageShown, children }: PlaceThumbProps) {
  const photo = item.photo
  return (
    <div className={`place-thumb${onOpen ? ' place-thumb--link' : ''}`} onClick={onOpen}>
      <span className="place-thumb__emoji" aria-hidden="true">
        {emoji}
      </span>
      {photo.kind === 'LOADED' && (
        <img
          className="place-thumb__img"
          src={photo.url}
          alt={item.place.name}
          loading="lazy"
          decoding="async"
          onLoad={() => onImageShown?.(true)}
          onError={(event) => {
            event.currentTarget.hidden = true
            onImageShown?.(false)
          }}
        />
      )}
      {photo.kind === 'LOADING' && <span className="place-thumb__spinner spinner" aria-hidden="true" />}
      {children}
    </div>
  )
}

/** 小标签（「机翻」「演示数据」）。 */
export function SmallTag({ children, tone = 'tertiary' }: { readonly children: ReactNode; readonly tone?: 'tertiary' | 'inverse' }) {
  return <span className={`small-tag small-tag--${tone}`}>{children}</span>
}

/** 「大概意思：餐厅、扁担饭」：没有机翻的英文 / 马来文店名才有。 */
export function roughMeaningLine(item: ResultItem): string | null {
  if (item.translatedName != null) return null
  const meaning = roughMeaning(item.place.name)
  return meaning == null ? null : webText('web_rough_meaning', meaning)
}

export interface PlaceNameProps {
  readonly item: ResultItem
  /** 按店名 → 店家的 Google 地图页面（演示店没有，画面会提示）。 */
  readonly onOpen?: () => void
  /** 店名后面多一个标签（「就这一家吧！」的「演示数据」）。 */
  readonly extraTag?: ReactNode
  readonly large?: boolean
}

/** 店名（最多两行「…」）+「机翻」小标签（放不下就换到下一行，不挤店名）+ 原名 / 大概意思。 */
export function PlaceName({ item, onOpen, extraTag, large }: PlaceNameProps) {
  const translated = item.translatedName
  const rough = roughMeaningLine(item)
  const content = (
    <>
      <span className="place-name__row">
        <span className="place-name__name">{translated ?? item.place.name}</span>
        {translated != null && <SmallTag>{text('machine_translated')}</SmallTag>}
        {extraTag}
      </span>
      {translated != null && <span className="place-name__original">{item.place.name}</span>}
      {rough != null && <span className="place-name__rough">{rough}</span>}
    </>
  )
  const className = `place-name${large ? ' place-name--large' : ''}`
  return onOpen ? (
    <button type="button" className={`${className} place-name--link`} onClick={onOpen}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}

/** 「⭐ 4.6（1,234 条评价） · 🚶 520 米 · 走路约 7 分钟」（short：「约 7 分钟」）；只在两段之间换行。 */
export function RatingLine({ item, short = false }: { readonly item: ResultItem; readonly short?: boolean }) {
  const pieces: FlowPiece[] = ratingLinePieces(item, short).map((piece, index) => ({ key: String(index), node: piece }))
  return <SeparatedFlow className="rating-line" pieces={pieces} />
}

/** 「RM8–15 · 营业中 开到晚上 10:00」/「⏰ 还有 35 分钟关门 · 可能停止点餐了」（橙）/「休息中 下午 5:00 开」。 */
export function PriceHoursLine({
  place,
  status,
  now,
  showPrice = true,
}: {
  readonly place: Place
  readonly status: OpenStatus
  readonly now: ZonedTime
  readonly showPrice?: boolean
}) {
  const label = describeHours(status, now)
  const price = showPrice ? formatPrice(place.priceRange, place.priceLevel) : null
  const pieces: FlowPiece[] = []
  if (price) pieces.push({ key: 'price', node: <span className="price-hours__price">{price}</span> })
  pieces.push({ key: 'label', node: <span className={`price-hours__label ${hoursToneClass(label.tone)}`}>{label.label}</span>, before: 'dot' })
  if (label.detail != null) {
    pieces.push({
      key: 'detail',
      node: <span className={`price-hours__detail${label.tone === 'OPEN' ? ' is-open' : ''}`}>{label.detail}</span>,
      before: label.dotted ? 'dot' : 'gap',
    })
  }
  return <SeparatedFlow className="price-hours" pieces={pieces} />
}

/** 照片显示出来了没有（换了照片就重新算）。 */
export function useImageShown(photoKey: string): [boolean, (shown: boolean) => void] {
  const [state, setState] = useState<{ key: string; shown: boolean }>({ key: photoKey, shown: false })
  const shown = state.key === photoKey && state.shown
  return [shown, (value: boolean) => setState({ key: photoKey, shown: value })]
}
