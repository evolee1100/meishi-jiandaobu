/**
 * 首页（安卓 ui/HomeScreen.kt，功能清单第三节）：上面可以滑的内容 + 固定在最下面的底栏（三个大按钮怎么滑都在）。
 * 先放「要注意的事」（演示黑条、没密钥、定位问题、本月用完），正常的状态行放在最下面。
 * 首页上什么都不花钱：选菜系、调范围、随便挑、饭签、摇一摇都不发请求；只有按三个大按钮才搜索。
 */
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import type { AppState } from '../app/state.ts'
import type { MainStore } from '../app/store.ts'
import {
  cuisineHint,
  fortuneChip,
  greeting,
  locationCard,
  locationStatusLine,
  text,
  webText,
  type LocationCardAction,
  type LocationEnvironment,
} from '../app/texts.ts'
import { HOME_SYMBOLS, SEPARATORS } from '../data/uiLiterals.ts'
import { ALL_CUISINES, cuisineChipLabel, cuisineData, cuisineName, mealData } from '../domain/cuisine.ts'
import { formatKm } from '../domain/geo.ts'
import type { CuisineId, MealId } from '../domain/model.ts'
import { MAX_KM, MIN_KM, STEP_KM } from '../domain/radius.ts'
import { playAnimation } from '../lib/motion.ts'
import { BottomBar } from '../ui/BottomBar.tsx'
import { afterTwoFrames, useReducedMotion } from '../ui/media.ts'
import { PhraseText } from '../ui/PhraseText.tsx'
import { DemoUndoStrip } from './DemoUndoStrip.tsx'

/** 摇一摇在这台手机上能不能用（网页 31.10）。 */
export type ShakeCapability = 'PROBING' | 'UNSUPPORTED' | 'NEEDS_PERMISSION' | 'READY'

export interface HomeScreenProps {
  readonly state: AppState
  readonly store: MainStore
  readonly env: LocationEnvironment
  readonly shake: ShakeCapability
  readonly onEat: (meal: MealId) => void
  readonly onOpenSettings: (expandAdvanced: boolean) => void
  readonly onOpenFortune: () => void
  readonly onOpenRadius: () => void
  readonly onLocationAction: (action: LocationCardAction) => void
  readonly onAllowShake: () => void
}

const EAT_BUTTONS: readonly { meal: MealId; key: 'eat_rice' | 'eat_noodle' | 'eat_any'; className: string }[] = [
  { meal: 'RICE', key: 'eat_rice', className: 'eat-btn--rice' },
  { meal: 'NOODLE', key: 'eat_noodle', className: 'eat-btn--noodle' },
  { meal: 'ANY', key: 'eat_any', className: 'eat-btn--any' },
]

