/**
 * 游戏记在本机的小东西（安卓 data/GameStore.kt）：饭桌上次几个人、头像改的名字、今天的猜拳战绩、
 * 这台设备的饭签随机数和今天抽过没有、摇一摇开关、这一餐的决定（真实 / 演示各一份）。只存在这个浏览器。
 */
import type { AvatarId } from '../domain/model.ts'
import { randomSeed } from '../domain/random.ts'
import { EMPTY_DAY_STATS, type DayStats } from '../domain/taskDeck.ts'
import { KEY_PREFIX, readBoolean, readInt, type KeyValueStore } from './storage.ts'

export interface GameStore {
  /** 「几个人？」上次玩饭桌模式时的人数；0 = 没玩过。 */
  tablePlayers: number
  avatarName(avatar: AvatarId): string
  setAvatarName(avatar: AvatarId, name: string): void
  dayStats: DayStats
  /** 这台设备自己的随机数（64 位）：饭签和别人的不一样。 */
  readonly phoneSeed: bigint
  /** 今天抽过饭签的日期（ISO），没抽过是 ""。 */
  fortuneDay: string
  shakeEnabled: boolean
  /** 这一餐的决定（JSON，一餐 3 小时内），没有是 null。 */
  mealJson: string | null
  /** 演示店的这一餐，分开放：用假店玩永远碰不到真的一餐。 */
  demoMealJson: string | null
}

export class MemoryGameStore implements GameStore {
  tablePlayers = 0
  private readonly names = new Map<AvatarId, string>()
  dayStats: DayStats = EMPTY_DAY_STATS
  readonly phoneSeed: bigint
  fortuneDay = ''
  shakeEnabled = true
  mealJson: string | null = null
  demoMealJson: string | null = null

  constructor(phoneSeed: bigint | number = 20261004n) {
    this.phoneSeed = BigInt(phoneSeed)
  }

  avatarName(avatar: AvatarId): string {
    return this.names.get(avatar) ?? ''
  }

  setAvatarName(avatar: AvatarId, name: string): void {
    this.names.set(avatar, name)
  }
}

export const GAME_KEYS = {
  tablePlayers: KEY_PREFIX + 'table_players',
  avatarPrefix: KEY_PREFIX + 'avatar_name_',
  dayStats: KEY_PREFIX + 'day_stats',
  phoneSeed: KEY_PREFIX + 'phone_seed',
  fortuneDay: KEY_PREFIX + 'fortune_day',
  shake: KEY_PREFIX + 'shake_enabled',
  meal: KEY_PREFIX + 'meal_decision',
  demoMeal: KEY_PREFIX + 'meal_decision_demo',
} as const

function parseDayStats(raw: string | null): DayStats {
  if (!raw) return EMPTY_DAY_STATS
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value == null) return EMPTY_DAY_STATS
    const { day, wins, losses, ties } = value as Record<string, unknown>
    const count = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0)
    return { day: typeof day === 'string' ? day : '', wins: count(wins), losses: count(losses), ties: count(ties) }
  } catch {
    return EMPTY_DAY_STATS
  }
}

export class StoredGameStore implements GameStore {
  private readonly store: KeyValueStore
  private seed: bigint | null = null

  constructor(store: KeyValueStore) {
    this.store = store
  }

  get tablePlayers(): number {
    return readInt(this.store, GAME_KEYS.tablePlayers, 0)
  }

  set tablePlayers(value: number) {
    this.store.set(GAME_KEYS.tablePlayers, String(value))
  }

  avatarName(avatar: AvatarId): string {
    return this.store.get(GAME_KEYS.avatarPrefix + avatar) ?? ''
  }

  setAvatarName(avatar: AvatarId, name: string): void {
    if (name === '') this.store.remove(GAME_KEYS.avatarPrefix + avatar)
    else this.store.set(GAME_KEYS.avatarPrefix + avatar, name)
  }

  get dayStats(): DayStats {
    return parseDayStats(this.store.get(GAME_KEYS.dayStats))
  }

  set dayStats(value: DayStats) {
    this.store.set(GAME_KEYS.dayStats, JSON.stringify(value))
  }

  /** 第一次用时用 crypto 产生，存成字符串；存不进去也照样用（这次打开网页内不变）。 */
  get phoneSeed(): bigint {
    if (this.seed != null) return this.seed
    const raw = this.store.get(GAME_KEYS.phoneSeed)
    if (raw != null && /^-?\d+$/.test(raw)) {
      this.seed = BigInt.asIntN(64, BigInt(raw))
      return this.seed
    }
    const seed = randomSeed()
    this.store.set(GAME_KEYS.phoneSeed, seed.toString())
    this.seed = seed
    return seed
  }

  get fortuneDay(): string {
    return this.store.get(GAME_KEYS.fortuneDay) ?? ''
  }

  set fortuneDay(value: string) {
    this.store.set(GAME_KEYS.fortuneDay, value)
  }

  get shakeEnabled(): boolean {
    return readBoolean(this.store, GAME_KEYS.shake, true)
  }

  set shakeEnabled(value: boolean) {
    this.store.set(GAME_KEYS.shake, String(value))
  }

  get mealJson(): string | null {
    return this.store.get(GAME_KEYS.meal)
  }

  set mealJson(value: string | null) {
    if (value == null) this.store.remove(GAME_KEYS.meal)
    else this.store.set(GAME_KEYS.meal, value)
  }

  get demoMealJson(): string | null {
    return this.store.get(GAME_KEYS.demoMeal)
  }

  set demoMealJson(value: string | null) {
    if (value == null) this.store.remove(GAME_KEYS.demoMeal)
    else this.store.set(GAME_KEYS.demoMeal, value)
  }
}
