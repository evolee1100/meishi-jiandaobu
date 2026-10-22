/**
 * 🙈 暗中出拳（安卓 TableOverlay.SecretScreen，功能清单 14.5）：刚好 3 家，✊ = 第 1 家、✌️ = 第 2 家、🖐️ = 第 3 家。
 * 每人偷偷出一个手势，App 不出、只当裁判。画面只知道「谁拿着手机、几个人出了」：翻牌前一个手势都拿不到（测试 SCREEN-01、TABLE-15）。
 *
 * 1. 交手机：大头像「交给 🐼 熊猫」/「传给 🐯 老虎 👉」、别给别人看哦 🙈、已经出了 1 / 4 个人、【我拿到了，开始出拳】
 *    （这一页不能改任何人的手势）；
 * 2. 选手势：三张大卡（手势、手势名、店名缩小字放进一行）；按一张 → 震一下 → 三张一起翻过去「✔ 出好了」
 *    （旁边偷看的人看不出按了哪张）；下面【交给 🐯 老虎 👉】/ 最后一个人【出好了，叫大家过来 👀】+「点错了？重出」
 *    （只有自己这一页有重出；不会过几秒自己交出去）；
 * 3. 全部出完：大家的头像、【全部出完了！一起翻牌 👀】；
 * 4. 揭晓：按传手机的顺序每 0.15 秒翻一张，最后一张翻完震一下 → 判定大字；人头打平 → 转盘在打平的几家里自己转；
 *    停了（或没有转盘）出【看结果 🎉】，1.8 秒后也会自己进「就这一家吧！」。减少动画：一次全部翻开、马上出判定。
 */
import { useEffect, useRef, useState } from 'react'
import {
  newDuelState,
  secretCurrentPlayer,
  secretNextPlayer,
  statusOf,
  tablePlayers,
  type ResultItem,
  type ResultsState,
  type SecretProgress,
  type TableState,
} from '../../app/state.ts'
import { decisionVerdict, shortName, text } from '../../app/texts.ts'
import { TABLE } from '../../data/constants.ts'
import { GAME_SYMBOLS } from '../../data/uiLiterals.ts'
import type { HandId } from '../../domain/model.ts'
import { handEmoji, handForPlaceIndex, handName } from '../../domain/rps.ts'
import { avatarEmoji, playerLabel, playerName, type TablePlayer } from '../../domain/table.ts'
import { vibrate } from '../../platform/device.ts'
import { FitText } from '../../ui/FitText.tsx'
import { PhraseText } from '../../ui/PhraseText.tsx'
import { LuckyWheel } from '../game/LuckyWheel.tsx'

export interface SecretBoardProps {
  readonly table: TableState
  readonly places: readonly ResultItem[]
  readonly results: ResultsState
  readonly twoPane: boolean
  readonly reducedMotion: boolean
  readonly onTake: () => void
  readonly onChoose: (hand: HandId) => void
  readonly onPass: () => void
  readonly onRedo: () => void
  readonly onReveal: () => void
  readonly onShowResult: () => void
}

export function SecretBoard(props: SecretBoardProps) {
  const secret = props.table.secret
  if (!secret) return null
  switch (secret.step) {
    case 'HANDOVER':
      return <Handover {...props} secret={secret} />
    case 'CHOOSING':
    case 'CHOSEN':
      return <ChooseHand {...props} secret={secret} />
    case 'ALL_DONE':
      return <AllDone {...props} />
    case 'REVEAL':
      return <Reveal key={props.table.round} {...props} secret={secret} />
  }
}

function playerAt(table: TableState, index: number): TablePlayer | null {
  return tablePlayers(table)[index] ?? null
}

/** 「交给 🐼 熊猫」：谁的手势都不在画面上，也改不了任何人的手势。 */
function Handover({ table, secret, twoPane, onTake }: SecretBoardProps & { readonly secret: SecretProgress }) {
  const player = playerAt(table, secretCurrentPlayer(secret))
  if (!player) return null
  const title = text(secret.turn === 0 ? 'secret_handover_first' : 'secret_handover_next', playerLabel(player))
  const avatar = (
    <div className="secret-avatar" aria-hidden="true">
      <span className="secret-avatar__emoji">{avatarEmoji(player.avatar)}</span>
    </div>
  )
  const words = (
    <div className="secret-words">
      <div aria-live="polite">
        <PhraseText as="h2" id="game-title" className="secret-handover__title" text={title} />
      </div>
      <p className="secret-handover__peek">{text('secret_dont_peek')}</p>
      <p className="secret-progress">{text('secret_progress', secret.chosenCount, secret.order.length)}</p>
      <button type="button" className="btn btn--filled btn--block secret-big-btn" onClick={onTake}>
        <PhraseText text={text('secret_take')} />
      </button>
    </div>
  )
  return (
    <div className={`secret-handover${twoPane ? ' secret-handover--two-pane' : ''}`} data-testid="secret-handover">
      {avatar}
      {words}
    </div>
  )
}

