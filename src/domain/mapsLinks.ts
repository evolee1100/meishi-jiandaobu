/**
 * Google 地图的普通网址（Maps URLs，打开不花钱、不算 API 用量；安卓 domain/MapsLinks.kt）。
 */
import { GEO } from '../data/constants.ts'
import { formatFixed } from '../data/javaFormat.ts'
import { isDemoPlace, type LatLng, type Place } from './model.ts'

/** 和 Java 的 URLEncoder.encode(value, "UTF-8") 一样：空格变「+」，! ' ( ) ~ 也编码，* 不编码。 */
export function javaUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+')
}

function latLng(point: LatLng): string {
  return `${formatFixed(point.latitude, 7)}%2C${formatFixed(point.longitude, 7)}`
}

/** 1 公里内（含 1,000 米）的导航直接用走路路线。 */
export function isWalkingDistance(meters: number): boolean {
  return meters <= GEO.WALKING_NAV_MAX_METERS
}

/** 导航网址：api=1 + 目的地坐标（逗号写成 %2C）+ 店的编号（演示店没有）+ 走路（1 公里内）。 */
export function directionsUrlTo(destination: LatLng, placeId: string | null, walking = false): string {
  let url = `https://www.google.com/maps/dir/?api=1&destination=${latLng(destination)}`
  if (placeId && placeId.trim()) url += '&destination_place_id=' + javaUrlEncode(placeId)
  if (walking) url += '&travelmode=walking'
  return url
}

/** 到这家店的导航（1 公里内走路；演示店不带假编号）。 */
export function directionsUrl(place: Place): string {
  return directionsUrlTo(place.location, isDemoPlace(place) ? null : place.id, isWalkingDistance(place.distanceMeters))
}

/** 分享给朋友的导航：永远不指定走路（朋友在别的地方）。 */
export function sharedDirectionsUrl(place: Place): string {
  return directionsUrlTo(place.location, isDemoPlace(place) ? null : place.id, false)
}

/** 店家的 Google 地图页面：Google 给的 googleMapsUri，否则按编号搜索；演示店没有。 */
export function placePageUrl(place: Place): string | null {
  if (isDemoPlace(place)) return null
  if (place.googleMapsUri && place.googleMapsUri.trim()) return place.googleMapsUri
  return `https://www.google.com/maps/search/?api=1&query=${latLng(place.location)}&query_place_id=${javaUrlEncode(place.id)}`
}

/** 分享文字里的短链接：店家页面；演示店用 5 位小数的坐标（https://maps.google.com/?q=3.14520,101.69750）。 */
export function shareUrl(place: Place): string {
  return (
    placePageUrl(place) ??
    `https://maps.google.com/?q=${formatFixed(place.location.latitude, 5)},${formatFixed(place.location.longitude, 5)}`
  )
}
