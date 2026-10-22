/**
 * 网页版要「换掉」或「新加」的文字 —— 建议稿，不是安卓原文（安卓原文一条不差地在 strings.ts）。
 *
 * 为什么要有：安卓有些说法网页做不到或不对（「去设置开启」能直接打开手机设置、包名和 SHA-1、
 * 「找不到可以分享的应用」……），见 功能清单.md「三十一、安卓专属、网页要换做法的地方」。
 * 口吻照第四版：简体中文、短句、不写技术英文（Google Cloud 后台的名称除外，要和网站上一模一样才找得到）。
 * 写法规则和 strings.ts 一样：数字和量词之间用  ，「公里」中间用 ⁠，没有标点的句子用 ​ 标断点。
 *
 * 用法：显示文字时先查 WEB_TEXT_OVERRIDES，有就用它，没有才用 STRINGS；网页新功能用 WEB_TEXTS。
 * ANDROID_ONLY_KEYS 里的安卓文字网页版用不到（画面上不该出现）。
 */
import type { StringKey } from './strings';

/** 换掉安卓原文（key 和 strings.ts 相同）。 */
export const WEB_TEXT_OVERRIDES: Partial<Record<StringKey, string>> = {
  // 定位：浏览器问的是「允许 / 不允许」，不是安卓的「使用 App 时允许」。
  location_explain_next: '等一下浏览器会问能不能用你的位置，请按「允许」（英文是 Allow）',
  // 网页打不开手机的设置页：说清楚是浏览器挡住了，按钮改成看步骤（见 WEB_TEXTS.web_location_help_*）。
  loc_denied_permanent: '📍 浏览器挡住了这个网页的定位，要在浏览器设置里把「位置」打开',
  err_permission_permanent_msg: '这个网页的定位被浏览器挡住了。按下面的「怎么打开？」看步骤，打开以后回来按「重试」。',
  action_open_app_settings: '怎么打开？',
  // 网页分不出「定位服务没开」还是「暂时拿不到位置」，两种合成一种，提醒看看手机的定位开关。
  err_location_msg: '可能是在室内、信号不好，或者手机的定位没打开。打开定位、走到窗边或户外，再试一次吧。',
  // 密钥限制：网页不能用「Android 应用」限制，要改成「网站」。
  hint_android_blocked: '这个密钥只准安卓 App 用，网页用不了。请到 Google Cloud 把密钥的「应用限制」改成「网站」，再把设置 → 进阶里的网址填进去。',
  settings_restrict_title: '把密钥限制为「网站」（HTTP referrer）时，要填这两项：',
  settings_key_help: '到 Google Cloud 控制台（项目 Foodtracker）→「API 和服务」→「凭⁠据」创建 API 密钥，并启用「Places API (New)」。详细步骤见下面的「📖 怎么申请密钥？」。',
  settings_key_source_in_app: '现在使用：保存在这个浏览器里的密钥',
  hint_generic: '请检查 API 密钥和 Google Cloud 的设置（步骤见设置 → 进阶里的「📖 怎么申请密钥？」）。',
  // 打开地图：网页是开新分页，可能被浏览器挡住。
  maps_open_failed: '打不开地图，请看看浏览器有没有挡住新窗口',
  // 「只存在这部手机」→ 网页其实是存在这个浏览器（换浏览器就没有了），说实话。
  settings_visits_note: '吃过的记录只存在这个浏览器：店的编号、菜系和时间，用来标「👣 去过」和少推荐刚吃过的。',
  table_rename_note: '名字只存在这个浏览器，不会发到别的地方',
};

