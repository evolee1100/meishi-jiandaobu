import { afterEach, describe, expect, it, vi } from 'vitest'
import { playAnimation, prefersReducedMotion } from './motion.ts'

function fakeMatchMedia(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduce && query.includes('prefers-reduced-motion: reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

function fakeAnimatedElement() {
  const finish = vi.fn()
  const animate = vi.fn(() => ({ finish }) as unknown as Animation)
  const element = document.createElement('div')
  Object.defineProperty(element, 'animate', { value: animate })
  return { element, animate, finish }
}

describe('减少动画', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('平常照原样播放', () => {
    fakeMatchMedia(false)
    const { element, animate, finish } = fakeAnimatedElement()
    playAnimation(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
    expect(prefersReducedMotion()).toBe(false)
    expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], { duration: 300 })
    expect(finish).not.toHaveBeenCalled()
  })

  it('开了减少动画就直接跳到最后', () => {
    fakeMatchMedia(true)
    const { element, animate, finish } = fakeAnimatedElement()
    playAnimation(element, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
      duration: 800,
      delay: 200,
      iterations: 3,
    })
    expect(prefersReducedMotion()).toBe(true)
    expect(animate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 0, delay: 0, iterations: 1 }))
    expect(finish).toHaveBeenCalled()
  })

  it('浏览器不支持 element.animate 时什么都不做', () => {
    fakeMatchMedia(false)
    const element = document.createElement('div')
    Object.defineProperty(element, 'animate', { value: undefined })
    expect(playAnimation(element, [], { duration: 100 })).toBeNull()
  })
})
