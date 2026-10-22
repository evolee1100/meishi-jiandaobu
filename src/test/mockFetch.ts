/**
 * 模拟的 Google 服务器（安卓测试用 MockWebServer）：每一次 fetch 都记下来，测试最后核对数目、网址、请求头、请求体。
 * 绝不连真正的网络、绝不用真正的密钥。
 */

export interface RecordedRequest {
  readonly url: string
  readonly method: string
  readonly headers: Record<string, string>
  readonly body: string | null
}

export type MockAnswer = { status?: number; body: string } | 'NETWORK_ERROR' | 'HANG'

export interface MockServer {
  readonly fetch: typeof fetch
  readonly requests: RecordedRequest[]
  /** 文字搜索请求的 textQuery（按发出顺序）。 */
  textQueries(): string[]
  photoRequests(): RecordedRequest[]
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  const h = init?.headers
  if (!h) return out
  if (typeof Headers !== 'undefined' && h instanceof Headers) h.forEach((v, k) => (out[k] = v))
  else if (Array.isArray(h)) for (const [k, v] of h) out[k] = v
  else Object.assign(out, h)
  return out
}

/** handler 决定每个请求怎么回答（默认 200 + {}）。 */
export function mockGoogle(handler: (request: RecordedRequest) => MockAnswer = () => ({ body: '{}' })): MockServer {
  const requests: RecordedRequest[] = []
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const request: RecordedRequest = {
      url,
      method: init?.method ?? 'GET',
      headers: headersOf(init),
      body: typeof init?.body === 'string' ? init.body : null,
    }
    requests.push(request)
    const answer = handler(request)
    if (answer === 'NETWORK_ERROR') throw new TypeError('Failed to fetch')
    if (answer === 'HANG') {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }
    const status = answer.status ?? 200
    const fake = {
      ok: status >= 200 && status < 300,
      status,
      text: async () => answer.body,
    }
    return fake as unknown as Response
  }
  return {
    fetch: fetchImpl as typeof fetch,
    requests,
    textQueries: () =>
      requests
        .filter((r) => r.url.endsWith('/v1/places:searchText'))
        .map((r) => (JSON.parse(r.body ?? '{}') as { textQuery: string }).textQuery),
    photoRequests: () => requests.filter((r) => r.url.includes('/media?')),
  }
}

export function placesBody(places: readonly unknown[]): string {
  return JSON.stringify({ places })
}

/** 测试用的假密钥（不是 AIza 开头，源码扫描不会当成真密钥）。 */
export const TEST_KEY = 'test-key-0123456789'
