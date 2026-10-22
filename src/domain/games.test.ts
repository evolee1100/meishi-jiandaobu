import { describe, expect, it } from 'vitest'
import { seeded, testPlace } from '../test/helpers.ts'
import type { DuelVerdictId, HandId } from './model.ts'
import { shuffled } from './random.ts'
import {
  ALL_HANDS,
  beats,
  handEmoji,
  handForPlaceIndex,
  isTie,
  isVegetarian,
  judge,
  lineVerdict,
  pickLine,
  pickOfTwo,
  placeIndexOf,
  play,
  ROULETTE_SPIN_MS,
  RPS_SPIN_MS,
  spinMillis,
  verdictOf,
  winnerIndexOf,
  winningHand,
} from './rps.ts'
import { segmentAt, stopRotation, WHEEL_LOOPS, WHEEL_SPIN_MS, wheelSpin } from './spin.ts'
import {
  ALL_AVATARS,
  cleanName,
  cutCount,
  cutters,
  drawOrder,
  judgeSecretHands,
  MAX_PLAYERS,
  MIN_PLAYERS,
  newVetoGame,
  referees,
  secretWinningHand,
  tablePlayer,
  vetoCurrentPlayer,
  vetoCut,
  vetoCutterOf,
  vetoIsFinished,
  vetoIsLastCut,
  vetoRemaining,
  vetoUndo,
  vetoWinner,
  type SecretVerdict,
} from './table.ts'
import { drawTaskCard, EMPTY_DAY_STATS, FREE_PASS, isFreePass, recordDayStats, dayStatsIsEmpty, dayStatsOn, taskAssignee, taskDraw, TASK_DECK_SIZE } from './taskDeck.ts'

const R: HandId = 'ROCK'
const S: HandId = 'SCISSORS'
const P: HandId = 'PAPER'
const VERDICTS: DuelVerdictId[] = ['WIN', 'LOSE', 'TIE', 'ROULETTE', 'TABLE']

