// 单元测试的公共设置：加上 toBeInTheDocument() 之类的检查，每个测试结束后清掉画面。
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom 没有的浏览器功能：画面会调用，测试里当作什么都不做。
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
if (typeof window !== 'undefined') {
  window.scrollTo = (() => {}) as typeof window.scrollTo
}

afterEach(() => {
  cleanup()
})
