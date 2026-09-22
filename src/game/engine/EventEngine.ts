import type { EventDef, GameState, Season } from '../types'
import { EVENT_DEFS, EVENT_MAP, RANDOM_EVENT_IDS, TUTORIAL_STEPS } from '../../data'
import { BASE_GAME_MINUTES_PER_REAL_SECOND, calendarFromMinutes, MINUTES_PER_DAY, meetsRequirement, safeNumber } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import type { EngineHooks } from './hooks'
import { eventIntervalMinutes } from './TimeEngine'
import { drawOffer } from './CardEngine'
import { applyDeltaToAllCohorts } from './CourseEngine'
import { applyDeclarativeChoice } from '../../data/eventHelpers'

/** 事件自动结束的游戏时间上限（游戏日） */
export const EVENT_AUTO_RESOLVE_DAYS = 150
/** 事件至少保留的现实时间（秒）：保证不管游戏速度多快，玩家都有 5 分钟做决定 */
export const EVENT_MIN_REAL_SECONDS = 300

function expiryWindow(minute: number): { expiresAtMinute: number; expiresAtEpoch: number } {
  return {
    expiresAtMinute: minute + EVENT_AUTO_RESOLVE_DAYS * MINUTES_PER_DAY,
    expiresAtEpoch: Date.now() + EVENT_MIN_REAL_SECONDS * 1000,
  }
}

/** 事件剩余的可处理时间（现实秒；游戏暂停时视为无限） */
export function eventTimeRemaining(
  state: GameState,
  event: GameState['events']['active'][number],
): { realSeconds: number; paused: boolean } {
  const now = Date.now()
  const realRemaining = event.expiresAtEpoch != null ? Math.max(0, (event.expiresAtEpoch - now) / 1000) : 0
  const gameRemainingMinutes = Math.max(0, event.expiresAtMinute - state.time.minutes)
  const speed = Math.max(0.1, safeNumber(state.time.speed, 1))
  const gameRemainingReal = state.time.paused
    ? Number.POSITIVE_INFINITY
    : gameRemainingMinutes / (BASE_GAME_MINUTES_PER_REAL_SECOND * speed)
  return { realSeconds: Math.max(realRemaining, gameRemainingReal), paused: state.time.paused }
}

export function activeEventList(state: GameState): { event: GameState['events']['active'][number]; def: EventDef }[] {
  return state.events.active
    .map((event) => ({ event, def: EVENT_MAP[event.defId] }))
    .filter((entry): entry is { event: GameState['events']['active'][number]; def: EventDef } => Boolean(entry.def))
}

export function isEventEligible(state: GameState, def: EventDef): boolean {
  if (def.weight <= 0) return false
  const calendar = calendarFromMinutes(state.time.minutes)
  if (def.minSchoolYear != null && calendar.schoolYear < def.minSchoolYear) return false
  if (def.seasons && !def.seasons.includes(calendar.season as Season)) return false
  if (def.once && (state.events.seenCount[def.id] ?? 0) > 0) return false
  const cooldown = state.events.cooldownUntil[def.id] ?? 0
  if (cooldown > state.time.minutes) return false
  if (state.events.active.some((e) => e.defId === def.id)) return false
  return meetsRequirement(state, def.requires)
}

export function eligibleEventDefs(state: GameState): EventDef[] {
  return EVENT_DEFS.filter((def) => isEventEligible(state, def))
}

export function triggerEvent(state: GameState, id: string, hooks: EngineHooks, source = '随机事件'): boolean {
  const def = EVENT_MAP[id]
  if (!def) return false
  state.events.active.push({
    uid: `evt_${Math.round(state.time.minutes)}_${id}_${Math.round(Math.random() * 1e5)}`,
    defId: id,
    triggeredAtMinute: state.time.minutes,
    ...expiryWindow(state.time.minutes),
    source,
  })
  state.events.seenCount[id] = (state.events.seenCount[id] ?? 0) + 1
  if (!state.statistics.distinctEventIds.includes(id)) state.statistics.distinctEventIds.push(id)
  hooks.notify(`事件：${def.title}`, 'event')
  return true
}

export function rollRandomEvent(state: GameState, mods: ModifierIndex, hooks: EngineHooks): void {
  // 剧情引导期间只有剧本事件（见 tutorial.ts 的 demoEvent）：
  // 玩家处理完第一件校园事件后才恢复随机事件，避免一上来就被打断。
  if (!randomEventsUnlocked(state)) return
  const interval = eventIntervalMinutes(state, mods)
  if (state.time.minutes < state.events.nextRollMinute) return
  state.events.nextRollMinute = state.time.minutes + interval * (0.7 + Math.random() * 0.6)
  if (state.events.active.length >= 3) return
  const candidates = eligibleEventDefs(state)
  if (candidates.length === 0) return
  // event_good 会降低负面事件的出现权重（正面事件保持原权重）
  const goodBias = Math.max(0.2, mods.mul('event_good'))
  const weights = candidates.map((def) => {
    const negative = NEGATIVE_EVENT_HINTS.some((keyword) => def.title.includes(keyword))
    return Math.max(0.01, negative ? def.weight / goodBias : def.weight)
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < candidates.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) {
      triggerEvent(state, candidates[i].id, hooks)
      return
    }
  }
  triggerEvent(state, candidates[candidates.length - 1].id, hooks)
}

