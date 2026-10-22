import { describe, expect, it, vi } from 'vitest'
import { reloadOnStaleAssets, type ReloadTarget } from './reload-on-update.ts'

function fakeWindow(storage: Map<string, string> | 'blocked' = new Map()) {
  const listeners: ((event: Event) => void)[] = []
  const reload = vi.fn()
  const target: ReloadTarget = {
    addEventListener: (_type, listener) => listeners.push(listener),
    sessionStorage:
      storage === 'blocked'
        ? {
            getItem: () => {
              throw new Error('不让用')
            },
            setItem: () => {
              throw new Error('不让用')
            },
          }
        : {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => void storage.set(key, value),
          },
    location: { reload },
  }
  /** 模拟「旧版文件加载失败」，返回网页有没有把错误拦下来。 */
  const fail = () => {
    const event = new Event('vite:preloadError', { cancelable: true })
    for (const listener of listeners) listener(event)
    return event.defaultPrevented
  }
  return { target, reload, fail }
}

describe('发布新版后自动换成新版', () => {
  it('旧版文件加载失败：重新打开一次网页', () => {
    const { target, reload, fail } = fakeWindow()
    reloadOnStaleAssets(target, () => 1_000_000)
    expect(fail()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('一分钟内又失败：不再刷新，免得一直刷个不停', () => {
    const storage = new Map<string, string>()
    let now = 1_000_000
    const first = fakeWindow(storage)
    reloadOnStaleAssets(first.target, () => now)
    first.fail()

    // 刷新以后是新的页面，但 sessionStorage 还在。
    now += 5_000
    const second = fakeWindow(storage)
    reloadOnStaleAssets(second.target, () => now)
    expect(second.fail()).toBe(false)
    expect(second.reload).not.toHaveBeenCalled()

    // 过了一分钟（例如又发布了新版），可以再刷新一次。
    now += 60_000
    expect(second.fail()).toBe(true)
    expect(second.reload).toHaveBeenCalledTimes(1)
  })

  it('浏览器不让用 sessionStorage：不刷新，错误照常抛出', () => {
    const { target, reload, fail } = fakeWindow('blocked')
    reloadOnStaleAssets(target, () => 1_000_000)
    expect(fail()).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
