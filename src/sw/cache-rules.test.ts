import { describe, expect, it } from 'vitest'
import { cacheNameFor, classifyRequest, isGoogleUrl } from './cache-rules.ts'

const SCOPE = 'https://evolee1217-lgtm.github.io/meishi/'

function headers(...names: string[]) {
  const set = new Set(names.map((name) => name.toLowerCase()))
  return { has: (name: string) => set.has(name.toLowerCase()) }
}

describe('离线缓存规则', () => {
  it('Google 的接口和照片一律不缓存', () => {
    const googleUrls = [
      'https://places.googleapis.com/v1/places:searchText',
      'https://places.googleapis.com/v1/places/abc/photos/xyz/media?maxWidthPx=400',
      'https://maps.googleapis.com/maps/api/js',
      'https://lh3.googleusercontent.com/places/photo-123',
      'https://www.google.com/maps/dir/?api=1&destination=3.1440,101.6979',
      'https://maps.gstatic.com/tactile/pane/default_geocode-2x.png',
    ]
    for (const url of googleUrls) {
      expect(isGoogleUrl(new URL(url)), url).toBe(true)
      expect(classifyRequest({ url, method: 'GET' }, SCOPE), url).toBe('bypass')
    }
    expect(classifyRequest({ url: 'https://places.googleapis.com/v1/places:searchText', method: 'POST' }, SCOPE)).toBe(
      'bypass',
    )
  })

  it('带密钥、带授权、分段下载的请求都不碰', () => {
    expect(classifyRequest({ url: `${SCOPE}assets/a.js?key=test`, method: 'GET' }, SCOPE)).toBe('bypass')
    expect(
      classifyRequest({ url: `${SCOPE}assets/a.js`, method: 'GET', headers: headers('X-Goog-Api-Key') }, SCOPE),
    ).toBe('bypass')
    expect(classifyRequest({ url: `${SCOPE}assets/a.js`, method: 'GET', headers: headers('Authorization') }, SCOPE)).toBe(
      'bypass',
    )
    expect(classifyRequest({ url: `${SCOPE}sounds/ding.mp3`, method: 'GET', headers: headers('Range') }, SCOPE)).toBe(
      'bypass',
    )
  })

  it('别的网站、同一网站但不在本页范围内的文件、sw.js 本身都不缓存', () => {
    expect(classifyRequest({ url: 'https://cdn.example.com/x.js', method: 'GET' }, SCOPE)).toBe('bypass')
    expect(classifyRequest({ url: 'https://evolee1217-lgtm.github.io/other-app/x.js', method: 'GET' }, SCOPE)).toBe(
      'bypass',
    )
    expect(classifyRequest({ url: `${SCOPE}sw.js`, method: 'GET' }, SCOPE)).toBe('bypass')
  })

  it('打开网页用缓存里的 index.html，静态文件先查缓存', () => {
    expect(classifyRequest({ url: SCOPE, method: 'GET', mode: 'navigate' }, SCOPE)).toBe('shell')
    expect(classifyRequest({ url: `${SCOPE}index.html`, method: 'GET', mode: 'navigate' }, SCOPE)).toBe('shell')
    expect(classifyRequest({ url: `${SCOPE}?from=share`, method: 'GET', mode: 'navigate' }, SCOPE)).toBe('shell')
    expect(classifyRequest({ url: `${SCOPE}assets/index-abc123.js`, method: 'GET' }, SCOPE)).toBe('static')
    expect(classifyRequest({ url: `${SCOPE}icons/icon-192.png`, method: 'GET', headers: headers() }, SCOPE)).toBe(
      'static',
    )
  })

  it('缓存名字带版本号', () => {
    expect(cacheNameFor('abc123')).toBe('meishi-jiandaobu-abc123')
  })
})