export function HomeScreen(props: HomeScreenProps) {
  const { state, store, env, shake } = props
  const home = state.home
  const reduced = useReducedMotion()
  const diceRef = useRef<HTMLSpanElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const firstCuisine = useRef(true)

  // 🎲 首页每次出现时摇一下：600 毫秒，150 毫秒时 −15°、400 毫秒时 +15°、回 0°。
  useEffect(() => {
    const dice = diceRef.current
    if (!dice) return
    const animation = playAnimation(
      dice,
      [
        { transform: 'rotate(0deg)', offset: 0 },
        { transform: 'rotate(-15deg)', offset: 0.25 },
        { transform: 'rotate(15deg)', offset: 0.6667 },
        { transform: 'rotate(0deg)', offset: 1 },
      ],
      { duration: 600, easing: 'ease-in-out' },
    )
    return () => animation?.cancel()
  }, [])

  // 换了菜系：说明那一行等排好两帧后滚到完全看得见、在底栏上方。
  useEffect(() => {
    if (firstCuisine.current) {
      firstCuisine.current = false
      return
    }
    return afterTwoFrames(() => hintRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }))
  }, [home.selectedCuisine, reduced])

  const card = locationCard(home.location, env)
  const statusLine = locationStatusLine(home.location)
  const fortune = home.fortune
  const showNoKey = home.apiKeySource === 'NONE' && !home.demoMode
  const quotaGone = !home.demoMode && home.remainingSearches <= 0
  // 浏览器不让网页记东西（无痕模式等）：记不了用量就不能保证不花钱，真实搜索停用（演示照玩）。
  const storageBlocked = !home.demoMode && home.storageBlocked

  return (
    <div className="screen home">
      <div className="home__content">
        {home.demoMode && (
          <div className="demo-banner">
            <span className="demo-banner__icon" aria-hidden="true">
              {HOME_SYMBOLS.demoBannerIcon}
            </span>
            <PhraseText className="demo-banner__text" text={text('demo_home_banner')} />
            <button type="button" className="demo-banner__off" onClick={() => store.turnOffDemoFromBanner()}>
              {text('demo_home_banner_off')}
            </button>
          </div>
        )}

        {showNoKey && (
          <section className="no-key-card">
            <PhraseText as="p" className="no-key-card__text" text={text('no_key_banner')} />
            <button type="button" className="btn btn--filled btn--block btn--tall" onClick={() => store.setDemoMode(true)}>
              {text('no_key_demo_button')}
            </button>
            <button type="button" className="btn btn--text" onClick={() => props.onOpenSettings(true)}>
              {text('no_key_settings_link')}
            </button>
          </section>
        )}

        {card && (
          <section className="location-card" aria-live="polite">
            <PhraseText as="p" className="location-card__text" text={card.text} />
            {card.explain && <PhraseText as="p" className="location-card__explain" text={card.explain} />}
            <button type="button" className="btn btn--tonal" onClick={() => props.onLocationAction(card.action)}>
              {card.button}
            </button>
          </section>
        )}

        {storageBlocked && (
          <section className="quota-card" aria-live="polite">
            <PhraseText as="p" text={webText('web_storage_blocked')} />
          </section>
        )}

        {quotaGone && !storageBlocked && (
          <section className="quota-card">
            <PhraseText as="p" text={text('remaining_none')} />
          </section>
        )}

        <div className="home__hello">
          <span className="greeting-chip">{greeting(home.dayPart)}</span>
          {fortune && (
            <button
              type="button"
              className={`fortune-chip${fortune.drawn ? ' fortune-chip--drawn' : ''}`}
              aria-label={text('fortune_chip_a11y') + SEPARATORS.a11yComma + fortuneChip(fortune.stickIndex, fortune.drawn)}
              onClick={props.onOpenFortune}
            >
              <span className="fortune-chip__text">{fortuneChip(fortune.stickIndex, fortune.drawn)}</span>
            </button>
          )}
          <h2 className="home__title">{text('home_title')}</h2>
        </div>
        <PhraseText as="p" className="home__subtitle" text={text('home_subtitle')} />

        {home.streakCuisine && (
          <button type="button" className="streak-card" onClick={() => store.openRandomPick(home.streakCuisine)}>
            <PhraseText text={text('streak_text', 3, cuisineName(home.streakCuisine))} />
          </button>
        )}

        <button type="button" className="dice-entry" onClick={() => store.openRandomPick()}>
          <span ref={diceRef} className="dice-entry__dice" aria-hidden="true">
            {HOME_SYMBOLS.diceIcon}
          </span>
          <PhraseText className="dice-entry__text" text={text('random_entry')} />
          <span className="dice-entry__chevron" aria-hidden="true">
            {HOME_SYMBOLS.chevron}
          </span>
        </button>

        {home.shakeEnabled && shake === 'READY' && <p className="shake-hint">{text('shake_hint')}</p>}
        {home.shakeEnabled && shake === 'NEEDS_PERMISSION' && (
          <div className="shake-hint shake-hint--ask">
            <button type="button" className="btn btn--text btn--small" onClick={props.onAllowShake}>
              📳 {webText('web_shake_allow')}
            </button>
          </div>
        )}

        <h3 className="step-label" id="step-cuisine">
          {text('step_cuisine')}
        </h3>
        <CuisineGrid selected={home.selectedCuisine} onSelect={(c) => store.selectCuisine(c)} gridRef={gridRef} />
        <div ref={hintRef} className="cuisine-hint" aria-live="polite">
          <PhraseText text={cuisineHint(home.selectedCuisine)} />
        </div>

        <RadiusCard store={store} radiusKm={home.radiusKm} />

        <div className="home__status">
          {statusLine && (
            <p className="status-line" aria-live="polite">
              {home.location.kind === 'LOCATING' && <span className="spinner" aria-hidden="true" />}
              <PhraseText text={statusLine} />
            </p>
          )}
          {home.demoMode ? (
            <p className="status-line status-line--quota">
              <PhraseText text={text('demo_quota_line')} />
            </p>
          ) : (
            !quotaGone &&
            !storageBlocked && (
              <p className="status-line status-line--quota">
                <PhraseText text={text('remaining_free', home.remainingSearches)} />
              </p>
            )
          )}
        </div>
      </div>

      <BottomBar className="home-bar" label={text('step_meal')}>
        <DemoUndoStrip visible={home.demoUndo} onUndo={() => store.undoDemoOff()} onExpire={() => store.dismissDemoUndo()} />
        <div className="home-bar__main">
          <div className="home-bar__step">
            <span className="home-bar__label">{text('step_meal')}</span>
            <div className="home-bar__chips">
              <button
                type="button"
                className="chip chip--selected"
                onClick={() => gridRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })}
              >
                <span className="chip__text">{text('step_meal_selected', cuisineChipLabel(home.selectedCuisine))}</span>
              </button>
              <button
                type="button"
                className="chip chip--radius"
                aria-label={text('radius_chip_a11y', formatKm(home.radiusKm))}
                onClick={props.onOpenRadius}
              >
                <span className="chip__text">{text('radius_chip', formatKm(home.radiusKm))}</span>
              </button>
            </div>
          </div>
          <div className="home-bar__eat">
            {EAT_BUTTONS.map((b) => (
              <button key={b.meal} type="button" className={`eat-btn ${b.className}`} onClick={() => props.onEat(b.meal)}>
                <span className="eat-btn__emoji" aria-hidden="true">
                  {mealData(b.meal).emoji}
                </span>
                <span className="eat-btn__text">{text(b.key)}</span>
              </button>
            ))}
          </div>
        </div>
      </BottomBar>
    </div>
  )
}

