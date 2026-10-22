/**
 * 📊 群投票计票板（安卓 ui/VoteBoard.kt，功能清单十六节）：按「📤 发到群里投票」以后出现在表头下面，跟着列表滑。
 * 每家一行「✊ 开心云吞面　－　0　＋」，标记和发出去的文字一样（≤ 3 家 ✊✌️🖐️，4–6 家 1️⃣–6️⃣）。
 * 「数好了，看结果」：最多票的赢；打平 → 转盘只在打平的几家里转。票只记在这台手机上，不发到任何地方。
 */
import { resultItem, type ResultsState } from '../../app/state.ts'
import { shortName, text } from '../../app/texts.ts'
import { GAME_SYMBOLS } from '../../data/uiLiterals.ts'
import { voteMarkersOf, voteTotal, type VoteTally } from '../../domain/vote.ts'

export interface VoteBoardProps {
  readonly vote: VoteTally
  readonly results: ResultsState
  readonly onChange: (index: number, add: boolean) => void
  readonly onFinish: () => void
  readonly onClose: () => void
}

export function VoteBoard({ vote, results, onChange, onFinish, onClose }: VoteBoardProps) {
  const markers = voteMarkersOf(vote)
  return (
    <section className="vote-board" aria-labelledby="vote-board-title">
      <div className="vote-board__head">
        <div className="vote-board__titles">
          <h3 id="vote-board-title" className="vote-board__title">
            {text('vote_board_title')}
          </h3>
          <p className="vote-board__hint">{text('vote_board_hint')}</p>
        </div>
        <button type="button" className="btn btn--text vote-board__close" onClick={onClose}>
          {text('vote_close')}
        </button>
      </div>
      <ul className="vote-board__rows">
        {vote.placeIds.map((id, index) => {
          const item = resultItem(results, id)
          const name = item ? shortName(item) : id
          const count = vote.counts[index] ?? 0
          return (
            <li key={id} className="vote-row">
              <span className="vote-row__marker" aria-hidden="true">
                {markers[index]}
              </span>
              <span className="vote-row__name">{name}</span>
              <button
                type="button"
                className="vote-row__btn"
                aria-label={text('vote_minus_a11y', name)}
                disabled={count <= 0}
                onClick={() => onChange(index, false)}
              >
                <span aria-hidden="true">{GAME_SYMBOLS.voteMinus}</span>
              </button>
              <span className="vote-row__count" aria-live="polite">
                <span aria-hidden="true">{count}</span>
                <span className="visually-hidden">{text('vote_count_a11y', count)}</span>
              </span>
              <button type="button" className="vote-row__btn" aria-label={text('vote_plus_a11y', name)} onClick={() => onChange(index, true)}>
                <span aria-hidden="true">{GAME_SYMBOLS.votePlus}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn btn--filled btn--block vote-board__finish" disabled={voteTotal(vote) === 0} onClick={onFinish}>
        {text('vote_finish')}
      </button>
    </section>
  )
}
