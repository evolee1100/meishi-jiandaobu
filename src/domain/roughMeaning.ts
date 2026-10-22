/**
 * 店名的「大概意思」（网页版专属，研究结论：手机浏览器没有内建离线翻译时的退路）。
 *
 * 手机 Chrome、iPhone Safari 都没有 Translator API，英文 / 马来文店名只能照原文显示（方便到现场对招牌）。
 * 这里用一张很小的词表，把店名里认得的吃的词拼成一行「大概意思：餐厅、扁担饭」，不联网、不花钱、不下载模型。
 * 只认「整个词」（Mile High Cafe 的 Mi 不算「面」）；几个词连在一起的先认（nasi lemak = 椰浆饭，不是「饭、椰浆」）。
 * 认不出任何词 → null（只显示原名）。词表的中文都是马来西亚华人平常的叫法。
 */
import { SEPARATORS } from '../data/uiLiterals.ts'
import { needsTranslation } from './chineseText.ts'

/** 词（小写、用空格分开）→ 中文。几个词的放前面也没关系，查的时候先试最长的。 */
const GLOSSARY: Readonly<Record<string, string>> = {
  // ---- 几个词一起才有意思的（马来西亚常见的菜名、店名）
  'nasi lemak': '椰浆饭',
  'nasi kandar': '扁担饭',
  'nasi campur': '杂饭',
  'nasi goreng': '炒饭',
  'nasi ayam': '鸡饭',
  'nasi kerabu': '蓝花饭',
  'nasi briyani': '印度香饭',
  'nasi beriani': '印度香饭',
  'mee goreng': '炒面',
  'mee rebus': '卤面',
  'mee kari': '咖喱面',
  'mee curry': '咖喱面',
  'curry mee': '咖喱面',
  'mee hailam': '海南面',
  'hokkien mee': '福建面',
  'prawn mee': '虾面',
  'pan mee': '板面',
  'wantan mee': '云吞面',
  'wanton mee': '云吞面',
  'wonton mee': '云吞面',
  'chicken rice': '鸡饭',
  'banana leaf': '香蕉叶饭',
  'roti canai': '印度煎饼',
  'roti telur': '鸡蛋煎饼',
  'teh tarik': '拉茶',
  'char kuey teow': '炒粿条',
  'char kway teow': '炒粿条',
  'kuey teow': '粿条',
  'kway teow': '粿条',
  'bak kut teh': '肉骨茶',
  'yong tau foo': '酿豆腐',
  'dim sum': '点心',
  'char siew': '叉烧',
  'char siu': '叉烧',
  'tom yum': '冬炎',
  'ayam goreng': '炸鸡',
  'ayam penyet': '印尼炸鸡',
  'ikan bakar': '烤鱼',
  'sup kambing': '羊肉汤',
  'kedai makan': '餐馆',
  'kedai kopi': '咖啡店',
  'medan selera': '美食广场',
  'food court': '美食中心',
  'hawker centre': '小贩中心',
  'hawker center': '小贩中心',
  'noodle house': '面馆',
  'coffee shop': '咖啡店',
  'seafood restaurant': '海鲜餐厅',
  'fish head': '鱼头',
  'hot pot': '火锅',
  'ice kacang': '红豆冰',

  // ---- 一个词
  restoran: '餐厅',
  restaurant: '餐厅',
  kedai: '店',
  warung: '小食档',
  gerai: '档口',
  stall: '档口',
  kopitiam: '咖啡店',
  mamak: '嘛嘛档',
  cafe: '咖啡馆',
  café: '咖啡馆',
  kitchen: '厨房',
  dapur: '厨房',
  makan: '吃',
  makanan: '吃的',
  masakan: '料理',
  nasi: '饭',
  rice: '饭',
  mee: '面',
  mi: '面',
  noodle: '面',
  noodles: '面',
  bihun: '米粉',
  meehoon: '米粉',
  laksa: '叻沙',
  pho: '河粉',
  ramen: '拉面',
  udon: '乌冬面',
  sushi: '寿司',
  kopi: '咖啡',
  coffee: '咖啡',
  teh: '茶',
  tea: '茶',
  roti: '面包',
  bread: '面包',
  ayam: '鸡',
  chicken: '鸡',
  itik: '鸭',
  duck: '鸭',
  ikan: '鱼',
  fish: '鱼',
  daging: '肉',
  lembu: '牛肉',
  beef: '牛肉',
  kambing: '羊肉',
  mutton: '羊肉',
  lamb: '羊肉',
  babi: '猪肉',
  pork: '猪肉',
  udang: '虾',
  prawn: '虾',
  shrimp: '虾',
  ketam: '螃蟹',
  crab: '螃蟹',
  sotong: '苏东',
  seafood: '海鲜',
  sayur: '菜',
  vegetarian: '素食',
  vegan: '素食',
  sup: '汤',
  soup: '汤',
  lemak: '椰浆',
  goreng: '炒',
  bakar: '烤',
  grill: '烧烤',
  bbq: '烧烤',
  kuah: '汤汁',
  kari: '咖喱',
  curry: '咖喱',
  satay: '沙爹',
  sate: '沙爹',
  rojak: '啰惹',
  cendol: '煎蕊',
  tomyam: '冬炎',
  briyani: '印度香饭',
  biryani: '印度香饭',
  naan: '印度烤饼',
  tandoori: '印度烤鸡',
  steamboat: '火锅',
  hotpot: '火锅',
  claypot: '瓦煲',
  dessert: '甜品',
  bakery: '面包店',
  burger: '汉堡',
  pizza: '比萨',
  steak: '牛排',
  pasta: '意大利面',
  western: '西餐',
  thai: '泰式',
  korean: '韩式',
  japanese: '日式',
  indian: '印度',
  chinese: '中式',
  hainanese: '海南',
  hokkien: '福建',
  cantonese: '广东',
  kampung: '乡村',
  sedap: '好吃',
  enak: '好吃',
  istimewa: '特别',
}

/** 最长的词有几个字（查的时候从这么长开始试）。 */
const MAX_WORDS = Math.max(...Object.keys(GLOSSARY).map((k) => k.split(' ').length))

/** 拆成小写的词：只留字母（马来文、英文、带重音的 é）；数字、符号、&、' 都当分隔。 */
function wordsOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length > 0)
}

/** 店名里认得的词的中文（按出现的顺序、不重复）；一个都不认得 → 空的。 */
export function roughMeaningParts(name: string): string[] {
  const words = wordsOf(name)
  const found: string[] = []
  let i = 0
  while (i < words.length) {
    let matched = 0
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1; n--) {
      const meaning = GLOSSARY[words.slice(i, i + n).join(' ')]
      if (meaning !== undefined) {
        if (!found.includes(meaning)) found.push(meaning)
        matched = n
        break
      }
    }
    i += matched > 0 ? matched : 1
  }
  return found
}

/**
 * 「餐厅、扁担饭」：要机翻的店名（有字母、没有汉字）才有；中文店名、认不出任何词 → null。
 */
export function roughMeaning(name: string | null | undefined): string | null {
  if (!needsTranslation(name)) return null
  const parts = roughMeaningParts(name as string)
  return parts.length > 0 ? parts.join(SEPARATORS.list) : null
}