/** 三张大卡，一张代表一家；出了以后三张一起翻过去「✔ 出好了」。 */
function ChooseHand({ table, secret, places, results, twoPane, onChoose, onPass, onRedo }: SecretBoardProps & { readonly secret: SecretProgress }) {
  const player = playerAt(table, secretCurrentPlayer(secret))
  if (!player) return null
  const chosen = secret.step === 'CHOSEN'
  const next = secretNextPlayer(secret)
  const nextPlayer = next == null ? null : playerAt(table, next)
  const passLabel = nextPlayer ? text('secret_pass_next', playerLabel(nextPlayer)) : text('secret_pass_last')
  const pass = (
    <button type="button" className="btn btn--filled secret-big-btn secret-pass" onClick={onPass}>
      <PhraseText text={passLabel} />
    </button>
  )
  const redo = (
    <button type="button" className="btn btn--text secret-redo" onClick={onRedo}>
      {text('secret_redo_self')}
    </button>
  )
  return (
    <div className={`secret-choose${twoPane ? ' secret-choose--two-pane' : ''}`} data-testid="secret-choose" data-step={chosen ? 'chosen' : 'choosing'}>
      <PhraseText as="h2" id="game-title" className="secret-choose__title" text={text('secret_choose_title', playerLabel(player))} />
      {!twoPane && <p className="secret-choose__hint">{text('secret_choose_hint')}</p>}
      <div className="secret-cards">
        {places.map((item, index) => {
          const hand = handForPlaceIndex(index)
          return (
            <SecretHandCard
              key={item.place.id}
              hand={hand}
              name={shortName(item)}
              hoursUnknown={statusOf(results, item.place).kind === 'UNKNOWN'}
              turned={chosen}
              tall={!twoPane}
              onClick={() => {
                vibrate('heavy')
                onChoose(hand)
              }}
            />
          )
        })}
      </div>
      {chosen ? (
        <div className={`secret-pass-row${twoPane ? ' secret-pass-row--two-pane' : ''}`}>
          {twoPane ? (
            <>
              {redo}
              {pass}
            </>
          ) : (
            <>
              {pass}
              {redo}
            </>
          )}
        </div>
      ) : (
        <p className="secret-progress">{text('secret_progress', secret.chosenCount, secret.order.length)}</p>
      )}
    </div>
  )
}

/**
 * 一个手势代表一家（比一个人和 App 猜拳的卡大）：手势、手势名、店名缩小字放进一行。
 * 翻过去以后背面三张一样「✔ 出好了」；读屏也只念「✔ 出好了」，不会念出按了哪张。
 */
function SecretHandCard({
  hand,
  name,
  hoursUnknown,
  turned,
  tall,
  onClick,
}: {
  readonly hand: HandId
  readonly name: string
  readonly hoursUnknown: boolean
  readonly turned: boolean
  readonly tall: boolean
  readonly onClick: () => void
}) {
  const handLabel = handName(hand)
  return (
    <div className={`secret-card${turned ? ' is-turned' : ''}${tall ? ' secret-card--tall' : ''}`}>
      <div className="secret-card__inner">
        <button
          type="button"
          className="secret-card__face secret-card__front"
          disabled={turned}
          aria-hidden={turned ? true : undefined}
          tabIndex={turned ? -1 : undefined}
          aria-label={text('secret_hand_a11y', `${handEmoji(hand)} ${handLabel}`, name)}
          onClick={onClick}
        >
          <span className="secret-card__emoji" aria-hidden="true">
            {handEmoji(hand)}
          </span>
          <span className="secret-card__hand" aria-hidden="true">
            {handLabel}
          </span>
          <FitText className="secret-card__name" text={name} minPx={10} minRatio={0.6} aria-hidden="true" />
          {hoursUnknown && <PhraseText className="secret-card__unknown" text={text('open_unknown_careful')} aria-hidden="true" />}
        </button>
        <div className="secret-card__face secret-card__back" aria-hidden={turned ? undefined : true}>
          <span className="secret-card__done">{text('secret_done')}</span>
        </div>
      </div>
    </div>
  )
}

/** 「全部出完了！一起翻牌 👀」：大家围过来。这时谁的手势都定了，没有重出。 */
function AllDone({ table, twoPane, onReveal }: SecretBoardProps) {
  return (
    <div className={`secret-all-done${twoPane ? ' secret-all-done--two-pane' : ''}`} data-testid="secret-all-done">
      <p className="secret-all-done__faces" aria-hidden="true">
        {tablePlayers(table).map((player) => (
          <span key={player.avatar}>{avatarEmoji(player.avatar)}</span>
        ))}
      </p>
      <h2 id="game-title" className="secret-all-done__note">
        {text('secret_all_done_note')}
      </h2>
      <button type="button" className="btn btn--filled btn--block secret-reveal-btn" onClick={onReveal}>
        <PhraseText text={text('secret_all_done')} />
      </button>
    </div>
  )
}

