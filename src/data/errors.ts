/**
 * 搜索出错时怎么归类、错误页显示什么、给哪些按钮。安卓源：ui/UiState.kt（SearchError / HttpProblem /
 * mightBeFixedByNewKey）、ui/StatusScreens.kt（ErrorScreen / httpHint）、data/PlacesRepository.kt（mostInformativeFailure）。
 * 文字都用 strings.ts 的 key；图案见 uiLiterals.ts ERROR_EMOJI。
 */

/** Google HTTP 错误的分类（按顺序判断，先看 reason）。 */
export type HttpProblem =
  | 'KEY_INVALID'
  | 'ANDROID_APP_BLOCKED'
  | 'SERVICE_BLOCKED'
  | 'SERVICE_DISABLED'
  | 'BILLING'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'OTHER';

/**
 * 安卓 SearchError.Http.problem 的规则（从上到下，第一个符合的）：
 * 1. reason = API_KEY_INVALID → KEY_INVALID
 * 2. reason = API_KEY_ANDROID_APP_BLOCKED → ANDROID_APP_BLOCKED（网页版对应：HTTP referrer 限制对不上，见 功能清单.md）
 * 3. reason = API_KEY_SERVICE_BLOCKED → SERVICE_BLOCKED
 * 4. reason = SERVICE_DISABLED 或 ACCESS_NOT_CONFIGURED → SERVICE_DISABLED
 * 5. reason = BILLING_DISABLED 或 BILLING_NOT_ENABLED，或 Google 原文（不分大小写）含 "billing" → BILLING
 * 6. code = 429 或 status = RESOURCE_EXHAUSTED → RATE_LIMITED
 * 7. code ≥ 500 → SERVER
 * 8. 其他 → OTHER
 * reason 取 error.details 里第一个有 reason 的；Google 原文取 error.message，没有 JSON 时取回复正文前 300 个字。
 */
export function classifyHttp(code: number, status: string | null, reason: string | null, googleMessage: string | null): HttpProblem {
  if (reason === 'API_KEY_INVALID') return 'KEY_INVALID';
  if (reason === 'API_KEY_ANDROID_APP_BLOCKED') return 'ANDROID_APP_BLOCKED';
  if (reason === 'API_KEY_SERVICE_BLOCKED') return 'SERVICE_BLOCKED';
  if (reason === 'SERVICE_DISABLED' || reason === 'ACCESS_NOT_CONFIGURED') return 'SERVICE_DISABLED';
  if (reason === 'BILLING_DISABLED' || reason === 'BILLING_NOT_ENABLED' || (googleMessage ?? '').toLowerCase().includes('billing')) return 'BILLING';
  if (code === 429 || status === 'RESOURCE_EXHAUSTED') return 'RATE_LIMITED';
  if (code >= 500) return 'SERVER';
  return 'OTHER';
}

/** 每种 HTTP 问题的提示文字（strings.ts key）和按钮。 */
export const HTTP_PROBLEM_SCREEN: Record<HttpProblem, { hintKey: string; actions: ('openSettings' | 'retry')[] }> = {
  KEY_INVALID: { hintKey: 'hint_key_invalid', actions: ['openSettings', 'retry'] },
  ANDROID_APP_BLOCKED: { hintKey: 'hint_android_blocked', actions: ['openSettings', 'retry'] },
  SERVICE_BLOCKED: { hintKey: 'hint_service_blocked', actions: ['openSettings', 'retry'] },
  SERVICE_DISABLED: { hintKey: 'hint_service_disabled', actions: ['retry'] },
  /** 试用结束后这是正常的、免费的结局：不给「重试」。 */
  BILLING: { hintKey: 'hint_billing', actions: [] },
  RATE_LIMITED: { hintKey: 'hint_quota', actions: ['retry'] },
  SERVER: { hintKey: 'hint_server', actions: ['retry'] },
  OTHER: { hintKey: 'hint_generic', actions: ['retry'] },
};

/**
 * 换了一个新密钥后，哪些错误值得马上自动重试（安卓 mightBeFixedByNewKey）：
 * 没有密钥、密钥格式不对、HTTP 400–499 里除了 RATE_LIMITED 以外的。网络、定位、5xx 不重试。
 */
export function mightBeFixedByNewKey(kind: 'NoApiKey' | 'InvalidApiKey' | 'Http' | string, code?: number, problem?: HttpProblem): boolean {
  if (kind === 'NoApiKey' || kind === 'InvalidApiKey') return true;
  if (kind === 'Http' && code !== undefined) return code >= 400 && code <= 499 && problem !== 'RATE_LIMITED';
  return false;
}

/**
 * 每种错误页：标题 key、正文 key、主按钮、次按钮（安卓 ErrorScreen）。网页版的定位类错误文字要改写（见 功能清单.md）。
 * - NoResults：标题按选择不同（有具体菜系 → err_no_results_title_choice（%1$s 公里, %2$s 选择名）；
 *   不限+饭 → _rice；不限+面 → _noodle；不限+都可以 → _any）。还能扩大 → 正文 err_no_results_msg、主按钮
 *   「扩大到 X 公里再找」+ 小字（会用 1 次免费搜索 / 演示模式不扣次数）；已经 5 公里 → 正文 err_no_results_max_msg、没有扩大按钮。
 *   有具体菜系时多一个次按钮「换成「不限」再找」（不是演示模式时下面小字「会用 1 次免费搜索」）。
 *   永远有「🎲 换个菜系再摇」+ 小字「摇多少次都不扣免费次数」。
 * - 所有错误页最下面都有「返回首页」。
 */
export const ERROR_SCREENS = {
  NoApiKey: { titleKey: 'err_no_key_title', messageKey: 'err_no_key_msg', primary: 'openSettings' },
  InvalidApiKey: { titleKey: 'err_invalid_key_title', messageKey: 'err_invalid_key_msg', primary: 'openSettings' },
  /** 正文参数：300、3、900、1000。没有按钮（只有返回首页）。 */
  QuotaExhausted: { titleKey: 'err_quota_title', messageKey: 'err_quota_msg', primary: null },
  /** 一般拒绝：正文 permission_explain、按钮「允许定位」；永久拒绝：正文 err_permission_permanent_msg、按钮「去设置开启」。 */
  PermissionNeeded: { titleKey: 'err_permission_title', messageKey: 'permission_explain', primary: 'grantLocation' },
  /** 主按钮「打开定位」，次按钮「重试」。 */
  LocationServicesOff: { titleKey: 'err_services_off_title', messageKey: 'err_services_off_msg', primary: 'openLocationSettings' },
  LocationUnavailable: { titleKey: 'err_location_title', messageKey: 'err_location_msg', primary: 'retry' },
  Network: { titleKey: 'err_network_title', messageKey: 'err_network_msg', primary: 'retry' },
  /** 标题 err_http_title(code)；正文 = HTTP_PROBLEM_SCREEN 的提示；Google 原文另起一行灰色小字 err_google_original。 */
  Http: { titleKey: 'err_http_title', messageKey: null, primary: 'byProblem' },
  BadResponse: { titleKey: 'err_bad_response_title', messageKey: 'err_bad_response_msg', primary: 'retry' },
  NoResults: { titleKey: 'byChoice', messageKey: 'byRadius', primary: 'expandRadius' },
} as const;

/** 好几个关键词都失败时，显示哪一个（安卓 mostInformativeFailure）：额度用完 > Google 的 HTTP 错误 > 第一个错误。 */
export const FAILURE_PRIORITY = ['QuotaExhausted', 'Http', 'first'] as const;
