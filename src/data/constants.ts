/**
 * 安卓第四版里所有「规则数字」：额度、缓存、营业时间、走路、排名、随便挑、愿赌服输、饭桌模式、动画时间……
 * 每一个都注明安卓出处（文件 + 名字），../校验/verify.mjs 会回到安卓源码逐个核对数值。
 * 时间一律用毫秒（_MS）或分钟（_MINUTES），距离用米，半径用公里。
 */

// ============================================================ 免费额度（永远免费的底线）

export const QUOTA = {
  /** Google 每月免费：Text Search Enterprise 1,000 次（data/UsageGuard.kt FreeQuota.GOOGLE_FREE_TEXT_SEARCH）。 */
  GOOGLE_FREE_TEXT_SEARCH: 1000,
  /** Google 每月免费：Place Details Photos 1,000 次（FreeQuota.GOOGLE_FREE_PHOTOS）。 */
  GOOGLE_FREE_PHOTOS: 1000,
  /** App 自己的硬上限：每月最多 900 个文字搜索请求（FreeQuota.TEXT_SEARCH_MONTHLY_LIMIT）。 */
  TEXT_SEARCH_MONTHLY_LIMIT: 900,
  /** App 自己的硬上限：每月最多 900 个照片请求（FreeQuota.PHOTO_MONTHLY_LIMIT）。 */
  PHOTO_MONTHLY_LIMIT: 900,
  /** 每次搜索按 3 个请求算（SearchConfig.QUERIES_PER_SEARCH = 表里最长的一格）。 */
  QUERIES_PER_SEARCH: 3,
  /** 每月可以搜索几次 = 900 ÷ 3（FreeQuota.SEARCHES_PER_MONTH）。 */
  SEARCHES_PER_MONTH: 300,
  /** 按这个时区算「哪个月」（Google 按太平洋时间计费；FreeQuota.BILLING_ZONE）。月份 key 写成 "2026-10"。 */
  BILLING_ZONE: 'America/Los_Angeles',
} as const;

// ============================================================ Google Places API (New)

export const PLACES_API = {
  /** data/PlacesApi.kt DEFAULT_BASE_URL。 */
  BASE_URL: 'https://places.googleapis.com/',
  /** 文字搜索：POST v1/places:searchText。 */
  SEARCH_TEXT_PATH: 'v1/places:searchText',
  /** 照片：GET v1/{photoName}/media?maxWidthPx=800&skipHttpRedirect=true（回 JSON 的 photoUri，再用 <img> 显示，图片本身不计费）。 */
  PHOTO_MAX_WIDTH_PX: 800,
  /** 请求体 languageCode（SearchConfig.LANGUAGE_CODE）。 */
  LANGUAGE_CODE: 'zh-CN',
  /** 请求体 regionCode（SearchConfig.REGION_CODE）。 */
  REGION_CODE: 'MY',
  /** 请求体 pageSize：只要一页（最多 20 家），永远不翻页（SearchConfig.PAGE_SIZE）。 */
  PAGE_SIZE: 20,
  /**
   * 请求头 X-Goog-FieldMask，一个字都不能改（多要字段 = 更贵的 SKU）。测试会逐字核对。
   * 安卓另外带 X-Android-Package / X-Android-Cert（网页版没有，见 功能清单.md「安卓专属」）。
   */
  FIELD_MASK:
    'places.id,places.displayName,places.shortFormattedAddress,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.priceRange,places.currentOpeningHours,places.businessStatus,places.photos,places.googleMapsUri,places.primaryType,places.primaryTypeDisplayName,places.types',
  /** 绝对不能发的请求体字段（PlacesApiTest 检查）。 */
  FORBIDDEN_BODY_FIELDS: ['includedType', 'strictTypeFiltering', 'rankPreference', 'pageToken', 'maxResultCount', 'locationBias'],
  /** 绝对不能出现在 FIELD_MASK 里的 Atmosphere 字段前缀（会变成更贵的 SKU）。 */
  FORBIDDEN_FIELD_PREFIXES: ['reviews', 'takeout', 'dineIn', 'delivery', 'servesLunch', 'servesDinner', 'editorialSummary', 'generativeSummary', 'reviewSummary'],
  /** 安卓 OkHttp 的超时：连接 10 秒、读取 15 秒、整次 25 秒（MeiShiApplication.kt）。 */
  CONNECT_TIMEOUT_MS: 10_000,
  READ_TIMEOUT_MS: 15_000,
  CALL_TIMEOUT_MS: 25_000,
} as const;

// ============================================================ 定位