describe('十七、✊✌️🖐️ 剪刀石头布 / 🎲 帮我挑一家 / 台词', () => {
  it('DUEL-01 石头赢剪刀、剪刀赢布、布赢石头，自己不赢自己，反过来都不赢', () => {
    expect(beats(R, S)).toBe(true)
    expect(beats(S, P)).toBe(true)
    expect(beats(P, R)).toBe(true)
    for (const hand of ALL_HANDS) expect(beats(hand, hand)).toBe(false)
    expect(beats(S, R)).toBe(false)
    expect(beats(P, S)).toBe(false)
    expect(beats(R, P)).toBe(false)
  })

  it('DUEL-02 9 种出法逐一核对赢的手势、是否平手、赢的是第几家（平手 = 两人出的那家）', () => {
    const expected: [HandId, HandId, HandId, boolean][] = [
      [R, R, R, true],
      [R, S, R, false],
      [R, P, P, false],
      [S, R, R, false],
      [S, S, S, true],
      [S, P, S, false],
      [P, R, P, false],
      [P, S, S, false],
      [P, P, P, true],
    ]
    expect(expected).toHaveLength(9)
    for (const [user, app, winner, tie] of expected) {
      const outcome = judge(user, app)
      expect(winningHand(outcome), `${user} ${app}`).toBe(winner)
      expect(isTie(outcome)).toBe(tie)
      expect(winnerIndexOf(outcome)).toBe(placeIndexOf(winner))
    }
  })

  it('DUEL-03 ✊ = 第 1 家、✌️ = 第 2 家、🖐️ = 第 3 家，来回对应不错', () => {
    expect(handForPlaceIndex(0)).toBe(R)
    expect(handForPlaceIndex(1)).toBe(S)
    expect(handForPlaceIndex(2)).toBe(P)
    for (const i of [0, 1, 2]) expect(placeIndexOf(handForPlaceIndex(i))).toBe(i)
    expect(ALL_HANDS.map(handEmoji)).toEqual(['✊', '✌️', '🖐️'])
  })

  it('DUEL-04 赢家不一定是自己出的那家（出 ✌️ 遇到 ✊ → 第 1 家）；每个手势 3 次里有 2 次是自己那家（含平手）', () => {
    expect(winnerIndexOf(judge(S, R))).toBe(0)
    for (const user of ALL_HANDS) expect(ALL_HANDS.filter((app) => winningHand(judge(user, app)) === user)).toHaveLength(2)
  })

  it('DUEL-05 同一个种子 App 出同样的手；30 局里三种手都出过', () => {
    const first = Array.from({ length: 30 }, (_, i) => play(R, seeded(43 + i)))
    const second = Array.from({ length: 30 }, (_, i) => play(R, seeded(43 + i)))
    expect(first).toEqual(second)
    expect(new Set(first.map((o) => o.app))).toEqual(new Set(ALL_HANDS))
    expect(first.every((o) => o.user === R)).toBe(true)
  })

  it('DUEL-06 帮我挑一家两家机会一样（2,000 次各约一半）；App 的手转 1.5–2 秒，亮灯 1.5–1.9 秒', () => {
    const random = seeded(7)
    const picks = Array.from({ length: 2000 }, () => pickOfTwo(random))
    expect(new Set(picks)).toEqual(new Set([0, 1]))
    const zeros = picks.filter((p) => p === 0).length
    expect(zeros).toBeGreaterThanOrEqual(900)
    expect(zeros).toBeLessThanOrEqual(1100)
    for (let i = 0; i < 500; i++) {
      const rps = spinMillis(random, RPS_SPIN_MS)
      const roulette = spinMillis(random, ROULETTE_SPIN_MS)
      expect(rps >= 1500 && rps <= 2000).toBe(true)
      expect(roulette >= 1500 && roulette <= 1900).toBe(true)
    }
  })

  it('DUEL-07 「剩下的就是缘分 🍀」只在每人划一刀后出现；暗中出拳和投票只抽另外两句；一个人玩的台词不受影响', () => {
    const random = seeded(4)
    const afterCuts = new Set(Array.from({ length: 300 }, () => pickLine('TABLE', random, false, true)))
    expect(afterCuts).toEqual(new Set(['TABLE_1', 'TABLE_2', 'TABLE_3']))
    const otherwise = new Set(Array.from({ length: 300 }, () => pickLine('TABLE', random, false, false)))
    expect(otherwise).toEqual(new Set(['TABLE_1', 'TABLE_3']))
    expect(Array.from({ length: 300 }, () => pickLine('WIN', random, false, false)).every((l) => lineVerdict(l) === 'WIN')).toBe(true)
  })

  it('DUEL-08 每组只抽自己那一组的台词、每组至少用到 2 句、平常不抽「乖乖去吃素吧」；输到素食店一定是那句；赢到素食店还是赢的台词', () => {
    const random = seeded(11)
    for (const verdict of VERDICTS) {
      const lines = new Set(Array.from({ length: 500 }, () => pickLine(verdict, random)))
      expect([...lines].every((l) => lineVerdict(l) === verdict), verdict).toBe(true)
      expect(lines.size, verdict).toBeGreaterThanOrEqual(2)
      expect(lines.has('LOSE_VEGETARIAN')).toBe(false)
    }
    expect(pickLine('LOSE', random, true)).toBe('LOSE_VEGETARIAN')
    expect(lineVerdict(pickLine('WIN', random, true))).toBe('WIN')
  })

  it('DUEL-09 赢/输/平手跟着手势走，没有手势 = 帮我挑一家；素食店按类型认', () => {
    expect(verdictOf(judge(R, S))).toBe('WIN')
    expect(verdictOf(judge(S, R))).toBe('LOSE')
    expect(verdictOf(judge(P, P))).toBe('TIE')
    expect(verdictOf(null)).toBe('ROULETTE')
    expect(isVegetarian({ ...testPlace('v'), primaryType: 'vegetarian_restaurant' })).toBe(true)
    expect(isVegetarian({ ...testPlace('vg'), types: ['vegan_restaurant', 'food'] })).toBe(true)
    expect(isVegetarian(testPlace('c'))).toBe(false)
  })
})

