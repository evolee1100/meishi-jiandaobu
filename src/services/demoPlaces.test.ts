import demoPlacesRaw from '../test/golden/demoPlaces.json?raw'
import demoReachableRaw from '../test/golden/demoReachable.json?raw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_SHOPS } from '../data/demoShops.ts'
import { KotlinRandom } from '../data/kotlinRandom.ts'
import kotlinRandomRaw from '../test/golden/kotlinRandom.json?raw'
import { containsCjk, looksMalay, needsTranslation } from '../domain/chineseText.ts'
import { ALL_CUISINES, ALL_MEALS, allChoices, SPECIFIC_CUISINES, suits } from '../domain/cuisine.ts'
import { dayPartAt } from '../domain/dayPart.ts'
import type { LatLng, Place, SearchChoice } from '../domain/model.ts'
import { isClosed, placeStatus, open, type OpenStatus } from '../domain/openingHours.ts'
import { DEFAULT_KM } from '../domain/radius.ts'
import { pick, weight } from '../domain/randomPicker.ts'
import { isEatery } from '../domain/ranking.ts'
import { rankedFor } from '../domain/searchConfig.ts'
import { epochFromLocal, localFields, type ZonedTime } from '../domain/time.ts'
import { findTraditional, flush, KL, seeded } from '../test/helpers.ts'
import { MIN_PLACES } from '../app/state.ts'
import {
  allDemoPlaces,
  DEMO_FAKE_DELAY_MS,
  DEMO_REFERENCE_CENTER,
  demoChineseName,
  demoNameTranslator,
  DemoPlacesClient,
  demoReachableCount,
  searchDemoPlaces,
} from './demoPlaces.ts'

const CENTER: LatLng = { latitude: 3.144, longitude: 101.6979 }
const RADIUS = DEFAULT_KM * 1000
const MINUTE = 60_000

/** 2026 年 10 月 5 日（星期一）起第 dayOffset 天的 hour:minute，吉隆坡。 */
function at(hour: number, minute = 0, dayOffset = 0): ZonedTime {
  return { epochMillis: epochFromLocal(KL, 2026, 10, 5 + dayOffset, hour, minute), zone: KL }
}
const MONDAY = at(0)
const WEEK: ZonedTime[] = Array.from({ length: 7 * 24 * 4 }, (_, i) => ({ epochMillis: MONDAY.epochMillis + i * 15 * MINUTE, zone: KL }))

const NOW = { epochMillis: epochFromLocal(KL, 2026, 10, 6, 12, 35), zone: KL }
const ALL = allDemoPlaces(CENTER, NOW)
const key = (c: SearchChoice) => `${c.cuisine}/${c.meal}`

function search(cuisine: SearchChoice['cuisine'], meal: SearchChoice['meal'], km = 1.5): Place[] {
  return searchDemoPlaces({ cuisine, meal }, CENTER, km * 1000, NOW)
}

function named(now: ZonedTime, name: string): Place {
  const found = allDemoPlaces(CENTER, now).filter((p) => p.name === name)
  expect(found, name).toHaveLength(1)
  return found[0] as Place
}

