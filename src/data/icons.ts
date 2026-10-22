/**
 * 安卓第四版的图标，原样转成 SVG 字符串（路径数据一个字都没改），网页版直接放进 <img src="data:image/svg+xml,…">、
 * 内联 SVG 或做成 PWA / favicon 图标。
 *
 * 由 ../校验/export/genIcons.mjs 从 app/src/main/res/drawable/*.xml 和 mipmap-anydpi/ic_launcher.xml 自动生成，
 * ../校验/verify.mjs 会核对每一条路径。不要手改。
 * 界面小图标都是 Google 的 Material Symbols（Apache License 2.0），颜色用 currentColor，跟着文字颜色走。
 */

/**
 * App 图标：橙色底 + 一碗冒热气的面和筷子（安卓自适应图标 = ic_launcher_background + ic_launcher_foreground，
 * 108 × 108，内容都在中间直径 66 的安全圈里）。整张正方形可以直接当 PWA 的 maskable 图标；
 * 做普通圆角图标时照样能用（四周是橙色底，裁掉不会伤到碗）。
 */
export const APP_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><path d="M0,0h108v108h-108z" fill="#FF7A1A"/><path d="M54,54m-40,0a40,40 0,1 1,80 0a40,40 0,1 1,-80 0" fill="#FF9A4D"/><path d="M54,54m-30,0a30,30 0,1 1,60 0a30,30 0,1 1,-60 0" fill="#FFB070"/><path d="M44,40 C41,36 47,33 44,28" fill="none" stroke="#FFF4E6" stroke-width="2.6" stroke-linecap="round"/><path d="M53,38 C50,34 56,31 53,26" fill="none" stroke="#FFF4E6" stroke-width="2.6" stroke-linecap="round"/><path d="M56.5,51 L75.6,29.4 L78.2,31.5 L60,52.5 Z" fill="#6B2E0E"/><path d="M61.5,52 L80.4,34.4 L82.4,36.8 L64.6,53.4 Z" fill="#8A3F14"/><path d="M31,52 C33,43 43,40 54,40 C65,40 75,43 77,52 Z" fill="#FFE8A3"/><path d="M37,50 C40,45 44,45 47,49 C50,45 54,45 57,49 C60,45 64,45 67,49 C69,46 71,46 72,48" fill="none" stroke="#F2C14E" stroke-width="1.8" stroke-linecap="round"/><path d="M27,51 L81,51 C81,66.5 69,78 54,78 C39,78 27,66.5 27,51 Z" fill="#FFFFFF"/><path d="M28.2,57 L79.8,57 C79.2,59.5 78.4,61.6 77.3,63.5 L30.7,63.5 C29.6,61.6 28.8,59.5 28.2,57 Z" fill="#C92A2A"/><path d="M47,77 L61,77 L59.5,82 L48.5,82 Z" fill="#FFFFFF"/><path d="M27,50 L81,50 L81,52.5 L27,52.5 Z" fill="#E8590C"/></svg>';

/** 单色版（安卓 13 主题图标 ic_launcher_monochrome）：透明底、黑色碗和筷子，可做 Safari 固定标签页 / 单色图标。 */
export const APP_ICON_MONOCHROME_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><path d="M56.5,51 L75.6,29.4 L78.2,31.5 L60,52.5 Z" fill="#000000"/><path d="M61.5,52 L80.4,34.4 L82.4,36.8 L64.6,53.4 Z" fill="#000000"/><path d="M27,51 L81,51 C81,66.5 69,78 54,78 C39,78 27,66.5 27,51 Z" fill="#000000"/><path d="M47,77 L61,77 L59.5,82 L48.5,82 Z" fill="#000000"/><path d="M44,44 C41,40 47,37 44,32" fill="none" stroke="#000000" stroke-width="2.6" stroke-linecap="round"/><path d="M53,44 C50,40 56,37 53,32" fill="none" stroke="#000000" stroke-width="2.6" stroke-linecap="round"/></svg>';

/** 启动时窗口底色（安卓 colors.xml window_background，避免白闪）：浅色 / 深色。 */
export const SPLASH_BACKGROUND = { light: '#FFF8F3', dark: '#1D120D' } as const;

