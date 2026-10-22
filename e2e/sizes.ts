/**
 * 响应式（RWD）要测的屏幕尺寸（用户的 RWD 要求）：手机竖屏为主，加上最窄、横屏、平板、电脑，
 * 再加一个「浏览器放大 200%」（390×844 的手机放大两倍 = 195×422 的版面）。
 */
export interface RwdSize {
  /** 项目名（英文、数字，放进 Playwright 的项目名和截图文件夹）。 */
  readonly id: string
  /** 中文说明（截图文件夹名）。 */
  readonly label: string
  readonly width: number
  readonly height: number
  /** 像素密度。 */
  readonly scale: number
  /** 手机、平板（触屏）。 */
  readonly touch: boolean
  /** 这一块的画面要不要拍一整套截图。 */
  readonly shots: boolean
}

export const RWD_SIZES: readonly RwdSize[] = [
  { id: '320x568', label: '320x568-最窄手机', width: 320, height: 568, scale: 2, touch: true, shots: true },
  { id: '360x780', label: '360x780-GalaxyS', width: 360, height: 780, scale: 3, touch: true, shots: false },
  { id: '375x667', label: '375x667-iPhoneSE', width: 375, height: 667, scale: 2, touch: true, shots: false },
  { id: '390x844', label: '390x844-手机', width: 390, height: 844, scale: 3, touch: true, shots: true },
  { id: '412x915', label: '412x915-Pixel7', width: 412, height: 915, scale: 2.625, touch: true, shots: false },
  { id: '430x932', label: '430x932-iPhone15ProMax', width: 430, height: 932, scale: 3, touch: true, shots: true },
  { id: '844x390', label: '844x390-手机横屏', width: 844, height: 390, scale: 3, touch: true, shots: true },
  { id: '768x1024', label: '768x1024-iPadMini', width: 768, height: 1024, scale: 2, touch: true, shots: true },
  { id: '1280x800', label: '1280x800-电脑', width: 1280, height: 800, scale: 1, touch: false, shots: true },
  { id: 'zoom200', label: '390x844-浏览器放大200%', width: 195, height: 422, scale: 6, touch: true, shots: false },
]

export function sizeOf(projectName: string): RwdSize | undefined {
  return RWD_SIZES.find((size) => `rwd-${size.id}` === projectName)
}
