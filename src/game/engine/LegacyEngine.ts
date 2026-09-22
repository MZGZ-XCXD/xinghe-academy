import type { GameState, ResourceKey } from '../types'
import { LEGACY_NODES, LEGACY_NODE_MAP } from '../../data'
import { legacyNodeCost, prestigeGain, prestigeRequirementsMet, safeNumber } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import type { EngineHooks } from './hooks'
import { createInitialState } from './state'

export interface PrestigePreview {
  can: boolean
  reasons: string[]
  gain: number
  requirement: string[]
}

export function prestigePreview(state: GameState, mods: ModifierIndex): PrestigePreview {
  const req = prestigeRequirementsMet(state)
  return {
    can: req.ok,
    reasons: req.reasons,
    gain: prestigeGain(state, mods),
    requirement: ['学校评级 ≥ 52', '累计毕业生 ≥ 200', '至少 1 次比赛胜利（首次传承）'],
  }
}

/**
 * 学园传承：结束当前学园周期，保留传承树、成就与历史统计，重新开始一所学校。
 */
export function doPrestige(state: GameState, mods: ModifierIndex): GameState {
  const gain = prestigeGain(state, mods)
  const keepLegacy = {
    ...state.legacy,
    points: state.legacy.points + gain,
    lifetimePoints: state.legacy.lifetimePoints + gain,
    lifetimePrestigePoints: state.legacy.lifetimePrestigePoints + gain,
    prestigeCount: state.legacy.prestigeCount + 1,
    historyPoints: state.legacy.historyPoints + Math.floor(gain / 2),
    bestRating: Math.max(state.legacy.bestRating, state.school.rating),
  }
  const stats = {
    ...state.statistics,
    prestiges: state.statistics.prestiges + 1,
    peakRating: Math.max(state.statistics.peakRating, state.school.rating),
    yearSnapshot: {
      moneyEarned: state.statistics.totalMoneyEarned,
      moneySpent: state.statistics.totalMoneySpent,
      graduates: state.statistics.graduates,
      wins: state.statistics.competitionWins,
      competitions: state.statistics.competitions,
      eventsResolved: state.statistics.eventsResolved,
    },
  }
  const perks = collectPerkBonuses(keepLegacy)
  const next = createInitialState({
    schoolName: state.school.name,
    keepLegacy,
    keepAchievements: state.achievements,
    keepSettings: state.settings,
    keepStatistics: stats,
    keepCardsHistory: state.cards.history,
    applyLegacyPerks: perks,
  })
  next.meta.runIndex = keepLegacy.prestigeCount + 1
  next.ui.unlockedTabs = state.ui.unlockedTabs
  next.ui.tutorialsSeen = state.ui.tutorialsSeen
  return next
}

/** 传承特性带来的开局能力 */
export function collectPerkBonuses(legacy: GameState['legacy']): {
  buildings: Record<string, number>
  technologies: string[]
  money: number
  satisfaction: number
} {
  const buildings: Record<string, number> = {}
  const technologies: string[] = []
  let money = 0
  if (legacy.perks.alumniNetwork) buildings.alumniCenter = 1
  if (legacy.perks.competitionStrong) buildings.gym = 1
  if (legacy.perks.intlEarly) {
    buildings.library = Math.max(buildings.library ?? 0, 1)
    technologies.push('schoolExchange')
  }
  if (legacy.perks.scienceSeed) technologies.push('basicLab', 'researchTraining')
  if (legacy.perks.oldTradition) buildings.historyHall = 1
  if (legacy.perks.festivalTradition) buildings.courtyard = 1
  if (legacy.perks.eliteCohort) money += 500
  money += (legacy.nodes.histStart ?? 0) * 200
  return { buildings, technologies, money, satisfaction: 0 }
}

export function legacyNodeStatus(state: GameState, id: string, mods: ModifierIndex) {
  const def = LEGACY_NODE_MAP[id]
  if (!def) return null
  const level = state.legacy.nodes[id] ?? 0
  const missing = def.requires.filter((r) => (state.legacy.nodes[r] ?? 0) <= 0)
  const cost = legacyNodeCost(def, level, mods)
  return {
    def,
    level,
    maxed: level >= def.maxLevel,
    cost,
    affordable: state.legacy.points >= cost,
    locked: missing.length > 0,
    missing,
  }
}

export function buyLegacyNode(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const status = legacyNodeStatus(state, id, mods)
  if (!status) return false
  if (status.maxed) {
    hooks.notify('该传承节点已满级。', 'bad')
    return false
  }
  if (status.locked) {
    hooks.notify(`需要先解锁：${status.missing.map((m) => LEGACY_NODE_MAP[m]?.name ?? m).join('、')}`, 'bad')
    return false
  }
  if (!status.affordable) {
    hooks.notify(`传承点不足（需要 ${status.cost}，当前 ${Math.floor(state.legacy.points)}）`, 'bad')
    return false
  }
  state.legacy.points -= status.cost
  state.legacy.nodes[id] = status.level + 1
  if (status.def.perk && status.level + 1 > 0) state.legacy.perks[status.def.perk] = true
  hooks.notify(`传承强化：${status.def.name} Lv.${status.level + 1}${status.def.perk ? '（获得传承特性）' : ''}`, 'good')
  hooks.log(`传承强化：${status.def.name} Lv.${status.level + 1}`, 'legacy')
  return true
}

export function legacyBranchSummary(state: GameState) {
  const map = new Map<string, { branch: string; spent: number; nodes: number }>()
  for (const node of LEGACY_NODES) {
    const level = state.legacy.nodes[node.id] ?? 0
    if (level <= 0) continue
    const entry = map.get(node.branch) ?? { branch: node.branch, spent: 0, nodes: 0 }
    entry.nodes += level
    entry.spent += level * node.baseCost
    map.set(node.branch, entry)
  }
  return [...map.values()]
}

export function totalLegacyInvestment(state: GameState): number {
  let total = 0
  for (const node of LEGACY_NODES) total += safeNumber(state.legacy.nodes[node.id], 0)
  return total
}

export function historyPointGain(state: GameState): number {
  return Math.floor(state.school.rating / 10)
}

export function resourceAfterPrestigeHint(state: GameState, mods: ModifierIndex): string {
  const gain = prestigeGain(state, mods)
  return `本次传承将获得 ${gain} 传承点（当前拥有 ${Math.floor(state.legacy.points)}）`
}
