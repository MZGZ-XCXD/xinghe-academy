import type { BuildingDef, GameState, ResourceKey } from '../types'
import { BUILDING_MAP } from '../../data'
import { buildDuration, buildingCost, formatGameDays, meetsRequirement, NO_MODS } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { canAfford, payResources } from './ResourceEngine'
import type { EngineHooks } from './hooks'
import { COURSE_MAP } from '../../data'

/** 同时施工的最大数量 */
export const BASE_BUILD_SLOTS = 3

export function buildingLevel(state: GameState, id: string): number {
  return state.buildings[id]?.level ?? 0
}

export function isBuildingUnlocked(state: GameState, def: BuildingDef): boolean {
  return meetsRequirement(state, def.requires)
}

export function costForNextLevel(
  state: GameState,
  id: string,
  mods: ModifierIndex,
): Partial<Record<ResourceKey, number>> {
  const def = BUILDING_MAP[id]
  if (!def) return {}
  const level = Math.min(def.maxLevel, buildingLevel(state, id) + 1)
  return buildingCost(def, level, mods)
}

export function durationForNextLevel(state: GameState, id: string, mods: ModifierIndex): number {
  const def = BUILDING_MAP[id]
  if (!def) return 0
  const level = Math.min(def.maxLevel, buildingLevel(state, id) + 1)
  return buildDuration(def, level, mods)
}

export function pendingTaskFor(state: GameState, id: string) {
  return state.buildQueue.find((t) => t.buildingId === id)
}

export function canStartBuild(
  state: GameState,
  id: string,
  mods: ModifierIndex,
): { ok: boolean; reason?: string; cost?: Partial<Record<ResourceKey, number>>; minutes?: number } {
  const def = BUILDING_MAP[id]
  if (!def) return { ok: false, reason: '建筑不存在' }
  if (!isBuildingUnlocked(state, def)) return { ok: false, reason: '尚未解锁（需要满足前置条件）' }
  const level = buildingLevel(state, id)
  if (level >= def.maxLevel) return { ok: false, reason: '已达到最高等级' }
  if (pendingTaskFor(state, id)) return { ok: false, reason: '该建筑已在建造队列中' }
  if (state.buildQueue.length >= BASE_BUILD_SLOTS) return { ok: false, reason: `建造队列已满（${BASE_BUILD_SLOTS} 个工位）` }
  const cost = buildingCost(def, level + 1, mods)
  if (!canAfford(state, cost)) return { ok: false, reason: '资源不足', cost }
  return { ok: true, cost, minutes: buildDuration(def, level + 1, mods) }
}

export function startBuild(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const check = canStartBuild(state, id, mods)
  if (!check.ok || !check.cost) {
    if (check.reason) hooks.notify(`${BUILDING_MAP[id]?.name ?? id}：${check.reason}`, 'bad')
    return false
  }
  payResources(state, check.cost)
  const minutes = check.minutes ?? 60
  const targetLevel = buildingLevel(state, id) + 1
  const task = {
    id: `build_${id}_${targetLevel}_${Math.round(state.time.minutes)}`,
    buildingId: id,
    targetLevel,
    startMinute: state.time.minutes,
    endMinute: state.time.minutes + minutes,
    durationMinutes: minutes,
  }
  state.buildQueue.push(task)
  const def = BUILDING_MAP[id]
  hooks.notify(
    `${def?.name ?? id} 开始建造（升级至 Lv.${targetLevel}，预计 ${formatGameDays(minutes)}）`,
    'info',
  )
  hooks.log(`${def?.name ?? id} 开工，目标 Lv.${targetLevel}`, 'build')
  return true
}

export function cancelBuild(state: GameState, taskId: string, hooks: EngineHooks): void {
  const index = state.buildQueue.findIndex((t) => t.id === taskId)
  if (index < 0) return
  const [task] = state.buildQueue.splice(index, 1)
  const def = BUILDING_MAP[task.buildingId]
  // 退还 60% 已投入的资金与教学资源
  const spent = buildingCost(def, task.targetLevel, NO_MODS)
  const refund: Partial<Record<ResourceKey, number>> = {}
  for (const [key, value] of Object.entries(spent)) refund[key as ResourceKey] = Math.floor(Number(value) * 0.6)
  for (const [key, value] of Object.entries(refund)) {
    const rk = key as ResourceKey
    state.resources[rk] = Math.max(0, (state.resources[rk] ?? 0) + (value ?? 0))
  }
  hooks.notify(`${def?.name ?? task.buildingId} 的建造已取消，退回六成投入。`, 'info')
}

/** 推进建造队列，返回本 tick 完成的建筑 id 列表 */
export function tickBuildQueue(state: GameState, hooks: EngineHooks): string[] {
  const finished: string[] = []
  const remaining = []
  for (const task of state.buildQueue) {
    if (state.time.minutes + 1e-6 >= task.endMinute) {
      const def = BUILDING_MAP[task.buildingId]
      if (def) {
        const current = state.buildings[task.buildingId]?.level ?? 0
        state.buildings[task.buildingId] = { level: Math.max(current, Math.min(def.maxLevel, task.targetLevel)) }
        state.statistics.buildingsBuilt += 1
        finished.push(task.buildingId)
        hooks.notify(`${def.name} 升级完成 → Lv.${state.buildings[task.buildingId].level}`, 'good')
        hooks.log(`${def.name} 建造完成 Lv.${state.buildings[task.buildingId].level}`, 'build')
      }
    } else {
      remaining.push(task)
    }
  }
  state.buildQueue = remaining
  return finished
}

/** 每级效果与实际成本，供 UI 展示 */
export function buildingPreview(state: GameState, id: string, mods: ModifierIndex) {
  const def = BUILDING_MAP[id]
  if (!def) return null
  const level = buildingLevel(state, id)
  const next = Math.min(def.maxLevel, level + 1)
  return {
    def,
    level,
    nextLevel: next,
    maxed: level >= def.maxLevel,
    cost: buildingCost(def, next, mods),
    minutes: buildDuration(def, next, mods),
    unlocked: isBuildingUnlocked(state, def),
    queued: pendingTaskFor(state, id) ?? null,
  }
}

export function newlyUnlockedCourses(state: GameState): string[] {
  const out: string[] = []
  for (const course of Object.values(COURSE_MAP)) {
    if (!state.courses[course.id]?.unlocked && meetsRequirement(state, course.requires)) out.push(course.id)
  }
  return out
}
