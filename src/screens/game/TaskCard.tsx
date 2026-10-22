/**
 * 🃏 饭桌任务卡和 🎯 谁来做（安卓 ResultPage.TaskCardSection / TaskWheel / PeopleCountRow，功能清单 13.5–13.7）。
 * - 今天的战绩（只有一个人和 App 猜拳、今天玩过才有）；
 * - 任务卡：背面（紫红渐层）整张可以按 → 手机震一下、绕垂直轴翻过来（450 毫秒）→ 正面写任务；一局只能抽一张；
 *   再显示已经抽过的卡直接是正面，不翻；免死金牌没有「谁来做」；
 * - 翻开普通卡后「🎯 转一下，看谁来做」（刚翻开时自己滚进画面）：饭桌模式直接用饭桌的玩家转，
 *   一个人玩先问「几个人一起？」2–6；转盘没有中间的钮，名字最多 6 个字写全；停了「🐼 熊猫，就是你了！」+ 任务。
 * - 再打开已经定了的结果从最上面开始，不自己往下滚；转过的转盘直接停在结果（测试 SCREEN-03）。
 * 全部在手机里玩，不发请求、不扣免费次数。
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DuelState } from '../../app/state.ts'
import { text } from '../../app/texts.ts'
import { TABLE } from '../../data/constants.ts'
import { avatarEmoji, MAX_PLAYERS, MIN_PLAYERS, playerLabel, playerName } from '../../domain/table.ts'
import { dayStatsIsEmpty, isFreePass, taskAssignee, taskCardText, type DayStats, type TaskDraw } from '../../domain/taskDeck.ts'
import { onAnimationDone, playAnimation } from '../../lib/motion.ts'
import { vibrate } from '../../platform/device.ts'
import { PhraseText } from '../../ui/PhraseText.tsx'
import { LuckyWheel } from './LuckyWheel.tsx'

/** 滚进画面时下面多留一点（手机底部的横条会盖住页面最下面）。 */
function reveal(el: Element | null, reducedMotion: boolean): void {
  if (!el || typeof el.scrollIntoView !== 'function') return
  el.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
}

export interface TaskCardSectionProps {
  readonly duel: DuelState
  /** 今天和 App 猜拳的战绩（只有剪刀石头布才给）。 */
  readonly stats: DayStats | null
  readonly reducedMotion: boolean
  readonly onDraw: () => void
  readonly onSpinTask: (people: number) => void
  readonly onTaskWheelStopped: () => void
}

export function TaskCardSection({ duel, stats, reducedMotion, onDraw, onSpinTask, onTaskWheelStopped }: TaskCardSectionProps) {
  const task = duel.task
  const innerRef = useRef<HTMLDivElement>(null)
  // 打开时已经抽过（再显示）：直接是正面，不翻、不滚。
  const drawnAtStart = useRef(task != null)
  const [flipDone, setFlipDone] = useState(task != null)
  const [flippedNow, setFlippedNow] = useState(false)

  useLayoutEffect(() => {
    if (task == null || drawnAtStart.current || flipDone) return
    vibrate('heavy')
    const inner = innerRef.current
    const animation = inner
      ? playAnimation(inner, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], { duration: 450, easing: 'ease-in-out' })
      : null
    const done = () => {
      setFlipDone(true)
      setFlippedNow(true)
    }
    if (!animation) {
      done()
      return
    }
    return onAnimationDone(animation, done)
  }, [task != null])

  const drawn = task != null
  return (
    <div className="task-section">
      {stats && !dayStatsIsEmpty(stats) && <p className="backdrop task-section__stats">{text('stats_today', stats.wins, stats.losses, stats.ties)}</p>}
      <div className={`task-card${drawn ? ' is-drawn' : ''}`}>
        <div ref={innerRef} className="task-card__inner">
          {drawn ? (
            <div className="task-card__face task-card__back" aria-hidden="true">
              <span className="task-card__title">{text('task_draw')}</span>
              <span className="task-card__note">{text('task_draw_note')}</span>
            </div>
          ) : (
            <button type="button" className="task-card__face task-card__back" aria-label={text('task_card_a11y')} onClick={onDraw}>
              <span className="task-card__title" aria-hidden="true">
                {text('task_draw')}
              </span>
              <span className="task-card__note" aria-hidden="true">
                {text('task_draw_note')}
              </span>
            </button>
          )}
          <div className="task-card__face task-card__front" aria-live="polite" aria-hidden={drawn ? undefined : true}>
            {task && (
              <>
                <span className="task-card__label">{text('task_label')}</span>
                <PhraseText className="task-card__text" text={taskCardText(task.card)} />
              </>
            )}
          </div>
        </div>
      </div>
      {task && !isFreePass(task) && flipDone && (
        <TaskWheel task={task} cardJustTurned={flippedNow} reducedMotion={reducedMotion} onSpinTask={onSpinTask} onStopped={onTaskWheelStopped} />
      )}
      <PhraseText as="p" className="backdrop game-free-note" text={text('duel_free_note')} />
    </div>
  )
}