const reachable = (choice: SearchChoice, now: ZonedTime) => demoReachableCount(choice, DEMO_REFERENCE_CENTER, RADIUS, now)
const playable = (choice: SearchChoice, now: ZonedTime) => reachable(choice, now) >= MIN_PLACES

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('二十八、🧪 演示模式：营业时间（DemoHoursTest）', () => {
  it('DEMO-01 一整个星期每 15 分钟检查一次：1.5 公里内任何时候都至少有 5 家演示店营业中', () => {
    for (const now of WEEK) {
      const near = searchDemoPlaces({ cuisine: 'ANY', meal: 'ANY' }, CENTER, RADIUS, now)
      const openCount = near.filter((p) => placeStatus(p, now).kind === 'OPEN').length
      expect(openCount, new Date(now.epochMillis).toISOString()).toBeGreaterThanOrEqual(5)
    }
  })

  it('DEMO-02 凌晨 2 点：24 小时嘛嘛档开着；港仔茶餐厅、开心云吞面在休息、今天早上开；休息时给下次开门时间、营业时给下次关门时间', () => {
    const twoAm = at(2)
    const mamak = named(twoAm, 'Mamak Roti & Mee Goreng 24 Jam')
    expect(mamak.openNow).toBe(true)
    expect(placeStatus(mamak, twoAm)).toEqual(open(null, true))
    for (const name of ['港仔茶餐厅', '开心云吞面']) {
      const shop = named(twoAm, name)
      expect(shop.openNow, name).toBe(false)
      const status = placeStatus(shop, twoAm) as Extract<OpenStatus, { kind: 'CLOSED' }>
      expect(status.kind).toBe('CLOSED')
      expect(localFields(status.opensAt?.epochMillis ?? 0, KL).day).toBe(5)
    }
    const wantan = named(twoAm, '开心云吞面').openingHours
    expect(wantan?.nextOpenMillis).toBe(at(7).epochMillis)
    expect(wantan?.nextCloseMillis).toBeNull()
    expect(named(at(23), '大排档海鲜楼').openingHours?.nextCloseMillis).toBe(at(2, 0, 1).epochMillis)
  })

  it('DEMO-03 截图时刻的状态合理；至少 2 家没有营业时间；Pak Din 星期五休息，星期四下午显示星期六开', () => {
    expect(named(at(7, 45), '开心云吞面').openNow).toBe(true)
    expect(named(at(7, 45), '麻辣火锅坊').openNow).toBe(false)
    expect(named(at(12, 35), '麻辣火锅坊').openNow).toBe(false)
    expect(named(at(12, 35), '阿明海南鸡饭').openNow).toBe(true)
    expect(named(at(15, 30), '港仔茶餐厅').openNow).toBe(true)
    expect(named(at(15, 30), 'Kedai Mee Rebus Pak Din').openNow).toBe(false)
    expect(named(at(19, 30), '麻辣火锅坊').openNow).toBe(true)
    expect(named(at(19, 30), '阿明海南鸡饭').openNow).toBe(true)
    expect(allDemoPlaces(CENTER, at(12)).filter((p) => p.openNow == null).length).toBeGreaterThanOrEqual(2)
    const thursday = at(15, 0, 3)
    const pakDin = placeStatus(named(thursday, 'Kedai Mee Rebus Pak Din'), thursday) as Extract<OpenStatus, { kind: 'CLOSED' }>
    expect(pakDin.kind).toBe('CLOSED')
    expect(new Date(localFields(pakDin.opensAt?.epochMillis ?? 0, KL).epochDay * 86_400_000).getUTCDay()).toBe(6)
  })

  it('DEMO-04 演示店图案对得上食物：首尔拌饭是 🍚、西贡河粉是 🍜，没有 🥖', () => {
    const all = allDemoPlaces(CENTER, at(12))
    expect(all.find((p) => p.name === 'Seoul Bibimbap Corner')?.placeholderEmoji).toBe('🍚')
    expect(all.find((p) => p.name === 'Pho Saigon Corner')?.placeholderEmoji).toBe('🍜')
    expect(all.some((p) => p.placeholderEmoji === '🥖')).toBe(false)
  })
})

