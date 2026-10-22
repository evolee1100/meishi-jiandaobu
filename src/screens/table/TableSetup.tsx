/**
 * 👥 饭桌模式第一页（安卓 TableOverlay.TableSetup，功能清单 14.2）。
 * 单栏从上到下：标题 → 几个人？（2–6，记住）→ 6 个头像（玩的亮、不玩的淡；点一下改名字）→ 说明 →
 * 这次的候选 → ✂️ 每人划一刀 / 🙈 暗中出拳（刚好 3 家才能玩）→ 在手机里玩，不扣免费次数。
 * 双栏（手机横屏）：左边「谁」，右边「玩什么」。
 */
import type { ResultItem, TableState } from '../../app/state.ts'
import { secretPossible } from '../../app/state.ts'
import { shortName, text } from '../../app/texts.ts'
import { SEPARATORS } from '../../data/uiLiterals.ts'
import type { AvatarId } from '../../domain/model.ts'
import { avatarEmoji, MAX_PLAYERS, MIN_PLAYERS, playerLabel, playerName } from '../../domain/table.ts'
import { PhraseText } from '../../ui/PhraseText.tsx'

export interface TableSetupProps {
  readonly table: TableState
  readonly places: readonly ResultItem[]
  readonly twoPane: boolean
  readonly onPlayers: (count: number) => void
  readonly onRename: (avatar: AvatarId) => void
  readonly onStartVeto: () => void
  readonly onStartSecret: () => void
}

export function TableSetup({ table, places, twoPane, onPlayers, onRename, onStartVeto, onStartSecret }: TableSetupProps) {
  const counts = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i)
  const secretOk = secretPossible(table)
  const who = (
    <>
      <PhraseText as="h2" id="table-title" className="table-title" text={text('table_title')} />
      <p className="table-subtitle" id="table-how-many">
        {text('table_how_many')}
      </p>
      <div className={`people-row${twoPane ? ' people-row--small' : ''}`} role="radiogroup" aria-labelledby="table-how-many">
        {counts.map((n) => {
          const selected = n === table.playerCount
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`people-row__btn${selected ? ' is-selected' : ''}`}
              aria-label={text('table_people_a11y', n)}
              onClick={() => onPlayers(n)}
            >
              <span aria-hidden="true">{n}</span>
            </button>
          )
        })}
      </div>
      <ul className="avatar-row">
        {table.avatars.map((player, index) => {
          const playing = index < table.playerCount
          return (
            <li key={player.avatar} className={`avatar-row__item${playing ? ' is-playing' : ''}`}>
              <button type="button" className="avatar-row__btn" aria-label={text('avatar_a11y', playerLabel(player))} onClick={() => onRename(player.avatar)}>
                <span className="avatar-row__face" aria-hidden="true">
                  {avatarEmoji(player.avatar)}
                </span>
                <span className="avatar-row__name" aria-hidden="true">
                  {playerName(player)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="table-note">{text('table_rename_hint')}</p>
    </>
  )
  const games = (
    <>
      <PhraseText as="p" className="table-candidates" text={text('table_candidates') + places.map(shortName).join(SEPARATORS.list)} />
      <GameCard title={text('table_veto_title')} description={text('table_veto_desc')} enabled onClick={onStartVeto} />
      <GameCard
        title={text('table_secret_title')}
        description={secretOk ? text('table_secret_desc') : text('table_secret_need_three')}
        enabled={secretOk}
        onClick={onStartSecret}
      />
      <PhraseText as="p" className="table-free-note" text={text('duel_free_note')} />
    </>
  )
  if (twoPane) {
    return (
      <div className="table-panes">
        <div className="table-pane">{who}</div>
        <div className="table-pane">{games}</div>
      </div>
    )
  }
  return (
    <div className="table-column">
      {who}
      {games}
    </div>
  )
}

/** 开一个游戏的大卡；不能玩时变淡，说明换成原因。 */
function GameCard({ title, description, enabled, onClick }: { readonly title: string; readonly description: string; readonly enabled: boolean; readonly onClick: () => void }) {
  return (
    <button type="button" className="table-game-card" disabled={!enabled} onClick={onClick}>
      <span className="table-game-card__title">{title}</span>
      <PhraseText className="table-game-card__desc" text={description} />
    </button>
  )
}