/** 计划里写的规则，自己再写一遍拿来核对每一种出法。 */
function oracle(hands: HandId[]): { kind: string; winners: Set<HandId> } {
  const kinds = new Set(hands)
  if (kinds.size === 1) return { kind: 'same', winners: kinds }
  if (kinds.size === 2) {
    const [a, b] = [...kinds] as [HandId, HandId]
    return { kind: 'two', winners: new Set([beats(a, b) ? a : b]) }
  }
  const counts = new Map(ALL_HANDS.map((h) => [h, hands.filter((x) => x === h).length]))
  const most = Math.max(...counts.values())
  const top = new Set(ALL_HANDS.filter((h) => counts.get(h) === most))
  return { kind: top.size === 1 ? 'heads' : 'tie', winners: top }
}

describe('二十、👥 饭桌模式（规则）', () => {
  it('TABLE-01 抽签排顺序：2–6 人各 6,000 次，每人都在顺序里一次，排第一的机会都是 1/N（误差 3 个百分点内）', () => {
    for (let players = MIN_PLAYERS; players <= MAX_PLAYERS; players++) {
      const random = seeded(500 + players)
      const first = new Array<number>(players).fill(0)
      for (let i = 0; i < 6000; i++) {
        const order = drawOrder(players, random)
        expect([...order].sort()).toEqual(Array.from({ length: players }, (_, k) => k))
        first[order[0] as number]!++
      }
      for (const count of first) expect(Math.abs(count / 6000 - 1 / players), `${players}: ${first}`).toBeLessThanOrEqual(0.03)
    }
  })

  it('TABLE-02 刀数 = 店数 − 1；5 人 4 家：前 3 人划、后 2 人当裁判；2 人 6 家：轮流划 5 刀；人数等于刀数：每人一刀、没有裁判', () => {
    for (let places = 2; places <= 6; places++) expect(cutCount(places)).toBe(places - 1)
    const order = [1, 0, 3, 2, 4]
    expect(cutters(order, 4)).toEqual([1, 0, 3])
    expect(referees(order, 4)).toEqual([2, 4])
    expect(cutters([1, 0], 6)).toEqual([1, 0, 1, 0, 1])
    expect(referees([1, 0], 6)).toEqual([])
    expect(cutters([2, 0, 1], 4)).toEqual([2, 0, 1])
    expect(referees([2, 0, 1], 4)).toEqual([])
  })

  it('TABLE-03 划到剩一家：轮到谁对、划过的和不存在的店划不了、剩 2 家是最后一刀、撤销只撤最后一刀、剩一家结束、结束后不能再划、每刀是谁划的都记得', () => {
    let game = newVetoGame(['a', 'b', 'c', 'd'], [2, 0, 1])
    expect(vetoCurrentPlayer(game)).toBe(2)
    expect(vetoIsLastCut(game)).toBe(false)
    game = vetoCut(game, 'b')
    expect(vetoCurrentPlayer(game)).toBe(0)
    expect(vetoRemaining(game)).toEqual(['a', 'c', 'd'])
    expect(vetoCut(game, 'b')).toEqual(game)
    expect(vetoCut(game, 'zzz')).toEqual(game)
    game = vetoCut(game, 'd')
    expect(vetoIsLastCut(game)).toBe(true)
    expect(vetoCurrentPlayer(game)).toBe(1)
    const undone = vetoUndo(game)
    expect(undone.cuts).toEqual(['b'])
    expect(vetoCurrentPlayer(undone)).toBe(0)
    game = vetoCut(game, 'a')
    expect(vetoIsFinished(game)).toBe(true)
    expect(vetoWinner(game)).toBe('c')
    expect(vetoCurrentPlayer(game)).toBeNull()
    expect(vetoCut(game, 'c')).toEqual(game)
    expect([0, 1, 2].map((i) => vetoCutterOf(game, i))).toEqual([2, 0, 1])
  })

  it('TABLE-04 暗中出拳 2–6 人全部 1,089 种出法逐一按规则核对，顺序打乱判定不变；书上的四个例子都对', () => {
    let checked = 0
    for (let players = 2; players <= 6; players++) {
      const total = 3 ** players
      for (let code = 0; code < total; code++) {
        let c = code
        const hands = Array.from({ length: players }, () => {
          const h = ALL_HANDS[c % 3] as HandId
          c = Math.floor(c / 3)
          return h
        })
        const { kind, winners } = oracle(hands)
        const verdict = judgeSecretHands(hands)
        const label = hands.join(',')
        if (kind === 'same') expect(verdict, label).toEqual({ kind: 'ALL_SAME', hand: [...winners][0] })
        else if (kind === 'two') {
          expect(verdict.kind, label).toBe('TWO_KINDS')
          expect(secretWinningHand(verdict)).toBe([...winners][0])
        } else if (kind === 'heads') {
          expect(verdict.kind, label).toBe('MAJORITY')
          expect(secretWinningHand(verdict)).toBe([...winners][0])
          expect((verdict as Extract<SecretVerdict, { kind: 'MAJORITY' }>).count).toBe(hands.filter((h) => h === [...winners][0]).length)
        } else {
          expect(verdict.kind, label).toBe('TIE')
          expect(new Set((verdict as Extract<SecretVerdict, { kind: 'TIE' }>).tiedHands)).toEqual(winners)
          expect(secretWinningHand(verdict)).toBeNull()
        }
        expect(judgeSecretHands([...hands].reverse())).toEqual(verdict)
        expect(judgeSecretHands(shuffled(seeded(code), hands))).toEqual(verdict)
        checked++
      }
    }
    expect(checked).toBe(9 + 27 + 81 + 243 + 729)
    expect(judgeSecretHands([R, R, S])).toEqual({ kind: 'TWO_KINDS', winner: R, loser: S })
    expect(judgeSecretHands([R, R, R, S, P])).toEqual({ kind: 'MAJORITY', hand: R, count: 3 })
    expect(judgeSecretHands([R, S, R, S, P])).toEqual({ kind: 'TIE', tiedHands: [R, S], count: 2 })
    expect(judgeSecretHands([R, S, P, R, S, P])).toEqual({ kind: 'TIE', tiedHands: [R, S, P], count: 2 })
  })

  it('TABLE-05 打平只在打平的几家里转盘，四种打平情况各 3,000 次机会一样', () => {
    for (const tied of [[0, 1], [0, 2], [1, 2], [0, 1, 2]]) {
      const random = seeded(77 + tied.reduce((a, b) => a + b, 0))
      const wins = new Map<number, number>()
      for (let i = 0; i < 3000; i++) {
        const place = tied[wheelSpin(random, tied.length).target] as number
        wins.set(place, (wins.get(place) ?? 0) + 1)
      }
      expect(new Set(wins.keys())).toEqual(new Set(tied))
      for (const count of wins.values()) expect(Math.abs(count / 3000 - 1 / tied.length)).toBeLessThanOrEqual(0.03)
    }
  })

  it('TABLE-06 改名：去掉前后空白、换行变空格、最多 6 个字（emoji 算 1 个字）、全是空白 = 用默认名', () => {
    expect(cleanName('  阿德 ')).toBe('阿德')
    expect(cleanName('大头\n阿明')).toBe('大头 阿明')
    expect(cleanName('一二三四五六七八')).toBe('一二三四五六')
    expect(cleanName('😀😀😀😀😀😀😀')).toBe('😀😀😀😀😀😀')
    expect(cleanName('   ')).toBe('')
  })
})

