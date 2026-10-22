/** 浏览器测试共用的常数（playwright.config.ts 和测试文件都会用）。 */

/** 模拟 GitHub Pages 的子路径（真的发布时是 /<仓库名>/）。 */
export const BASE_PATH = '/meishi-jiandaobu/'
/** 模拟 GitHub Pages 的本机服务器端口（vite preview 用 5180；4173 是这台电脑上别的项目的，不能用）。 */
export const PORT = 5181
export const BASE_URL = `http://127.0.0.1:${PORT}${BASE_PATH}`

/** 吉隆坡茨厂街（Petaling Street）。 */
export const KL_PETALING_STREET = { latitude: 3.144, longitude: 101.6979 }
export const KL_TIMEZONE = 'Asia/Kuala_Lumpur'
