/**
 * 13 个菜系（含「不限」）：中文名、emoji、搜索关键词表（13 × 饭/面/都可以）、菜系校对用的 Google 类型、首页说明；以及饭/面/都可以。
 *
 * 由 ../校验/ 里的脚本从安卓第四版（只读）导出，并已和安卓源码、安卓编译后的真实运行结果逐条核对。
 * 不要手改；安卓源：domain/Cuisine.kt、domain/Place.kt（Meal）、data/SearchConfig.kt、ui/Texts.kt（cuisineHintRes）
 */

import type { CuisineId, MealId } from './types';

export interface CuisineData {
  id: CuisineId;
  zhName: string;
  emoji: string;
  unsuitableMeals: MealId[];
  matchTypes: string[];
  queries: Record<MealId, string[]>;
  hintKey: string;
  hint: string;
}

/**
 * 顺序 = 安卓枚举顺序 = 首页格子顺序：「不限」单独一整行在最上面，下面 12 个菜系每行 4 个
 * （屏宽 < 300 时 3 个，≥ 560 时 6 个）。
 * 注意：emoji 里 🌶️（泰国餐）带 \uFE0F，一定要保留，否则有的手机画成黑白字。
 * 菜系 emoji 永远不用 🍚 🍜 🍽️（那三个是 饭 / 面 / 都可以 的）。
 */
