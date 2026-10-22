/**
 * 生成网页图标：照安卓版的启动图标（暖橙色底 + 冒热气的面碗和筷子）重画成 SVG，
 * 再用本机的 Google Chrome 把 SVG 画成各种尺寸的 PNG。
 * 改了图案以后运行 npm run icons，把 public/icons/ 里的文件一起提交。
 *
 * 安卓版的图标是 108×108 的画布（自适应图标），手机桌面上大概只露出中间 72×72。
 * - icon.svg / icon-192.png / icon-512.png：一般用（圆角方块，只取中间 72×72）；
 * - icon-maskable-*.png：给安卓桌面裁成圆形 / 水滴形用（整张 108×108，图案都在安全区里）；
 * - apple-touch-icon.png：iPhone 加到主屏幕用（不能透明，iPhone 自己会切圆角）；
 * - favicon-32.png：浏览器分页上的小图标。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const OUT_DIR = path.resolve('public/icons')

// 照抄安卓版 ic_launcher_background.xml
const BACKGROUND = `
  <rect x="0" y="0" width="108" height="108" fill="#FF7A1A"/>
  <circle cx="54" cy="54" r="40" fill="#FF9A4D"/>
  <circle cx="54" cy="54" r="30" fill="#FFB070"/>`

// 照抄安卓版 ic_launcher_foreground.xml（画的顺序一样：热气、筷子、面、碗）
const FOREGROUND = `
  <g fill="none" stroke="#FFF4E6" stroke-width="2.6" stroke-linecap="round">
    <path d="M44,40 C41,36 47,33 44,28"/>
    <path d="M53,38 C50,34 56,31 53,26"/>
  </g>
  <path fill="#6B2E0E" d="M56.5,51 L75.6,29.4 L78.2,31.5 L60,52.5 Z"/>
  <path fill="#8A3F14" d="M61.5,52 L80.4,34.4 L82.4,36.8 L64.6,53.4 Z"/>
  <path fill="#FFE8A3" d="M31,52 C33,43 43,40 54,40 C65,40 75,43 77,52 Z"/>
  <path fill="none" stroke="#F2C14E" stroke-width="1.8" stroke-linecap="round"
    d="M37,50 C40,45 44,45 47,49 C50,45 54,45 57,49 C60,45 64,45 67,49 C69,46 71,46 72,48"/>
  <path fill="#FFFFFF" d="M27,51 L81,51 C81,66.5 69,78 54,78 C39,78 27,66.5 27,51 Z"/>
  <path fill="#C92A2A" d="M28.2,57 L79.8,57 C79.2,59.5 78.4,61.6 77.3,63.5 L30.7,63.5 C29.6,61.6 28.8,59.5 28.2,57 Z"/>
  <path fill="#FFFFFF" d="M47,77 L61,77 L59.5,82 L48.5,82 Z"/>
  <path fill="#E8590C" d="M27,50 L81,50 L81,52.5 L27,52.5 Z"/>`

type Variant = 'rounded' | 'maskable' | 'square'

function iconSvg(variant: Variant): string {
  const title = '<title>美食剪刀布</title>'
  if (variant === 'maskable') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${title}${BACKGROUND}${FOREGROUND}\n</svg>\n`
  }
  if (variant === 'square') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72">${title}${BACKGROUND}${FOREGROUND}\n</svg>\n`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 18 72 72">${title}
  <defs><clipPath id="r"><rect x="18" y="18" width="72" height="72" rx="16"/></clipPath></defs>
  <g clip-path="url(#r)">${BACKGROUND}
  </g>${FOREGROUND}\n</svg>\n`
}

const PNGS: { file: string; variant: Variant; size: number }[] = [
  { file: 'icon-192.png', variant: 'rounded', size: 192 },
  { file: 'icon-512.png', variant: 'rounded', size: 512 },
  { file: 'icon-maskable-192.png', variant: 'maskable', size: 192 },
  { file: 'icon-maskable-512.png', variant: 'maskable', size: 512 },
  { file: 'apple-touch-icon.png', variant: 'square', size: 180 },
  { file: 'favicon-32.png', variant: 'rounded', size: 32 },
]

await mkdir(OUT_DIR, { recursive: true })
await writeFile(path.join(OUT_DIR, 'icon.svg'), iconSvg('rounded'))
await writeFile(path.join(OUT_DIR, 'icon-maskable.svg'), iconSvg('maskable'))

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage()
  for (const { file, variant, size } of PNGS) {
    // 在网页里用 canvas 把 SVG 画成 PNG（比截图稳定，透明的地方保持透明）。
    const dataUrl = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image()
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (!context) throw new Error('canvas 不能用')
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, 0, 0, size, size)
        return canvas.toDataURL('image/png')
      },
      { svg: iconSvg(variant), size },
    )
    await writeFile(path.join(OUT_DIR, file), Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'))
    console.log(`✅ ${file}（${size}×${size}）`)
  }
} finally {
  await browser.close()
}
console.log('✅ icon.svg、icon-maskable.svg')
