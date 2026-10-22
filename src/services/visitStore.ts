/**
 * 吃过的记录存在哪（安卓 data/Prefs.kt 的 VisitStore）：localStorage 的「meishi.visits_v1」，
 * JSON 数组 [{placeId, cuisine, atMillis}]；空了就删掉这个键；读坏了当空的。
 */
import { decodeVisits, encodeVisits, type Visit } from '../domain/visits.ts'
import { KEY_PREFIX, type KeyValueStore } from './storage.ts'

export interface VisitStore {
  load(): Visit[]
  save(visits: readonly Visit[]): void
}

export const VISITS_KEY = KEY_PREFIX + 'visits_v1'

export class MemoryVisitStore implements VisitStore {
  private visits: Visit[]

  constructor(visits: readonly Visit[] = []) {
    this.visits = [...visits]
  }

  load(): Visit[] {
    return [...this.visits]
  }

  save(visits: readonly Visit[]): void {
    this.visits = [...visits]
  }
}

export class StoredVisitStore implements VisitStore {
  private readonly store: KeyValueStore

  constructor(store: KeyValueStore) {
    this.store = store
  }

  load(): Visit[] {
    return decodeVisits(this.store.get(VISITS_KEY))
  }

  save(visits: readonly Visit[]): void {
    if (visits.length === 0) this.store.remove(VISITS_KEY)
    else this.store.set(VISITS_KEY, encodeVisits(visits))
  }
}