function TaskWheel({
  task,
  cardJustTurned,
  reducedMotion,
  onSpinTask,
  onStopped,
}: {
  readonly task: TaskDraw
  readonly cardJustTurned: boolean
  readonly reducedMotion: boolean
  readonly onSpinTask: (people: number) => void
  readonly onStopped: () => void
}) {
  const [choosing, setChoosing] = useState(false)
  if (task.spin != null) return <TaskSpin task={task} reducedMotion={reducedMotion} onStopped={onStopped} />
  if (choosing) return <PeopleChooser reducedMotion={reducedMotion} onPick={onSpinTask} />
  return (
    <WhoButton
      cardJustTurned={cardJustTurned}
      reducedMotion={reducedMotion}
      onClick={() => {
        if (task.players.length === 0) setChoosing(true)
        else onSpinTask(task.players.length)
      }}
    />
  )
}

function WhoButton({ cardJustTurned, reducedMotion, onClick }: { readonly cardJustTurned: boolean; readonly reducedMotion: boolean; readonly onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  // 卡刚翻开：这个按钮自己滚进画面（测试 SCREEN-06）
  useEffect(() => {
    if (cardJustTurned) reveal(ref.current, reducedMotion)
  }, [cardJustTurned, reducedMotion])
  return (
    <button ref={ref} type="button" className="btn btn--outlined btn--page btn--block btn--tall task-who reveal-margin" onClick={onClick}>
      {text('task_who')}
    </button>
  )
}

/** 「几个人一起？」+ 一排 5 个大圆钮 2–6（出现时整排滚进画面）。 */
function PeopleChooser({ reducedMotion, onPick }: { readonly reducedMotion: boolean; readonly onPick: (people: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    reveal(ref.current, reducedMotion)
  }, [reducedMotion])
  const counts = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i)
  return (
    <div ref={ref} className="people-chooser reveal-margin">
      <p className="people-chooser__title backdrop" id="people-chooser-title">
        {text('task_how_many')}
      </p>
      <div className="people-row" role="radiogroup" aria-labelledby="people-chooser-title">
        {counts.map((n) => (
          <button key={n} type="button" role="radio" aria-checked="false" className="people-row__btn" aria-label={text('table_people_a11y', n)} onClick={() => onPick(n)}>
            <span aria-hidden="true">{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 谁来做的转盘：转（2.5–3.2 秒），停了写「🐼 熊猫，就是你了！」+ 任务；刚转、刚停时自己滚进画面。 */
function TaskSpin({ task, reducedMotion, onStopped }: { readonly task: TaskDraw; readonly reducedMotion: boolean; readonly onStopped: () => void }) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const whoRef = useRef<HTMLDivElement>(null)
  // 现在才转的（不是再显示的结果）：转盘滚进画面
  const spinningNow = useRef(!task.spun)
  const [stopped, setStopped] = useState(task.spun)
  const [stoppedNow, setStoppedNow] = useState(false)
  useEffect(() => {
    if (spinningNow.current) reveal(wheelRef.current, reducedMotion)
  }, [reducedMotion])
  useEffect(() => {
    if (stoppedNow) reveal(whoRef.current, reducedMotion)
  }, [stoppedNow, reducedMotion])
  const spin = task.spin
  if (!spin) return null
  const assignee = taskAssignee(task)
  return (
    <>
      <div ref={wheelRef} className="task-wheel reveal-margin">
        <LuckyWheel
          segments={task.players.map((player) => ({ emoji: avatarEmoji(player.avatar), label: playerName(player) }))}
          spin={spin}
          play={!task.spun}
          reducedMotion={reducedMotion}
          onStopped={() => {
            setStopped(true)
            setStoppedNow(true)
            onStopped()
          }}
          hub={false}
          labelChars={TABLE.MAX_NAME_LENGTH}
          description={text('task_who')}
          maxSize={260}
          testId="task-wheel"
        />
      </div>
      {stopped && assignee && (
        <div ref={whoRef} className="task-assigned backdrop reveal-margin" aria-live="polite">
          <PhraseText as="p" className="task-assigned__who" text={text('task_assigned', playerLabel(assignee))} />
          <PhraseText as="p" className="task-assigned__card" text={taskCardText(task.card)} />
        </div>
      )}
    </>
  )
}
