import type { GameState, ResourceKey, TechDef } from '../types'
import { BUILDING_MAP, COURSE_MAP, TECH_DEFS, TECH_MAP } from '../../data'
import { formatGameDays, hasTech, safeNumber } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { canAfford, payResources } from './ResourceEngine'
import type { EngineHooks } from './hooks'

export function techCost(def: TechDef, mods: ModifierIndex): Partial<Record<ResourceKey, number>> {
  const mul = Math.max(0.1, mods.mul('tech_cost'))
  const out: Partial<Record<ResourceKey, number>> = {}
  for (const [key, value] of Object.entries(def.cost)) {
    out[key as ResourceKey] = Math.ceil(safeNumber(value, 0) * mul * 100) / 100
  }
  return out
}

export function techDuration(def: TechDef, mods: ModifierIndex): number {
  // 研究速度受益于教学资源、教师效率与设施（用建造速度的一半折算）
  const speed = Math.max(0.2, mods.mul('build_speed') * 0.5 + 0.5)
  return Math.max(10, def.researchMinutes / speed)
}

export function isTechAvailable(state: GameState, def: TechDef): boolean {
  if (state.technologies[def.id]?.unlocked) return false
  if (state.technologies[def.id]?.researching) return false
  return def.requires.every((id) => hasTech(state, id))
}

export function canResearch(
  state: GameState,
  id: string,
  mods: ModifierIndex,
): { ok: boolean; reason?: string; cost?: Partial<Record<ResourceKey, number>>; minutes?: number } {
  const def = TECH_MAP[id]
  if (!def) return { ok: false, reason: '科技不存在' }
  if (state.technologies[id]?.unlocked) return { ok: false, reason: '已解锁' }
  if (state.technologies[id]?.researching) return { ok: false, reason: '正在研究中' }
  const missing = def.requires.filter((r) => !hasTech(state, r))
  if (missing.length > 0) {
    return { ok: false, reason: `缺少前置科技：${missing.map((m) => TECH_MAP[m]?.name ?? m).join('、')}` }
  }
  const cost = techCost(def, mods)
  if (!canAfford(state, cost)) return { ok: false, reason: '资源不足', cost }
  return { ok: true, cost, minutes: techDuration(def, mods) }
}

export function startResearch(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const check = canResearch(state, id, mods)
  if (!check.ok || !check.cost) {
    if (check.reason) hooks.notify(`${TECH_MAP[id]?.name ?? id}：${check.reason}`, 'bad')
    return false
  }
  payResources(state, check.cost)
  const minutes = check.minutes ?? 60
  state.technologies[id] = { unlocked: false, researching: { startMinute: state.time.minutes, endMinute: state.time.minutes + minutes } }
  hooks.notify(`开始研究「${TECH_MAP[id].name}」（${formatGameDays(minutes)}）`, 'info')
  return true
}

export function researchProgress(state: GameState, id: string): number {
  const rs = state.technologies[id]?.researching
  if (!rs) return state.technologies[id]?.unlocked ? 1 : 0
  const total = Math.max(1, rs.endMinute - rs.startMinute)
  return Math.min(1, Math.max(0, (state.time.minutes - rs.startMinute) / total))
}

export function tickResearch(state: GameState, hooks: EngineHooks): string[] {
  const unlocked: string[] = []
  for (const def of TECH_DEFS) {
    const rs = state.technologies[def.id]
    if (!rs || rs.unlocked || !rs.researching) continue
    if (state.time.minutes + 1e-6 >= rs.researching.endMinute) {
      state.technologies[def.id] = { unlocked: true, researching: false }
      unlocked.push(def.id)
      applyTechUnlocks(state, def, hooks)
      hooks.notify(`科技解锁：${def.name}`, 'unlock')
      hooks.log(`科技解锁：${def.name}`, 'tech')
    }
  }
  return unlocked
}

export function applyTechUnlocks(state: GameState, def: TechDef, hooks: EngineHooks): void {
  for (const courseId of def.unlocks?.courses ?? []) {
    const course = state.courses[courseId]
    if (course && !course.unlocked) {
      course.unlocked = true
      const courseDef = COURSE_MAP[courseId]
      if (courseDef) hooks.notify(`新课程解锁：${courseDef.name}`, 'unlock')
    }
  }
  for (const buildingId of def.unlocks?.buildings ?? []) {
    const building = BUILDING_MAP[buildingId]
    if (building && (state.buildings[buildingId]?.level ?? 0) === 0) {
      hooks.notify(`新建筑解锁：${building.name}`, 'unlock')
    }
  }
}

export function techBranchProgress(state: GameState) {
  const branches = new Map<string, { total: number; unlocked: number }>()
  for (const def of TECH_DEFS) {
    const entry = branches.get(def.branch) ?? { total: 0, unlocked: 0 }
    entry.total += 1
    if (hasTech(state, def.id)) entry.unlocked += 1
    branches.set(def.branch, entry)
  }
  return branches
}
