import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_KM, largerRadius, QUICK_KM, snapRadius } from '../domain/radius.ts'
import { visit } from '../domain/visits.ts'
import { StoredGameStore } from './gameStore.ts'
import { StoredSettings } from './settings.ts'
import { BrowserStore, browserLocalStore, isWritable, MemoryStore, readBoolean } from './storage.ts'
import { StoredVisitStore, VISITS_KEY } from './visitStore.ts'

afterEach(() => {
  try {
    window.localStorage.clear()
  } catch {
    // 算了
  }
})

describe('二十九、⚙️ 设置与记住的偏好', () => {
  it('SETTINGS-01 「只看营业中」第一次打开是开的；关掉后重新打开还是关的；再打开也记得', () => {
    const disk = new MemoryStore()
    expect(new StoredSettings(disk).openNowOnly).toBe(true)
    new StoredSettings(disk).openNowOnly = false
    expect(new StoredSettings(disk).openNowOnly).toBe(false)
    new StoredSettings(disk).openNowOnly = true
    expect(new StoredSettings(disk).openNowOnly).toBe(true)
  })

  it('SETTINGS-02 范围默认 1.5 公里；改成 0.5 公里、开了演示模式，重新打开都记得', () => {
    const disk = new MemoryStore()
    const prefs = new StoredSettings(disk)
    expect(prefs.radiusKm).toBe(DEFAULT_KM)
    prefs.radiusKm = 0.5
    prefs.demoMode = true
    expect(new StoredSettings(disk).radiusKm).toBe(0.5)
    expect(new StoredSettings(disk).demoMode).toBe(true)
    // 存的时候夹成 0.5 的倍数、0.5–5。
    prefs.radiusKm = 7.3
    expect(new StoredSettings(disk).radiusKm).toBe(5)
    disk.set('meishi.radius_km', 'abc')
    expect(new StoredSettings(disk).radiusKm).toBe(DEFAULT_KM)
  })

  it('SETTINGS-03 吃过的记录只存店编号、菜系、时间；读得回来；清空后存储里什么都不剩；坏数据当空的', () => {
    const disk = new MemoryStore()
    const store = new StoredVisitStore(disk)
    expect(store.load()).toEqual([])
    const visits = [visit('ChIJabc', 'CHINESE', 1000), visit('demo_02', null, 900)]
    store.save(visits)
    expect(new StoredVisitStore(disk).load()).toEqual(visits)
    const saved = disk.get(VISITS_KEY) ?? ''
    expect(/name|address|photo/.test(saved)).toBe(false)
    store.save([])
    expect(disk.keys()).toEqual([])
    disk.set(VISITS_KEY, '{broken')
    expect(new StoredVisitStore(disk).load()).toEqual([])
    disk.set(VISITS_KEY, '[{"placeId":1}]')
    expect(new StoredVisitStore(disk).load()).toEqual([])
  })

  it('SETTINGS-04 四个范围按钮是 0.5、1.5、3、5 公里；扩大：0.5→1、1.5→3、3→5、4.5→5、5→没有', () => {
    expect(QUICK_KM).toEqual([0.5, 1.5, 3, 5])
    expect(largerRadius(0.5)).toBe(1)
    expect(largerRadius(1.5)).toBe(3)
    expect(largerRadius(3)).toBe(5)
    expect(largerRadius(4.5)).toBe(5)
    expect(largerRadius(5)).toBeNull()
    expect(snapRadius(1.74)).toBe(1.5)
    expect(snapRadius(1.75)).toBe(2)
    expect(snapRadius(0.1)).toBe(0.5)
  })

  it('密钥只存清理过的、只存在本机存储；清除就删掉这个键', () => {
    const disk = new MemoryStore()
    const prefs = new StoredSettings(disk)
    expect(prefs.apiKeySource()).toBe('NONE')
    prefs.apiKeyOverride = '  ｔｅｓｔ-key​ '
    expect(disk.get('meishi.places_api_key')).toBe('test-key')
    expect(prefs.apiKeySource()).toBe('IN_APP')
    expect(prefs.effectiveApiKey()).toBe('test-key')
    prefs.apiKeyOverride = ''
    expect(disk.get('meishi.places_api_key')).toBeNull()
  })

  it('游戏的小东西：人数、头像名（空的删掉）、战绩、饭签种子（64 位、存成字符串）、摇一摇、这一餐', () => {
    const disk = new MemoryStore()
    const games = new StoredGameStore(disk)
    expect(games.tablePlayers).toBe(0)
    games.tablePlayers = 5
    games.setAvatarName('PANDA', '小玲')
    games.dayStats = { day: '2026-10-06', wins: 2, losses: 1, ties: 0 }
    games.fortuneDay = '2026-10-06'
    games.shakeEnabled = false
    games.mealJson = '{"x":1}'
    const again = new StoredGameStore(disk)
    expect(again.tablePlayers).toBe(5)
    expect(again.avatarName('PANDA')).toBe('小玲')
    expect(again.avatarName('TIGER')).toBe('')
    expect(again.dayStats).toEqual({ day: '2026-10-06', wins: 2, losses: 1, ties: 0 })
    expect(again.fortuneDay).toBe('2026-10-06')
    expect(again.shakeEnabled).toBe(false)
    expect(again.mealJson).toBe('{"x":1}')
    const seed = games.phoneSeed
    expect(typeof seed).toBe('bigint')
    expect(new StoredGameStore(disk).phoneSeed).toBe(seed)
    expect(disk.get('meishi.phone_seed')).toBe(seed.toString())
    games.setAvatarName('PANDA', '')
    expect(disk.get('meishi.avatar_name_PANDA')).toBeNull()
    games.mealJson = null
    expect(disk.get('meishi.meal_decision')).toBeNull()
    disk.set('meishi.day_stats', 'not json')
    expect(new StoredGameStore(disk).dayStats.wins).toBe(0)
  })

  it('WEB-04 localStorage 用不了（抛错、隐私模式）：读到的当没有、写回 false，网页不会崩', () => {
    const throwing = new BrowserStore(() => {
      throw new Error('SecurityError')
    })
    expect(throwing.get('x')).toBeNull()
    expect(throwing.set('x', '1')).toBe(false)
    expect(() => throwing.remove('x')).not.toThrow()
    expect(throwing.keys()).toEqual([])
    expect(isWritable(throwing)).toBe(false)
    expect(readBoolean(throwing, 'x', true)).toBe(true)
    // 存满了：setItem 抛错。
    const full = new BrowserStore(() => ({ ...window.localStorage, setItem: () => { throw new Error('QuotaExceededError') }, getItem: () => null, removeItem: () => undefined, key: () => null, length: 0, clear: () => undefined }) as Storage)
    expect(full.set('x', '1')).toBe(false)
    // 正常的浏览器（jsdom）写得进去。
    const local = browserLocalStore()
    expect(isWritable(local)).toBe(true)
    expect(local.set('meishi.a', 'b')).toBe(true)
    expect(local.get('meishi.a')).toBe('b')
  })
})
