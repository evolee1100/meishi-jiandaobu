import { describe, expect, it } from 'vitest'
import { PlacesError } from '../services/placesErrors.ts'
import { findTraditional } from '../test/helpers.ts'
import { httpProblem, isLocationProblem, mightBeFixedByNewKey, problemOf, toSearchError, type SearchError } from './searchError.ts'
import { errorScreen, text, webText } from './texts.ts'

function http(code: number, reason: string | null = null, status: string | null = null, message: string | null = null): Extract<SearchError, { kind: 'HTTP' }> {
  return { kind: 'HTTP', code, status, reason, googleMessage: message }
}

describe('十三、错误归类、换密钥后重试', () => {
  it('ERROR-09 Google 错误先看 reason：密钥无效、安卓限制、服务限制、服务没开、结算（含原文 billing）；再看 429 太多、503 服务器、其他 400', () => {
    expect(problemOf(http(400, 'API_KEY_INVALID'))).toBe('KEY_INVALID')
    expect(problemOf(http(403, 'API_KEY_ANDROID_APP_BLOCKED'))).toBe('ANDROID_APP_BLOCKED')
    expect(problemOf(http(403, 'API_KEY_SERVICE_BLOCKED'))).toBe('SERVICE_BLOCKED')
    expect(problemOf(http(403, 'SERVICE_DISABLED'))).toBe('SERVICE_DISABLED')
    expect(problemOf(http(403, 'BILLING_DISABLED'))).toBe('BILLING')
    expect(problemOf(http(403, null, null, 'This API project requires billing to be enabled.'))).toBe('BILLING')
    expect(problemOf(http(429, null, 'RESOURCE_EXHAUSTED'))).toBe('RATE_LIMITED')
    expect(problemOf(http(503))).toBe('SERVER')
    expect(problemOf(http(400, null, 'INVALID_ARGUMENT'))).toBe('OTHER')
  })

  it('ERROR-10 换了新密钥才值得重试的：没有密钥、格式不对、密钥无效、限制对不上、结算；429、500、网络、定位不重试', () => {
    expect(mightBeFixedByNewKey({ kind: 'NO_API_KEY' })).toBe(true)
    expect(mightBeFixedByNewKey({ kind: 'INVALID_API_KEY' })).toBe(true)
    expect(mightBeFixedByNewKey(http(400, 'API_KEY_INVALID'))).toBe(true)
    expect(mightBeFixedByNewKey(http(403, 'API_KEY_ANDROID_APP_BLOCKED'))).toBe(true)
    expect(mightBeFixedByNewKey(http(403, 'BILLING_DISABLED'))).toBe(true)
    expect(mightBeFixedByNewKey(http(429, null, 'RESOURCE_EXHAUSTED'))).toBe(false)
    expect(mightBeFixedByNewKey(http(500))).toBe(false)
    expect(mightBeFixedByNewKey({ kind: 'NETWORK' })).toBe(false)
    expect(mightBeFixedByNewKey({ kind: 'LOCATION_UNAVAILABLE' })).toBe(false)
    expect(mightBeFixedByNewKey({ kind: 'STORAGE_BLOCKED' })).toBe(false)
    expect(isLocationProblem({ kind: 'PERMISSION_NEEDED', permanently: false })).toBe(true)
    expect(isLocationProblem({ kind: 'NETWORK' })).toBe(false)
  })

  it('WEB-18 reason = API_KEY_HTTP_REFERRER_BLOCKED → 网址不在名单里的提示 + 打开设置 + 重试；安卓限制用网页版的说法；两种都值得换密钥重试', () => {
    const referrer = http(403, 'API_KEY_HTTP_REFERRER_BLOCKED', 'PERMISSION_DENIED', 'Requests from referer https://x.github.io/ are blocked.')
    expect(httpProblem(403, 'PERMISSION_DENIED', 'API_KEY_HTTP_REFERRER_BLOCKED', null)).toBe('REFERRER_BLOCKED')
    expect(mightBeFixedByNewKey(referrer)).toBe(true)
    const screen = errorScreen({ cuisine: 'ANY', meal: 'RICE' }, referrer, false)
    expect(screen.message).toBe(webText('hint_referrer_blocked'))
    expect(screen.primary?.action).toBe('OPEN_SETTINGS')
    expect(screen.secondary?.action).toBe('RETRY')
    expect(screen.detail).toContain('Requests from referer')

    const android = errorScreen(null, http(403, 'API_KEY_ANDROID_APP_BLOCKED'), false)
    expect(android.message).toBe(text('hint_android_blocked'))
    expect(android.message).toContain('网页用不了')
    expect(android.primary?.action).toBe('OPEN_SETTINGS')
    expect(android.secondary?.action).toBe('RETRY')
    expect(findTraditional(screen.message + android.message)).toEqual([])

    // 结算出问题不给重试（试用结束后这是正常、免费的结局）。
    expect(errorScreen(null, http(403, 'BILLING_DISABLED'), false).primary).toBeNull()
    // 请求层的错 → 画面的错。
    expect(toSearchError(PlacesError.http(403, 'PERMISSION_DENIED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'blocked'))).toEqual({
      kind: 'HTTP',
      code: 403,
      status: 'PERMISSION_DENIED',
      reason: 'API_KEY_HTTP_REFERRER_BLOCKED',
      googleMessage: 'blocked',
    })
    expect(toSearchError(PlacesError.storageBlocked())).toEqual({ kind: 'STORAGE_BLOCKED' })
    expect(toSearchError(new Error('???'))).toEqual({ kind: 'BAD_RESPONSE' })
  })
})
