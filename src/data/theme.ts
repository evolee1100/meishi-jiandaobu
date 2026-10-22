/**
 * 安卓第四版的颜色：浅色 / 深色两套（Material 3 配色）+ 饭/面/都可以按钮渐变 + 营业状态色 + 转盘、饭签、任务卡等固定颜色。
 * 每个色值都从安卓源码照抄，../校验/verify.mjs 会核对每个色值确实出现在对应的安卓文件里。
 * 安卓源：ui/theme/Theme.kt、ui/LuckyWheel.kt、ui/FortuneDialog.kt、ui/ResultPage.kt、ui/TableOverlay.kt、res/values(-night)/colors.xml
 */

/** 浅色主题（Theme.kt LightColors）。网页建议做成 CSS 变量，深色用 prefers-color-scheme 切换。 */
export const LIGHT = {
  primary: '#D9480F',
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFDBC8',
  onPrimaryContainer: '#3A1000',
  secondary: '#C92A2A',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#FFDAD6',
  onSecondaryContainer: '#410002',
  tertiary: '#9A6B00',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFE08A',
  onTertiaryContainer: '#2F2000',
  background: '#FFF8F3',
  onBackground: '#2A1A12',
  surface: '#FFF8F3',
  onSurface: '#2A1A12',
  surfaceVariant: '#F7DED2',
  onSurfaceVariant: '#53433B',
  surfaceTint: '#D9480F',
  outline: '#85736A',
  outlineVariant: '#D8C2B7',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FFF1EA',
  surfaceContainer: '#FBEAE1',
  surfaceContainerHigh: '#F5E4DB',
  surfaceContainerHighest: '#EFDED5',
  surfaceBright: '#FFF8F3',
  surfaceDim: '#E8D6CD',
  inverseSurface: '#3F2E26',
  inverseOnSurface: '#FFEDE5',
  inversePrimary: '#FFB590',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
} as const;

/** 深色主题（Theme.kt DarkColors）。 */
export const DARK = {
  primary: '#FFB590',
  onPrimary: '#5A1B00',
  primaryContainer: '#7F2B00',
  onPrimaryContainer: '#FFDBC8',
  secondary: '#FFB4AB',
  onSecondary: '#690005',
  secondaryContainer: '#93000A',
  onSecondaryContainer: '#FFDAD6',
  tertiary: '#F2C14E',
  onTertiary: '#3E2E00',
  tertiaryContainer: '#5A4300',
  onTertiaryContainer: '#FFE08A',
  background: '#1D120D',
  onBackground: '#F2DFD6',
  surface: '#1D120D',
  onSurface: '#F2DFD6',
  surfaceVariant: '#53433B',
  onSurfaceVariant: '#D8C2B7',
  surfaceTint: '#FFB590',
  outline: '#A08D83',
  outlineVariant: '#53433B',
  surfaceContainerLowest: '#170D09',
  surfaceContainerLow: '#261A14',
  surfaceContainer: '#2A1E18',
  surfaceContainerHigh: '#352822',
  surfaceContainerHighest: '#41322B',
  surfaceBright: '#463730',
  surfaceDim: '#1D120D',
  inverseSurface: '#F2DFD6',
  inverseOnSurface: '#3F2E26',
  inversePrimary: '#D9480F',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
} as const;

/** 页面底色（启动时不闪白；colors.xml window_background）。 */
export const WINDOW_BACKGROUND = { light: '#FFF8F3', dark: '#1D120D' } as const;

/** 好玩的按钮和状态色（Theme.kt FoodColors），浅色深色共用，除非写了 OnDark。 */
export const FOOD_COLORS = {
  /** 🍚 吃饭 按钮渐变（左上 → 右下）。 */
  riceGradient: ['#FF922B', '#E8590C'],
  /** 🍜 吃面 按钮渐变。 */
  noodleGradient: ['#FF6B6B', '#C92A2A'],
  /** 🍽️ 都可以 按钮渐变（班兰绿，白字看得清）。 */
  anyGradient: ['#37B24D', '#2B8A3E'],
  /** 「营业中」绿色；深色模式用浅一点的。 */
  openGreen: '#2B8A3E',
  openGreenOnDark: '#8CE99A',
  /** 「⏰ 还有 35 分钟关门」橙色；深色模式用浅一点的。 */
  closingOrange: '#D9480F',
  closingOrangeOnDark: '#FFA94D',
  closedGrey: '#6C6C6C',
  /** 没有照片时 emoji 后面的底色（上 → 下渐变），够深，🥟 不会像图片没载好。 */
  photoPlaceholderLight: ['#FFD08A', '#FFA94D'],
  photoPlaceholderDark: ['#6B3A1E', '#4A2A18'],
} as const;

/**
 * 剪刀石头布 / 底栏「选不了？剪刀石头布帮你决定！」大按钮的渐变：riceGradient 第一个色 → noodleGradient 最后一个色
 * （横向，ResultsScreen DecideButton）。
 */
export const DECIDE_BUTTON_GRADIENT = ['#FF922B', '#C92A2A'] as const;

/** 🎡 转盘每格的颜色，按格子顺序循环（LuckyWheel.LightSlices / DarkSlices）。字：浅色 #2A1A12，深色白色。 */
export const WHEEL_SLICES = {
  light: ['#FFC078', '#FFA8A8', '#8CE99A', '#74C0FC', '#E599F7', '#FFE066'],
  dark: ['#9C4A00', '#8F2D2D', '#2B6E3A', '#1F5C8C', '#6E3A82', '#7A6200'],
  textLight: '#2A1A12',
  textDark: '#FFFFFF',
} as const;

/** 📜 饭签：签纸、签筒、签的颜色（FortuneDialog.kt；深色模式也用同样的纸色）。 */
export const FORTUNE_COLORS = {
  slipBackground: '#FFF4D6',
  slipBorder: '#C92A2A',
  levelText: '#C92A2A',
  yiText: '#2A1A12',
  jiText: '#53433B',
  tube: '#C92A2A',
  tubeBorder: '#8A1C1C',
  tubeText: '#FFE066',
  sticks: '#D9A441',
  fallingStick: '#E8B04C',
} as const;

/** 🃏 任务卡背面的渐变（紫 → 玫红），翻过来后用 tertiaryContainer → primaryContainer（ResultPage.kt）。 */
export const TASK_CARD_BACK_GRADIENT = ['#5F3DC4', '#C2255C'] as const;

/** ✂️ 「不吃！」印章的红色（TableOverlay.kt）。最后一刀时整个画面加 6dp 的 error 色边框。 */
export const VETO_STAMP_RED = '#E03131';
