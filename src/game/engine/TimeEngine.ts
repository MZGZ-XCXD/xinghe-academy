import type { GameState } from '../types'
import { calendarFromMinutes, type CalendarInfo } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { SEASON_MAP } from '../../data'

export function calendarOf(state: GameState): CalendarInfo {
  return calendarFromMinutes(state.time.minutes)
}

export function currentSeason(state: GameState) {
  return calendarOf(state).season
}

/** 季节会对产出、比赛、考试与事件频率产生真实影响 */
export function collectSeasonModifiers(state: GameState, mods: ModifierIndex): void {
  const season = currentSeason(state)
  for (const effect of SEASON_MAP[season].modifiers) {
    mods.push(effect.target, effect.op, effect.value, `季节·${SEASON_MAP[season].name}`)
  }
}

/** 事件间隔（游戏分钟），受季节与科技影响 */
export function eventIntervalMinutes(state: GameState, mods: ModifierIndex): number {
  // 平均 36 个游戏日一个事件（1× 速度下约合 7 分钟真实时间）
  const base = 1440 * 36
  return Math.max(1440, base * mods.mul('event_interval'))
}

/** 一年中的第几天（用于季节事件权重） */
export function dayOfYear(state: GameState): number {
  return calendarOf(state).totalDays % 360
}