export const CUISINES: CuisineData[] = [
  {
    id: 'ANY',
    zhName: '不限',
    emoji: '🍴',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: [],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['饭', 'rice restaurant', 'nasi'],
      NOODLE: ['面', 'noodle restaurant', 'mee'],
      ANY: ['餐厅', 'restaurant', 'kedai makan'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_any',
    hint: '🍴 不限会帮你找：附近评价最好的餐厅、小贩档、咖啡店',
  },
  {
    id: 'CHINESE',
    zhName: '中餐',
    emoji: '🥢',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["chinese_restaurant","chinese_noodle_restaurant","cantonese_restaurant","dumpling_restaurant","taiwanese_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['杂饭', 'chicken rice', '瓦煲鸡饭'],
      NOODLE: ['云吞面', 'wantan mee', 'pan mee'],
      ANY: ['中餐', 'Chinese restaurant', '煮炒'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_chinese',
    hint: '🥢 中餐会帮你找：杂饭、海南鸡饭、瓦煲鸡饭、云吞面、板面、煮炒',
  },
  {
    id: 'HK_DIM_SUM',
    zhName: '港式/点心',
    emoji: '🥟',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["dim_sum_restaurant","cantonese_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['烧腊饭', 'char siew'],
      NOODLE: ['港式云吞面', '牛腩面', 'brisket noodle'],
      ANY: ['点心', 'dim sum', '茶餐厅'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_hk',
    hint: '🥟 港式/点心会帮你找：点心、茶餐厅、烧腊饭、港式云吞面、牛腩面',
  },
  {
    id: 'MALAY',
    zhName: '马来餐',
    emoji: '🥥',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["malaysian_restaurant","indonesian_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['nasi lemak', 'nasi campur', '椰浆饭'],
      NOODLE: ['mee rebus', '叻沙', 'mee goreng'],
      ANY: ['马来餐', 'masakan Melayu', 'Malay food'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_malay',
    hint: '🥥 马来餐会帮你找：椰浆饭、马来杂饭、马来卤面、叻沙、马来炒面',
  },
  {
    id: 'INDIAN_MAMAK',
    zhName: '印度/嘛嘛档',
    emoji: '🍛',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["indian_restaurant","south_indian_restaurant","north_indian_restaurant","sri_lankan_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['nasi kandar', '香蕉叶饭', 'nasi briyani'],
      NOODLE: ['mee mamak', '印度炒面', 'maggi goreng'],
      ANY: ['mamak', '嘛嘛档', 'Indian restaurant'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_mamak',
    hint: '🍛 印度/嘛嘛档会帮你找：嘛嘛档、印度煎饼、拉茶、扁担饭、香蕉叶饭、印度香饭、嘛嘛炒面、炒美极面',
  },
  {
    id: 'JAPANESE',
    zhName: '日本餐',
    emoji: '🍣',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["japanese_restaurant","ramen_restaurant","sushi_restaurant","japanese_curry_restaurant","japanese_izakaya_restaurant","tonkatsu_restaurant","yakiniku_restaurant","yakitori_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['donburi', '丼饭', '日式咖喱饭'],
      NOODLE: ['拉面', 'ramen', 'udon'],
      ANY: ['日本餐', 'Japanese restaurant', 'sushi'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_japanese',
    hint: '🍣 日本餐会帮你找：日本料理、寿司、丼饭、日式咖喱饭、拉面、乌冬面',
  },
  {
    id: 'KOREAN',
    zhName: '韩国餐',
    emoji: '🥘',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["korean_restaurant","korean_barbecue_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['韩式拌饭', 'bibimbap'],
      NOODLE: ['韩式炸酱面', 'jjajangmyeon', '冷面'],
      ANY: ['韩国餐', 'Korean restaurant', 'Korean BBQ'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_korean',
    hint: '🥘 韩国餐会帮你找：韩国料理、韩式烤肉、韩式拌饭、炸酱面、冷面',
  },
  {
    id: 'THAI',
    zhName: '泰国餐',
    emoji: '🌶\uFE0F',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["thai_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['打抛饭', 'kra pao', 'nasi paprik'],
      NOODLE: ['船面', 'boat noodle', 'pad thai'],
      ANY: ['泰国餐', 'Thai food', 'tomyam'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_thai',
    hint: '🌶\uFE0F 泰国餐会帮你找：泰国菜、冬炎档、打抛饭、泰式辣椒饭、船面、泰式炒河粉',
  },
  {
    id: 'VIETNAMESE',
    zhName: '越南餐',
    emoji: '🌿',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: ["RICE"],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["vietnamese_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['com tam', '越南碎米饭'],
      NOODLE: ['越南河粉', 'pho', 'bun cha'],
      ANY: ['越南餐', 'Vietnamese restaurant', 'pho'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_vietnamese',
    hint: '🌿 越南餐会帮你找：越南菜、越南河粉、越南碎米饭、越南烤肉米粉',
  },
  {
    id: 'WESTERN',
    zhName: '西餐',
    emoji: '🥩',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: ["RICE"],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["western_restaurant","american_restaurant","italian_restaurant","steak_house","european_restaurant","french_restaurant","british_restaurant","pizza_restaurant","hamburger_restaurant","fish_and_chips_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['焗饭', 'baked rice', 'risotto'],
      NOODLE: ['意大利面', 'pasta', 'aglio olio'],
      ANY: ['西餐', 'western food', 'chicken chop'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_western',
    hint: '🥩 西餐会帮你找：西餐档、炸鸡扒、焗饭、意大利面、蒜香意面',
  },
  {
    id: 'HOT_POT',
    zhName: '火锅',
    emoji: '🍲',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: ["RICE"],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["hot_pot_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['麻辣香锅', 'xiang guo'],
      NOODLE: ['麻辣烫', 'mala tang'],
      ANY: ['火锅', 'steamboat', 'hotpot'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_hot_pot',
    hint: '🍲 火锅会帮你找：火锅、打边炉、麻辣香锅、麻辣烫',
  },
  {
    id: 'SEAFOOD',
    zhName: '海鲜',
    emoji: '🦀',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["seafood_restaurant","oyster_bar_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['咖喱鱼头', 'fishhead curry', '海鲜炒饭'],
      NOODLE: ['鱼头米粉', '虾面', 'prawn mee'],
      ANY: ['海鲜', 'seafood restaurant', 'ikan bakar'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_seafood',
    hint: '🦀 海鲜会帮你找：海鲜楼、烧鱼、咖喱鱼头、海鲜炒饭、鱼头米粉、虾面',
  },
  {
    id: 'VEGETARIAN',
    zhName: '素食',
    emoji: '🥦',
    /** 不合理的组合：随便挑永远不会摇到（用户自己选照样可以搜）。 */
    unsuitableMeals: [],
    /** Google 地点类型：菜系软过滤用（不限 = 空，不过滤）。 */
    matchTypes: ["vegetarian_restaurant","vegan_restaurant"],
    /** 每次搜索最多 3 个关键词，同时发出（简体中文 / 英文 / 马来文混用）。 */
    queries: {
      RICE: ['素食杂饭', 'vegetarian rice'],
      NOODLE: ['素食面', 'vegetarian noodle'],
      ANY: ['素食', 'vegetarian restaurant'],
    },
    /** 格子下面「会帮你找：…」那一行（strings.ts 的 key）。 */
    hintKey: 'cuisine_hint_vegetarian',
    hint: '🥦 素食会帮你找：素食馆、素食杂饭、素食面',
  },
];

/** 12 个具体菜系（不含「不限」），随便挑只在这里面摇。 */
export const SPECIFIC_CUISINES: CuisineId[] = CUISINES.filter((c) => c.id !== 'ANY').map((c) => c.id);

export interface MealData {
  id: MealId;
  label: string;
  emoji: string;
  /** 底部三个大按钮的文字（strings.ts 的 key）。 */
  buttonKey: string;
}

/** 饭 / 面 / 都可以。「都可以」在标题里从不出现（见 choiceLabel）。 */
export const MEALS: MealData[] = [
  { id: 'RICE', label: '饭', emoji: '🍚', buttonKey: 'eat_rice' },
  { id: 'NOODLE', label: '面', emoji: '🍜', buttonKey: 'eat_noodle' },
  { id: 'ANY', label: '都可以', emoji: '🍽\uFE0F', buttonKey: 'eat_any' },
];

/** 标题里菜系和饭/面之间的点：「日本餐・面」。 */
export const CHOICE_SEPARATOR = '・';

/** 第一个版本的「不限」关键词（测试会核对）。 */
export const RICE_QUERIES = ["饭","rice restaurant","nasi"];
export const NOODLE_QUERIES = ["面","noodle restaurant","mee"];
export const ANY_QUERIES = ["餐厅","restaurant","kedai makan"];

/** 每次搜索最多发几个文字搜索请求（表里最长的一格）。每月额度一律按 3 个算。 */
export const QUERIES_PER_SEARCH = 3;

/** 救援卡怎么称呼刚才找的东西：具体菜系用中文名；不限时按饭/面/都可以（strings.ts 的 key）。 */
export const RESCUE_SUBJECT_KEYS: Record<MealId, string> = { RICE: 'rescue_subject_rice', NOODLE: 'rescue_subject_noodle', ANY: 'rescue_subject_any' };