describe('二十八、🧪 演示模式：假店（DemoPlacesTest）', () => {
  it('DEMO-05 30–40 家演示店，id 都以 demo_ 开头且不重复；中文名 ≥ 4、马来文名 ≥ 3、英文名 ≥ 5；店名和类型名都没有繁体字', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(30)
    expect(ALL.length).toBeLessThanOrEqual(40)
    expect(ALL.every((p) => p.id.startsWith('demo_'))).toBe(true)
    expect(new Set(ALL.map((p) => p.id)).size).toBe(ALL.length)
    const chinese = ALL.filter((p) => containsCjk(p.name)).length
    const malay = ALL.filter((p) => !containsCjk(p.name) && looksMalay(p.name)).length
    const english = ALL.length - chinese - malay
    expect(chinese).toBeGreaterThanOrEqual(4)
    expect(malay).toBeGreaterThanOrEqual(3)
    expect(english).toBeGreaterThanOrEqual(5)
    expect(ALL.every((p) => findTraditional(p.name + (p.primaryTypeDisplayName ?? '')).length === 0)).toBe(true)
  })

  it('DEMO-06 位置固定、围着用户摆：1.5 公里内至少 30 家，全部在 140–2,510 米；5 公里比 1.5 公里多店；换到槟城，同样的店在同样的距离（误差 10 米内）', () => {
    expect(allDemoPlaces(CENTER, NOW)).toEqual(ALL)
    expect(ALL.filter((p) => p.distanceMeters <= 1500).length).toBeGreaterThanOrEqual(30)
    expect(ALL.every((p) => p.distanceMeters >= 140 && p.distanceMeters <= 2510)).toBe(true)
    expect(search('ANY', 'ANY', 5).length).toBeGreaterThan(search('ANY', 'ANY').length)
    const penang = allDemoPlaces({ latitude: 5.4141, longitude: 100.3288 }, NOW)
    expect(penang.map((p) => p.name)).toEqual(ALL.map((p) => p.name))
    ALL.forEach((kl, i) => expect(Math.abs(kl.distanceMeters - (penang[i] as Place).distanceMeters)).toBeLessThanOrEqual(10))
  })

  it('DEMO-07 每家演示店地址都不一样、都不是空的', () => {
    const addresses = ALL.map((p) => p.address)
    expect(addresses.every((a) => a != null && a.trim() !== '')).toBe(true)
    expect(new Set(addresses).size).toBe(ALL.length)
  })

  it('DEMO-08 饭和面搜到的店不一样；日本餐搜到的都是日本餐厅或拉面馆；12 个菜系在 5 公里内都至少有 1 家', () => {
    const rice = new Set(search('ANY', 'RICE').map((p) => p.id))
    const noodle = new Set(search('ANY', 'NOODLE').map((p) => p.id))
    expect(rice).not.toEqual(noodle)
    const japanese = search('JAPANESE', 'ANY', 5)
    expect(japanese.length).toBeGreaterThan(0)
    expect(japanese.every((p) => p.types.includes('japanese_restaurant') || p.primaryType === 'ramen_restaurant')).toBe(true)
    for (const cuisine of SPECIFIC_CUISINES) expect(search(cuisine, 'ANY', 5).length, cuisine).toBeGreaterThan(0)
  })

  it('DEMO-09 13 × 3 = 39 个组合在默认 1.5 公里、经过菜系过滤和排名后都至少 2 家；只标 restaurant 的嘛嘛档照样留在嘛嘛档结果里', () => {
    const every = ALL_CUISINES.flatMap((cuisine) => ALL_MEALS.map((meal) => ({ cuisine, meal })))
    expect(every).toHaveLength(39)
    for (const choice of every) {
      const shown = rankedFor(choice, searchDemoPlaces(choice, CENTER, RADIUS, NOW))
      expect(shown.length, key(choice)).toBeGreaterThanOrEqual(2)
    }
    const mamak = rankedFor({ cuisine: 'INDIAN_MAMAK', meal: 'ANY' }, search('INDIAN_MAMAK', 'ANY'))
    expect(mamak.some((p) => p.name === 'Mamak Roti & Mee Goreng 24 Jam')).toBe(true)
  })

  it('DEMO-10 随便挑摇 2,000 次，每个结果在演示店里都至少有一家', () => {
    const random = seeded(7)
    for (let i = 0; i < 2000; i++) {
      const choice = pick(random)
      expect(searchDemoPlaces(choice, CENTER, RADIUS, NOW).length, key(choice)).toBeGreaterThan(0)
    }
  })

  it('DEMO-11 英文/马来文演示店都有内置中文名（简体），内置翻译器照它翻；中文店名没有；类型名本来就是中文；Sakura Ramen House = 樱花拉面屋', async () => {
    for (const place of ALL) {
      const chinese = demoChineseName(place.name)
      if (containsCjk(place.name)) expect(chinese, place.name).toBeNull()
      else {
        expect(containsCjk(chinese), place.name).toBe(true)
        expect(findTraditional(chinese ?? '')).toEqual([])
        expect(await demoNameTranslator.translateToChinese(place.name)).toBe(chinese)
      }
      expect(needsTranslation(place.primaryTypeDisplayName)).toBe(false)
    }
    expect(demoChineseName('Sakura Ramen House')).toBe('樱花拉面屋')
  })

  it('DEMO-12 中餐+饭 ≥ 4 家、越南餐刚好 2 家、营业中/休息中/不明三种都有、有 4.8★/95 条和 4.5★/1,240 条', () => {
    expect(search('CHINESE', 'RICE').length).toBeGreaterThanOrEqual(4)
    expect(search('VIETNAMESE', 'ANY')).toHaveLength(2)
    expect(new Set(ALL.map((p) => p.openNow))).toEqual(new Set([true, false, null]))
    expect(ALL.some((p) => p.rating === 4.8 && p.userRatingCount === 95)).toBe(true)
    expect(ALL.some((p) => p.rating === 4.5 && p.userRatingCount === 1240)).toBe(true)
  })

  it('DEMO-13 演示店都是吃饭的地方，没有 Google 照片和地图链接，每家有自己的 emoji', () => {
    for (const place of ALL) {
      expect(isEatery(place.types, place.primaryType), place.name).toBe(true)
      expect(place.photoName).toBeNull()
      expect(place.googleMapsUri).toBeNull()
      expect(place.placeholderEmoji ?? '').not.toBe('')
    }
  })

  it('DEMO-14 演示搜索至少等 600 毫秒（看得到加载画面）后才给结果，不连网、没有失败', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const client = new DemoPlacesClient({ now: () => NOW })
      let done: Awaited<ReturnType<DemoPlacesClient['search']>> | null = null
      void client.search({ cuisine: 'ANY', meal: 'ANY' }, CENTER, 1500).then((r) => (done = r))
      await vi.advanceTimersByTimeAsync(DEMO_FAKE_DELAY_MS - 1)
      expect(done).toBeNull()
      await vi.advanceTimersByTimeAsync(1)
      await flush()
      expect(done).not.toBeNull()
      expect(done!.places).toEqual(search('ANY', 'ANY'))
      expect(done!.failures).toEqual([])
      expect(DEMO_FAKE_DELAY_MS).toBe(600)
      expect(await client.photoUri()).toBeNull()
      // 中途取消：不给结果。
      const controller = new AbortController()
      const cancelled = client.search({ cuisine: 'ANY', meal: 'ANY' }, CENTER, 1500, controller.signal)
      controller.abort()
      await expect(cancelled).rejects.toMatchObject({ name: 'CancelledError' })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('二十八、🧪 演示模式：可玩性（DemoPlayabilityTest）', () => {
  it('DEMO-15 一星期每 15 分钟：按随便挑的时段权重，摇到的组合有 2 家以上能去的机会都 ≥ 80%', () => {
    for (const now of WEEK) {
      const part = dayPartAt(now.epochMillis, KL)
      const total = SPECIFIC_CUISINES.reduce((sum, c) => sum + weight(part, c), 0)
      let share = 0
      for (const cuisine of SPECIFIC_CUISINES) {
        const meals = ALL_MEALS.filter((m) => suits(cuisine, m))
        const ok = meals.filter((meal) => playable({ cuisine, meal }, now)).length
        share += ((weight(part, cuisine) / total) * ok) / meals.length
      }
      expect(share, new Date(now.epochMillis).toISOString()).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('DEMO-16 每个时刻，那个时段权重 ≥ 2 的菜系配饭/面/都可以（合理的）永远至少 2 家能去', () => {
    for (const now of WEEK) {
      const part = dayPartAt(now.epochMillis, KL)
      for (const cuisine of SPECIFIC_CUISINES.filter((c) => weight(part, c) >= 2)) {
        for (const meal of ALL_MEALS.filter((m) => suits(cuisine, m))) {
          expect(playable({ cuisine, meal }, now), `${cuisine}/${meal} ${new Date(now.epochMillis).toISOString()}`).toBe(true)
        }
      }
    }
  })

  it('DEMO-17 以前掉进救援卡的例子现在都能玩', () => {
    const cases: [ZonedTime, SearchChoice][] = [
      [at(2), { cuisine: 'HOT_POT', meal: 'NOODLE' }],
      [at(2), { cuisine: 'SEAFOOD', meal: 'ANY' }],
      [at(2, 30), { cuisine: 'THAI', meal: 'RICE' }],
      [at(19, 3), { cuisine: 'KOREAN', meal: 'RICE' }],
      [at(19), { cuisine: 'HOT_POT', meal: 'ANY' }],
      [at(19), { cuisine: 'SEAFOOD', meal: 'RICE' }],
      [at(16, 30), { cuisine: 'HK_DIM_SUM', meal: 'ANY' }],
      [at(16, 30), { cuisine: 'WESTERN', meal: 'NOODLE' }],
      [at(5), { cuisine: 'HK_DIM_SUM', meal: 'RICE' }],
      [at(5), { cuisine: 'MALAY', meal: 'NOODLE' }],
      [at(5), { cuisine: 'CHINESE', meal: 'RICE' }],
      [at(20, 58), { cuisine: 'CHINESE', meal: 'RICE' }],
    ]
    for (const [now, choice] of cases) expect(playable(choice, now), `${key(choice)} ${reachable(choice, now)}`).toBe(true)
  })

  it('DEMO-18 加上「只摇能玩的」规则后，在 9 个时刻各摇 300 次（每次排除一个菜系）都只摇到能玩、而且不是被排除的菜系', () => {
    const random = seeded(2026)
    for (const now of [at(2), at(4, 45), at(5), at(7, 45), at(10), at(12, 35), at(15, 30), at(19, 3), at(20, 58)]) {
      const dayPart = dayPartAt(now.epochMillis, KL)
      let previous: SearchChoice | null = null
      for (let i = 0; i < 300; i++) {
        const excluded = SPECIFIC_CUISINES[i % SPECIFIC_CUISINES.length]!
        const p: SearchChoice = pick(random, { exclude: previous, dayPart, excludeCuisine: excluded, playable: (c) => playable(c, now) })
        expect(playable(p, now) && p.cuisine !== excluded, key(p)).toBe(true)
        previous = p
      }
    }
  })
})

describe('网页版另外要加的：演示数据和安卓一模一样', () => {
  it('WEB-09 演示店的位置、地址、营业时段、每个组合找到哪些店、1.5 公里内的排名都和 golden/demoPlaces.json 一样；一星期每 15 分钟 × 39 个组合「能去几家」和 golden/demoReachable.json 一样', () => {
    const golden = JSON.parse(demoPlacesRaw) as {
      referenceCenter: [number, number]
      at: string
      places: {
        id: string
        name: string
        chineseName: string | null
        address: string
        lat: number
        lng: number
        distanceMeters: number
        rating: number | null
        reviews: number | null
        price: [number, number] | null
        openNow: boolean | null
        businessStatus: string
        primaryType: string
        typeName: string
        types: string[]
        emoji: string
        periods: [number, number | null][] | null
        nextOpenMillis: number | null
        nextCloseMillis: number | null
      }[]
      serves: Record<string, string[]>
      rankedAt1500: Record<string, string[]>
    }
    const center = { latitude: golden.referenceCenter[0], longitude: golden.referenceCenter[1] }
    expect(center).toEqual(DEMO_REFERENCE_CENTER)
    // "2026-10-05T12:35+08:00[Asia/Kuala_Lumpur]"
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(golden.at)!
    const when: ZonedTime = { epochMillis: epochFromLocal(KL, +m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!), zone: KL }
    const mine = allDemoPlaces(center, when)
    expect(mine).toHaveLength(golden.places.length)
    golden.places.forEach((g, i) => {
      const p = mine[i] as Place
      expect(p.id).toBe(g.id)
      expect(p.name).toBe(g.name)
      expect(demoChineseName(p.name)).toBe(g.chineseName)
      expect(p.address).toBe(g.address)
      expect(p.location.latitude).toBeCloseTo(g.lat, 12)
      expect(p.location.longitude).toBeCloseTo(g.lng, 12)
      expect(p.distanceMeters).toBeCloseTo(g.distanceMeters, 6)
      expect(p.rating).toBe(g.rating ?? null)
      expect(p.userRatingCount).toBe(g.reviews ?? null)
      expect(p.priceRange ? [p.priceRange.start?.units, p.priceRange.end?.units] : null).toEqual(g.price ?? null)
      expect(p.openNow, g.id).toBe(g.openNow ?? null)
      expect(p.businessStatus).toBe(g.businessStatus)
      expect(p.primaryType).toBe(g.primaryType)
      expect(p.primaryTypeDisplayName).toBe(g.typeName)
      expect(p.types).toEqual(g.types)
      expect(p.placeholderEmoji).toBe(g.emoji)
      expect(p.openingHours?.periods ?? null).toEqual(g.periods ?? null)
      expect(p.openingHours?.nextOpenMillis ?? null, g.id).toBe(g.nextOpenMillis ?? null)
      expect(p.openingHours?.nextCloseMillis ?? null, g.id).toBe(g.nextCloseMillis ?? null)
    })
    for (const [k, ids] of Object.entries(golden.serves)) {
      const [cuisine, meal] = k.split('/') as [SearchChoice['cuisine'], SearchChoice['meal']]
      expect(searchDemoPlaces({ cuisine, meal }, center, 1e9, when).map((p) => p.id), k).toEqual(ids)
    }
    expect(Object.keys(golden.rankedAt1500)).toHaveLength(39)
    for (const [k, ids] of Object.entries(golden.rankedAt1500)) {
      const [cuisine, meal] = k.split('/') as [SearchChoice['cuisine'], SearchChoice['meal']]
      const choice = { cuisine, meal }
      expect(rankedFor(choice, searchDemoPlaces(choice, center, 1500, when)).map((p) => p.id), k).toEqual(ids)
    }

    // 假店摆放 = KotlinRandom(20261003) 依次抽方位、距离、门牌、街号（和安卓一样）。
    const draws = (JSON.parse(kotlinRandomRaw) as { demoDraws: { bearingDeg: number; meters: number; unused: number; street: number }[] }).demoDraws
    const r = new KotlinRandom(20261003n)
    DEMO_SHOPS.forEach((shop, i) => {
      const g = draws[i]!
      expect(r.nextDouble(0, 360)).toBe(g.bearingDeg)
      expect(shop.near ? r.nextDouble(150, 1400) : r.nextDouble(1600, 2500)).toBe(g.meters)
      expect(r.nextInt(1, 99)).toBe(g.unused)
      expect(r.nextInt(1, 20)).toBe(g.street)
      expect(shop.placement).toMatchObject({ bearingDeg: g.bearingDeg, meters: g.meters, street: g.street })
    })

    // 一星期 × 39 个组合能去几家（字母编码：0–9，再来 A = 10…）。
    const reach = JSON.parse(demoReachableRaw) as { start: string; stepMinutes: number; steps: number; radiusMeters: number; counts: Record<string, string> }
    expect(reach.steps).toBe(672)
    const s = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(reach.start)!
    const start = epochFromLocal(KL, +s[1]!, +s[2]!, +s[3]!, +s[4]!, +s[5]!)
    const decode = (c: string) => (c >= '0' && c <= '9' ? Number(c) : c.charCodeAt(0) - 65 + 10)
    let checked = 0
    for (const choice of allChoices()) {
      const counts = reach.counts[key(choice)]!
      expect(counts, key(choice)).toHaveLength(reach.steps)
      for (let step = 0; step < reach.steps; step++) {
        const now = { epochMillis: start + step * reach.stepMinutes * MINUTE, zone: KL }
        const expected = decode(counts[step]!)
        const actual = demoReachableCount(choice, DEMO_REFERENCE_CENTER, reach.radiusMeters, now)
        if (actual !== expected) expect(actual, `${key(choice)} step ${step}`).toBe(expected)
        checked++
      }
    }
    expect(checked).toBe(39 * 672)
    expect(isClosed(placeStatus(named(at(2), '开心云吞面'), at(2)))).toBe(true)
  })
})
