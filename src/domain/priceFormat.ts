/**
 * 价钱的写法（安卓 domain/PriceFormat.kt）：优先价钱范围「RM10–20」「RM50 以上」「RM15 以下」，
 * 没有范围才用等级「$」–「$$$$」，都没有就不写。
 */
import { PRICE } from '../data/uiLiterals.ts'
import type { PriceLevel, PriceRange } from './model.ts'

/** Google 的 PRICE_LEVEL_*；UNSPECIFIED 和没有 → null。 */
export function priceLevelFromApi(value: string | null | undefined): PriceLevel | null {
  switch (value) {
    case 'PRICE_LEVEL_FREE':
      return 'FREE'
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 'INEXPENSIVE'
    case 'PRICE_LEVEL_MODERATE':
      return 'MODERATE'
    case 'PRICE_LEVEL_EXPENSIVE':
      return 'EXPENSIVE'
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 'VERY_EXPENSIVE'
    default:
      return null
  }
}

function currencyPrefix(code: string | null): string {
  const upper = code?.toUpperCase() ?? ''
  if (upper === '' || upper === 'MYR') return 'RM'
  if (upper === 'SGD') return 'S$'
  if (upper === 'USD') return 'US$'
  return `${code} `
}

export function formatRange(range: PriceRange): string | null {
  const { start, end } = range
  const currency = currencyPrefix(start?.currencyCode ?? end?.currencyCode ?? null)
  if (start && end && start.units === end.units) return `${currency}${start.units}`
  if (start && end) return `${currency}${start.units}${PRICE.rangeDash}${end.units}`
  if (start) return `${currency}${start.units}${PRICE.openEndedFrom}`
  if (end) return `${currency}${end.units}${PRICE.openEndedTo}`
  return null
}

export function formatLevel(level: PriceLevel): string {
  return PRICE.levels[level]
}

export function formatPrice(range: PriceRange | null, level: PriceLevel | null): string | null {
  return (range ? formatRange(range) : null) ?? (level ? formatLevel(level) : null)
}
