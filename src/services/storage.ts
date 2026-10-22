/**
 * 本机存储的安全封装：localStorage / sessionStorage 读写都包 try/catch。
 * 隐私模式、被封锁、存满了 → 读到的当没有、写不进去回传 false，网页不会崩。
 * 键名一律加前缀「meishi.」（安卓的档案名 + 键名对照见 功能清单.md 第二十五节）。
 */

/** 最小的键值存储（localStorage、sessionStorage、测试用的内存版都一样用）。 */
export interface KeyValueStore {
  get(key: string): string | null
  /** 写进去了而且读回来一样 → true；写不进去（隐私模式、存满）→ false。 */
  set(key: string, value: string): boolean
  remove(key: string): void
  keys(): string[]
}

export const KEY_PREFIX = 'meishi.'

/** 内存版（测试用；也是浏览器存储完全用不了时的后备）。 */
export class MemoryStore implements KeyValueStore {
  readonly values = new Map<string, string>()
  /** 测试用：假装存储坏了（写入一律失败）。 */
  broken = false

  get(key: string): string | null {
    if (this.broken) return null
    return this.values.get(key) ?? null
  }

  set(key: string, value: string): boolean {
    if (this.broken) return false
    this.values.set(key, value)
    return true
  }

  remove(key: string): void {
    this.values.delete(key)
  }

  keys(): string[] {
    return [...this.values.keys()]
  }
}

/** 把浏览器的 Storage（localStorage / sessionStorage）包起来，所有操作都不会抛错。 */
export class BrowserStore implements KeyValueStore {
  private readonly storage: () => Storage | null

  constructor(storage: () => Storage | null) {
    this.storage = storage
  }

  private target(): Storage | null {
    try {
      return this.storage()
    } catch {
      return null
    }
  }

  get(key: string): string | null {
    try {
      return this.target()?.getItem(key) ?? null
    } catch {
      return null
    }
  }

  set(key: string, value: string): boolean {
    try {
      const storage = this.target()
      if (!storage) return false
      storage.setItem(key, value)
      return storage.getItem(key) === value
    } catch {
      return false
    }
  }

  remove(key: string): void {
    try {
      this.target()?.removeItem(key)
    } catch {
      // 用不了就算了
    }
  }

  keys(): string[] {
    try {
      const storage = this.target()
      if (!storage) return []
      const keys: string[] = []
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (key != null) keys.push(key)
      }
      return keys
    } catch {
      return []
    }
  }
}

/** 这个浏览器的 localStorage（不在浏览器里、或被封锁时，每次读写都安全失败）。 */
export function browserLocalStore(): KeyValueStore {
  return new BrowserStore(() => (typeof window === 'undefined' ? null : window.localStorage))
}

/** 这个分页的 sessionStorage（重新整理、手机浏览器把分页丢掉再载入时还在；关掉分页就没了）。 */
export function browserSessionStore(): KeyValueStore {
  return new BrowserStore(() => (typeof window === 'undefined' ? null : window.sessionStorage))
}

/** 存储能不能写：写一个测试值再读回来。写不进去 → 真实搜索不能保证不超额，一律不发（演示照玩）。 */
export function isWritable(store: KeyValueStore): boolean {
  const key = KEY_PREFIX + 'probe'
  const value = String(Date.now())
  const ok = store.set(key, value) && store.get(key) === value
  store.remove(key)
  return ok
}

/** 请浏览器尽量别清掉这个网站的存储（Chrome 55 起、Safari 15.2 起；不支持就算了）。 */
export async function requestPersistentStorage(nav: Navigator | undefined = globalThis.navigator): Promise<boolean> {
  try {
    if (!nav?.storage?.persist) return false
    if (await nav.storage.persisted?.()) return true
    return await nav.storage.persist()
  } catch {
    return false
  }
}

// ------------------------------------------------------------------ 读写小工具

export function readBoolean(store: KeyValueStore, key: string, fallback: boolean): boolean {
  const raw = store.get(key)
  if (raw === 'true') return true
  if (raw === 'false') return false
  return fallback
}

export function readNumber(store: KeyValueStore, key: string, fallback: number): number {
  const raw = store.get(key)
  if (raw == null || raw.trim() === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

export function readInt(store: KeyValueStore, key: string, fallback = 0): number {
  const value = readNumber(store, key, fallback)
  return Number.isInteger(value) ? value : fallback
}
