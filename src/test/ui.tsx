/**
 * 画面测试的小工具：用状态层测试架子（Harness）的假定位、假时钟、演示假店，把整个 App 画出来。
 * 中文排版的隐形字符（不换行空格、字连接符、断点）和「按短句换行」拆开的小段都不影响找字。
 */
import { render, screen, type RenderResult } from '@testing-library/react'
import App from '../App.tsx'
import type { MainStore } from '../app/store.ts'
import type { LocationEnvironment } from '../app/texts.ts'
import { Harness, type HarnessOptions } from './storeHarness.ts'
import { plain } from './helpers.ts'

export interface AppOptions extends HarnessOptions {
  readonly reducedMotion?: boolean
  readonly env?: LocationEnvironment
  /** 打开前先改架子（例如没有定位权限）。 */
  readonly before?: (h: Harness) => void
}

/** 把 matchMedia 换成假的：「减少动画」开或关，其他媒体查询都不成立。 */
export function fakeMatchMedia(reducedMotion: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

export function renderApp(options: AppOptions = {}): { h: Harness; store: MainStore; view: RenderResult } {
  fakeMatchMedia(options.reducedMotion ?? true)
  // 每个测试都像新开的分页：浏览器历史现在这一格不是上一个测试留下的「标记」。
  window.history.replaceState(null, '')
  const h = new Harness(options)
  options.before?.(h)
  const store = h.store()
  const view = render(<App store={store} env={options.env ?? 'OK'} translatorAvailable={false} />)
  return { h, store, view }
}

function same(text: string | null | undefined): string {
  return plain(text ?? '').replace(/\s+/g, ' ').trim()
}

/** 找「整句字」刚好是 expected 的最里面那个元素（按短句拆开的也找得到）。 */
export function byFullText(expected: string) {
  const want = same(expected)
  return (_content: string, element: Element | null): boolean => {
    if (!element || same(element.textContent) !== want) return false
    return ![...element.children].some((child) => same(child.textContent) === want)
  }
}

export function getText(expected: string): HTMLElement {
  return screen.getByText(byFullText(expected))
}

export function queryText(expected: string): HTMLElement | null {
  return screen.queryByText(byFullText(expected))
}

/** 按钮的名字（读屏念的）去掉隐形字符再比。 */
export function button(name: string): HTMLElement {
  const want = same(name)
  return screen.getByRole('button', { name: (accessible) => same(accessible) === want })
}

export function queryButton(name: string): HTMLElement | null {
  const want = same(name)
  return screen.queryByRole('button', { name: (accessible) => same(accessible) === want })
}
