import { describe, expect, it } from 'vitest'
import { FORTUNE_STICKS } from '../data/fortunes.ts'
import { TASK_CARDS } from '../data/taskCards.ts'
import { DUEL_LINES } from '../data/duelLines.ts'
import { STRINGS } from '../data/strings.ts'
import { fortuneFood, STICK_COUNT } from '../domain/fortune.ts'
import { closed, closesBeforeArrival, mayHaveStoppedOrders, open, UNKNOWN, type OpenStatus } from '../domain/openingHours.ts'
import { lineText } from '../domain/rps.ts'
import { splitPhrases } from '../domain/phrases.ts'
import { tablePlayer } from '../domain/table.ts'
import { FREE_PASS, taskCardText, taskDraw, TASK_DECK_SIZE } from '../domain/taskDeck.ts'
import { newVoteTally, voteMarkersOf } from '../domain/vote.ts'
import { findTraditional, KL, klAt, klMillis, plain, testPlace } from '../test/helpers.ts'
import { newDuelState, PHOTO_NONE, type DuelState, type ResultItem } from './state.ts'
import {
  clockText,
  describeHours,
  fullHoursLabel,
  lockLine,
  rushText,
  shareDecision,
  shareFortune,
  shareVote,
  text,
  visitText,
  walkText,
} from './texts.ts'

const NBSP = ' '
const lines = (s: string) => s.split('\n')
const DINNER = klAt(6, 19, 30)

function item(id: string, name: string, rating: number, meters: number, price: [number, number] | null, translated: string | null = null): ResultItem {
  return {
    rank: 1,
    place: {
      ...testPlace(id, { rating, distanceMeters: meters, name, location: { latitude: 3.1452, longitude: 101.6975 } }),
      priceRange: price ? { start: { currencyCode: 'MYR', units: price[0] }, end: { currencyCode: 'MYR', units: price[1] } } : null,
      googleMapsUri: `https://maps.google.com/?cid=${id}`,
    },
    photo: PHOTO_NONE,
    translatedName: translated,
    translatedType: null,
  }
}

const wantan = item('111', '开心云吞面', 4.6, 520, [8, 15])
const chaChaanTeng = item('222', '港仔茶餐厅', 4.5, 600, [12, 25])
const ramen = item('333', 'Sakura Ramen House', 4.7, 1100, [25, 40], '樱花拉面屋')
const three = [wantan, chaChaanTeng, ramen]
const tenPm: OpenStatus = open(klAt(6, 22))
const players = [tablePlayer('TIGER'), tablePlayer('PANDA'), tablePlayer('MONKEY', '阿德'), tablePlayer('CHICK')]
const ids = ['111', '222', '333']
const won: DuelState = newDuelState({ round: 1, placeIds: ids, mode: 'ROCK_PAPER_SCISSORS', userHand: 'ROCK', appHand: 'SCISSORS', winnerIndex: 0, line: 'WIN_1' })

