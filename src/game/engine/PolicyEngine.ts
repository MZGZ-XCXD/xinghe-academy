import type { GameState, PolicyDef } from '../types'
import { BASE_POLICY_SLOTS, POLICY_DEFS, POLICY_MAP } from '../../data'
import { meetsRequirement } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import type { EngineHooks } from './hooks'

export function totalPolicySlots(state: GameState, mods: ModifierIndex): number {
  return Math.max(0, Math.round(BASE_POLICY_SLOTS + mods.add('policy_slots')))
}

export function policySlotsUsed(state: GameState): number {
  return state.school.activePolicies.length
}

export function isPolicyUnlocked(state: GameState, def: PolicyDef): boolean {
  return meetsRequirement(state, def.requires)
}

export function togglePolicy(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const def = POLICY_MAP[id]
  if (!def) return false
  const index = state.school.activePolicies.indexOf(id)
  if (index >= 0) {
    state.school.activePolicies.splice(index, 1)
    hooks.notify(`已废止校规：${def.name}`, 'info')
    return true
  }
  if (!isPolicyUnlocked(state, def)) {
    hooks.notify(`校规「${def.name}」尚未解锁。`, 'bad')
    return false
  }
  const slots = totalPolicySlots(state, mods)
  if (policySlotsUsed(state) >= slots) {
    hooks.notify(`校规名额已满（${slots} 条），请先废止一条。`, 'bad')
    return false
  }
  state.school.activePolicies.push(id)
  state.statistics.flags.policyChanged = true
  if (!state.statistics.usedPolicies.includes(id)) state.statistics.usedPolicies.push(id)
  hooks.notify(`已施行校规：${def.name}`, 'good')
  hooks.log(`施行校规：${def.name}`, 'policy')
  return true
}

export function availablePolicies(state: GameState): { def: PolicyDef; unlocked: boolean; active: boolean }[] {
  return POLICY_DEFS.map((def) => ({
    def,
    unlocked: isPolicyUnlocked(state, def),
    active: state.school.activePolicies.includes(def.id),
  }))
}