/** 界面上用到的 6 个小图标（24 × 24）。 */
export const UI_ICONS = {
  /** 标题栏左边的「返回」（安卓 autoMirrored：右到左语言会左右翻转，中文用不到）（res/drawable/ic_arrow_back.xml） */
  ARROW_BACK: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20,11H7.83l5.59,-5.59L12,4l-8,8 8,8 1.41,-1.41L7.83,13H20v-2z" fill="currentColor"/></svg>',
  /** 标题栏右边的 ⚙️ 设置（res/drawable/ic_settings.xml） */
  SETTINGS: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.14,12.94c0.04,-0.3 0.06,-0.61 0.06,-0.94c0,-0.32 -0.02,-0.64 -0.07,-0.94l2.03,-1.58c0.18,-0.14 0.23,-0.41 0.12,-0.61l-1.92,-3.32c-0.12,-0.22 -0.37,-0.29 -0.59,-0.22l-2.39,0.96c-0.5,-0.38 -1.03,-0.7 -1.62,-0.94L14.4,2.81c-0.04,-0.24 -0.24,-0.41 -0.48,-0.41h-3.84c-0.24,0 -0.43,0.17 -0.47,0.41L9.25,5.35C8.66,5.59 8.12,5.92 7.63,6.29L5.24,5.33c-0.22,-0.08 -0.47,0 -0.59,0.22L2.74,8.87C2.62,9.08 2.66,9.34 2.86,9.48l2.03,1.58C4.84,11.36 4.8,11.69 4.8,12s0.02,0.64 0.07,0.94l-2.03,1.58c-0.18,0.14 -0.23,0.41 -0.12,0.61l1.92,3.32c0.12,0.22 0.37,0.29 0.59,0.22l2.39,-0.96c0.5,0.38 1.03,0.7 1.62,0.94l0.36,2.54c0.05,0.24 0.24,0.41 0.48,0.41h3.84c0.24,0 0.44,-0.17 0.47,-0.41l0.36,-2.54c0.59,-0.24 1.13,-0.56 1.62,-0.94l2.39,0.96c0.22,0.08 0.47,0 0.59,-0.22l1.92,-3.32c0.12,-0.22 0.07,-0.47 -0.12,-0.61L19.14,12.94zM12,15.6c-1.98,0 -3.6,-1.62 -3.6,-3.6s1.62,-3.6 3.6,-3.6s3.6,1.62 3.6,3.6S13.98,15.6 12,15.6z" fill="currentColor"/></svg>',
  /** 「导航」「导航过去」按钮里的图标（res/drawable/ic_directions.xml） */
  DIRECTIONS: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.71,11.29l-9,-9c-0.39,-0.39 -1.02,-0.39 -1.41,0l-9,9c-0.39,0.39 -0.39,1.02 0,1.41l9,9c0.39,0.39 1.02,0.39 1.41,0l9,-9c0.39,-0.38 0.39,-1.01 0,-1.41zM14,14.5V12h-4v3H8v-4c0,-0.55 0.45,-1 1,-1h5V7.5l3.5,3.5 -3.5,3.5z" fill="currentColor"/></svg>',
  /** 设置「进阶」里复制包名 / SHA-1 的按钮（网页版：复制网站网址）（res/drawable/ic_content_copy.xml） */
  CONTENT_COPY: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16,1H4c-1.1,0 -2,0.9 -2,2v14h2V3h12V1zM19,5H8c-1.1,0 -2,0.9 -2,2v14c0,1.1 0.9,2 2,2h11c1.1,0 2,-0.9 2,-2V7c0,-1.1 -0.9,-2 -2,-2zM19,21H8V7h11v14z" fill="currentColor"/></svg>',
  /** 密钥输入框右边「显示密钥」（res/drawable/ic_visibility.xml） */
  VISIBILITY: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12,4.5C7,4.5 2.73,7.61 1,12c1.73,4.39 6,7.5 11,7.5s9.27,-3.11 11,-7.5c-1.73,-4.39 -6,-7.5 -11,-7.5zM12,17c-2.76,0 -5,-2.24 -5,-5s2.24,-5 5,-5 5,2.24 5,5 -2.24,5 -5,5zM12,9c-1.66,0 -3,1.34 -3,3s1.34,3 3,3 3,-1.34 3,-3 -1.34,-3 -3,-3z" fill="currentColor"/></svg>',
  /** 密钥输入框右边「隐藏密钥」（res/drawable/ic_visibility_off.xml） */
  VISIBILITY_OFF: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12,7c2.76,0 5,2.24 5,5 0,0.65 -0.13,1.26 -0.36,1.83l2.92,2.92c1.51,-1.26 2.7,-2.89 3.43,-4.75 -1.73,-4.39 -6,-7.5 -11,-7.5 -1.4,0 -2.74,0.25 -3.98,0.7l2.16,2.16C10.74,7.13 11.35,7 12,7zM2,4.27l2.28,2.28 0.46,0.46C3.08,8.3 1.78,10.02 1,12c1.73,4.39 6,7.5 11,7.5 1.55,0 3.03,-0.3 4.38,-0.84l0.42,0.42L19.73,22 21,20.73 3.27,3 2,4.27zM7.53,9.8l1.55,1.55c-0.05,0.21 -0.08,0.43 -0.08,0.65 0,1.66 1.34,3 3,3 0.22,0 0.44,-0.03 0.65,-0.08l1.55,1.55c-0.67,0.33 -1.41,0.53 -2.2,0.53 -2.76,0 -5,-2.24 -5,-5 0,-0.79 0.2,-1.53 0.53,-2.2zM11.84,9.02l3.15,3.15 0.02,-0.16c0,-1.66 -1.34,-3 -3,-3l-0.17,0.01z" fill="currentColor"/></svg>',
} as const;

export type UiIconName = keyof typeof UI_ICONS;