export function resolveEvent(
  state: GameState,
  uid: string,
  choiceIndex: number,
  mods: ModifierIndex,
  hooks: EngineHooks,
): boolean {
  const index = state.events.active.findIndex((e) => e.uid === uid)
  if (index < 0) return false
  const active = state.events.active[index]
  const def = EVENT_MAP[active.defId]
  if (!def) {
    state.events.active.splice(index, 1)
    return false
  }
  const choice = def.choices[choiceIndex] ?? def.choices[0]
  // 声明式字段（cost / gain / studentDelta / teacherDelta / notes）与自定义 apply 一起结算
  const lines: string[] = applyDeclarativeChoice(state, choice)
  for (const effect of choice.effects ?? []) {
    state.school.permanentEffects.push({ ...effect })
    lines.push(`永久效果：${effect.target} ${effect.op === 'mul' ? `${(effect.value * 100).toFixed(0)}%` : `+${effect.value}`}`)
  }
  for (const scheduled of choice.schedule ?? []) {
    const at = state.time.minutes + scheduled.days * 1440
    state.events.scheduled.push({
      uid: `evt_${Math.round(at)}_${scheduled.eventId}_${Math.round(Math.random() * 1e5)}`,
      defId: scheduled.eventId,
      triggeredAtMinute: at,
      expiresAtMinute: at + 5 * 1440,
      source: '后续事件',
    })
    const followDef = EVENT_MAP[scheduled.eventId]
    if (followDef) lines.push(`${scheduled.days} 天后将会出现后续：${followDef.title}`)
  }
  if (choice.grantCards) {
    drawOffer(state, choice.grantCards.pool, choice.grantCards.count, `事件·${def.title}`, mods, hooks)
  }

  // 冷却
  if (def.cooldownDays) {
    state.events.cooldownUntil[def.id] = state.time.minutes + def.cooldownDays * 1440
  }
  state.events.log.unshift({
    uid: active.uid,
    defId: def.id,
    title: def.title,
    lines: [choice.label, ...lines],
    minute: state.time.minutes,
  })
  state.events.log = state.events.log.slice(0, 60)
  state.events.active.splice(index, 1)
  state.statistics.eventsResolved += 1
  if (def.category === '校园' && lines.some((l) => l.includes('-'))) {
    state.statistics.negativeEventsInYear += 1
  }
  hooks.notify(`事件处理完毕：${def.title}`, 'info')
  hooks.log(`事件「${def.title}」→ ${choice.label}`, 'event')
  return true
}

/** 超时未处理的事件自动按保守选项结算，避免游戏被挂起 */
export function tickEvents(state: GameState, mods: ModifierIndex, hooks: EngineHooks): void {
  // 到期的后续事件进入待处理列表
  const due = state.events.scheduled.filter((e) => e.triggeredAtMinute <= state.time.minutes)
  if (due.length > 0) {
    state.events.scheduled = state.events.scheduled.filter((e) => e.triggeredAtMinute > state.time.minutes)
    for (const event of due) {
      const def = EVENT_MAP[event.defId]
      state.events.active.push({
        ...event,
        ...expiryWindow(state.time.minutes),
      })
      if (def) hooks.notify(`后续事件：${def.title}`, 'event')
    }
  }
  // 同时满足「游戏时间到期」与「现实时间下限已过」才自动处理
  const now = Date.now()
  const expired = state.events.active.filter((e) => {
    if (e.expiresAtMinute > state.time.minutes) return false
    if (e.expiresAtEpoch == null) return true
    return now >= e.expiresAtEpoch
  })
  for (const e of expired) {
    hooks.notify('一个事件因长时间未处理而自动结束。', 'bad')
    resolveEvent(state, e.uid, 0, mods, hooks)
  }
}

/** 标题中包含这些关键词的事件视为负面事件，会被 event_good 抑制 */
export const NEGATIVE_EVENT_HINTS = ['冲突', '投诉', '停电', '举报', '低谷', '作弊', '翻墙', '过劳', '挖角', '争执', '争议', '受伤', '暴雨', '酷暑', '没有暖气']

/** 剧情引导是否已经全部播完 */
export function tutorialFinished(state: GameState): boolean {
  return state.ui.tutorialStep >= TUTORIAL_STEPS.length
}

/**
 * 随机事件是否已经开放。
 * 剧情引导期间只派发剧本事件；玩家处理过第一件校园事件（或引导全部走完）之后恢复正常。
 */
export function randomEventsUnlocked(state: GameState): boolean {
  return tutorialFinished(state) || state.statistics.eventsResolved > 0
}

export function eventChoicePreview(def: EventDef, index: number): string {
  const choice = def.choices[index]
  if (!choice) return ''
  return choice.hint ?? ''
}
