import type { GameState, ResourceKey } from '../types'
import { RESOURCE_DEFS } from '../../data'
import {
  buildingProduction,
  buildingUpkeepPerMinute,
  isStorableResource,
  resourceCapacity,
  safeNumber,
  sanitizeResource,
  STORAGE_KEYS,
  teacherSalaryPerMinute,
  tuitionPerMinute,
} from '../formulas'
import { BUILDING_DEFS, BUILDING_MAP } from '../../data'
import type { ModifierIndex } from './ModifierIndex'

/**
 * 仓储上限缓存：每个 step 开始时刷新一次（由 GameEngine 调用），
 * 这样 grantResources / clampToCapacity 在没有 mods 参数时也能拿到一致的上限。
 */
const capacityCache = new WeakMap<object, Partial<Record<ResourceKey, number>>>()

export function refreshStorageCaps(state: GameState, mods: ModifierIndex): void {
  const caps: Partial<Record<ResourceKey, number>> = {}
  for (const key of STORAGE_KEYS) caps[key] = resourceCapacity(state, BUILDING_MAP, key, mods)
  capacityCache.set(state as unknown as object, caps)
}

export function capacityOf(state: GameState, key: ResourceKey): number {
  if (!isStorableResource(key)) return Number.POSITIVE_INFINITY
  const cached = capacityCache.get(state as unknown as object)
  const value = cached?.[key]
  if (value != null) return value
  // 缓存还没建立（例如测试里直接调用）时，用无加成版本兜底
  return resourceCapacity(state, BUILDING_MAP, key)
}

export interface RatePart {
  source: string
  value: number
  kind: 'building' | 'course' | 'tuition' | 'cost' | 'bonus'
}

export interface ResourceRate {
  total: number
  parts: RatePart[]
}

export type ResourceRates = Record<ResourceKey, ResourceRate>

const RATE_TARGET: Partial<Record<ResourceKey, string>> = {
  money: 'money_rate',
  teaching: 'teaching_rate',
  reputation: 'reputation_rate',
  research: 'research_rate',
  sports: 'sports_rate',
  culture: 'culture_rate',
  activity: 'activity_rate',
  parentTrust: 'parenttrust_rate',
  alumniContribution: 'alumni_rate',
  educationFund: 'fund_rate',
  intlReputation: 'intl_rate',
  influence: 'influence_rate',
}

/** 建筑与学费带来的每分钟净产出（课程产出与消耗由 CourseEngine 单独结算） */
export function computeRates(state: GameState, mods: ModifierIndex): ResourceRates {
  const rates = {} as ResourceRates
  for (const def of RESOURCE_DEFS) rates[def.key] = { total: 0, parts: [] }

  for (const def of BUILDING_DEFS) {
    const level = state.buildings[def.id]?.level ?? 0
    if (level <= 0) continue
    const production = buildingProduction(def, level)
    for (const [key, value] of Object.entries(production)) {
      const rk = key as ResourceKey
      const target = RATE_TARGET[rk]
      const adjusted = target ? value * mods.mul(target) : value
      rates[rk].parts.push({ source: `${def.name} Lv.${level}`, value: adjusted, kind: 'building' })
    }
  }

  const tuition = tuitionPerMinute(state, mods)
  if (tuition > 0) rates.money.parts.push({ source: '学费收入', value: tuition, kind: 'tuition' })

  const salary = teacherSalaryPerMinute(state, mods)
  if (salary > 0) rates.money.parts.push({ source: '教师薪资', value: -salary, kind: 'cost' })

  const upkeep = buildingUpkeepPerMinute(state)
  if (upkeep > 0) rates.money.parts.push({ source: '设施维护', value: -upkeep, kind: 'cost' })

  for (const def of RESOURCE_DEFS) {
    const rate = rates[def.key]
    rate.total = rate.parts.reduce((sum, p) => sum + p.value, 0)
  }
  return rates
}

/** 按分钟结算建筑、学费、薪资与维护 */
export function tickResources(state: GameState, mods: ModifierIndex, dtMinutes: number): void {
  const rates = computeRates(state, mods)
  for (const def of RESOURCE_DEFS) {
    const delta = rates[def.key].total * dtMinutes
    if (!Number.isFinite(delta) || delta === 0) continue
    const before = safeNumber(state.resources[def.key], 0)
    const next = clampToCapacity(state, def.key, sanitizeResource(before + delta))
    state.resources[def.key] = next
    if (def.key === 'money') {
      if (delta > 0) state.statistics.totalMoneyEarned += delta
      else state.statistics.totalMoneySpent += -delta
    }
    if (def.key === 'teaching' && delta > 0) state.statistics.totalTeachingEarned += delta
    if (def.key === 'research' && delta > 0) state.statistics.research += delta
  }
}

export function canAfford(state: GameState, cost: Partial<Record<ResourceKey, number>>): boolean {
  for (const [key, value] of Object.entries(cost)) {
    if (safeNumber(state.resources[key as ResourceKey], 0) + 1e-6 < safeNumber(value, 0)) return false
  }
  return true
}

export function payResources(state: GameState, cost: Partial<Record<ResourceKey, number>>): void {
  for (const [key, value] of Object.entries(cost)) {
    const rk = key as ResourceKey
    state.resources[rk] = sanitizeResource(safeNumber(state.resources[rk], 0) - safeNumber(value, 0))
    if (rk === 'money') state.statistics.totalMoneySpent += safeNumber(value, 0)
  }
}

export function grantResources(state: GameState, gain: Partial<Record<ResourceKey, number>>): void {
  for (const [key, value] of Object.entries(gain)) {
    const rk = key as ResourceKey
    const amount = safeNumber(value, 0)
    state.resources[rk] = clampToCapacity(state, rk, sanitizeResource(safeNumber(state.resources[rk], 0) + amount))
    if (rk === 'money' && amount > 0) state.statistics.totalMoneyEarned += amount
    if (rk === 'teaching' && amount > 0) state.statistics.totalTeachingEarned += amount
    if (rk === 'research' && amount > 0) state.statistics.research += amount
  }
}

/** 把资源裁剪到仓储上限（不设上限的资源原样返回） */
export function clampToCapacity(
  state: GameState,
  key: ResourceKey,
  value: number,
): number {
  const safe = sanitizeResource(value)
  if (!isStorableResource(key)) return safe
  return Math.min(safe, capacityOf(state, key))
}
