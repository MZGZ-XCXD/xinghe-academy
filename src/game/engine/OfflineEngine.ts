import type { GameState, ResourceKey, StudentDelta } from '../types'
import {
  BASE_GAME_MINUTES_PER_REAL_SECOND,
  MINUTES_PER_DAY,
  offlineCapSeconds,
  OFFLINE_MAX_GAME_DAYS,
  offlineRate,
  safeNumber,
  seasonOf,
  teacherEfficiency,
  courseGrowthPerDay,
  courseOutputPerDay,
  courseTeachingCostPerDay,
  totalStudents,
} from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { computeRates, grantResources } from './ResourceEngine'
import { allocateCourses, applyDeltaToAllCohorts } from './CourseEngine'
import { tickStudentDrift } from './StudentEngine'

export interface OfflineResult {
  elapsedSeconds: number
  countedSeconds: number
  capped: boolean
  gameMinutes: number
  gameDays: number
  gains: Partial<Record<ResourceKey, number>>
  studentGrowth: number
  notes: string[]
}

/**
 * 离线结算：按在线速率的固定比例折算，最多结算 8 小时（可由科技/传承提升）。
 * 离线期间不触发随机事件与比赛，避免玩家回来后面对十几个弹窗。
 */
export function computeOffline(
  state: GameState,
  elapsedSeconds: number,
  mods: ModifierIndex,
): OfflineResult {
  const elapsed = Math.max(0, safeNumber(elapsedSeconds, 0))
  const cap = offlineCapSeconds(mods)
  const counted = Math.min(elapsed, cap)
  const rate = offlineRate(state, mods)
  const rawGameMinutes = counted * BASE_GAME_MINUTES_PER_REAL_SECOND * rate
  const gameMinutes = Math.min(rawGameMinutes, OFFLINE_MAX_GAME_DAYS * MINUTES_PER_DAY)
  const gameDays = gameMinutes / MINUTES_PER_DAY

  const before: Partial<Record<ResourceKey, number>> = { ...state.resources }

  // 1. 建筑与学费产出
  const rates = computeRates(state, mods)
  const production: Partial<Record<ResourceKey, number>> = {}
  for (const [key, rate2] of Object.entries(rates)) {
    const gain = rate2.total * gameMinutes
    if (gain !== 0 && Number.isFinite(gain)) production[key as ResourceKey] = gain
  }
  grantResources(state, production)

  // 2. 课程产出与学生成长（按离线天数做一次整体结算）
  const allocations = allocateCourses(state)
  const season = seasonOf(state.time.minutes)
  const efficiency = teacherEfficiency(state, mods)
  const total = totalStudents(state)
  let plannedCost = 0
  for (const a of allocations) plannedCost += courseTeachingCostPerDay(a.def, a.served, mods) * gameDays
  const available = Math.max(0, safeNumber(state.resources.teaching, 0))
  const affordability = plannedCost > 0 ? Math.min(1, available / plannedCost) : 1
  let studentGrowth = 0

  for (const a of allocations) {
    if (a.served <= 0) continue
    const ctx = {
      cohortCount: total,
      servedStudents: a.served,
      teacherRatio: a.teacherRatio,
      capacityRatio: a.capacityRatio,
      efficiency,
      season,
    }
    const delta = courseGrowthPerDay(a.def, ctx, mods)
    const scaled: StudentDelta = {}
    for (const [key, value] of Object.entries(delta)) {
      const v = safeNumber(value, 0) * gameDays * affordability
      scaled[key as keyof StudentDelta] = v
      if (key === 'academic') studentGrowth += Math.abs(v)
    }
    applyDeltaToAllCohorts(state, scaled)

    const outputs = courseOutputPerDay(a.def, ctx, mods)
    const gain: Partial<Record<ResourceKey, number>> = {}
    for (const [key, value] of Object.entries(outputs)) {
      gain[key as ResourceKey] = safeNumber(value, 0) * gameDays * affordability
    }
    grantResources(state, gain)
  }
  state.resources.teaching = Math.max(0, state.resources.teaching - plannedCost * affordability)

  // 3. 学生状态自然变化
  tickStudentDrift(state, mods, Math.min(gameDays, 30))

  const gains: Partial<Record<ResourceKey, number>> = {}
  for (const [key, value] of Object.entries(state.resources)) {
    const diff = safeNumber(value, 0) - safeNumber(before[key as ResourceKey], 0)
    if (Math.abs(diff) > 0.01) gains[key as ResourceKey] = diff
  }

  const notes: string[] = []
  if (elapsed > cap) notes.push(`离线时间超过上限，仅结算前 ${(cap / 3600).toFixed(1)} 小时。`)
  if (rawGameMinutes > gameMinutes) notes.push(`离线收益按 ${OFFLINE_MAX_GAME_DAYS} 个游戏日的上限结算。`)
  notes.push(`离线效率 ${(rate * 100).toFixed(1)}%，等效游戏时间 ${gameDays.toFixed(1)} 天。`)

  return {
    elapsedSeconds: elapsed,
    countedSeconds: counted,
    capped: elapsed > cap,
    gameMinutes,
    gameDays,
    gains,
    studentGrowth,
    notes,
  }
}

export function formatOfflineDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 3600) return `${Math.round(s / 60)} 分钟`
  const hours = Math.floor(s / 3600)
  const minutes = Math.round((s % 3600) / 60)
  return minutes > 0 ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`
}
