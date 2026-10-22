/**
 * 在网页上一模一样地重现安卓（Java / Kotlin）的数字写法。
 *
 * 为什么一定要用这个，不能直接用 JS 的 toFixed：
 * - 安卓用 String.format(Locale.US, "%.1f", x)，它先取这个数「最短的十进制写法」（1150 米 ÷ 1000 = 1.15），
 *   再四舍五入（HALF_UP）→「1.2 公里」。
 * - JS 的 (1.15).toFixed(1) 按二进制里的真实值（1.149999…）舍入 →「1.1」，和安卓不一样。
 * - 用安卓编译后的真实代码（JVM）对照过：0–6 公里每 1 米的距离里有 107 个会写错，演示店分享链接的
 *   5 位小数坐标里也有会差一位的。golden/javaFormat.json 是 JVM 的标准答案，../校验/verify.mjs 逐个核对。
 *
 * 用到的地方（安卓源）：
 * - formatFixed(x, 1)：domain/Geo.kt formatDistance（「1.2 公里」）和 formatKm；ui/ResultsScreen.kt RatingLine、
 *   ui/Texts.kt ShareText（「⭐4.6」）、ui/DuelOverlay.kt、ui/TableOverlay.kt（星数一位小数）。
 * - formatFixed(x, 5)：domain/MapsLinks.kt shareUrl（演示店「https://maps.google.com/?q=3.14520,101.69750」）。
 * - formatFixed(x, 7)：domain/MapsLinks.kt latLng（导航网址「3.1390000%2C101.6869000」）。
 * - formatGrouped(n)：ui/ResultsScreen.kt RatingLine 的评价数（NumberFormat.getIntegerInstance(Locale.US)：「1,240」）。
 */

/** 和 Java 一样的「最短十进制写法」，但不用科学记号（1e-7 → "0.0000001"）。 */
function plainDecimal(abs: number): string {
  const s = abs.toString();
  const e = s.search(/e/i);
  if (e < 0) return s;
  const mantissa = s.slice(0, e);
  const exponent = Number(s.slice(e + 1));
  const dot = mantissa.indexOf('.');
  const intPart = dot < 0 ? mantissa : mantissa.slice(0, dot);
  const fracPart = dot < 0 ? '' : mantissa.slice(dot + 1);
  const digits = intPart + fracPart;
  const point = intPart.length + exponent;
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return digits.slice(0, point) + '.' + digits.slice(point);
}

/**
 * 等同 Java 的 String.format(Locale.US, "%.<digits>f", value)：最短十进制写法 + 四舍五入（HALF_UP），
 * 小数点永远是「.」，不分千位；负数（包括舍入成 0 的负数）前面带「-」，和 Java 一样（-0.04 → "-0.0"）。
 */
export function formatFixed(value: number, digits: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity';
  const sign = value < 0 || Object.is(value, -0) ? '-' : '';
  const plain = plainDecimal(Math.abs(value));
  const dot = plain.indexOf('.');
  const intPart = dot < 0 ? plain : plain.slice(0, dot);
  const fracPart = dot < 0 ? '' : plain.slice(dot + 1);
  if (fracPart.length <= digits) {
    return sign + intPart + (digits > 0 ? '.' + fracPart.padEnd(digits, '0') : '');
  }
  const roundUp = fracPart.charCodeAt(digits) >= 53; // '5'..'9'
  let kept = BigInt(intPart + fracPart.slice(0, digits));
  if (roundUp) kept += 1n;
  const text = kept.toString().padStart(digits + 1, '0');
  const whole = text.slice(0, text.length - digits);
  return sign + whole + (digits > 0 ? '.' + text.slice(text.length - digits) : '');
}

/** 等同 Java 的 NumberFormat.getIntegerInstance(Locale.US).format(n)：整数、每三位一个「,」（1240 → "1,240"）。 */
export function formatGrouped(n: number): string {
  const whole = Math.trunc(n);
  const sign = whole < 0 ? '-' : '';
  return sign + Math.abs(whole).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