export const LOCATION = {
  /** 2 分钟内拿过的位置直接用，不再定位（MainViewModel.LOCATION_MAX_AGE_MS）。 */
  REUSE_MAX_AGE_MS: 2 * 60 * 1000,
  /** 拿不到新位置时，10 分钟内的旧位置还可以用；更旧的不用（免得在别处找店；LocationFix.FALLBACK_MAX_AGE_MS）。 */
  FALLBACK_MAX_AGE_MS: 10 * 60 * 1000,
  /** 一次定位最多等 10 秒（LocationProvider.TIMEOUT_MS）。 */
  TIMEOUT_MS: 10_000,
  /** 接受 30 秒内的缓存位置（LocationProvider.MAX_CACHED_AGE_MS → 网页 maximumAge）。 */
  MAX_CACHED_AGE_MS: 30_000,
} as const;

// ============================================================ 搜索范围

export const RADIUS = {
  /** data/Prefs.kt RadiusOptions。 */
  MIN_KM: 0.5,
  MAX_KM: 5.0,
  STEP_KM: 0.5,
  DEFAULT_KM: 1.5,
  /** 四个大按钮：🚶 走路就到 0.5 / 🚶 附近 1.5 / 🛵 远一点 3 / 🚗 开车去 5。 */
  QUICK_KM: [0.5, 1.5, 3.0, 5.0],
  /** 「扩大范围」= 现在的两倍，最多 5 公里，按 0.5 取整；已经 5 公里就没有（RadiusOptions.larger）。 */
} as const;

// ============================================================ 结果缓存、恢复、自动回首页

export const CACHE = {
  /** 同一「菜系+饭/面+范围」10 分钟内、移动不到 200 米：直接用上次结果，不发请求（MainViewModel.CACHE_TTL_MS）。 */
  TTL_MS: 10 * 60 * 1000,
  MAX_MOVE_METERS: 200,
  /** 最多缓存 6 组结果（CACHE_MAX_ENTRIES）。 */
  MAX_ENTRIES: 6,
  /** 「App 被系统关掉」时保存的缓存只留最近 3 组（SAVED_CACHE_MAX）。 */
  SAVED_MAX: 3,
  /** 保存时每组结果只留排名前 30 家（加上候选篮、清空撤销、计票板点名的店；SAVED_RANKED_MAX）。 */
  SAVED_RANKED_MAX: 30,
  /** 结果超过 3 个钟头、而且换了时段 → 回到首页（STALE_RESULTS_MS）。 */
  STALE_RESULTS_MS: 3 * 60 * 60 * 1000,
  /** 超过 12 个钟头（比最长的时段宵夜还长）一定回首页（SAME_MEAL_MAX_MS）。 */
  SAME_MEAL_MAX_MS: 12 * 60 * 60 * 1000,
} as const;

// ============================================================ 排名、过滤

export const RANKING = {
  /** 贝叶斯加权的 m（domain/Ranking.kt PRIOR_WEIGHT）。 */
  PRIOR_WEIGHT: 100,
  /** 没有候选时的 C（FALLBACK_MEAN_RATING）。 */
  FALLBACK_MEAN_RATING: 4.0,
  /** C 最高只算 4.2（MAX_PRIOR_MEAN）：4.5★/800 条永远排在 4.9★/40 条前面。 */
  MAX_PRIOR_MEAN: 4.2,
  /** 评价数门槛，依次放宽直到至少 3 家（REVIEW_TIERS / MIN_CANDIDATES）。 */
  REVIEW_TIERS: [30, 10, 1],
  MIN_CANDIDATES: 3,
  /** 菜系软过滤：至少 3 家「能排名的」店被 Google 标成这个菜系才过滤（CuisineTypeFilter.MIN_MATCHES）。 */
  CUISINE_FILTER_MIN_MATCHES: 3,
} as const;

// ============================================================ 距离、走路、开车

export const GEO = {
  /** haversine 用的地球平均半径（domain/Geo.kt EARTH_RADIUS_METERS）。 */
  EARTH_RADIUS_METERS: 6_371_008.8,
  /** 1 纬度约多少米（矩形搜索范围用）。 */
  METERS_PER_DEGREE_LAT: 111_320,
  /** 1 公里以内的导航直接用走路路线（MapsLinks.WALKING_MAX_METERS）。 */
  WALKING_NAV_MAX_METERS: 1000,
} as const;