describe('二十一、🎡 幸运大转盘', () => {
  it('WHEEL-01 4、5、6 格各转 6,000 次，每格机会一样（误差 3 个百分点内）', () => {
    for (let n = 4; n <= 6; n++) {
      const random = seeded(n * 31)
      const counts = new Array<number>(n).fill(0)
      for (let i = 0; i < 6000; i++) counts[wheelSpin(random, n).target]!++
      for (const c of counts) expect(Math.abs(c / 6000 - 1 / n), `${n}: ${counts}`).toBeLessThanOrEqual(0.03)
    }
  })

  it('WHEEL-02 2–6 格各 500 次：转 3–4 秒、偏移 ≤ 0.35 格、至少转 5 圈不到 6 圈、停在先抽好的那格、前后 0.1° 还是同一格；静止时指针在第 1 格起点', () => {
    const random = seeded(2026)
    const f = Math.fround
    for (let n = 2; n <= 6; n++) {
      for (let i = 0; i < 500; i++) {
        const spin = wheelSpin(random, n)
        expect(spin.millis >= WHEEL_SPIN_MS[0] && spin.millis <= WHEEL_SPIN_MS[1]).toBe(true)
        expect(WHEEL_SPIN_MS).toEqual([3000, 4000])
        expect(Math.abs(spin.offset)).toBeLessThanOrEqual(f(0.35))
        const start = f(f(random.nextFloat() * 720) - 360)
        const stop = stopRotation(start, spin)
        expect(stop).toBeGreaterThanOrEqual(f(start + WHEEL_LOOPS * 360))
        expect(stop).toBeLessThan(start + (WHEEL_LOOPS + 1) * 360)
        expect(segmentAt(stop, n), `n=${n}`).toBe(spin.target)
        expect(segmentAt(f(stop + 0.1), n)).toBe(spin.target)
        expect(segmentAt(f(stop - 0.1), n)).toBe(spin.target)
      }
    }
    expect(WHEEL_LOOPS).toBe(5)
    expect(segmentAt(-1, 4)).toBe(0)
    expect(segmentAt(1, 4)).toBe(3)
    expect(segmentAt(-100, 4)).toBe(1)
  })
})