describe('九、营业时间：文字', () => {
  it('HOURS-12 来不及 = 剩余分钟 < 路上分钟 + 20；30 分钟内可能停止点餐；24 小时、不知道关门、休息中、不明都不算来不及', () => {
    const nine = open(klAt(6, 21))
    expect(closesBeforeArrival(nine, klAt(6, 20, 58), 18)).toBe(true)
    expect(closesBeforeArrival(nine, klAt(6, 20, 23), 18)).toBe(true)
    expect(closesBeforeArrival(nine, klAt(6, 20, 22), 18)).toBe(false)
    expect(closesBeforeArrival(nine, klAt(6, 20, 34), 6)).toBe(false)
    expect(closesBeforeArrival(nine, klAt(6, 20, 35), 6)).toBe(true)
    expect(closesBeforeArrival(nine, klAt(6, 20, 58), 1)).toBe(true)
    expect(mayHaveStoppedOrders(nine, klAt(6, 20, 30))).toBe(true)
    expect(mayHaveStoppedOrders(nine, klAt(6, 20, 29))).toBe(false)
    expect(closesBeforeArrival(open(null, true), klAt(6, 20, 58), 30)).toBe(false)
    expect(closesBeforeArrival(open(), klAt(6, 20, 58), 30)).toBe(false)
    expect(closesBeforeArrival(closed(), klAt(6, 20, 58), 30)).toBe(false)
    expect(closesBeforeArrival(UNKNOWN, klAt(6, 20, 58), 30)).toBe(false)
  })

  it('HOURS-13 时间写法：晚上 10:00、凌晨 2:00、半夜 12:30、早上 7:00、上午 10:15、中午 12:00、下午 5:00、晚上 6:30', () => {
    const cases: [number, number, string][] = [
      [22, 0, '晚上 10:00'],
      [2, 0, '凌晨 2:00'],
      [0, 30, '半夜 12:30'],
      [7, 0, '早上 7:00'],
      [10, 15, '上午 10:15'],
      [12, 0, '中午 12:00'],
      [17, 0, '下午 5:00'],
      [18, 30, '晚上 6:30'],
    ]
    for (const [h, m, expected] of cases) expect(plain(clockText(h, m)), `${h}:${m}`).toBe(expected)
  })

  it('HOURS-14 营业中 · 开到晚上 10:00（绿色）；23:00 时「开到凌晨 2:00」不写明天；24 小时营业；21:25「⏰ 还有 35 分钟关门」（橙色）；不知道关门时间只写「营业中」', () => {
    const now = DINNER
    expect(plain(fullHoursLabel(describeHours(tenPm, now)))).toBe('营业中 · 开到晚上 10:00')
    expect(describeHours(tenPm, now).tone).toBe('OPEN')
    expect(plain(fullHoursLabel(describeHours(open(klAt(7, 2)), klAt(6, 23))))).toBe('营业中 · 开到凌晨 2:00')
    expect(plain(fullHoursLabel(describeHours(open(null, true), now)))).toBe('24 小时营业')
    const soon = describeHours(tenPm, klAt(6, 21, 25))
    expect(soon.tone).toBe('CLOSING_SOON')
    expect(plain(fullHoursLabel(soon))).toBe('⏰ 还有 35 分钟关门')
    expect(fullHoursLabel(describeHours(open(), now))).toBe('营业中')
  })

  it('HOURS-15 休息中 · 下午 5:00 开 / 明天早上 7:00 开 / 半夜后同一天 / 星期六早上 7:00 开 / 10月20日上午 11:00 开；不知道几点开只写休息中；不明 = 营业时间不明', () => {
    const say = (status: OpenStatus, now = klAt(6, 12)) => plain(fullHoursLabel(describeHours(status, now)))
    expect(say(closed(klAt(6, 17)), klAt(6, 15, 30))).toBe('休息中 · 下午 5:00 开')
    expect(say(closed(klAt(7, 7)), klAt(6, 16))).toBe('休息中 · 明天早上 7:00 开')
    expect(say(closed(klAt(7, 7)), klAt(7, 1))).toBe('休息中 · 早上 7:00 开')
    expect(say(closed(klAt(10, 7)), klAt(8, 15))).toBe('休息中 · 星期六早上 7:00 开')
    expect(say(closed(klAt(20, 11)))).toBe('休息中 · 10月20日上午 11:00 开')
    expect(describeHours(closed(), klAt(6, 12)).tone).toBe('CLOSED')
    expect(say(closed())).toBe('休息中')
    expect(say(UNKNOWN)).toBe('营业时间不明')
    expect(describeHours(UNKNOWN, klAt(6, 12)).detail).toBeNull()
  })

  it('HOURS-16 营业时间文字里数字和单位、时段词和时间之间都是不换行空格，没有繁体字', () => {
    const texts = [
      fullHoursLabel(describeHours(tenPm, klAt(6, 19))),
      fullHoursLabel(describeHours(tenPm, klAt(6, 21, 25))),
      fullHoursLabel(describeHours(closed(klAt(7, 7)), klAt(6, 16))),
      fullHoursLabel(describeHours(open(null, true), klAt(6, 16))),
      walkText(520) ?? '',
    ]
    const breakable = /(\d|晚上|凌晨|早上|上午|中午|下午|半夜) (\d|分钟|小时|开)/
    for (const t of texts) {
      expect(breakable.test(t), t).toBe(false)
      expect(findTraditional(t)).toEqual([])
    }
    expect(texts[0]).toContain(`晚上${NBSP}10:00`)
    expect(texts[1]).toContain(`35${NBSP}分钟`)
    expect(texts[2]).toContain(`7:00${NBSP}开`)
  })

  it('HOURS-17 店卡走路文字：走路约 2 / 9 / 18 分钟，2.5 公里不写', () => {
    expect(plain(walkText(100) ?? '')).toBe('走路约 2 分钟')
    expect(plain(walkText(520) ?? '')).toBe('走路约 9 分钟')
    expect(plain(walkText(1100) ?? '')).toBe('走路约 18 分钟')
    expect(walkText(2500)).toBeNull()
  })

  it('HOURS-18 「就这一家吧」下面那句：赶得及 / 赶得到但可能停止点餐 / 来不及；不是快关门、24 小时、休息中 → 不说', () => {
    expect(rushText(tenPm, 150, klAt(6, 21, 15))).toBe('赶得及！冲！🏃')
    const lastOrders = klAt(6, 21, 35)
    expect(plain(fullHoursLabel(describeHours(tenPm, lastOrders))).endsWith('可能停止点餐了')).toBe(true)
    const rush = rushText(tenPm, 150, lastOrders) ?? ''
    expect(rush).toBe('赶得到，不过可能已经停止点餐了，碰碰运气吧 🤞')
    expect(rush).not.toContain('赶得及')
    expect(plain(rushText(tenPm, 600, lastOrders) ?? '')).toBe('⏰ 只剩 25 分钟，走过去要 10 分钟，来不及了')
    expect(plain(rushText(tenPm, 1100, klAt(6, 21, 58)) ?? '')).toBe('⏰ 只剩 2 分钟，走过去要 18 分钟，来不及了')
    expect(rushText(tenPm, 2500, klAt(6, 21, 15))).toBe('赶得及！冲！🏃')
    expect(rushText(tenPm, 150, klAt(6, 19))).toBeNull()
    expect(rushText(open(null, true), 150, klAt(6, 21, 35))).toBeNull()
    expect(rushText(closed(klAt(7, 7)), 150, klAt(6, 23))).toBeNull()
  })

  it('HOURS-21 来不及的文字：走路 / 开车两种说法；跳过提示和不能圈的提示原文', () => {
    expect(plain(text('hours_too_late_walk', 2, 18))).toBe('⏰ 只剩 2 分钟，走过去要 18 分钟，来不及了')
    expect(plain(text('hours_too_late_ride', 10, 15))).toBe('⏰ 只剩 10 分钟，过去要 15 分钟左右，来不及了')
    expect(text('duel_skipped_late', '阿明海南鸡饭')).toBe('😴 已跳过快关门、过去来不及的『阿明海南鸡饭』')
    expect(text('basket_too_late')).toBe('这家快关门了，过去来不及，先不能圈')
    // 开车的说法用在 2 公里以外。
    expect(plain(rushText(open(klAt(6, 22)), 2500, klAt(6, 21, 50)) ?? '')).toBe('⏰ 只剩 10 分钟，过去要 15 分钟左右，来不及了')
  })

  it('HOURS-22 20:35、9 点关门：「⏰ 还有 25 分钟关门 · 可能停止点餐了」（带点）；9:30 关门：「⏰ 还有 55 分钟关门」', () => {
    const now = klAt(6, 20, 35)
    const label = describeHours(open(klAt(6, 21)), now)
    expect(label.tone).toBe('CLOSING_SOON')
    expect(plain(fullHoursLabel(label))).toBe('⏰ 还有 25 分钟关门 · 可能停止点餐了')
    expect(label.dotted).toBe(true)
    expect(plain(fullHoursLabel(describeHours(open(klAt(6, 21, 30)), now)))).toBe('⏰ 还有 55 分钟关门')
  })
})

