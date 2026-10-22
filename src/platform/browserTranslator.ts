/**
 * 浏览器内建的离线翻译（Chrome 电脑版的 Translator API；手机 Chrome、iPhone Safari 都没有）。
 * 有就用来把英文 / 马来文店名翻成简体中文；没有、或任何失败 → 抛错（ChineseLocalizer 会安静地显示原名）。
 * 绝不改用要收费的 Cloud Translation，也不打包几百 MB 的模型。演示模式绝不调用（会下载模型）。
 *
 * Translator.create() 第一次可能要下载模型，需要用户刚点过：按「吃饭 / 吃面 / 都可以」的那一刻调用 prime()。
 * 马来文不在支持的语言里：先试 ms，再试 id（印尼文，和马来文很接近），都不行就当英文。
 */
import { looksMalay } from '../domain/chineseText.ts'
import type { NameTranslator } from '../domain/localizer.ts'

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

interface TranslatorInstance {
  translate(text: string): Promise<string>
  destroy?(): void
}

export interface TranslatorApi {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<Availability | string>
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorInstance>
}

const TARGET = 'zh'
const MALAY_SOURCES = ['ms', 'id']
const ENGLISH_SOURCES = ['en']

/** 这个浏览器有没有内建翻译（Translator API）。 */
export function browserTranslatorApi(): TranslatorApi | null {
  const api = (globalThis as unknown as { Translator?: TranslatorApi }).Translator
  return api && typeof api.availability === 'function' && typeof api.create === 'function' ? api : null
}

export class BrowserNameTranslator implements NameTranslator {
  private readonly api: TranslatorApi | null
  private readonly translators = new Map<string, Promise<TranslatorInstance | null>>()
  /** 每个翻译器一次只翻一条（浏览器是按顺序执行的）。 */
  private readonly queues = new Map<string, Promise<unknown>>()
  private closed = false

  constructor(api: TranslatorApi | null = browserTranslatorApi()) {
    this.api = api
  }

  get supported(): boolean {
    return this.api != null
  }

  /** 在用户点按的那一刻先把英文（和马来文）的翻译器准备好。 */
  prime(): void {
    if (!this.api || this.closed) return
    void this.translatorFor(ENGLISH_SOURCES)
    void this.translatorFor(MALAY_SOURCES)
  }

  private translatorFor(sources: readonly string[]): Promise<{ source: string; translator: TranslatorInstance } | null> {
    const api = this.api
    if (!api) return Promise.resolve(null)
    return (async () => {
      for (const source of sources) {
        let pending = this.translators.get(source)
        if (!pending) {
          pending = (async () => {
            try {
              const availability = await api.availability({ sourceLanguage: source, targetLanguage: TARGET })
              if (availability === 'unavailable') return null
              return await api.create({ sourceLanguage: source, targetLanguage: TARGET })
            } catch {
              return null
            }
          })()
          this.translators.set(source, pending)
          // 失败（例如没有用户点按、不能下载）：下次可以再试。
          void pending.then((t) => {
            if (t == null) this.translators.delete(source)
          })
        }
        const translator = await pending
        if (translator) return { source, translator }
      }
      return null
    })()
  }

  async translateToChinese(text: string): Promise<string> {
    if (this.closed) throw new Error('translator closed')
    const found = (looksMalay(text) ? await this.translatorFor(MALAY_SOURCES) : null) ?? (await this.translatorFor(ENGLISH_SOURCES))
    if (!found) throw new Error('no built-in translator')
    const previous = this.queues.get(found.source) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(() => found.translator.translate(text))
    this.queues.set(found.source, next)
    return next
  }

  close(): void {
    this.closed = true
    for (const pending of this.translators.values()) {
      void pending.then((t) => {
        try {
          t?.destroy?.()
        } catch {
          // 算了
        }
      })
    }
    this.translators.clear()
  }
}

/** 没有内建翻译时用：每次都失败（照样显示原名、不报错）。 */
export const noTranslator: NameTranslator = {
  async translateToChinese(): Promise<string> {
    throw new Error('no translator')
  },
  close() {},
}
