/**
 * Kotlin 标准库 `kotlin.random.Random(seed: Long)`（XorWow 算法）的逐位移植。
 *
 * 为什么需要：安卓版有几处结果是「固定种子算出来的」，网页版想和安卓一模一样就得用同一套随机数：
 * - 演示假店的位置：DemoPlaces.placed() 用 Random(20261003)。本资料已经把结果预先算好写进
 *   demoShops.ts（bearingDeg / meters / street），网页版直接用即可，不一定要调用这里。
 * - 今日饭签：Fortune.indexFor(day, phoneSeed) = STICKS 下标洗牌（shuffled(Random(phoneSeed)))
 *   后按天取。网页版的 phoneSeed 是每个浏览器自己随机生成的数，所以不必和安卓相同；但如果想
 *   用 golden/kotlinRandom.json 里的对照值写测试，就用这个文件。
 *
 * 已和安卓真机代码（JVM 上运行 kotlin-stdlib）逐个数字对照过，见 ../校验/verify.mjs 和
 * golden/kotlinRandom.json。
 *
 * 安卓源文件参考：kotlin-stdlib 的 XorWowRandom / Random.kt；用到它的地方：
 * domain/Fortune.kt、data/DemoPlaces.kt。
 */

export class KotlinRandom {
  private x: number;
  private y: number;
  private z: number;
  private w: number;
  private v: number;
  private addend: number;

  /** 等同 Kotlin 的 `Random(seed: Long)`。seed 可以是 bigint 或安全整数范围内的 number。 */
  constructor(seed: bigint | number) {
    const s = BigInt.asIntN(64, BigInt(seed));
    const seed1 = Number(BigInt.asIntN(32, s)); // seed.toInt()
    const seed2 = Number(BigInt.asIntN(32, s >> 32n)); // seed.shr(32).toInt()
    this.x = seed1 | 0;
    this.y = seed2 | 0;
    this.z = 0;
    this.w = 0;
    this.v = ~seed1 | 0;
    this.addend = ((seed1 << 10) ^ (seed2 >>> 4)) | 0;
    if ((this.x | this.y | this.z | this.w | this.v) === 0) {
      throw new Error('Initial state must have at least one non-zero element.');
    }
    for (let i = 0; i < 64; i++) this.nextInt();
  }

  /** 32 位有符号整数（XorWow 一步）。 */
  nextInt(): number;
  /** [0, until) 的整数。 */
  nextInt(until: number): number;
  /** [from, until) 的整数。 */
  nextInt(from: number, until: number): number;
  nextInt(a?: number, b?: number): number {
    if (a === undefined) return this.step();
    if (b === undefined) return this.nextIntRange(0, a);
    return this.nextIntRange(a, b);
  }

  /** [0, 1) 的小数（53 位精度，和 Kotlin 一样由 26 + 27 位拼成）。 */
  nextDouble(): number;
  /** [from, until) 的小数。 */
  nextDouble(from: number, until: number): number;
  nextDouble(from?: number, until?: number): number {
    const unit = (this.nextBits(26) * 134217728 + this.nextBits(27)) / 9007199254740992; // (hi26 << 27 + lo27) / 2^53
    if (from === undefined || until === undefined) return unit;
    if (!(until > from)) throw new Error(`Random range is empty: [${from}, ${until}).`);
    const size = until - from;
    let r: number;
    if (!Number.isFinite(size) && Number.isFinite(from) && Number.isFinite(until)) {
      const r1 = unit * (until / 2 - from / 2);
      r = from + r1 + r1;
    } else {
      r = from + unit * size;
    }
    return r >= until ? nextDown(until) : r;
  }

  /** [0, 1) 的单精度小数（24 位）。 */
  nextFloat(): number {
    return this.nextBits(24) / 16777216;
  }

  nextBoolean(): boolean {
    return this.nextBits(1) !== 0;
  }

  /** 64 位整数（bigint）：`nextInt().toLong().shl(32) + nextInt()`。 */
  nextLong(): bigint {
    const hi = BigInt(this.step());
    const lo = BigInt(this.step());
    return BigInt.asIntN(64, (hi << 32n) + lo);
  }

  /** Kotlin `List.shuffled(random)`：从最后一个往前，和 [0, i] 里随机一个交换。 */
  shuffled<T>(items: readonly T[]): T[] {
    const list = items.slice();
    for (let i = list.length - 1; i >= 1; i--) {
      const j = this.nextInt(i + 1);
      const tmp = list[i] as T;
      list[i] = list[j] as T;
      list[j] = tmp;
    }
    return list;
  }

  /** Kotlin `List.random(random)`。 */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Collection is empty.');
    return items[this.nextInt(items.length)] as T;
  }

  private step(): number {
    let t = this.x;
    t = t ^ (t >>> 2);
    this.x = this.y;
    this.y = this.z;
    this.z = this.w;
    const v0 = this.v;
    this.w = v0;
    t = t ^ (t << 1) ^ v0 ^ (v0 << 4);
    this.v = t | 0;
    this.addend = (this.addend + 362437) | 0;
    return (t + this.addend) | 0;
  }

  /** takeUpperBits：高 bitCount 位。 */
  private nextBits(bitCount: number): number {
    if (bitCount === 0) return 0;
    return this.step() >>> (32 - bitCount);
  }

  private nextIntRange(from: number, until: number): number {
    if (!(until > from)) throw new Error(`Random range is empty: [${from}, ${until}).`);
    const n = (until - from) | 0;
    if (n > 0 || n === -2147483648) {
      let rnd: number;
      if ((n & -n) === n) {
        const bitCount = 31 - Math.clz32(n);
        rnd = this.nextBits(bitCount);
      } else {
        let v: number;
        let bits: number;
        do {
          bits = this.step() >>> 1;
          v = bits % n;
        } while (((bits - v + (n - 1)) | 0) < 0);
        rnd = v;
      }
      return from + rnd;
    }
    for (;;) {
      const rnd = this.step();
      if (rnd >= from && rnd < until) return rnd;
    }
  }
}

/** Java Math.nextDown（只用于 nextDouble 边界，正常不会走到）。 */
function nextDown(x: number): number {
  if (Number.isNaN(x) || x === -Infinity) return x;
  if (x === 0) return -Number.MIN_VALUE;
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, x);
  let bits = buf.getBigUint64(0);
  bits = x > 0 ? bits - 1n : bits + 1n;
  buf.setBigUint64(0, bits);
  return buf.getFloat64(0);
}
