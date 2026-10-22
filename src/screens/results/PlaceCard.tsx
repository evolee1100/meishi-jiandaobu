/**
 * 一家店的卡片（安卓 ResultsScreen.PlaceCard，功能清单 11.5）：矮到一屏放得下三张。
 * 左边：照片 / emoji（左上角名次）+ 下面「导航」；右边：店名（机翻 + 原名 / 大概意思）、评分行、价钱营业行、地址、
 * 「👣 去过」、「📷 作者」（照片真的显示出来才写）；右上角 ❤️。
 * 卡片上的东西都不发请求：导航和店家页面是普通的 Google 地图网址（不带密钥、不算用量）。
 */
import type { ResultItem } from '../../app/state.ts'
import { text, visitText } from '../../app/texts.ts'
import { GAME_SYMBOLS, PREFIXES } from '../../data/uiLiterals.ts'
import type { OpenStatus } from '../../domain/openingHours.ts'
import type { ZonedTime } from '../../domain/time.ts'
import { Icon } from '../../ui/Icon.tsx'
import { PlaceName, PlaceThumb, PriceHoursLine, RankBadge, RatingLine, useImageShown } from './PlaceParts.tsx'

export interface PlaceCardProps {
  readonly item: ResultItem
  readonly status: OpenStatus
  /** 现在能去（营业中或不明，而且走到、点菜前不会关门）：不能去的 🤍 变淡。 */
  readonly canGo: boolean
  readonly now: ZonedTime
  readonly emoji: string
  readonly inBasket: boolean
  /** 最后一次导航到这家的时间（「👣 今天中午去过」）。 */
  readonly lastVisit: number | null
  /** 窄屏大字：小照片、评分行短写，字有更多地方。 */
  readonly tight: boolean
  readonly onToggleBasket: () => void
  readonly onNavigate: () => void
  readonly onOpenPage: () => void
}

export function PlaceCard(props: PlaceCardProps) {
  const { item, status, now, tight } = props
  const place = item.place
  const photoKey = item.photo.kind === 'LOADED' ? item.photo.url : item.photo.kind
  const [imageShown, setImageShown] = useImageShown(photoKey)
  const name = item.translatedName ?? place.name
  return (
    <article className={`place-card${tight ? ' place-card--tight' : ''}`} aria-label={name}>
      <div className="place-card__left">
        <PlaceThumb item={item} emoji={props.emoji} onOpen={props.onOpenPage} onImageShown={setImageShown}>
          <RankBadge rank={item.rank} className="place-thumb__badge" />
        </PlaceThumb>
        <button type="button" className="btn btn--filled place-card__nav" onClick={props.onNavigate}>
          <Icon name="DIRECTIONS" className="place-card__nav-icon" />
          <span className="place-card__nav-text">{text('navigate')}</span>
        </button>
      </div>
      <div className="place-card__body">
        <PlaceName item={item} onOpen={props.onOpenPage} />
        <RatingLine item={item} short={tight} />
        <PriceHoursLine place={place} status={status} now={now} />
        {place.address && (
          <p className="place-card__address">
            {PREFIXES.address}
            {place.address}
          </p>
        )}
        {props.lastVisit != null && <p className="place-card__visited">{visitText(props.lastVisit, now.epochMillis, now.zone)}</p>}
        {imageShown && place.photoAuthor && <p className="place-card__author">{text('photo_by', place.photoAuthor)}</p>}
      </div>
      <button
        type="button"
        className={`heart-btn${!props.canGo && !props.inBasket ? ' heart-btn--faded' : ''}`}
        aria-label={text(props.inBasket ? 'basket_remove_a11y' : 'basket_add_a11y', name)}
        aria-pressed={props.inBasket}
        aria-description={text(props.inBasket ? 'basket_state_in' : 'basket_state_out')}
        onClick={props.onToggleBasket}
      >
        <span className="heart-btn__emoji" aria-hidden="true">
          {props.inBasket ? GAME_SYMBOLS.heartIn : GAME_SYMBOLS.heartOut}
        </span>
      </button>
    </article>
  )
}