describe('二十四、📤 分享文字', () => {
  it('SHARE-01 晚餐 3 家投票文字逐行一致', () => {
    const t = shareVote(three, [tenPm, UNKNOWN, closed(klAt(7, 7, 30))], DINNER, false)
    expect(lines(t)).toEqual([
      '今晚吃哪家？回 ✊✌️🖐️ 投票！',
      '✊ 开心云吞面 ⭐4.6 · 离我 520 米 · RM8–15 · 开到晚上 10:00',
      '✌️ 港仔茶餐厅 ⭐4.5 · 离我 600 米 · RM12–25',
      '🖐️ 樱花拉面屋（Sakura Ramen House） ⭐4.7 · 离我 1.1 公里 · RM25–40 · 休息中 · 明天早上 7:30 开',
      '（用「美食剪刀布」挑的）',
      '',
      '👉 点这里看地图：',
      '✊ https://maps.google.com/?cid=111',
      '✌️ https://maps.google.com/?cid=222',
      '🖐️ https://maps.google.com/?cid=333',
    ])
  })

  it('SHARE-02 2 家用 ✊✌️、一共 8 行；1 家「午餐就吃这家？回 👍 或 👎！」用 👉；5 家宵夜用 1️⃣–5️⃣；计票板和文字用同样的编号', () => {
    const two = shareVote([wantan, chaChaanTeng], [tenPm, tenPm], DINNER, false)
    expect(lines(two)[0]).toBe('今晚吃哪家？回 ✊✌️ 投票！')
    expect(lines(two)).toHaveLength(8)
    const one = shareVote([wantan], [open(null, true)], klAt(6, 12, 30), false)
    expect(lines(one)).toEqual([
      '午餐就吃这家？回 👍 或 👎！',
      '👉 开心云吞面 ⭐4.6 · 离我 520 米 · RM8–15 · 24 小时营业',
      '（用「美食剪刀布」挑的）',
      '',
      '👉 点这里看地图：',
      '👉 https://maps.google.com/?cid=111',
    ])
    const five = [1, 2, 3, 4, 5].map((i) => item(`p${i}`, `店${i}`, 4.5, 300 + i, null))
    const vote = lines(shareVote(five, five.map(() => tenPm), klAt(6, 23, 30), false))
    expect(vote[0]).toBe('宵夜吃哪家？回 1️⃣2️⃣3️⃣4️⃣5️⃣ 投票！')
    expect(vote[1]?.startsWith('1️⃣ 店1 ')).toBe(true)
    expect(vote[5]?.startsWith('5️⃣ 店5 ')).toBe(true)
    expect(vote[vote.length - 1]).toBe('5️⃣ https://maps.google.com/?cid=p5')
    expect(voteMarkersOf(newVoteTally(five.map((i) => i.place.id)))).toEqual(['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'])
    expect(voteMarkersOf(newVoteTally(ids))).toEqual(['✊', '✌️', '🖐️'])
  })

  it('SHARE-03 告诉朋友逐行一致：决定了吃『…』、我出 ✊，App 出 ✌️、⭐ · 离我 · 营业到几点（不写价钱）、署名、空行、地图链接', () => {
    expect(lines(shareDecision(wantan, won, three, tenPm, DINNER, false))).toEqual([
      '美食剪刀布帮我们决定了：今天吃『开心云吞面』！',
      '我出 ✊，App 出 ✌️，石头赢 —— 你赢了！就吃你挑的 😎',
      '⭐4.6 · 离我 520 米 · 开到晚上 10:00',
      '（用「美食剪刀布」挑的）',
      '',
      '👉 点这里看地图：https://maps.google.com/?cid=111',
    ])
  })

  it('SHARE-04 输、平手、帮我挑一家各有自己的说法；机翻店名带原名；不明不写营业；链接从不带 travelmode', () => {
    const lost = { ...won, userHand: 'SCISSORS' as const, appHand: 'ROCK' as const, line: 'LOSE_VEGETARIAN' }
    expect(lines(shareDecision(wantan, lost, three, tenPm, DINNER, false))[1]).toBe('我出 ✌️，App 出 ✊，石头赢 —— 乖乖去吃素吧 🥦')
    const tie = { ...won, userHand: 'PAPER' as const, appHand: 'PAPER' as const, winnerIndex: 2, line: 'TIE_2' }
    const tieText = lines(shareDecision(ramen, tie, three, UNKNOWN, DINNER, false))
    expect(tieText[0]).toBe('美食剪刀布帮我们决定了：今天吃『樱花拉面屋（Sakura Ramen House）』！')
    expect(tieText[1]).toBe('我出 🖐️，App 也出 🖐️，心有灵犀 —— 连 App 都想吃这家，就它了 😆')
    expect(tieText[2]).toBe('⭐4.7 · 离我 1.1 公里')
    const roulette = newDuelState({ round: 2, placeIds: ['111', '222'], mode: 'ROULETTE', winnerIndex: 1, line: 'ROULETTE_1' })
    expect(lines(shareDecision(chaChaanTeng, roulette, [wantan, chaChaanTeng], tenPm, DINNER, false))[1]).toBe('🎲 两家轮流亮灯，命运停在了这一家 —— 命运选中了它 ✨')
    for (const i of three) expect(shareDecision(i, tie, three, UNKNOWN, DINNER, false)).not.toContain('travelmode')
  })

  it('SHARE-05 转盘、划一刀（+ 划刀记录）、暗中出拳（+ 每人手势）、投票、平票', () => {
    const five = [...three, item('444', '阿明海南鸡饭', 4.5, 700, null), item('555', '青莲素食', 4.6, 800, null)]
    const wheel = newDuelState({ round: 3, placeIds: five.map((i) => i.place.id), mode: 'WHEEL', winnerIndex: 3, wheel: { target: 3, segments: 5, millis: 3500, offset: 0 }, line: 'ROULETTE_2' })
    expect(lines(shareDecision(five[3]!, wheel, five, tenPm, DINNER, false))[1]).toBe('🎡 5 家转转盘，停在了这一家 —— 老天帮你挑好了，就它吧 🙏')

    const veto = newDuelState({
      round: 4,
      placeIds: [...ids, '444'],
      mode: 'VETO',
      winnerIndex: 3,
      line: 'TABLE_1',
      table: { players, order: [1, 0, 3, 2], cuts: ['333', '111', '222'], hands: [] },
    })
    const vetoText = lines(shareDecision(five[3]!, veto, five.slice(0, 4), tenPm, DINNER, false))
    expect(vetoText[1]).toBe('✂️ 大家划了 3 刀，剩下这一家！ —— 大家一起定的，谁都不准抱怨 🤝')
    expect(vetoText[2]).toBe('🐼 划掉樱花拉面屋 · 🐯 划掉开心云吞面 · 🐔 划掉港仔茶餐厅')

    const secret = newDuelState({
      round: 5,
      placeIds: ids,
      mode: 'SECRET_HANDS',
      winnerIndex: 0,
      line: 'TABLE_3',
      table: { players, order: [0, 1, 2, 3], cuts: [], hands: ['ROCK', 'ROCK', 'SCISSORS', 'ROCK'] },
    })
    const secretText = lines(shareDecision(wantan, secret, three, tenPm, DINNER, false))
    expect(secretText[1]).toBe('🐯🐼🐔 出 ✊，🐵 出 ✌️ → 石头赢！ —— 民主的力量 ✊')
    expect(secretText[2]).toBe('🐯✊  🐼✊  🐵✌️  🐔✊')

    const vote = newDuelState({ round: 6, placeIds: ids, mode: 'VOTE', winnerIndex: 0, line: 'TABLE_2', vote: newVoteTally(ids, [4, 2, 1]) })
    expect(plain(lines(shareDecision(wantan, vote, three, tenPm, DINNER, false))[1] ?? '')).toBe('群里投票：✊ 4 票、✌️ 2 票、🖐️ 1 票 → 开心云吞面！ —— 剩下的就是缘分 🍀')
    const tied = { ...vote, vote: newVoteTally(ids, [3, 3, 1]), tiedIndices: [0, 1], wheel: { target: 0, segments: 2, millis: 3000, offset: 0 } }
    const tiedText = lines(shareDecision(wantan, tied, three, tenPm, DINNER, false))
    expect(tiedText[1]).toBe('平票！App 来当判官 ⚖️ —— 剩下的就是缘分 🍀')
    expect(tiedText[2]).toBe('✊ 3 票、✌️ 3 票、🖐️ 1 票')
  })

  it('SHARE-06 没抽任务卡就没有那行；抽了「🃏 饭桌任务：…」；转了谁来做加上人；免死金牌；链接是最后一行、前面空一行、再前面是署名、全文只有一个空行', () => {
    expect(shareDecision(wantan, won, three, tenPm, DINNER, false)).not.toContain('🃏')
    expect(lines(shareDecision(wantan, { ...won, task: taskDraw(0) }, three, tenPm, DINNER, false))[2]).toBe('🃏 饭桌任务：请大家喝拉茶 🧋')
    const assigned = { ...won, task: taskDraw(0, players, { target: 1, segments: 4, millis: 3000, offset: 0 }, true) }
    expect(lines(shareDecision(wantan, assigned, three, tenPm, DINNER, false))[2]).toBe('🃏 饭桌任务：🐼 熊猫 请大家喝拉茶 🧋')
    const renamed = { ...won, task: taskDraw(2, players, { target: 2, segments: 4, millis: 3000, offset: 0 }, true) }
    expect(lines(shareDecision(wantan, renamed, three, tenPm, DINNER, false))[2]).toBe('🃏 饭桌任务：🐵 阿德 负责点菜 📝')
    expect(lines(shareDecision(wantan, { ...won, task: taskDraw(FREE_PASS) }, three, tenPm, DINNER, false))[2]).toBe('🃏 饭桌任务：🎉 免死金牌：今天谁都不用做！')
    const all = lines(shareDecision(wantan, assigned, three, tenPm, DINNER, false))
    expect(all[all.length - 1]?.startsWith('👉 点这里看地图：https://')).toBe(true)
    expect(all[all.length - 2]).toBe('')
    expect(all[all.length - 3]).toBe('（用「美食剪刀布」挑的）')
    expect(all.filter((l) => l === '')).toHaveLength(1)
  })

  it('SHARE-07 演示的投票和决定第一行都是「【演示数据，不是真实的店】」；演示店链接是坐标短网址；不出现 demo_ 编号；链接都是 Google 地图、不超过 50 个字', () => {
    const demoShop = { ...item('demo_01', '开心云吞面', 4.6, 520, [8, 15]) }
    const demo = { ...demoShop, place: { ...demoShop.place, googleMapsUri: null } }
    const vote = shareVote([demo, chaChaanTeng], [tenPm, tenPm], DINNER, true)
    expect(lines(vote)[0]).toBe('【演示数据，不是真实的店】')
    expect(lines(vote)[lines(vote).length - 2]).toBe('✊ https://maps.google.com/?q=3.14520,101.69750')
    const roulette = newDuelState({ round: 2, placeIds: ['demo_01', '222'], mode: 'ROULETTE', winnerIndex: 0 })
    const decision = shareDecision(demo, roulette, [demo, chaChaanTeng], tenPm, DINNER, true)
    expect(lines(decision)[0]).toBe('【演示数据，不是真实的店】')
    expect(decision).not.toContain('demo_01')
    for (const t of [vote, decision]) {
      const urls = t.match(/https?:\/\/\S+/g) ?? []
      expect(urls.length).toBeGreaterThan(0)
      expect(urls.every((u) => u.startsWith('https://www.google.com/maps/') || u.startsWith('https://maps.google.com/'))).toBe(true)
      expect(urls.every((u) => u.length <= 50)).toBe(true)
    }
  })

  it('SHARE-08 饭签分享四行', () => {
    expect(lines(shareFortune(0))).toEqual(['我今天抽到 📜 上上签 🎉', '今日宜：云吞面、走路去', '忌：排队超过 20 分钟', '你抽到什么？（用「美食剪刀布」抽的）'])
  })

  it('SHARE-09 分享文字没有繁体字、没有不换行空格、字连接符、零宽空格', () => {
    const texts = [
      shareVote(three, [tenPm, tenPm, tenPm], DINNER, true),
      shareDecision(ramen, newDuelState({ round: 1, placeIds: ['333'], mode: 'ROULETTE', winnerIndex: 0 }), [ramen], tenPm, DINNER, true),
      shareFortune(5),
      shareDecision(wantan, { ...won, task: taskDraw(13) }, three, tenPm, DINNER, false),
    ]
    for (const t of texts) {
      expect(findTraditional(t)).toEqual([])
      expect(/[ ⁠​]/.test(t), t).toBe(false)
    }
  })
})

