/**
 * 安卓代码里「写死」、不在 strings.xml 里的界面文字和符号（前缀 emoji、分隔符、奖牌、错误页图案、价钱写法…）。
 * 网页版要照样用，否则排版和截图会对不上。每一项注明安卓出处，../校验/verify.mjs 会核对每个字面量确实在那个文件里。
 */

/** 分隔符和标点。 */
export const SEPARATORS = {
  /** 店卡两段之间「 · 」（前后各一个空格）。只画在同一行的两段中间，行尾不留「·」（安卓 SeparatedFlow）。 */
  dot: ' · ',
  /** 标题「附近最强 3 家・日本餐・面」里的点（domain/Cuisine.kt ChoiceLabel.SEPARATOR）。 */
  choice: '・',
  /** 店名列表「、」：已圈 N 家：A、B…，这次的候选：A、B…，裁判 🐷、🐶（ResultsScreen / TableOverlay）。 */
  list: '、',
  /** 跳过提示里多家店名之间「』『」：😴 已跳过休息中的『A』『B』（DuelOverlay SkippedNote）。 */
  skippedJoin: '』『',
  /** 划一刀抽签顺序「🐼 → 🐯 → 🐔」（TableOverlay veto_order）。 */
  orderArrow: ' → ',
  /** 暗中出拳结果下面那排「🐯✊  🐼✊」之间是两个空格（ui/Texts.kt DecisionText.record）。 */
  secretRecordGap: '  ',
  /** 「不限 · 什么菜都看看」（HomeScreen「不限」那一格）。 */
  anyHint: ' · ',
  /** 读屏用的逗号：「今日饭签，📜 抽今日饭签」「🔒 这一餐定了，赢了就听你的…」。 */
  a11yComma: '，',
} as const;

/** 前缀和小图标。 */
export const PREFIXES = {
  /** 星数「⭐ 4.6」（店卡、划一刀卡片、两家亮灯卡；分享文字里是「⭐4.6」没有空格）。 */
  rating: '⭐ ',
  ratingShare: '⭐',
  /** 距离「🚶 520 米」（店卡、划一刀卡片）。 */
  walk: '🚶 ',
  /** 地址「📍 No. 3, Jalan Contoh 7」。 */
  address: '📍 ',
  /** 「♻️ 刚刚搜过，直接用上次的结果（不耗免费次数）」。 */
  cached: '♻️ ',
  /** 「⚠️ 有一部分搜索没成功，结果可能少了一些」。 */
  partial: '⚠️ ',
  /** 分享文字只有 1 家时，用 👉 代替 ✊ 编号（ui/Texts.kt ShareText.vote）。 */
  singleShareMarker: '👉',
} as const;

/** 首页和对话框里写死的符号。 */
export const HOME_SYMBOLS = {
  /** 演示黑条左边（HomeScreen DemoBanner）。 */
  demoBannerIcon: '🧪',
  /** 随便挑卡片左边的骰子（首页出现时摇一下）和右边的「›」。 */
  diceIcon: '🎲',
  chevron: '›',
  /** 选中的菜系格子右上角的小勾（不只靠颜色区分）。 */
  selectedCheck: '✓',
  /** 随便挑两个卷轴中间的点。 */
  reelDot: '・',
  /** 设置里「进阶：Google 密钥」展开 / 收起。 */
  expanded: '▲',
  collapsed: '▼',
  /** 饭签签筒上的字。 */
  fortuneTube: '签',
} as const;

/** 结果页和游戏里写死的符号。 */
export const GAME_SYMBOLS = {
  /** 第 1–3 名的奖牌；第 4 名起用圆圈里的数字（ResultsScreen medalFor / RankBadge）。 */
  medals: ['🥇', '🥈', '🥉'],
  /** ❤️ 已圈 / 🤍 没圈（圈不了的店：🤍 变成 35% 透明度）。 */
  heartIn: '❤️',
  heartOut: '🤍',
  /** App 的手还没出 / 暗中出拳没翻开的牌。 */
  unknownHand: '❓',
  /** 赢家卡片右上角。 */
  winnerCup: '🏆',
  /** 转盘中间「转！」下面的提示：wheel_spin + 「 👆」。 */
  spinHintSuffix: ' 👆',
  /** 转盘格子名字太长：截到 N 个字（按码点）后加「…」。 */
  ellipsis: '…',
  /** 计票板的减号和加号（全角）。 */
  voteMinus: '－',
  votePlus: '＋',
  /**
   * 「就这一家吧！」店卡左上角的小徽章（ResultPage WinnerCard）：剪刀石头布 / 暗中出拳（没打平）用赢的手势，
   * 其余：转盘 🎡、划一刀 ✂️、投票 📊、暗中出拳打平转盘 🎡、帮我挑一家 🎲。
   */
  winnerBadge: { WHEEL: '🎡', VETO: '✂️', VOTE: '📊', SECRET_HANDS_TIE: '🎡', ROULETTE: '🎲' },
  /** 彩带的 8 种图案，按片号循环（ResultPage ConfettiBurst）。 */
  confetti: ['🎉', '✨', '🎊', '⭐', '🎈', '✨', '🎉', '🎊'],
} as const;

/** 错误页最上面的大图案（ui/StatusScreens.kt ErrorScreen）。 */
export const ERROR_EMOJI = {
  NoApiKey: '🔑',
  InvalidApiKey: '🔑',
  QuotaExhausted: '🙏',
  PermissionNeeded: '📍',
  LocationServicesOff: '🛰️',
  LocationUnavailable: '🧭',
  Network: '📶',
  Http: '😵',
  BadResponse: '🤔',
  NoResults: '🔍',
} as const;

/** 价钱写法（domain/PriceFormat.kt）。 */
export const PRICE = {
  /** 币种前缀：MYR 或没写 → RM；SGD → S$；USD → US$；其他 → 「代码 + 空格」（例如「THB 100–200」）。 */
  currencyPrefix: { MYR: 'RM', SGD: 'S$', USD: 'US$' },
  /** 范围之间用短横「–」（U+2013），不是减号：「RM10–20」。 */
  rangeDash: '–',
  /** 只有起价「RM50 以上」、只有最高价「RM15 以下」；起价 = 最高价只写一个「RM10」。 */
  openEndedFrom: ' 以上',
  openEndedTo: ' 以下',
  /** 没有价钱范围时用 Google 的 priceLevel。 */
  levels: { FREE: '免费', INEXPENSIVE: '$', MODERATE: '$$', EXPENSIVE: '$$$', VERY_EXPENSIVE: '$$$$' },
} as const;

/** 距离写法（domain/Geo.kt formatDistance / formatKm）。 */
export const DISTANCE = {
  /** 1 公里以下：四舍五入到 10 米、最少 10 米：「350 米」。 */
  meters: ' 米',
  /** 1 公里起：一位小数：「1.2 公⁠里」（996 米写「1.0 公里」）。 */
  km: ' 公⁠里',
  /** 公里两个字中间的连接符（不让「公」「里」分到两行）。 */
  kmWord: '公⁠里',
} as const;
