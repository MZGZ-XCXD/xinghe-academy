import type { GameState } from '../types'
import { ACHIEVEMENT_DEFS } from '../../data'
import { grantResources } from './ResourceEngine'
import type { EngineHooks } from './hooks'

/** 成就检查：解锁后立即发放奖励（传承点 / 资源 / 永久加成） */
export function checkAchievements(state: GameState, hooks: EngineHooks): string[] {
  const unlocked: string[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    const entry = state.achievements[def.id]
    if (!entry || entry.unlocked) continue
    let ok = false
    try {
      ok = def.check(state) === true
    } catch {
      ok = false
    }
    if (!ok) continue
    entry.unlocked = true
    entry.unlockedAtMinute = state.time.minutes
    unlocked.push(def.id)
    const reward = def.reward
    if (reward?.legacyPoints) {
      state.legacy.points += reward.legacyPoints
      state.legacy.lifetimePoints += reward.legacyPoints
    }
    if (reward?.resources) grantResources(state, reward.resources)
    for (const effect of reward?.effects ?? []) state.school.permanentEffects.push({ ...effect })
    hooks.notify(`成就达成：${def.name}`, 'unlock')
    hooks.log(`成就达成：${def.name}`, 'achievement')
  }
  return unlocked
}

export function achievementSummary(state: GameState) {
  const total = ACHIEVEMENT_DEFS.length
  const unlocked = ACHIEVEMENT_DEFS.filter((a) => state.achievements[a.id]?.unlocked).length
  return { total, unlocked, ratio: total > 0 ? unlocked / total : 0 }
}
