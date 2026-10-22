/**
 * 店名机翻的规则（安卓 domain/ChineseLocalizer.kt）：只翻「有字母、没有汉字」的；结果按原文存在内存里（这次打开网页有效）；
 * 翻译失败、翻出来是空的、和原文一样、或没有汉字 → 当作没翻译（显示原名），不报错、不存，下次可以再试。
 */
import { containsCjk, ktTrim, needsTranslation } from './chineseText.ts'

/** 把短短的字（店名、类型名）翻成简体中文；可能抛错。 */
export interface NameTranslator {
  translateToChinese(text: string): Promise<string>
  /** 释放资源（浏览器翻译器对象）。 */
  close(): void
}

export class ChineseLocalizer {
  private readonly translator: NameTranslator
  private readonly cache = new Map<string, string>()

  constructor(translator: NameTranslator) {
    this.translator = translator
  }

  /** 已经翻好的（搜索出结果时直接带上）。 */
  cached(text: string | null | undefined): string | null {
    if (text == null) return null
    return this.cache.get(ktTrim(text)) ?? null
  }

  /** 中文翻译；不需要、或翻不出来 → null。 */
  async localize(text: string | null | undefined): Promise<string | null> {
    if (!needsTranslation(text)) return null
    const original = ktTrim(text as string)
    const known = this.cache.get(original)
    if (known != null) return known
    let translated: string
    try {
      translated = ktTrim(await this.translator.translateToChinese(original))
    } catch {
      return null
    }
    if (translated.length === 0 || translated === original || !containsCjk(translated)) return null
    this.cache.set(original, translated)
    return translated
  }

  close(): void {
    this.translator.close()
  }
}