describe('其他文字（第三、五版）', () => {
  it('DUEL-15 每句台词都有、简体；输的四句原文；平手台词不重复「心有灵犀」；帮我挑一家「命运选中了它 ✨」；平手判定原文保留', () => {
    for (const line of DUEL_LINES) {
      expect(lineText(line.id).trim(), line.id).not.toBe('')
      expect(findTraditional(lineText(line.id))).toEqual([])
    }
    expect(lineText('WIN_1')).toBe('你赢了！就吃你挑的 😎')
    expect(new Set(DUEL_LINES.filter((l) => l.verdict === 'LOSE').map((l) => lineText(l.id)))).toEqual(
      new Set(['哈哈你输了，乖乖去吃吧 😜', '愿赌服输，不准反悔！', '输的人请喝茶 🧋', '乖乖去吃素吧 🥦']),
    )
    expect(DUEL_LINES.filter((l) => l.verdict === 'TIE').some((l) => lineText(l.id).includes('心有灵犀'))).toBe(false)
    expect(lineText('ROULETTE_1')).toBe('命运选中了它 ✨')
    expect(STRINGS.duel_tie).toBe('你出 %1$s，我也出 %1$s → 心有灵犀！')
  })

  it('TASK-06 24 张任务卡都不一样、简体，包括请喝拉茶、排队打包、请吃煎蕊；免死金牌和「🐼 熊猫，就是你了！」原文', () => {
    const cards = Array.from({ length: TASK_DECK_SIZE }, (_, i) => taskCardText(i))
    expect(TASK_CARDS).toHaveLength(TASK_DECK_SIZE)
    expect(new Set(cards).size).toBe(TASK_DECK_SIZE)
    for (const card of cards) expect(findTraditional(card)).toEqual([])
    expect(cards).toContain('请大家喝拉茶 🧋')
    expect(cards).toContain('负责排队打包 🥡')
    expect(cards).toContain('请大家吃煎蕊 🍧')
    expect(taskCardText(FREE_PASS)).toBe('🎉 免死金牌：今天谁都不用做！')
    expect(text('task_assigned', '🐼 熊猫')).toBe('🐼 熊猫，就是你了！')
  })

  it('FORTUNE-07 40 支签的宜和忌都简体、没有英文、没有「凶 死 病 破财 倒霉」；每支都能取出食物名；忌里的数字和单位不断行；第一支签和饭签说明原文', () => {
    expect(FORTUNE_STICKS).toHaveLength(STICK_COUNT)
    for (let i = 0; i < STICK_COUNT; i++) {
      const stick = FORTUNE_STICKS[i]!
      for (const t of [stick.yi, stick.ji]) {
        expect(findTraditional(t)).toEqual([])
        expect(/[a-zA-Z]/.test(t), t).toBe(false)
        expect(['凶', '死', '病', '破财', '倒霉'].some((w) => t.includes(w)), t).toBe(false)
      }
      expect(fortuneFood(i).trim()).not.toBe('')
      expect(/\d (分钟|次|家)/.test(stick.ji), stick.ji).toBe(false)
    }
    expect(fortuneFood(0)).toBe('云吞面')
    expect(text('fortune_yi', FORTUNE_STICKS[0]!.yi)).toBe('今日宜：云吞面、走路去')
    expect(text('fortune_ji', FORTUNE_STICKS[0]!.ji)).toBe(`忌：排队超过 20${NBSP}分钟`)
    expect(text('random_fortune_note', fortuneFood(0))).toBe('📜 今天签上宜云吞面，多给它一点机会')
    expect(text('fortune_go_note')).toBe(`会用 1${NBSP}次免费搜索，跟按「吃饭」「吃面」一样`)
  })

  it('MEAL-15 「🔒 这一餐定了」下面那句跟着怎么定的走；饭桌三句台词原文', () => {
    const rps = newDuelState({ round: 1, placeIds: ['a', 'b', 'c'], mode: 'ROCK_PAPER_SCISSORS' })
    expect(lockLine({ ...rps, userHand: 'ROCK', appHand: 'SCISSORS' })).toBe('赢了就听你的，就这么定了 🤝')
    expect(lockLine({ ...rps, userHand: 'SCISSORS', appHand: 'ROCK' })).toBe('愿赌服输，就这家了 🤝')
    expect(lockLine({ ...rps, userHand: 'PAPER', appHand: 'PAPER' })).toBe('心有灵犀，就这么定了 🤝')
    expect(lockLine({ ...rps, mode: 'VETO' })).toBe('大家一起定的，不能反悔 🤝')
    expect(lockLine({ ...rps, mode: 'SECRET_HANDS' })).toBe('大家一起定的，不能反悔 🤝')
    expect(lockLine({ ...rps, mode: 'VOTE' })).toBe('大家一起定的，不能反悔 🤝')
    expect(lockLine({ ...rps, mode: 'ROULETTE' })).toBe('老天帮你挑的，就这么定了 🤝')
    expect(new Set(DUEL_LINES.filter((l) => l.verdict === 'TABLE').map((l) => lineText(l.id)))).toEqual(
      new Set(['大家一起定的，谁都不准抱怨 🤝', '剩下的就是缘分 🍀', '民主的力量 ✊']),
    )
    // 反悔询问里的店名不拆行。
    expect(splitPhrases(text('meal_prompt_text', '阿南达香蕉叶饭餐厅')).some((p) => p.startsWith('『阿南达香蕉叶饭餐厅』'))).toBe(true)
  })

  it('VISIT-12 去过文字：刚刚导航过、今天中午去过、昨晚去过、昨天下午去过、昨天去过、3 天前去过', () => {
    const say = (visitMs: number, nowMs: number) => plain(visitText(visitMs, nowMs, KL))
    expect(say(klMillis(6, 12, 0), klMillis(6, 12, 59))).toBe('👣 刚刚导航过')
    expect(say(klMillis(6, 12, 0), klMillis(6, 13, 0))).toBe('👣 今天中午去过')
    expect(say(klMillis(5, 19, 47), klMillis(6, 1, 15))).toBe('👣 昨晚去过')
    expect(say(klMillis(5, 23, 50), klMillis(6, 0, 10))).toBe('👣 刚刚导航过')
    expect(say(klMillis(6, 22, 52), klMillis(6, 22, 51))).toBe('👣 刚刚导航过')
    expect(say(klMillis(5, 15, 0), klMillis(6, 2, 59))).toBe('👣 昨天下午去过')
    expect(say(klMillis(5, 15, 0), klMillis(6, 3, 0))).toBe('👣 昨天去过')
    expect(say(klMillis(5, 12, 0), klMillis(6, 19, 0))).toBe('👣 昨天去过')
    expect(say(klMillis(3, 12, 0), klMillis(6, 12, 0))).toBe('👣 3 天前去过')
  })
})