describe('二十二、🃏 饭桌任务卡、🎯 谁来做、📊 今日战绩', () => {
  it('TASK-01 抽 10,000 次：免死金牌占 3%–7%，24 张普通卡都抽得到；免死金牌认得出；没转谁来做时没有人', () => {
    const random = seeded(99)
    const draws = Array.from({ length: 10_000 }, () => drawTaskCard(random))
    const free = draws.filter((d) => d === FREE_PASS).length / 10_000
    expect(free).toBeGreaterThanOrEqual(0.03)
    expect(free).toBeLessThanOrEqual(0.07)
    expect(TASK_DECK_SIZE).toBe(24)
    expect(new Set(draws.filter((d) => d !== FREE_PASS))).toEqual(new Set(Array.from({ length: TASK_DECK_SIZE }, (_, i) => i)))
    expect(isFreePass(taskDraw(FREE_PASS))).toBe(true)
    expect(taskAssignee(taskDraw(3))).toBeNull()
  })

  it('TASK-02 谁来做：2–6 个人各转 6,000 次，每人机会一样（误差 3 个百分点内）；转盘停在第 3 格就是第 3 个头像（🐵）', () => {
    for (let people = 2; people <= 6; people++) {
      const random = seeded(people)
      const counts = new Array<number>(people).fill(0)
      for (let i = 0; i < 6000; i++) counts[wheelSpin(random, people).target]!++
      for (const c of counts) expect(Math.abs(c / 6000 - 1 / people), `${people}: ${counts}`).toBeLessThanOrEqual(0.03)
    }
    const players = ALL_AVATARS.slice(0, 3).map((a) => tablePlayer(a))
    expect(taskAssignee(taskDraw(1, players, { target: 2, segments: 3, millis: 3000, offset: 0 }))?.avatar).toBe('MONKEY')
  })

  it('TASK-03 今日战绩：赢 2、输 1、心有灵犀 1（帮我挑一家不算）；第二天从 0 开始', () => {
    let stats = EMPTY_DAY_STATS
    stats = recordDayStats(stats, '2026-10-06', 'WIN')
    stats = recordDayStats(stats, '2026-10-06', 'WIN')
    stats = recordDayStats(stats, '2026-10-06', 'LOSE')
    stats = recordDayStats(stats, '2026-10-06', 'TIE')
    stats = recordDayStats(stats, '2026-10-06', 'ROULETTE')
    expect(stats).toEqual({ day: '2026-10-06', wins: 2, losses: 1, ties: 1 })
    expect(dayStatsIsEmpty(dayStatsOn(stats, '2026-10-07'))).toBe(true)
    expect(recordDayStats(stats, '2026-10-07', 'WIN')).toEqual({ day: '2026-10-07', wins: 1, losses: 0, ties: 0 })
  })
})
