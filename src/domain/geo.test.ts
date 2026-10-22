import javaFormatRaw from '../test/golden/javaFormat.json?raw'
import { describe, expect, it } from 'vitest'
import { formatFixed, formatGrouped } from '../data/javaFormat.ts'
import { testPlace } from '../test/helpers.ts'
import { boundsAround, formatDistance, formatKm, haversineMeters } from './geo.ts'
import { directionsUrl, directionsUrlTo, placePageUrl, shareUrl, sharedDirectionsUrl } from './mapsLinks.ts'
import type { Place } from './model.ts'
import { formatPrice, priceLevelFromApi } from './priceFormat.ts'
import { isOnFoot, travelMinutes, walkingMinutes } from './travel.ts'

const kl = { latitude: 3.139, longitude: 101.6869 }
const rm = (units: number) => ({ currencyCode: 'MYR', units })

function linkPlace(meters: number, id = 'ChIJabc', mapsUri: string | null = null): Place {
  return { ...testPlace(id, { distanceMeters: meters }), googleMapsUri: mapsUri }
}

describe('十、距离、走路分钟、价钱、地图链接', () => {
  it('GEO-01 导航网址：api=1、坐标 7 位小数、逗号编码成 %2C、带店的编号', () => {
    expect(directionsUrlTo(kl, 'ChIJ5-rvAcdJzDERfSgcL1uO2fQ')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=3.1390000%2C101.6869000&destination_place_id=ChIJ5-rvAcdJzDERfSgcL1uO2fQ',
    )
  })

  it('GEO-02 没有店编号（演示店）只带坐标', () => {
    expect(directionsUrlTo(kl, null)).toBe('https://www.google.com/maps/dir/?api=1&destination=3.1390000%2C101.6869000')
  })

  it('GEO-03 负数坐标也用小数点（不跟语言环境变成逗号）', () => {
    expect(directionsUrlTo({ latitude: -33.8688, longitude: 151.2093 }, 'abc')).toContain('destination=-33.8688000%2C151.2093000')
  })

  it('GEO-04 haversine：1 纬度约 111,195 米', () => {
    expect(Math.abs(haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) - 111195)).toBeLessThan(1)
  })

  it('GEO-05 赤道上 1 经度也约 111,195 米', () => {
    expect(Math.abs(haversineMeters({ latitude: 0, longitude: 100 }, { latitude: 0, longitude: 101 }) - 111195)).toBeLessThan(1)
  })

  it('GEO-06 吉隆坡到新加坡约 316 公里（误差 2 公里内）', () => {
    expect(Math.abs(haversineMeters(kl, { latitude: 1.2903, longitude: 103.852 }) - 316000)).toBeLessThan(2000)
  })

  it('GEO-07 同一点距离 0，两点互换距离一样', () => {
    const other = { latitude: 3.15, longitude: 101.7 }
    expect(haversineMeters(kl, kl)).toBeCloseTo(0, 9)
    expect(haversineMeters(kl, other)).toBeCloseTo(haversineMeters(other, kl), 9)
  })

  it('GEO-08 搜索矩形：西南角 low、东北角 high，纬度差 = 半径 ÷ 111,320，四边中点约等于半径，角落约 1.41 倍', () => {
    const radius = 1500
    const b = boundsAround(kl, radius)
    expect(b.low.latitude < kl.latitude && kl.latitude < b.high.latitude).toBe(true)
    expect(b.low.longitude < kl.longitude && kl.longitude < b.high.longitude).toBe(true)
    expect(kl.latitude - b.low.latitude).toBeCloseTo(radius / 111320, 9)
    expect(b.high.latitude - kl.latitude).toBeCloseTo(radius / 111320, 9)
    expect(Math.abs(haversineMeters(kl, { latitude: b.high.latitude, longitude: kl.longitude }) - radius)).toBeLessThan(radius * 0.01)
    expect(Math.abs(haversineMeters(kl, { latitude: kl.latitude, longitude: b.high.longitude }) - radius)).toBeLessThan(radius * 0.01)
    expect(Math.abs(haversineMeters(kl, b.high) - radius * Math.SQRT2)).toBeLessThan(radius * 0.02)
  })

  it('GEO-09 纬度 60° 时经度范围是纬度范围的 2 倍', () => {
    const b = boundsAround({ latitude: 60, longitude: 10 }, 1000)
    expect((b.high.longitude - 10) / (b.high.latitude - 60)).toBeCloseTo(2, 6)
  })

  it('GEO-10 距离写法：米以下四舍五入到 10 米，公里一位小数（数字和单位间不换行空格、公里粘在一起）', () => {
    expect(formatDistance(350)).toBe('350 米')
    expect(formatDistance(347.2)).toBe('350 米')
    expect(formatDistance(3)).toBe('10 米')
    expect(formatDistance(994)).toBe('990 米')
    expect(formatDistance(996)).toBe('1.0 公⁠里')
    expect(formatDistance(1234)).toBe('1.2 公⁠里')
    expect(formatDistance(4790)).toBe('4.8 公⁠里')
    expect(formatDistance(1150)).toBe('1.2 公⁠里') // JS toFixed 会写成 1.1
  })

  it('GEO-11 公里数写法：1.5、0.5、5、3、1（不写 1.0）、1.9999999 → 2', () => {
    expect(formatKm(1.5)).toBe('1.5')
    expect(formatKm(0.5)).toBe('0.5')
    expect(formatKm(5)).toBe('5')
    expect(formatKm(3)).toBe('3')
    expect(formatKm(1)).toBe('1')
    expect(formatKm(1.9999999)).toBe('2')
  })

  it('GEO-12 价钱：RM10–20', () => {
    expect(formatPrice({ start: rm(10), end: rm(20) }, null)).toBe('RM10–20')
  })

  it('GEO-13 只有起价「RM50 以上」，只有最高价「RM15 以下」', () => {
    expect(formatPrice({ start: rm(50), end: null }, null)).toBe('RM50 以上')
    expect(formatPrice({ start: null, end: rm(15) }, null)).toBe('RM15 以下')
  })

  it('GEO-14 起价等于最高价只写一个：RM10', () => {
    expect(formatPrice({ start: rm(10), end: rm(10) }, null)).toBe('RM10')
  })

  it('GEO-15 新币 S$10–20、泰铢「THB 100–200」、没写币种当马币 RM5–10', () => {
    expect(formatPrice({ start: { currencyCode: 'SGD', units: 10 }, end: { currencyCode: 'SGD', units: 20 } }, null)).toBe('S$10–20')
    expect(formatPrice({ start: { currencyCode: 'THB', units: 100 }, end: { currencyCode: 'THB', units: 200 } }, null)).toBe('THB 100–200')
    expect(formatPrice({ start: { currencyCode: null, units: 5 }, end: { currencyCode: null, units: 10 } }, null)).toBe('RM5–10')
  })

  it('GEO-16 有价钱范围就不用价钱等级', () => {
    expect(formatPrice({ start: rm(20), end: rm(40) }, 'EXPENSIVE')).toBe('RM20–40')
  })

  it('GEO-17 没有范围时用等级：$、$$、$$$、$$$$；范围是空的也用等级', () => {
    expect(formatPrice(null, 'INEXPENSIVE')).toBe('$')
    expect(formatPrice(null, 'MODERATE')).toBe('$$')
    expect(formatPrice(null, 'EXPENSIVE')).toBe('$$$')
    expect(formatPrice(null, 'VERY_EXPENSIVE')).toBe('$$$$')
    expect(formatPrice({ start: null, end: null }, 'MODERATE')).toBe('$$')
    expect(formatPrice(null, 'FREE')).toBe('免费')
  })

  it('GEO-18 都没有 = 不显示价钱', () => {
    expect(formatPrice(null, null)).toBeNull()
  })

  it('GEO-19 读 PRICE_LEVEL_INEXPENSIVE / VERY_EXPENSIVE；UNSPECIFIED 和空值 = 没有', () => {
    expect(priceLevelFromApi('PRICE_LEVEL_INEXPENSIVE')).toBe('INEXPENSIVE')
    expect(priceLevelFromApi('PRICE_LEVEL_VERY_EXPENSIVE')).toBe('VERY_EXPENSIVE')
    expect(priceLevelFromApi('PRICE_LEVEL_UNSPECIFIED')).toBeNull()
    expect(priceLevelFromApi(null)).toBeNull()
  })

  it('GEO-20 走路分钟 = 直线 × 1.3 ÷ 80 进一位：100 米 2 分、520 米 9 分、1.1 公里 18 分、2 公里 33 分、10 米 1 分、800 米刚好 13 分；超过 2 公里不写', () => {
    expect(walkingMinutes(100)).toBe(2)
    expect(walkingMinutes(520)).toBe(9)
    expect(walkingMinutes(1100)).toBe(18)
    expect(walkingMinutes(2500)).toBeNull()
    expect(walkingMinutes(2000)).toBe(33)
    expect(walkingMinutes(10)).toBe(1)
    expect(walkingMinutes(800)).toBe(13)
    expect(walkingMinutes(0)).toBe(1)
  })

  it('GEO-21 路上分钟：2 公里内走路（1,092 米 18 分）；更远按开车 ÷ 333 进一位 + 5 分钟停车', () => {
    expect(travelMinutes(1092)).toBe(18)
    expect(isOnFoot(2000)).toBe(true)
    expect(isOnFoot(2100)).toBe(false)
    expect(travelMinutes(2500)).toBe(15)
    expect(travelMinutes(5000)).toBe(25)
  })

  it('GEO-22 1 公里内（含 1,000 米）导航网址加走路，1.1 公里不加；分享出去的永远不加；演示店只带坐标', () => {
    expect(directionsUrl(linkPlace(520)).endsWith('&travelmode=walking')).toBe(true)
    expect(directionsUrl(linkPlace(1000))).toContain('travelmode=walking')
    expect(directionsUrl(linkPlace(1100))).not.toContain('travelmode')
    expect(directionsUrl(linkPlace(300))).toBe('https://www.google.com/maps/dir/?api=1&destination=3.1390000%2C101.6869000&destination_place_id=ChIJabc&travelmode=walking')
    expect(sharedDirectionsUrl(linkPlace(300))).toBe('https://www.google.com/maps/dir/?api=1&destination=3.1390000%2C101.6869000&destination_place_id=ChIJabc')
    expect(sharedDirectionsUrl(linkPlace(300, 'demo_02'))).toBe('https://www.google.com/maps/dir/?api=1&destination=3.1390000%2C101.6869000')
    expect(directionsUrl(linkPlace(300, 'demo_02'))).toBe('https://www.google.com/maps/dir/?api=1&destination=3.1390000%2C101.6869000&travelmode=walking')
  })

  it('GEO-23 店家页面优先用 googleMapsUri，没有就用编号搜索，演示店没有；演示店分享用 5 位小数的坐标', () => {
    expect(placePageUrl(linkPlace(300, 'ChIJabc', 'https://maps.google.com/?cid=1'))).toBe('https://maps.google.com/?cid=1')
    expect(placePageUrl(linkPlace(300))).toBe('https://www.google.com/maps/search/?api=1&query=3.1390000%2C101.6869000&query_place_id=ChIJabc')
    expect(placePageUrl(linkPlace(300, 'demo_01'))).toBeNull()
    expect(shareUrl(linkPlace(300, 'demo_01'))).toBe('https://maps.google.com/?q=3.13900,101.68690')
  })

  it('WEB-08 formatFixed / formatGrouped 和 1.7 万个 JVM 标准答案全部一样', () => {
    const golden = JSON.parse(javaFormatRaw) as Record<string, unknown>
    let checked = 0
    for (const [name, cases] of Object.entries(golden)) {
      if (!Array.isArray(cases)) continue
      const fixed = /^fixed(\d+)$/.exec(name)
      for (const entry of cases as [number, string][]) {
        const [value, expected] = entry
        if (fixed) expect(formatFixed(value, Number(fixed[1])), `${name} ${value}`).toBe(expected)
        else if (name.startsWith('grouped')) expect(formatGrouped(value), `${name} ${value}`).toBe(expected)
        else continue
        checked++
      }
    }
    expect(checked).toBeGreaterThan(17000)
  })
})
