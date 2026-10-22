/**
 * 📊 群投票计票板（安卓 domain/VoteTally.kt）：朋友在群里回什么，用户就在这台手机上按一下 ＋。不发到任何地方。
 */
import { voteMarkers } from '../data/avatars.ts'

export { voteMarkers } from '../data/avatars.ts'

export interface VoteTally {
  readonly placeIds: readonly string[]
  readonly counts: readonly number[]
}

export function newVoteTally(placeIds: readonly string[], counts?: readonly number[]): VoteTally {
  return { placeIds: [...placeIds], counts: counts ? [...counts] : placeIds.map(() => 0) }
}

/** 编号：3 家以内 ✊✌️🖐️，4–6 家 1️⃣–6️⃣（和分享文字一样）。 */
export function voteMarkersOf(tally: VoteTally): string[] {
  return voteMarkers(tally.placeIds.length)
}

export function voteTotal(tally: VoteTally): number {
  return tally.counts.reduce((sum, c) => sum + c, 0)
}

function change(tally: VoteTally, index: number, by: number): VoteTally {
  if (index < 0 || index >= tally.counts.length) return tally
  return { ...tally, counts: tally.counts.map((c, i) => (i === index ? Math.max(c + by, 0) : c)) }
}

export function addVote(tally: VoteTally, index: number): VoteTally {
  return change(tally, index, 1)
}

/** 票数不会小于 0。 */
export function removeVote(tally: VoteTally, index: number): VoteTally {
  return change(tally, index, -1)
}

/** 票最多的那家（或几家，打平就是好几家）；还没人投票 → 空的。 */
export function voteLeaders(tally: VoteTally): number[] {
  const most = tally.counts.length === 0 ? 0 : Math.max(...tally.counts)
  if (most <= 0) return []
  return tally.counts.flatMap((c, i) => (c === most ? [i] : []))
}

export function sameVotePlaces(a: VoteTally | null, placeIds: readonly string[]): boolean {
  if (!a || a.placeIds.length !== placeIds.length) return false
  return a.placeIds.every((id, i) => id === placeIds[i])
}