export const WALKING = {
  /** 街道要绕路：直线距离 × 1.3（domain/MapsLinks.kt Walking.DETOUR_FACTOR）。 */
  DETOUR_FACTOR: 1.3,
  /** 每分钟走 80 米（4.8 公里/小时）。 */
  METERS_PER_MINUTE: 80,
  /** 超过 2 公里只写距离、不写走路分钟。 */
  MAX_METERS: 2000,
  /** 超过 2 公里按开车/骑摩托估算：城里每分钟约 333 米（约 20 公里/小时），再加 5 分钟找停车位（Travel）。 */
  RIDE_METERS_PER_MINUTE: 333,
  PARKING_MINUTES: 5,
} as const;

// ============================================================ 营业时间

export const HOURS = {
  /** 一个钟头内关门：橙色「⏰ 还有 N 分钟关门」（OpenStatus.CLOSING_SOON_MINUTES）。 */
  CLOSING_SOON_MINUTES: 60,
  /** 30 分钟内关门：再加「可能停止点餐了」（LAST_ORDERS_MINUTES）。 */
  LAST_ORDERS_MINUTES: 30,
  /** 到了还要 20 分钟点餐：剩余分钟 < 路上分钟 + 20 → 来不及（ORDER_MARGIN_MINUTES）。 */
  ORDER_MARGIN_MINUTES: 20,
  /** 结果页放着时，每 30 秒按手机时间重算营业状态（ResultsScreen.CLOCK_TICK_MS；同一分钟内不重算）。 */
  CLOCK_TICK_MS: 30_000,
} as const;

// ============================================================ 结果页

export const RESULTS = {
  /** 一页 3 家（ResultsPager.PAGE_SIZE）。 */
  PAGE_SIZE: 3,
  /** 半夜排序：21:00–06:00（不含 6 点）（ResultsPager.NIGHT_FROM_HOUR / NIGHT_UNTIL_HOUR）。 */
  NIGHT_FROM_HOUR: 21,
  NIGHT_UNTIL_HOUR: 6,
  /** 底栏上方小提示停留 3 秒（ResultsScreen.NOTICE_MS）。 */
  NOTICE_MS: 3000,
  /** 「已清空 N 家　撤销」停留 8 秒（BASKET_UNDO_MS）。 */
  BASKET_UNDO_MS: 8000,
  /** 候选篮最多 6 家（UiState.Results.BASKET_MAX）。 */
  BASKET_MAX: 6,
  /** 圈了 2 家以上就用圈的店玩，不用这一页（DuelPlanner.MIN_BASKET）。 */
  MIN_BASKET: 2,
  /** 至少 2 家能去才有游戏（DuelPlanner.MIN_PLACES）。 */
  MIN_PLACES: 2,
  /** 圈了 3 家以上才出现「👥 饭桌模式」，饭桌也改用圈的店（MIN_TABLE_BASKET）。 */
  MIN_TABLE_BASKET: 3,
  /** 圈了 4 家以上用转盘（MIN_WHEEL）。 */
  MIN_WHEEL: 4,
  /** 小屏判断：宽 < 400 而且系统字体 > 1.15 倍 → 小图 72（否则 88），「📤 投票」短字等（ResultsScreen）。 */
  NARROW_WIDTH_DP: 400,
  LARGE_FONT_SCALE: 1.15,
  THUMB_SIZE_DP: 88,
  THUMB_SIZE_SMALL_DP: 72,
  /** 横屏侧栏：可用高 < 480 而且宽 ≥ 640 → 按钮放右边 280 宽一栏（SIDE_BAR_*）。 */
  SIDE_BAR_MAX_HEIGHT_DP: 480,
  SIDE_BAR_MIN_WIDTH_DP: 640,
  SIDE_BAR_WIDTH_DP: 280,
  /** 内容最宽 560（平板/横屏；HomeScreen.MAX_CONTENT_WIDTH）。 */
  MAX_CONTENT_WIDTH_DP: 560,
} as const;

// ============================================================ 首页

export const HOME = {
  /** 「演示模式已经关掉了　撤销」停留 8 秒（HomeScreen.DEMO_UNDO_MS）。 */
  DEMO_UNDO_MS: 8000,
  /** 可用高度 < 600 = 紧凑排版（按钮矮一点）；< 420 = 横屏排版（HomeScreen）。 */
  COMPACT_HEIGHT_DP: 600,
  LANDSCAPE_HEIGHT_DP: 420,
} as const;

// ============================================================ 随便挑

