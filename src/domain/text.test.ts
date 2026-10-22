import readme from '../../README.md?raw'
import { describe, expect, it } from 'vitest'
import { CUISINES } from '../data/cuisines.ts'
import { DAY_PARTS } from '../data/dayParts.ts'
import { DUEL_LINES } from '../data/duelLines.ts'
import { formatString, STRINGS, t, type StringKey } from '../data/strings.ts'
import { WEB_TEXT_OVERRIDES, WEB_TEXTS } from '../data/webText.ts'
import { findTraditional, TRADITIONAL_CHAR_COUNT } from '../test/helpers.ts'
import { BREAK, cleanForShare, splitPhrases, stripBreaks } from './phrases.ts'

const entries = Object.entries(STRINGS) as [StringKey, string][]
const s = (key: StringKey, ...args: (string | number)[]) => t(key, ...args)
/** 拉丁字母（格式占位符 %1$d 不算）。 */
const hasLatin = (text: string) => /[a-zA-Z]/.test(text.replace(/%\d\$[ds]/g, ''))

describe('一、界面文字：简体中文、数字不断行、按短句换行', () => {
  it('TEXT-01 繁体字表能读到（超过 2,000 字）；繁体写的「吃饭还是吃面」找得到三个字，简体的一个都没有', () => {
    expect(TRADITIONAL_CHAR_COUNT).toBeGreaterThan(2000)
    // 繁体的「饭、还、面」用 \u 写，免得这个文件自己被扫描抓到。
    expect(findTraditional('吃\u98EF\u9084是吃\u9EB5')).toEqual(['\u98EF', '\u9084', '\u9EB5'])
    expect(findTraditional('吃饭还是吃面')).toEqual([])
  })

  it('TEXT-02 全部界面文字（超过 150 条）没有一个繁体字', () => {
    expect(entries.length).toBeGreaterThan(150)
    const offenders = entries.filter(([, v]) => findTraditional(v).length > 0).map(([k]) => k)
    expect(offenders).toEqual([])
  })

  it('TEXT-03 说明书（README）没有繁体字（网页项目所有文字文件另由 scripts/simplified-chinese.test.ts 扫描）', () => {
    expect(readme.length).toBeGreaterThan(100)
    expect(findTraditional(readme)).toEqual([])
  })

  it('TEXT-04 数字（或占位符）和量词之间一律是不换行空格，「公里」之间一律有字连接符', () => {
    const loose = /(\d|%\d\$[ds]) (家|次|公|名|号|个|条|米)/
    expect(entries.filter(([, v]) => loose.test(v)).map(([k]) => k)).toEqual([])
    expect(entries.filter(([, v]) => v.includes('公里')).map(([k]) => k)).toEqual([])
    expect(STRINGS.home_subtitle).toBe('专挑附近 Google 评价最好的 3 家')
  })

  it('TEXT-05 没有标点的标题用隐形换行标记标好断点，「最好吃的」四个字粘在一起', () => {
    for (const key of ['err_no_results_title_rice', 'err_no_results_title_noodle', 'err_no_results_title_any'] as const) {
      expect(STRINGS[key]).toContain('里内​没找到')
    }
    expect(STRINGS.err_no_results_title_choice).toContain('里内​没找到​「%2$s」的店')
    expect(STRINGS.loading_title).toBe('正在帮你找附近​最⁠好⁠吃⁠的%1$s…')
  })

  it('TEXT-06 计划里承诺的文案原样存在', () => {
    expect(STRINGS.home_title).toBe('今天想吃什么？')
    expect(STRINGS.random_entry).toBe('不知道吃什么？帮我随便挑')
    expect(stripBreaks(STRINGS.decide_rps_bar)).toBe('选不了？剪刀石头布帮你决定！')
    expect(STRINGS.decide_roulette).toBe('🎲 帮我挑一家')
    expect(STRINGS.duel_result_title).toBe('就这一家吧！🎉')
    expect(STRINGS.demo_switch).toBe('演示模式：不用密钥，用假数据试玩')
    expect(STRINGS.demo_results_banner).toBe('🧪 这是演示数据，不是真实的店')
    expect(STRINGS.open_only).toBe('只看营业中')
    expect(STRINGS.open_unknown).toBe('营业时间不明')
    expect(STRINGS.duel_tie).toBe('你出 %1$s，我也出 %1$s → 心有灵犀！')
    for (const key of ['greeting_breakfast', 'greeting_lunch', 'greeting_tea', 'greeting_dinner', 'greeting_supper'] as const) {
      expect(STRINGS[key].trim()).not.toBe('')
    }
  })

  it('TEXT-07 只在标点后换行', () => {
    expect(splitPhrases('选不了？剪刀石头布帮你决定！')).toEqual(['选不了？', '剪刀石头布帮你决定！'])
    expect(splitPhrases('一个手势代表一家店。你先出，赢的手势就是今天吃的！')).toEqual(['一个手势代表一家店。', '你先出，', '赢的手势就是今天吃的！'])
    expect(splitPhrases('你出 ✊，我出 ✌️ → 石头赢！')).toEqual(['你出 ✊，', '我出 ✌️ → 石头赢！'])
  })

  it('TEXT-08 「 · 」也可以断行，空格跟着留在上一行', () => {
    expect(splitPhrases('从 16 家店里，按 Google 评分和评价数综合排名 · 范围 3.0 公里')).toEqual([
      '从 16 家店里，',
      '按 Google 评分和评价数综合排名 · ',
      '范围 3.0 公里',
    ])
  })

  it('TEXT-09 「（」只在前面至少 4 个字时才开新行，标点永远不在行首', () => {
    expect(splitPhrases('已隐藏 3 家休息中的店（营业时间不明的照样显示）')).toEqual(['已隐藏 3 家休息中的店', '（营业时间不明的照样显示）'])
    expect(splitPhrases('我（App）：等你先出拳哦…')).toEqual(['我（App）：', '等你先出拳哦…'])
    for (const text of ['你出 ✊，我也出 ✊ → 心有灵犀！', '按「就它了」才开始找！」好']) {
      expect(splitPhrases(text).slice(1).every((p) => !'，。！？：；、）」』…·'.includes(p.charAt(0)))).toBe(true)
    }
  })

  it('TEXT-10 隐形换行标记把没标点的句子切开、自己消失；连续或挨着标点的不会切出空段', () => {
    expect(splitPhrases(`附近 1.5 公里内${BREAK}没找到${BREAK}「韩国餐」的店`)).toEqual(['附近 1.5 公里内', '没找到', '「韩国餐」的店'])
    expect(splitPhrases(`正在帮你找附近${BREAK}最好吃的饭…`)).toEqual(['正在帮你找附近', '最好吃的饭…'])
    expect(splitPhrases(`你好，${BREAK}再见${BREAK}`)).toEqual(['你好，', '再见'])
    expect(splitPhrases(`${BREAK}${BREAK}甲${BREAK}${BREAK}乙`)).toEqual(['甲', '乙'])
  })

  it('TEXT-11 没有标点就整句不拆；空字符串没有段；切开再拼回来一字不少', () => {
    expect(splitPhrases('正在帮你找附近最好吃的店…')).toEqual(['正在帮你找附近最好吃的店…'])
    expect(splitPhrases('')).toEqual([])
    const text = '演示模式开着：用假店试玩，不用密钥、不扣免费次数'
    expect(splitPhrases(text).join('')).toBe(text)
    expect(splitPhrases(text)).toEqual(['演示模式开着：', '用假店试玩，', '不用密钥、', '不扣免费次数'])
  })

  it('TEXT-12 每个菜系的「会帮你找」只写中文、有菜系名、简体；时段说明没有英文', () => {
    for (const cuisine of CUISINES) {
      const hint = STRINGS[cuisine.hintKey as StringKey]
      expect(hint).toBe(cuisine.hint)
      if (cuisine.id !== 'ANY') expect(hint).toContain(cuisine.zhName)
      expect(hasLatin(hint)).toBe(false)
      expect(findTraditional(hint)).toEqual([])
    }
    expect(STRINGS.cuisine_hint_chinese).toBe('🥢 中餐会帮你找：杂饭、海南鸡饭、瓦煲鸡饭、云吞面、板面、煮炒')
    for (const part of DAY_PARTS) expect(hasLatin(STRINGS[part.diceNoteKey as StringKey])).toBe(false)
    expect(STRINGS.random_daypart_supper).toBe('🌙 宵夜时间，多给嘛嘛档和煮炒一点机会')
  })

  it('TEXT-13 设置「一般」和第一次打开的画面没有技术英文、没有繁体', () => {
    const plainKeys: StringKey[] = [
      'demo_switch', 'demo_switch_note', 'remaining_free', 'settings_remaining_demo', 'settings_visits_note', 'settings_clear_visits',
      'settings_advanced_note', 'location_explain_title', 'location_explain_text', 'location_explain_ok', 'location_explain_later',
      'no_key_demo_button', 'demo_turned_off', 'demo_undo',
    ]
    for (const key of plainKeys) {
      const text = formatString(STRINGS[key], 1)
      expect(hasLatin(text), key).toBe(false)
      expect(findTraditional(text)).toEqual([])
    }
    // 网页改写过的「只存在这个浏览器」也一样。
    expect(hasLatin(WEB_TEXT_OVERRIDES.settings_visits_note ?? '')).toBe(false)
    expect(STRINGS.location_explain_text).toBe('📍 要用你的位置找附近的店。位置只用来搜附近的店，不会保存，也不会给别人。')
    expect(STRINGS.no_key_banner).toBe('还没有 Google 密钥也没关系，先用演示模式玩玩看！')
    expect(STRINGS.settings_advanced).toBe('进阶：Google 密钥')
    expect(STRINGS.settings_unsaved_title).toBe('密钥还没保存，要保存吗？')
  })

  it('TEXT-14 第三版计划里的文案原文；救援卡不再说「晚点再来」', () => {
    expect(s('share_vote_button')).toBe('📤 发到群里投票')
    expect(s('duel_share')).toBe('📤 告诉朋友')
    expect(s('duel_regret', 1)).toBe('不服！再来一局（只剩 1 次）')
    expect(s('duel_accept')).toBe('愿赌服输，就这家了 🤝')
    expect(s('duel_skipped', '麻辣火锅坊')).toBe('😴 已跳过休息中的『麻辣火锅坊』')
    expect(s('decide_none')).toBe('这一页能去的店不到 2 家')
    expect(stripBreaks(s('rescue_all_closed', '火锅'))).toBe('这个时间附近的火锅都打烊了 😴 换一样吃吧！')
    expect(splitPhrases(s('rescue_all_closed', '火锅'))).toEqual(['这个时间附近的火锅', '都打烊了 😴 ', '换一样吃吧！'])
    expect(s('rescue_reroll')).toBe('🎲 换个菜系再摇')
    expect(s('rescue_expand_note')).toBe('会用 1 次免费搜索')
    expect(s('rescue_expand_note_demo')).toBe('演示模式不扣次数')
    expect(s('rescue_show_all')).toBe('显示全部店（含休息中）')
    expect(s('basket_full')).toBe('最多圈 6 家，先取消一家吧')
    expect(s('basket_closed')).toBe('这家在休息，先不能圈')
    expect(s('maps_demo_no_page')).toBe('演示的店没有地图页面')
    expect(s('hours_rush')).toBe('赶得及！冲！🏃')
    expect(s('share_demo_header')).toBe('【演示数据，不是真实的店】')
    expect(STRINGS.rescue_one_open).not.toContain('晚点再来')
  })

  it('TEXT-15 第四版计划文案原文', () => {
    const p = (text: string) => stripBreaks(text).replace(/ /g, ' ')
    expect(s('table_title')).toBe('👥 饭桌模式：传一台手机，人人都有份')
    expect(s('table_how_many')).toBe('几个人？')
    expect(['avatar_tiger', 'avatar_panda', 'avatar_monkey', 'avatar_chick', 'avatar_pig', 'avatar_dog'].map((k) => s(k as StringKey))).toEqual(['老虎', '熊猫', '猴子', '小鸡', '小猪', '小狗'])
    expect(s('table_secret_need_three')).toBe('刚好 3 家才能玩')
    expect(s('veto_order', '🐼 → 🐯 → 🐔 → 🐵')).toBe('🎲 抽签：🐼 → 🐯 → 🐔 → 🐵')
    expect(s('veto_referees', '🐷、🐶')).toBe('🐷、🐶 这次当裁判 😆')
    expect(s('veto_turn', '🐼 熊猫')).toBe('轮到 🐼 熊猫：划掉一家你不想吃的')
    expect(s('veto_cut', '🐼 熊猫', '樱花拉面屋', '🐯 老虎')).toBe('🐼 熊猫划掉了『樱花拉面屋』！交给 🐯 老虎 👉')
    expect(s('veto_last_cut', '🐵 猴子')).toBe('最后一刀！🐵 猴子，今天吃什么就看你了')
    expect(s('veto_stamp')).toBe('✂️ 不吃！')
    expect(p(s('verdict_veto', 3))).toBe('✂️ 大家划了 3 刀，剩下这一家！')
    expect(s('secret_handover_first', '🐼 熊猫')).toBe('交给 🐼 熊猫')
    expect(s('secret_handover_next', '🐯 老虎')).toBe('传给 🐯 老虎 👉')
    expect(s('secret_dont_peek')).toBe('别给别人看哦 🙈')
    expect(s('secret_all_done')).toBe('全部出完了！一起翻牌 👀')
    expect(p(s('verdict_majority', '✊', 3, '石头'))).toBe('三种都有，数人头：✊ 3 个人最多 → 石头赢！')
    expect(s('duel_switch_table')).toBe('👥 几个人一起？改用饭桌模式，人人都有份')
    expect(p(s('basket_full'))).toBe('最多圈 6 家，先取消一家吧')
    expect(p(s('decide_basket_wheel', 5))).toBe('🎡 用我圈的 5 家转转盘')
    expect(p(s('basket_cleared', 5))).toBe('已清空 5 家')
    expect(p(s('meal_prompt_text', '阿明海南鸡饭'))).toBe('这一餐已经定了『阿明海南鸡饭』。换一组店重新玩，会用掉唯一一次反悔，确定吗？')
    expect(splitPhrases(s('meal_prompt_text', '阿南达香蕉叶饭餐厅')).some((x) => x.startsWith('『阿南达香蕉叶饭餐厅』'))).toBe(true)
    expect(s('meal_restart_confirm')).toBe('要所有人都点头哦！确定不算刚才那局？')
    expect(s('meal_settled')).toBe('🔒 这一餐定了')
    expect(s('verdict_vote_tie')).toBe('平票！App 来当判官 ⚖️')
    expect(s('shake_hint')).toBe('也可以摇一摇手机 📳')
    expect(s('cuisine_hint_mamak')).toContain('印度煎饼、拉茶')
    expect(s('location_explain_next')).toBe('等一下手机会弹出窗口，请按「使用 App 时允许」（英文是 While using the app）')
  })

  it('TEXT-16 第四版新加的 150 多条文字全部简体', () => {
    const prefixes = ['meal_', 'lock_', 'table_', 'avatar_', 'veto_', 'secret_', 'verdict_', 'wheel_', 'vote_', 'task_', 'stats_', 'fortune_', 'shake_', 'settings_shake', 'visit_', 'hours_last', 'open_unknown_careful', 'basket_', 'line_table']
    const round5 = entries.filter(([k]) => prefixes.some((p) => k.startsWith(p)))
    expect(round5.length).toBeGreaterThan(150)
    for (const [key, value] of round5) expect(findTraditional(value), key).toEqual([])
  })

  it('WEB-06 网页版全部文字（安卓原文、网页改写、网页新加）没有繁体字，数字和量词之间是不换行空格', () => {
    const all = [...Object.values(STRINGS), ...Object.values(WEB_TEXT_OVERRIDES), ...Object.values(WEB_TEXTS), ...DUEL_LINES.map((l) => l.text)]
    for (const text of all) expect(findTraditional(text ?? '')).toEqual([])
    const loose = /(\d|%\d\$[ds]) (家|次|公|名|号|个|条|米)/
    for (const text of [...Object.values(WEB_TEXT_OVERRIDES), ...Object.values(WEB_TEXTS)]) expect(loose.test(text ?? '')).toBe(false)
  })

  it('WEB-07 显示和读屏去掉 \\u200B；分享出去的文字没有 \\u00A0、\\u2060、\\u200B', () => {
    const title = t('err_no_results_title_choice', '1.5', '韩国餐')
    expect(stripBreaks(title)).not.toContain('​')
    expect(stripBreaks(title)).toContain(' ') // 画面上的不换行空格要留着
    const shared = cleanForShare(title)
    expect(/[ ⁠​]/.test(shared)).toBe(false)
    expect(shared).toBe('附近 1.5 公里内没找到「韩国餐」的店')
  })
})
