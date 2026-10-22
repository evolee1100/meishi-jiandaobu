/**
 * 动画小工具。CSS 的动画在 global.css 里已经处理了「减少动画」；
 * 用 Web Animations（element.animate）做的动画不受 CSS 影响，请统一用这里的 playAnimation()。
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** 用户是不是在手机 / 电脑设置里开了「减少动画」。 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false
}

/**
 * 播放一段 Web Animations 动画。开了「减少动画」就不播，直接跳到最后一帧，
 * 所以 onfinish / finished 照样会触发，游戏流程不会卡住（等它播完请用下面的 onAnimationDone）。
 * 注意：动画结束后的样子要写在元素本身的样式里（或者用 fill: 'forwards'）。
 */
export function playAnimation(
  element: Element,
  keyframes: Keyframe[] | PropertyIndexedKeyframes,
  options: KeyframeAnimationOptions,
): Animation | null {
  if (typeof element.animate !== 'function') return null
  if (!prefersReducedMotion()) return element.animate(keyframes, options)

  const animation = element.animate(keyframes, { ...options, duration: 0, delay: 0, endDelay: 0, iterations: 1 })
  animation.finish()
  return animation
}

/**
 * 动画播完（「减少动画」时马上播完也算）才做 action。用 animation.finished 这个 Promise：
 * 就算动画在挂上去之前就已经播完，也一定会叫到（onfinish 事件太快时可能漏掉）。动画被取消就不叫。
 * 回传一个函数：画面不要了（换了一局、离开）时调用，之后就不叫了。
 */
export function onAnimationDone(animation: Animation, action: () => void): () => void {
  let active = true
  animation.finished.then(
    () => {
      if (active) action()
    },
    () => {
      // 被取消（cancel）：什么都不做
    },
  )
  return () => {
    active = false
  }
}