export const RANDOM_PICK = {
  /** 上一餐（5 个钟头内导航过的）菜系的机会 × 1/3（RandomPicker.RECENTLY_EATEN_FACTOR）。 */
  RECENTLY_EATEN_FACTOR: 1 / 3,
  /** 今天抽过饭签：签上的菜系机会 × 2（FORTUNE_FACTOR）。 */
  FORTUNE_FACTOR: 2.0,
  /** …摇到这个菜系时，签上的饭/面/都可以权重 2，其他 1（FORTUNE_MEAL_WEIGHT）。 */
  FORTUNE_MEAL_WEIGHT: 2.0,
  /** 「刚才摇到」最多记 3 个（RandomPickState.HISTORY_MAX）。 */
  HISTORY_MAX: 3,
  /** 左边（菜系）卷轴转 1.1 秒（DEFAULT_SPIN_MILLIS）；右边（饭/面）多转 0.4 秒（RandomPickDialog.MEAL_REEL_EXTRA_MS）。 */
  DEFAULT_SPIN_MS: 1100,
  MEAL_REEL_EXTRA_MS: 400,
  /** 卷轴至少转几整圈再停：菜系 3 圈、饭/面 6 圈（RandomPickDialog SpinPlan loops）。 */
  CUISINE_REEL_LOOPS: 3,
  MEAL_REEL_LOOPS: 6,
} as const;

// ============================================================ 吃过的记录

export const VISITS = {
  /** 最多 50 餐、60 天（domain/Visits.kt VisitLog）。 */
  MAX_ENTRIES: 50,
  MAX_AGE_DAYS: 60,
  /** 「上一餐」= 5 个钟头内的导航（RECENT_MS）。 */
  RECENT_MS: 5 * 60 * 60 * 1000,
  /** 连续 3 餐同一菜系 → 连吃提醒（STREAK）。 */
  STREAK: 3,
  /** 2 个钟头内按好几次导航算同一餐，只留最后一次（SAME_MEAL_MS）。 */
  SAME_MEAL_MS: 2 * 60 * 60 * 1000,
  /** 手机时钟被调回去：12 个钟头内「未来」的记录先留着（FUTURE_TOLERANCE_MS），更远的丢掉。 */
  FUTURE_TOLERANCE_MS: 12 * 60 * 60 * 1000,
  /** 结果页的时钟最多落后 10 分钟，之后的记录先不显示「去过」（CLOCK_LAG_MS）。 */
  CLOCK_LAG_MS: 10 * 60 * 1000,
  /** 1 个钟头内：「👣 刚刚导航过」（ui/Texts.kt VisitText.JUST_NOW_MS）。 */
  JUST_NOW_MS: 60 * 60 * 1000,
  /** 跨过半夜、但不到 12 个钟头：「👣 昨晚去过」「👣 昨天下午去过」（LAST_NIGHT_MS）。 */
  LAST_NIGHT_MS: 12 * 60 * 60 * 1000,
} as const;

// ============================================================ 愿赌服输（一餐只能反悔一次）

export const MEAL = {
  /** 一餐只能反悔 1 次（MainViewModel.REGRETS_PER_MEAL）。 */
  REGRETS_PER_MEAL: 1,
  /** 一餐 = 第一次定下来之后的 3 个钟头（MEAL_MS）。 */
  MEAL_MS: 3 * 60 * 60 * 1000,
} as const;

// ============================================================ 剪刀石头布 / 帮我挑一家 / 揭晓

export const DUEL = {
  /** App 的手转 1.5–2 秒（含两端，随机整数毫秒；domain/RockPaperScissors.kt Duel.RPS_SPIN_MILLIS）。 */
  RPS_SPIN_MS: [1500, 2000],
  /** 帮我挑一家两张卡轮流亮灯 1.5–1.9 秒（ROULETTE_SPIN_MILLIS）。 */
  ROULETTE_SPIN_MS: [1500, 1900],
  /** 手停下后停 1.5 秒看判定，再进「就这一家吧！」（DuelOverlay.RPS_REVEAL_MS）。 */
  RPS_REVEAL_MS: 1500,
  /** 帮我挑一家：开始前等 0.3 秒；停下后停 1 秒（ROULETTE_START_DELAY_MS / ROULETTE_REVEAL_MS）。转盘停下后也停 1 秒。 */
  ROULETTE_START_DELAY_MS: 300,
  ROULETTE_REVEAL_MS: 1000,
  /** 卷轴至少转几圈：App 的手 5 圈、亮灯 6 圈（DuelOverlay SpinPlan loops）。 */
  RPS_REEL_LOOPS: 5,
  ROULETTE_REEL_LOOPS: 6,
  /** 彩带等 0.3 秒（让判定和台词先站稳）再放，飞 2 秒（ResultPage.CONFETTI_DELAY_MS / CONFETTI_MS）。 */
  CONFETTI_DELAY_MS: 300,
  CONFETTI_MS: 2000,
  /** 彩带 32 片，重力 1.9（屏高/秒²），见 功能清单.md「彩带」。 */
  CONFETTI_PIECES: 32,
  CONFETTI_GRAVITY: 1.9,
} as const;