/** 网页新加的文字。 */
export const WEB_TEXTS = {
  // ---- 设置「进阶」：网站网址（代替安卓的包名和 SHA-1）
  /** 标签；下面一行是网址本身：location.origin + 网页所在的路径 + "*"（例如 https://evolee1217-lgtm.github.io/美食剪刀布/*），旁边有复制按钮。 */
  web_site_label: '网站网址',
  web_site_note: '在 Google Cloud 的密钥「应用限制」选「网站」，把上面两行都加进「网站限制」（只填带网页路径的那一行会被 Google 挡下来）。',
  /** Google 回 reason = API_KEY_HTTP_REFERRER_BLOCKED（网站限制里没有这个网址）时的提示。 */
  hint_referrer_blocked: '这个密钥限制了网站，可是这个网址不在名单里。请到设置 → 进阶复制网址，加进 Google Cloud 的密钥限制。',
  /** 密钥输入框下面一行小字。 */
  web_key_local_note: '密钥只存在这个浏览器里，不会放进网页、也不会上传；换手机、换浏览器或清除浏览器资料后要重新粘贴。',
  /** 设置「进阶」用量下面一行小字（安卓 README 5.5「硬上限的局限」）。 */
  web_usage_local_note: '「本月用量」只记在这个浏览器里：换手机、换浏览器或清除浏览器资料会从 0 重新算，所以密钥只在一部手机上用，也不要给别人。',
  /** 浏览器不让网页存东西（无痕模式等）：为了保证不花钱，真实搜索先停用，演示照样能玩。 */
  web_storage_blocked: '这个浏览器不让网页记东西（可能是无痕模式），为了保证不花钱，真实搜索先停用。可以用演示模式玩，或者换普通模式打开。',

  // ---- 定位被挡住时「怎么打开？」的说明（一个小窗口）
  web_location_help_title: '怎么打开定位？',
  web_location_help_android: '安卓手机（Chrome）：点网址栏左边的图标 →「权限」→「位置」→ 选「允许」。',
  web_location_help_iphone: 'iPhone（Safari）：到手机的「设置」→「App」→「Safari」→「位置」→ 选「询问」或「允许」；也看看「设置」→「隐私与安全性」→「定位服务」有没有打开。',
  web_location_help_retry: '我改好了，再试一次',
  /** 不是 https 打开的（例如手机用局域网 http 地址打开）：浏览器根本不让网页定位。 */
  web_location_insecure: '📍 这个网址不是 https 开头，浏览器不让网页定位',
  web_location_insecure_help: '请用 https 开头的网址打开这个网页（例如 github.io 的网址），就可以用定位了。',
  /** 浏览器没有定位功能（很旧的浏览器、某些 App 里面的小浏览器）。 */
  web_location_unsupported: '📍 这个浏览器不能定位',
  web_location_unsupported_help: '请换用手机自带的 Chrome 或 Safari 打开这个网页。',
  web_location_got_it: '知道了',
  /** 暂时拿不到位置（超时、室内）时，首页定位卡片的第二行。 */
  web_location_unavailable_hint: '可能在室内或信号不好，走到窗边或户外再按「重试」。',

  // ---- 分享：没有系统分享面板时，改成复制
  web_share_copied: '已经复制好了，去 WhatsApp 群里粘贴就可以 📋',
  web_share_copy_failed: '复制不了，请长按下面的文字自己复制',
  /** 复制好了以后的按钮：打开 WhatsApp 选人发送（文字已经带上）。 */
  web_share_whatsapp: '💬 用 WhatsApp 发',

  // ---- 📳 摇一摇（iPhone 要先允许「动作与方向」）
  web_shake_allow: '开启摇一摇',
  web_shake_permission_note: 'iPhone 要先按一下「开启摇一摇」，再在跳出来的窗口按「允许」（英文是 Allow）。',
  web_shake_unsupported: '这台手机或浏览器不支持摇一摇',

  // ---- 设置「进阶」：怎么申请密钥（网页版的说明书，一步一步；Google Cloud 后台的名称照网站上写）
  web_key_guide_title: '📖 怎么申请密钥？一步一步来',
  web_key_guide_1: '用电脑打开 Google Cloud 控制台（console.cloud.google.com），登录你的 Google 账号，选好项目（安卓版用的是 Foodtracker）。',
  web_key_guide_2: '左上角菜单 →「API 和服务」→「库」，搜索「Places API (New)」，按「启用」。',
  web_key_guide_3: '「API 和服务」→「凭\u2060据」→「+ 创建凭\u2060据」→「API 密钥」。网页版要另外建一把新的，安卓版那把不要动（一把密钥只能选一种「应用限制」）。',
  web_key_guide_4: '点开新的密钥：「应用限制」选「网站」，把下面两行都加进「网站限制」。',
  web_key_guide_5: '「API 限制」选「限制密钥」，只勾「Places API (New)」，再按「保存」。',
  web_key_guide_6: '复制密钥（AIza 开头），回来贴进上面的框，按「保存密钥」。改完限制要等几分钟才生效。',
  web_key_guide_7: '不用升级付费账号：这个网页每个月最多只用 900\u00A0个搜索请求和 900\u00A0个照片请求，比 Google 每月的免费额度还少。想更放心，可以在「配额」里把每天的上限调低。',

  // ---- 店名机翻：浏览器没有离线翻译时（设置里一行小字，可选）
  web_translate_unavailable: '这个浏览器不能在手机上离线翻译，英文和马来文店名会照原文显示，下面加一行「大概意思」。',
  /** 没有机翻时，英文 / 马来文店名下面那一行（小词表认得的词，domain/roughMeaning.ts）。 */
  web_rough_meaning: '大概意思：%1$s',
} as const;

export type WebTextKey = keyof typeof WEB_TEXTS;

/**
 * 网页版用不到的安卓文字（画面上不该出现）：包名 / SHA-1 / 打包内置密钥是安卓才有的；
 * 网页分不出「定位服务没开」；网页打不开系统设置；没有分享面板时改成复制（web_share_*）。
 */
export const ANDROID_ONLY_KEYS: StringKey[] = [
  'settings_package',
  'settings_sha1',
  'settings_sha1_unknown',
  'settings_key_source_build',
  'loc_services_off',
  'err_services_off_title',
  'err_services_off_msg',
  'action_open_location_settings',
  'settings_open_failed',
  'share_failed',
];

/** 取文字：网页改写过的用改写，否则用安卓原文。 */
export function webString(key: StringKey, android: Readonly<Record<StringKey, string>>): string {
  return WEB_TEXT_OVERRIDES[key] ?? android[key];
}
