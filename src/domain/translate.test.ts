import { describe, expect, it } from 'vitest'
import { BrowserNameTranslator, noTranslator, type TranslatorApi } from '../platform/browserTranslator.ts'
import { demoChineseName, demoNameTranslator } from '../services/demoPlaces.ts'
import { PrefixTranslator } from '../test/helpers.ts'
import { containsCjk, looksMalay, needsTranslation } from './chineseText.ts'
import { ChineseLocalizer, type NameTranslator } from './localizer.ts'

class FakeTranslator implements NameTranslator {
  readonly calls: string[] = []
  closed = false
  private readonly result: (text: string) => string

  constructor(result: (text: string) => string) {
    this.result = result
  }

  async translateToChinese(text: string): Promise<string> {
    this.calls.push(text)
    return this.result(text)
  }

  close(): void {
    this.closed = true
  }
}

describe('十一、店名机翻（中文判断、马来文判断、缓存）', () => {
  it('TRANSLATE-01 认得出中文：纯中文、中英混合、单个字、扩展区汉字（𠮷）', () => {
    expect(containsCjk('锦记云吞面')).toBe(true)
    expect(containsCjk('Kedai Kopi 老友记')).toBe(true)
    expect(containsCjk('Mee 面')).toBe(true)
    expect(containsCjk('饭')).toBe(true)
    expect(containsCjk('𠮷野家')).toBe(true)
  })

  it('TRANSLATE-02 马来文、英文、日文假名、全角英文数字、空字符串、空值都不算中文', () => {
    expect(containsCjk('Restoran Nasi Kandar Pelita')).toBe(false)
    expect(containsCjk('Mee Rebus Haji Wahid')).toBe(false)
    expect(containsCjk('ラーメン')).toBe(false)
    expect(containsCjk('Ｍｅｅ １２３')).toBe(false)
    expect(containsCjk('')).toBe(false)
    expect(containsCjk(null)).toBe(false)
  })

  it('TRANSLATE-03 只有「有字母、没有中文」的才需要翻译', () => {
    expect(needsTranslation('Restoran Nasi Kandar Pelita')).toBe(true)
    expect(needsTranslation('锦记云吞面')).toBe(false)
    expect(needsTranslation('123 & 456')).toBe(false)
    expect(needsTranslation('   ')).toBe(false)
    expect(needsTranslation(null)).toBe(false)
  })

  it('TRANSLATE-04 翻译结果按原名缓存：同一个名字翻两次只调用翻译器一次', async () => {
    const fake = new FakeTranslator(() => '佩利塔扁担饭餐厅')
    const localizer = new ChineseLocalizer(fake)
    expect(await localizer.localize('Restoran Nasi Kandar Pelita')).toBe('佩利塔扁担饭餐厅')
    expect(await localizer.localize('Restoran Nasi Kandar Pelita')).toBe('佩利塔扁担饭餐厅')
    expect(localizer.cached('Restoran Nasi Kandar Pelita')).toBe('佩利塔扁担饭餐厅')
    expect(fake.calls).toHaveLength(1)
  })

  it('TRANSLATE-05 中文名、空值、空字符串从不交给翻译器', async () => {
    const fake = new FakeTranslator(() => {
      throw new Error('should not be called')
    })
    const localizer = new ChineseLocalizer(fake)
    expect(await localizer.localize('锦记云吞面')).toBeNull()
    expect(await localizer.localize(null)).toBeNull()
    expect(await localizer.localize('')).toBeNull()
    expect(fake.calls).toEqual([])
  })

  it('TRANSLATE-06 失败、和原文一样、没有中文、空白：都当没翻译（照样显示原名），不报错', async () => {
    expect(await new ChineseLocalizer(new FakeTranslator(() => { throw new Error('model download failed') })).localize('Mee Goreng')).toBeNull()
    expect(await new ChineseLocalizer(new FakeTranslator((t) => t)).localize('Mee Goreng')).toBeNull()
    expect(await new ChineseLocalizer(new FakeTranslator(() => 'Fried noodles')).localize('Mee Goreng')).toBeNull()
    expect(await new ChineseLocalizer(new FakeTranslator(() => '  ')).localize('Mee Goreng')).toBeNull()
  })

  it('TRANSLATE-07 失败不缓存，下一次可以再试并成功', async () => {
    let fail = true
    const localizer = new ChineseLocalizer(new FakeTranslator(() => {
      if (fail) throw new Error('offline')
      return '炒面'
    }))
    expect(await localizer.localize('Mee Goreng')).toBeNull()
    fail = false
    expect(await localizer.localize('Mee Goreng')).toBe('炒面')
  })

  it('TRANSLATE-08 关闭时释放翻译器（网页：释放浏览器的翻译器对象）', async () => {
    const fake = new FakeTranslator(() => 'x')
    new ChineseLocalizer(fake).close()
    expect(fake.closed).toBe(true)
    let destroyed = 0
    const api: TranslatorApi = {
      availability: async () => 'available',
      create: async () => ({ translate: async (t: string) => `中${t}`, destroy: () => void destroyed++ }),
    }
    const browser = new BrowserNameTranslator(api)
    await browser.translateToChinese('The Noodle House')
    browser.close()
    await Promise.resolve()
    await Promise.resolve()
    expect(destroyed).toBe(1)
    await expect(browser.translateToChinese('x')).rejects.toThrow()
  })

  it('TRANSLATE-09 典型马来文店名认得出来', () => {
    expect(looksMalay('Restoran Nasi Kandar Pelita')).toBe(true)
    expect(looksMalay('Kedai Kopi Yut Kee')).toBe(true)
    expect(looksMalay('Mee Rebus Haji Wahid')).toBe(true)
    expect(looksMalay('WARUNG MAK TEH')).toBe(true)
  })

  it('TRANSLATE-10 英文店名不算马来文（Mile High Cafe 的 Mi 必须是整个词），空的也不算', () => {
    expect(looksMalay('Lot 10 Hutong Food Court')).toBe(false)
    expect(looksMalay('The Noodle House')).toBe(false)
    expect(looksMalay('Mile High Cafe')).toBe(false)
    expect(looksMalay('')).toBe(false)
    expect(looksMalay(null)).toBe(false)
  })

  it('WEB-26 浏览器没有离线翻译时照样显示原名、不报错；有的话马来文先试 ms 再试 id，一条一条翻；演示店永远用内置中文名', async () => {
    // 没有 Translator API（手机 Chrome、iPhone Safari）。
    const none = new BrowserNameTranslator(null)
    expect(none.supported).toBe(false)
    expect(await new ChineseLocalizer(none).localize('Restoran Nasi Kandar Pelita')).toBeNull()
    expect(await new ChineseLocalizer(noTranslator).localize('Restoran Nasi Kandar Pelita')).toBeNull()

    // 有（电脑 Chrome）：ms 不支持就用 id；英文用 en。
    const asked: string[] = []
    const events: string[] = []
    let running = 0
    let maxRunning = 0
    const api: TranslatorApi = {
      availability: async ({ sourceLanguage }) => {
        asked.push(sourceLanguage)
        return sourceLanguage === 'ms' ? 'unavailable' : 'available'
      },
      create: async ({ sourceLanguage }) => ({
        translate: async (text: string) => {
          running++
          maxRunning = Math.max(maxRunning, running)
          events.push(`开始 ${text}`)
          for (let i = 0; i < 5; i++) await Promise.resolve()
          events.push(`结束 ${text}`)
          running--
          return sourceLanguage === 'id' ? '马来译' : `英译${text.length}`
        },
      }),
    }
    const browser = new BrowserNameTranslator(api)
    const localizer = new ChineseLocalizer(browser)
    const [a, b, c] = await Promise.all([
      localizer.localize('Restoran Nasi Kandar Pelita'),
      localizer.localize('The Noodle House'),
      localizer.localize('Mile High Cafe'),
    ])
    expect(a).toBe('马来译')
    expect(b).toBe('英译16')
    expect(c).toBe('英译14')
    expect(asked).toEqual(expect.arrayContaining(['ms', 'id', 'en']))
    // 同一个翻译器一条翻完才翻下一条。
    const english = events.filter((e) => !e.includes('Restoran'))
    expect(english).toEqual(['开始 The Noodle House', '结束 The Noodle House', '开始 Mile High Cafe', '结束 Mile High Cafe'])
    expect(maxRunning).toBeLessThanOrEqual(2)

    // 全部不能用：安静地失败。
    const unavailable = new BrowserNameTranslator({ availability: async () => 'unavailable', create: async () => { throw new Error('x') } })
    expect(await new ChineseLocalizer(unavailable).localize('The Noodle House')).toBeNull()
    // create 需要用户刚点过（没有就抛错）：失败不记住，下次可以再试。
    let allowed = false
    const gesture = new BrowserNameTranslator({
      availability: async () => 'downloadable',
      create: async () => {
        if (!allowed) throw new DOMException('needs a click', 'NotAllowedError')
        return { translate: async () => '中文名' }
      },
    })
    const gl = new ChineseLocalizer(gesture)
    expect(await gl.localize('The Noodle House')).toBeNull()
    allowed = true
    gesture.prime()
    expect(await gl.localize('The Noodle House')).toBe('中文名')

    // 演示店：查内置对照表，绝不联网。
    expect(demoChineseName('Sakura Ramen House')).toBe('樱花拉面屋')
    expect(await demoNameTranslator.translateToChinese('Sakura Ramen House')).toBe('樱花拉面屋')
    await expect(demoNameTranslator.translateToChinese('不是演示店')).rejects.toThrow()
    expect(await new ChineseLocalizer(new PrefixTranslator()).localize('Mee Goreng')).toBe('译Mee Goreng')
  })
})