// ============================================================ 🎡 转盘

export const WHEEL = {
  /** 转 3–4 秒（domain/Wheel.kt SPIN_MILLIS）。 */
  SPIN_MS: [3000, 4000],
  /** 至少转 5 整圈（LOOPS）。 */
  LOOPS: 5,
  /** 停在格子中间 ±0.35 格的位置（永远不停在线上；MAX_OFFSET）。 */
  MAX_OFFSET: 0.35,
  /** 「谁来做」转盘短一点：2.5–3.2 秒（MainViewModel.TASK_WHEEL_MILLIS）。 */
  TASK_SPIN_MS: [2500, 3200],
  /** 转盘格子上的店名最多 5 个字，后面加「…」（LuckyWheel.WHEEL_LABEL_CHARS）；谁来做用 6 个字。 */
  LABEL_CHARS: 5,
  /** 缓动曲线 cubic-bezier(0.12, 0.75, 0.2, 1)：开始快，长长地慢慢停（LuckyWheel.WheelEasing）。 */
  EASING: 'cubic-bezier(0.12, 0.75, 0.2, 1)',
} as const;

// ============================================================ 👥 饭桌模式

export const TABLE = {
  /** 2–6 个人（domain/TableGame.kt TableRules）。 */
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  /** 头像改名最多 6 个字（MAX_NAME_LENGTH）。 */
  MAX_NAME_LENGTH: 6,
  /** 暗中出拳刚好 3 家（SECRET_HANDS_PLACES）。 */
  SECRET_HANDS_PLACES: 3,
  /** 划一刀后「点错了？撤销」3 秒，这 3 秒谁都不能再划（ui/TableOverlay.kt CUT_UNDO_MS）。 */
  CUT_UNDO_MS: 3000,
  /** 被划的卡：印章→撕开→收起，一共 1.2 秒（CUT_MS）。 */
  CUT_MS: 1200,
  /** 一起翻牌：每 0.15 秒翻一张（FLIP_EVERY_MS）。 */
  FLIP_EVERY_MS: 150,
  /** 翻完、判定出来后 1.8 秒自动进「就这一家吧！」（VERDICT_MS）。 */
  VERDICT_MS: 1800,
} as const;

// ============================================================ 🃏 任务卡

export const TASK = {
  /** 24 张普通卡（domain/TaskDeck.kt SIZE）。 */
  SIZE: 24,
  /** 免死金牌的编号（FREE_PASS）。 */
  FREE_PASS: -1,
  /** 免死金牌机会 5%（FREE_PASS_CHANCE）。 */
  FREE_PASS_CHANCE: 0.05,
} as const;

// ============================================================ 📳 摇一摇

export const SHAKE = {
  /** 一次「猛甩」：去掉重力后的加速度 ≥ 14 m/s²（约 1.4 g；domain/ShakeDetector.kt THRESHOLD）。 */
  THRESHOLD: 14,
  /** 两次反方向的猛甩相隔 90–900 毫秒才算一次「摇一摇」（MIN_GAP_MS / MAX_GAP_MS）。 */
  MIN_GAP_MS: 90,
  MAX_GAP_MS: 900,
  /** 触发后 1.5 秒内不再触发（COOLDOWN_MS）。 */
  COOLDOWN_MS: 1500,
  /** 重力低通滤波系数（GRAVITY_ALPHA）。 */
  GRAVITY_ALPHA: 0.1,
  /** 摇得越用力转得越久：1.1–2 秒，力度 14 → 1.1 秒，40 以上 → 2 秒，中间线性（spinMillisFor）。 */
  SPIN_MIN_MS: 1100,
  SPIN_MAX_MS: 2000,
  STRENGTH_FOR_MAX: 40,
} as const;

// ============================================================ 🧪 演示模式

export const DEMO = {
  /** 演示搜索的假等待（data/DemoPlaces.kt DemoPlaceSearcher.FAKE_DELAY_MS）。 */
  FAKE_DELAY_MS: 600,
  /** 摆放假店的固定种子（DemoPlaces.SEED）。 */
  SEED: 20261003,
  /** 近的店 150–1400 米、远的店 1600–2500 米（NEAR_MIN_M … FAR_MAX_M）。 */
  NEAR_MIN_M: 150,
  NEAR_MAX_M: 1400,
  FAR_MIN_M: 1600,
  FAR_MAX_M: 2500,
} as const;