// ------------------------------------------------------------------ 菜系格子（3.2）

function CuisineGrid({
  selected,
  onSelect,
  gridRef,
}: {
  readonly selected: CuisineId
  readonly onSelect: (cuisine: CuisineId) => void
  readonly gridRef: RefObject<HTMLDivElement | null>
}) {
  const specific = ALL_CUISINES.filter((c) => c !== 'ANY')
  const anySelected = selected === 'ANY'
  return (
    <div className="cuisine-wrap" ref={gridRef} role="radiogroup" aria-labelledby="step-cuisine">
      <button
        type="button"
        role="radio"
        aria-checked={anySelected}
        className={`cuisine-any${anySelected ? ' is-selected' : ''}`}
        onClick={() => onSelect('ANY')}
      >
        <span className="cuisine-any__emoji" aria-hidden="true">
          {cuisineData('ANY').emoji}
        </span>
        <span className="cuisine-any__name">{cuisineName('ANY')}</span>
        <span className="cuisine-any__hint">
          {SEPARATORS.anyHint}
          {text('cuisine_any_hint')}
        </span>
        {anySelected && <Check />}
      </button>
      <div className="cuisine-grid">
        {specific.map((id) => {
          const isSelected = id === selected
          const data = cuisineData(id)
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`cuisine-cell${isSelected ? ' is-selected' : ''}`}
              onClick={() => onSelect(id)}
            >
              <span className="cuisine-cell__emoji" aria-hidden="true">
                {data.emoji}
              </span>
              {/* 「印度/嘛嘛档」窄屏只在「/」后面换行 */}
              <span className="cuisine-cell__name">{data.zhName.replace('/', '/​')}</span>
              {isSelected && <Check />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Check() {
  return (
    <span className="cuisine-check" aria-hidden="true">
      {HOME_SYMBOLS.selectedCheck}
    </span>
  )
}

// ------------------------------------------------------------------ 搜索范围卡（滑杆：拖动时数字跟着变，放手才记住）

function RadiusCard({ store, radiusKm }: { readonly store: MainStore; readonly radiusKm: number }) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    // 原生 change 事件 = 放手（键盘一按也算）。
    const finished = () => store.onRadiusChangeFinished()
    input.addEventListener('change', finished)
    return () => input.removeEventListener('change', finished)
  }, [store])
  const fraction = (radiusKm - MIN_KM) / (MAX_KM - MIN_KM)
  return (
    <section className="radius-card">
      <p className="radius-card__label" id="radius-label">
        {text('radius_label', formatKm(radiusKm))}
      </p>
      <input
        ref={inputRef}
        className="radius-slider"
        type="range"
        min={MIN_KM}
        max={MAX_KM}
        step={STEP_KM}
        value={radiusKm}
        aria-labelledby="radius-label"
        aria-valuetext={text('radius_label', formatKm(radiusKm))}
        style={{ '--fill': `${fraction * 100}%` } as CSSProperties}
        onChange={(event) => store.onRadiusChange(Number(event.target.value))}
      />
      <div className="radius-card__ends" aria-hidden="true">
        <span>{text('radius_min')}</span>
        <span>{text('radius_max')}</span>
      </div>
    </section>
  )
}
