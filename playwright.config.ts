import { defineConfig, devices } from '@playwright/test'
import { BASE_PATH, BASE_URL, KL_PETALING_STREET, KL_TIMEZONE, PORT } from './e2e/constants.ts'
import { RWD_SIZES } from './e2e/sizes.ts'

// 让 service worker 发出的请求也经过 Playwright 的拦截，
// 这样 e2e/fixtures.ts 的「不准连外部网站」规则对离线缓存也有效。
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'

/** 手机：触屏、像素密度 3，用安卓 Chrome 的身份。 */
function phone(width: number, height: number) {
  return {
    ...devices['Pixel 7'],
    viewport: { width, height },
    screen: { width, height },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  }
}

/** 响应式（RWD）测试和截图专用的文件：只在 RWD_SIZES 那些尺寸上跑。 */
const RWD_FILES = /(rwd|walkthrough)[^/]*\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    // 用本机装好的 Google Chrome，不另外下载浏览器。
    channel: 'chrome',
    // 马来西亚很多人的手机是英文的；网页不管手机是什么语言，都必须显示简体中文。
    locale: 'en-MY',
    timezoneId: KL_TIMEZONE,
    // 默认已经允许定位，位置在吉隆坡茨厂街（测试里也可以用 context.setGeolocation 换地方）。
    permissions: ['geolocation'],
    geolocation: KL_PETALING_STREET,
    colorScheme: 'light',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 冒烟测试、旧的截图：两种主要手机尺寸 + 电脑
    { name: 'phone-390x844', use: phone(390, 844), testIgnore: RWD_FILES },
    { name: 'phone-360x740', use: phone(360, 740), testIgnore: RWD_FILES },
    { name: 'desktop-1280x800', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, testIgnore: RWD_FILES },
    // 响应式：功能清单 / RWD 要求列出的每一种尺寸（e2e/sizes.ts）
    ...RWD_SIZES.map((size) => ({
      name: `rwd-${size.id}`,
      testMatch: RWD_FILES,
      use: size.touch
        ? {
            ...devices['Pixel 7'],
            viewport: { width: size.width, height: size.height },
            screen: { width: size.width, height: size.height },
            deviceScaleFactor: size.scale,
            isMobile: true,
            hasTouch: true,
          }
        : { viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.scale },
    })),
  ],

  // 先 npm run build，再用模拟 GitHub Pages 的服务器在子路径下打开 dist。
  webServer: {
    command: 'node scripts/serve-subpath.ts',
    url: BASE_URL,
    env: { PORT: String(PORT), BASE_PATH },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
