/**
 * 🎲 帮你随便挑（安卓 ui/RandomPickDialog.kt，功能清单 5.5–5.7）。结果在打开 / 再摇一次的那一刻就由状态层决定好，
 * 卷轴只是转到那里；摇多少次都不花钱，只有「就它了」以后的搜索才算次数。
 *
 * 所有部分高度固定，按钮永远不动：转动中「就它了」「再摇一次」是灰的（不会在看到结果前就搜索、也不会连按）；
 * 「刚才摇到：」在按钮下面，一开始就留好高度。手机横屏时改成左右两栏。
 */
import { useEffect, useRef, useState } from 'react'
import type { RandomPickState } from '../app/state.ts'
import { pickNoteText, randomResultValue, text } from '../app/texts.ts'
import { RANDOM_PICK } from '../data/constants.ts'
import { HOME_SYMBOLS } from '../data/uiLiterals.ts'
import { choiceChipLabel, cuisineData, mealData, SPECIFIC_CUISINES, ALL_MEALS } from '../domain/cuisine.ts'
import { fortuneChoice } from '../domain/fortune.ts'
import { pickNote } from '../domain/randomPicker.ts'
import type { SearchChoice } from '../domain/model.ts'
import { Dialog } from '../ui/Dialog.tsx'
import { FitText } from '../ui/FitText.tsx'
import { PhraseText } from '../ui/PhraseText.tsx'
import { SlotReel, type ReelItem } from './SlotReel.tsx'

const CUISINE_ITEMS: readonly ReelItem[] = SPECIFIC_CUISINES.map((id) => ({ emoji: cuisineData(id).emoji, label: cuisineData(id).zhName }))
const MEAL_ITEMS: readonly ReelItem[] = ALL_MEALS.map((id) => ({ emoji: mealData(id).emoji, label: mealData(id).label }))

export interface RandomPickDialogProps {
  readonly pick: RandomPickState
  readonly reducedMotion: boolean
  readonly onSettled: (round: number) => void
  readonly onGo: () => void
  readonly onAgain: () => void
  readonly onEarlier: (choice: SearchChoice) => void
  readonly onCancel: () => void
}

export function RandomPickDialog({ pick, reducedMotion, onSettled, onGo, onAgain, onEarlier, onCancel }: RandomPickDialogProps) {
  // 这一轮开始时就停好了（点回「刚才摇到」、或减少动画）→ 卷轴直接停在结果。
  const roundInfo = useRef({ round: -1, instant: false })
  if (roundInfo.current.round !== pick.round) roundInfo.current = { round: pick.round, instant: reducedMotion || pick.settled }
  const instant = roundInfo.current.instant

  const [stopped, setStopped] = useState<{ cuisine: number; meal: number }>({ cuisine: -1, meal: -1 })
  const bothStopped = stopped.cuisine === pick.round && stopped.meal === pick.round
  const spinning = !(pick.settled || bothStopped)

  const reelStopped = (which: 'cuisine' | 'meal') => (round: number) => {
    setStopped((previous) => (previous[which] === round ? previous : { ...previous, [which]: round }))
  }

  // 两个卷轴都停下才算「停好了」：告诉状态层（转屏、再显示时直接显示结果）。
  useEffect(() => {
    if (bothStopped && !pick.settled) onSettled(pick.round)
  }, [bothStopped, pick.settled, pick.round, onSettled])

  const cuisineIndex = SPECIFIC_CUISINES.indexOf(pick.choice.cuisine)
  const mealIndex = ALL_MEALS.indexOf(pick.choice.meal)
  const fortuneCuisine = pick.fortuneStick != null ? fortuneChoice(pick.fortuneStick).cuisine : null
  const note = pickNoteText(pickNote(pick.excludedCuisine, pick.fortuneStick, fortuneCuisine, pick.dayPart, pick.lessLikely))

  return (
    <Dialog labelledBy="random-title" onDismiss={onCancel} className="dialog--card random-dialog" testId="random-dialog">
      <div className="random-dialog__top">
        <h2 id="random-title" className="dialog__title">
          {text('random_title')}
        </h2>
        <div className="reels">
          <SlotReel
            className="reel--cuisine"
            items={CUISINE_ITEMS}
            target={Math.max(cuisineIndex, 0)}
            round={pick.round}
            millis={pick.spinMillis}
            loops={RANDOM_PICK.CUISINE_REEL_LOOPS}
            instant={instant}
            onStopped={reelStopped('cuisine')}
          />
          <span className="reels__dot" aria-hidden="true">
            {HOME_SYMBOLS.reelDot}
          </span>
          <SlotReel
            className="reel--meal"
            items={MEAL_ITEMS}
            target={Math.max(mealIndex, 0)}
            round={pick.round}
            millis={pick.spinMillis + RANDOM_PICK.MEAL_REEL_EXTRA_MS}
            loops={RANDOM_PICK.MEAL_REEL_LOOPS}
            instant={instant}
            onStopped={reelStopped('meal')}
          />
        </div>
        <div className="random-result" aria-live="polite" data-testid="random-result">
          {spinning ? (
            <p className="random-result__spinning">{text('random_spinning')}</p>
          ) : (
            <div key={pick.round} className="random-result__done">
              <p className="random-result__prefix">{text('random_result_prefix')}</p>
              <p className="random-result__value">{randomResultValue(pick.choice)}</p>
            </div>
          )}
        </div>
        {note && <FitText className="random-note" text={note} />}
        <PhraseText as="p" className="random-small" text={text('random_note')} />
      </div>

      <div className="random-dialog__actions">
        <button type="button" className="btn btn--filled btn--block btn--tall" disabled={spinning} onClick={onGo}>
          {text('random_go')}
        </button>
        <button type="button" className="btn btn--outlined btn--block" disabled={spinning} onClick={onAgain}>
          {text('random_again')}
        </button>
        <button type="button" className="btn btn--text btn--block" onClick={onCancel}>
          {text('random_cancel')}
        </button>
        <div className="random-history">
          {pick.history.length > 0 && (
            <>
              <span className="random-history__label">{text('random_history')}</span>
              <div className="random-history__chips">
                {pick.history.map((choice) => (
                  <button
                    key={choice.cuisine + choice.meal}
                    type="button"
                    className="chip chip--history"
                    disabled={spinning}
                    onClick={() => onEarlier(choice)}
                  >
                    {choiceChipLabel(choice)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