/** 一起翻牌：按传手机的顺序一张一张翻开 → 判定 →（打平）转盘 → 看结果。 */
function Reveal({ table, secret, places, twoPane, reducedMotion, onShowResult }: SecretBoardProps & { readonly secret: SecretProgress }) {
  const total = secret.order.length
  const [shown, setShown] = useState(reducedMotion ? total : 0)
  const [verdictShown, setVerdictShown] = useState(reducedMotion)
  const [wheelStopped, setWheelStopped] = useState(secret.tieSpin == null)
  const showRef = useRef(onShowResult)
  showRef.current = onShowResult

  // 每 0.15 秒翻一张；最后一张翻完震一下、出判定。
  useEffect(() => {
    if (reducedMotion) {
      setShown(total)
      setVerdictShown(true)
      vibrate('heavy')
      return
    }
    let count = 0
    const timer = setInterval(() => {
      count++
      setShown(count)
      if (count >= total) {
        clearInterval(timer)
        vibrate('heavy')
        setVerdictShown(true)
      }
    }, TABLE.FLIP_EVERY_MS)
    return () => clearInterval(timer)
    // 一局只翻一次
  }, [])

  // 判定出来（转盘也停了）1.8 秒后自己进「就这一家吧！」。
  useEffect(() => {
    if (!verdictShown || !wheelStopped) return
    const timer = setTimeout(() => showRef.current(), TABLE.VERDICT_MS)
    return () => clearTimeout(timer)
  }, [verdictShown, wheelStopped])

  const players = tablePlayers(table)
  const verdict = decisionVerdict(
    newDuelState({
      round: 0,
      placeIds: table.placeIds,
      mode: 'SECRET_HANDS',
      winnerIndex: secret.winnerIndex,
      table: { players, order: secret.order, cuts: [], hands: secret.hands },
    }),
    places,
    () => 0,
  )
  const tie = secret.tieSpin
  const hands = (
    <ol className={`secret-reveal__hands${twoPane ? ' is-small' : ''}`} aria-label={text('secret_all_done')}>
      {secret.order.map((playerIndex, position) => {
        const player = players[playerIndex]
        if (!player) return null
        return <RevealedHand key={player.avatar} player={player} hand={secret.hands[playerIndex] ?? null} turned={position < shown} reducedMotion={reducedMotion} />
      })}
    </ol>
  )
  const verdictText = verdictShown && (
    <div className="secret-reveal__verdict" aria-live="polite">
      <PhraseText as="p" text={verdict} />
    </div>
  )
  const wheel = (max: number) =>
    tie &&
    verdictShown && (
      <LuckyWheel
        segments={secret.tiedIndices.map((index) => {
          const item = places[index]
          return { emoji: handEmoji(handForPlaceIndex(index)), label: item ? shortName(item) : '' }
        })}
        spin={tie}
        play
        reducedMotion={reducedMotion}
        onStopped={() => setWheelStopped(true)}
        hub={false}
        description={text('wheel_tie_title')}
        maxSize={max}
        className="secret-reveal__wheel"
        testId="secret-wheel"
      />
    )
  const resultButton = verdictShown && wheelStopped && (
    <button type="button" className="btn btn--filled secret-see-result" onClick={onShowResult}>
      {text('secret_see_result')}
    </button>
  )
  const title = (
    <h2 id="game-title" className="visually-hidden">
      {text('secret_all_done')}
    </h2>
  )
  if (twoPane && tie && verdictShown) {
    return (
      <div className="secret-reveal secret-reveal--split" data-testid="secret-reveal">
        {title}
        <div className="secret-reveal__start">
          {hands}
          {verdictText}
          {resultButton}
        </div>
        <div className="secret-reveal__end">{wheel(260)}</div>
      </div>
    )
  }
  return (
    <div className={`secret-reveal${twoPane ? ' secret-reveal--two-pane' : ''}`} data-testid="secret-reveal">
      {title}
      {hands}
      {verdictText}
      {wheel(twoPane ? 200 : 280)}
      {resultButton}
    </div>
  )
}

/** 一起翻牌时一个人的牌：背面（头像、❓、名字）→ 翻开（头像、手势、名字）。 */
function RevealedHand({ player, hand, turned, reducedMotion }: { readonly player: TablePlayer; readonly hand: HandId | null; readonly turned: boolean; readonly reducedMotion: boolean }) {
  const face = turned && hand != null
  const name = playerName(player)
  return (
    <li className={`reveal-hand${face ? ' is-turned' : ''}${reducedMotion ? ' no-motion' : ''}`}>
      <span className="reveal-hand__inner">
        <span className="reveal-hand__face reveal-hand__back" aria-hidden={face ? true : undefined}>
          <span className="reveal-hand__avatar">{avatarEmoji(player.avatar)}</span>
          <span className="reveal-hand__hand" aria-hidden="true">
            {GAME_SYMBOLS.unknownHand}
          </span>
          <span className="reveal-hand__name">{name}</span>
        </span>
        <span className="reveal-hand__face reveal-hand__front" aria-hidden={face ? undefined : true}>
          <span className="reveal-hand__avatar">{avatarEmoji(player.avatar)}</span>
          <span className="reveal-hand__hand">{hand ? handEmoji(hand) : ''}</span>
          <span className="reveal-hand__name">{name}</span>
        </span>
      </span>
    </li>
  )
}
