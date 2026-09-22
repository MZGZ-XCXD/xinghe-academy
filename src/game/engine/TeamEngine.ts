import type { GameState, ResourceKey, TeamDef, TeamTierDef } from '../types'
import { BUILDING_MAP, CLUB_MAP, TEAM_DEFS, TEAM_MAP, TEAM_TIERS, TEAM_TIER_MAP } from '../../data'
import {
  clamp,
  formatGameDays,
  meetsRequirement,
  overallAttributes,
  safeNumber,
  teacherEfficiency,
  totalStudents,
} from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { canAfford, grantResources, payResources } from './ResourceEngine'
import { applyDeltaToAllCohorts } from './CourseEngine'
import { maybeGrantCard } from './CardEngine'
import type { EngineHooks } from './hooks'

/* ------------------------------ 解锁链 ------------------------------ */

/**
 * 队名生成：用学校名拼上队名后缀。
 * 学校叫「星丘」+ 昵称「火鸟」 → 「星丘火鸟队」；玩家改名后以自定义名字为准。
 */
export function teamDisplayName(state: GameState, def: TeamDef): string {
  const custom = state.teams?.[def.id]?.name?.trim()
  if (custom) return custom
  const school = state.school.name?.trim() || '本校'
  return `${school}${def.nickname}队`
}

/** 推荐队名：学校名 × 该队伍的备选后缀，外加「学校名+项目名」这种朴素写法 */
export function teamNameSuggestions(state: GameState, def: TeamDef, limit = 8): string[] {
  const school = state.school.name?.trim() || '本校'
  const pool = def.namePool?.length ? def.namePool : [def.nickname]
  const names = pool.map((nickname) => `${school}${nickname}队`)
  names.push(`${school}${def.shortName}`)
  names.push(`${school}${def.shortName.replace(/队$/, '')}部`)
  const unique = [...new Set(names)].filter((name) => name.length > 0)
  // 让默认昵称排在最前，方便直接回车确认
  unique.sort((a, b) => {
    if (a === `${school}${def.nickname}队`) return -1
    if (b === `${school}${def.nickname}队`) return 1
    return 0
  })
  return unique.slice(0, limit)
}

export function renameTeam(state: GameState, id: string, name: string, hooks: EngineHooks): boolean {
  const def = TEAM_MAP[id]
  const entry = state.teams[id]
  if (!def || !entry?.founded) return false
  const trimmed = (name ?? '').trim().slice(0, 24)
  entry.name = trimmed.length > 0 ? trimmed : undefined
  hooks.notify(`${def.shortName} 更名为：${teamDisplayName(state, def)}`, 'good')
  return true
}

/** 校队的解锁链：建筑 → 社团 → 社团等级 / 社员人数 → 上报成立校队 */
export function teamUnlockStatus(state: GameState, def: TeamDef): { unlocked: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (def.requiresClub) {
    const clubDef = CLUB_MAP[def.requiresClub.id]
    const club = state.clubs[def.requiresClub.id]
    const level = club?.level ?? 0
    const members = club?.members ?? 0
    const needLevel = def.requiresClub.level ?? 1
    if (level < needLevel) {
      reasons.push(`${clubDef?.name ?? def.requiresClub.id} Lv.${needLevel}（当前 Lv.${level}）`)
    }
    if (def.requiresClub.members != null && members < def.requiresClub.members) {
      reasons.push(`${clubDef?.name ?? def.requiresClub.id} 社员 ≥ ${def.requiresClub.members} 人（当前 ${members} 人）`)
    }
  }
  if (def.requires && !meetsRequirement(state, def.requires)) {
    if (def.requires.buildings) {
      for (const [id, level] of Object.entries(def.requires.buildings)) {
        if ((state.buildings[id]?.level ?? 0) < level) reasons.push(`${BUILDING_MAP[id]?.name ?? id} Lv.${level}`)
      }
    }
    if (def.requires.tech) {
      for (const id of def.requires.tech) {
        if (!state.technologies[id]?.unlocked) reasons.push(`科技：${id}`)
      }
    }
    if (def.requires.schoolRating != null && state.school.rating < def.requires.schoolRating) {
      reasons.push(`学校评级 ≥ ${def.requires.schoolRating}`)
    }
  }
  if (totalStudents(state) < def.minStudents) reasons.push(`在校学生 ≥ ${def.minStudents} 人`)
  return { unlocked: reasons.length === 0, reasons }
}

export function isTeamUnlocked(state: GameState, def: TeamDef): boolean {
  return teamUnlockStatus(state, def).unlocked
}

/* ------------------------------ 组建 ------------------------------ */

export function canFoundTeam(
  state: GameState,
  id: string,
): { ok: boolean; reason?: string; cost: Partial<Record<ResourceKey, number>>; activity: number } {
  const def = TEAM_MAP[id]
  const entry = state.teams[id]
  const cost = def?.foundingCost ?? {}
  const activity = def?.foundingActivity ?? 0
  if (!def || !entry) return { ok: false, reason: '队伍不存在', cost, activity }
  if (entry.founded) return { ok: false, reason: '已经成立过了', cost, activity }
  const status = teamUnlockStatus(state, def)
  if (!status.unlocked) return { ok: false, reason: `尚未满足组建条件：${status.reasons.join('、')}`, cost, activity }
  if (!canAfford(state, cost)) return { ok: false, reason: '资源不足', cost, activity }
  if (safeNumber(state.resources.activity, 0) < activity) {
    return { ok: false, reason: `学生活跃度不足（需要 ${activity}）`, cost, activity }
  }
  return { ok: true, cost, activity }
}

export function foundTeam(
  state: GameState,
  id: string,
  mods: ModifierIndex,
  hooks: EngineHooks,
  name?: string,
): boolean {
  const def = TEAM_MAP[id]
  const check = canFoundTeam(state, id)
  if (!def || !check.ok) {
    if (check.reason) hooks.notify(`${def?.shortName ?? id}：${check.reason}`, 'bad')
    return false
  }
  payResources(state, check.cost)
  state.resources.activity = Math.max(0, safeNumber(state.resources.activity, 0) - check.activity)
  const entry = state.teams[id]
  entry.founded = true
  const trimmed = (name ?? '').trim().slice(0, 24)
  entry.name = trimmed.length > 0 ? trimmed : undefined
  entry.level = 1
  entry.strength = def.baseStrength * (0.9 + Math.random() * 0.2)
  entry.morale = 75
  entry.foundedAtMinute = state.time.minutes
  entry.bestTierIndex = -1
  hooks.notify(`上报成立校队：${teamDisplayName(state, def)}（${def.shortName}）实力 ${Math.round(entry.strength)}`, 'good')
  hooks.log(`校队成立：${teamDisplayName(state, def)}`, 'team')
  return true
}

/** 队伍升级（扩编）：提高训练收益与比赛加成 */
export function teamUpgradeCost(def: TeamDef, level: number): Partial<Record<ResourceKey, number>> {
  const scale = Math.pow(1.6, Math.max(0, level - 1))
  const out: Partial<Record<ResourceKey, number>> = {}
  for (const [key, value] of Object.entries(def.foundingCost)) {
    out[key as ResourceKey] = Math.ceil(safeNumber(value, 0) * 0.8 * scale)
  }
  return out
}

export function upgradeTeam(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const def = TEAM_MAP[id]
  const entry = state.teams[id]
  if (!def || !entry || !entry.founded) return false
  if (entry.level >= 5) {
    hooks.notify(`${def.shortName} 已经是满编状态。`, 'bad')
    return false
  }
  const cost = teamUpgradeCost(def, entry.level + 1)
  if (!canAfford(state, cost)) {
    hooks.notify(`${def.shortName} 扩编资源不足。`, 'bad')
    return false
  }
  payResources(state, cost)
  entry.level += 1
  entry.morale = clamp(entry.morale + 5, 0, 100)
  hooks.notify(`${def.shortName} 完成扩编：Lv.${entry.level}（训练收益与比赛加成提高）`, 'good')
  return true
}

/* ------------------------------ 训练 ------------------------------ */

/** 一次训练的收益：受队伍等级、队员属性、教师效率、士气与加成影响 */
export function trainingGain(state: GameState, def: TeamDef, mods: ModifierIndex): number {
  const entry = state.teams[def.id]
  if (!entry || !entry.founded) return 0
  const attr = safeNumber(overallAttributes(state)[def.attribute], 30)
  const levelFactor = 1 + 0.15 * (entry.level - 1)
  const moraleFactor = 0.8 + clamp(entry.morale, 0, 100) / 250
  const teacherFactor = 0.6 + teacherEfficiency(state, mods) * 0.5
  const attributeFactor = 0.7 + clamp(attr, 0, 100) / 100
  const bonus = Math.max(0.1, mods.mul('team_training'))
  return Math.max(
    0.5,
    def.training.baseGain * levelFactor * moraleFactor * teacherFactor * attributeFactor * bonus,
  )
}

export function canTrainTeam(state: GameState, id: string): { ok: boolean; reason?: string; gain: number } {
  const def = TEAM_MAP[id]
  const entry = state.teams[id]
  if (!def || !entry?.founded) return { ok: false, reason: '队伍尚未成立', gain: 0 }
  if (entry.training) return { ok: false, reason: '正在进行训练', gain: 0 }
  if (entry.match) return { ok: false, reason: '正在参加比赛', gain: 0 }
  if (def.training.cost && !canAfford(state, def.training.cost)) {
    return { ok: false, reason: '训练经费不足', gain: 0 }
  }
  return { ok: true, gain: 0 }
}

export function startTeamTraining(
  state: GameState,
  id: string,
  mods: ModifierIndex,
  hooks: EngineHooks,
): boolean {
  const def = TEAM_MAP[id]
  const check = canTrainTeam(state, id)
  if (!def || !check.ok) {
    if (check.reason) hooks.notify(`${def?.shortName ?? id}：${check.reason}`, 'bad')
    return false
  }
  if (def.training.cost) payResources(state, def.training.cost)
  const gain = trainingGain(state, def, mods)
  const entry = state.teams[id]
  entry.training = {
    startMinute: state.time.minutes,
    endMinute: state.time.minutes + def.training.minutes,
    gain,
  }
  hooks.notify(`${def.shortName} 开始训练（${formatGameDays(def.training.minutes)}）`, 'info')
  return true
}

/* ------------------------------ 比赛 ------------------------------ */

export function teamMatchChance(state: GameState, def: TeamDef, tier: TeamTierDef, mods: ModifierIndex): number {
  const entry = state.teams[def.id]
  const strength = entry?.strength ?? 0
  const margin = (strength - tier.difficulty) / Math.max(20, tier.difficulty)
  const base = tier.baseSuccess + margin * 0.6
  return clamp(base * Math.max(0.1, mods.mul('competition_success')), 0.05, 0.95)
}

export function teamTierStatus(
  state: GameState,
  id: string,
  tier: TeamTierDef,
): { available: boolean; reason?: string } {
  const def = TEAM_MAP[id]
  const entry = state.teams[id]
  if (!def || !entry?.founded) return { available: false, reason: '队伍尚未成立' }
  const tierIndex = TEAM_TIERS.findIndex((t) => t.id === tier.id)
  if (tierIndex > def.maxTierIndex) return { available: false, reason: `${def.shortName} 暂时没有这个级别的参赛资格` }
  if (entry.match) return { available: false, reason: '正在参加比赛' }
  if (entry.training) return { available: false, reason: '正在训练' }
  if (entry.strength < tier.minStrength) {
    return { available: false, reason: `实力不足（需要 ${tier.minStrength}，当前 ${Math.round(entry.strength)}）` }
  }
  if (tier.requires && !meetsRequirement(state, tier.requires)) {
    return { available: false, reason: '尚未获得该级别赛事的参赛资格（需要科技 / 评级）' }
  }
  if (totalStudents(state) < tier.memberCost) {
    return { available: false, reason: `需要 ${tier.memberCost} 名队员` }
  }
  if (!canAfford(state, tier.cost)) return { available: false, reason: '报名与差旅费用不足' }
  return { available: true }
}

export function startTeamMatch(
  state: GameState,
  id: string,
  tierId: string,
  mods: ModifierIndex,
  hooks: EngineHooks,
): boolean {
  const def = TEAM_MAP[id]
  const tier = TEAM_TIER_MAP[tierId]
  if (!def || !tier) return false
  const status = teamTierStatus(state, id, tier)
  if (!status.available) {
    hooks.notify(`${def.shortName} 无法参加${tier.name}：${status.reason}`, 'bad')
    return false
  }
  payResources(state, tier.cost)
  const entry = state.teams[id]
  entry.match = {
    tierId,
    startMinute: state.time.minutes,
    endMinute: state.time.minutes + tier.durationMinutes,
  }
  hooks.notify(`${def.shortName} 出发参加${tier.name}（${Math.round(tier.durationMinutes / 1440)} 天）`, 'info')
  hooks.log(`参加赛事：${def.shortName} → ${tier.name}`, 'team')
  return true
}

/* ------------------------------ 结算 ------------------------------ */

export function tickTeams(state: GameState, mods: ModifierIndex, dtDays: number, hooks: EngineHooks): void {
  for (const def of TEAM_DEFS) {
    const entry = state.teams[def.id]
    if (!entry?.founded) continue

    // 训练完成
    if (entry.training && state.time.minutes + 1e-6 >= entry.training.endMinute) {
      const gain = entry.training.gain
      entry.strength += gain
      entry.morale = clamp(entry.morale + 3, 0, 100)
      entry.training = false
      if (def.training.studentDelta) {
        const delta: Record<string, number> = {}
        for (const [key, value] of Object.entries(def.training.studentDelta)) {
          delta[key] = safeNumber(value, 0)
        }
        applyDeltaToAllCohorts(state, delta)
      }
      hooks.notify(`${def.shortName} 训练完成：实力 +${gain.toFixed(1)}（当前 ${Math.round(entry.strength)}）`, 'good')
    }

    // 比赛结算
    if (entry.match && state.time.minutes + 1e-6 >= entry.match.endMinute) {
      const tier = TEAM_TIER_MAP[entry.match.tierId]
      entry.match = false
      if (tier) resolveTeamMatch(state, def, tier, mods, hooks)
    }

    // 士气缓慢回升（输球不会永久打击队伍）
    if (entry.morale < 70) entry.morale = clamp(entry.morale + 0.6 * dtDays, 0, 100)
  }
}

function resolveTeamMatch(
  state: GameState,
  def: TeamDef,
  tier: TeamTierDef,
  mods: ModifierIndex,
  hooks: EngineHooks,
): void {
  const entry = state.teams[def.id]
  const chance = teamMatchChance(state, def, tier, mods)
  const roll = Math.random()
  const success = roll < chance
  const big = success && roll < chance * 0.25
  const rewardMul = success ? (big ? 1.7 : 1) : 0.3
  const rewardBonus = Math.max(0.1, mods.mul('competition_reward'))
  const tierIndex = TEAM_TIERS.findIndex((t) => t.id === tier.id)

  const resources: Partial<Record<ResourceKey, number>> = {}
  const reputation = Math.round(tier.rewardReputation * rewardMul * rewardBonus)
  for (const [key, value] of Object.entries(tier.rewardResources ?? {})) {
    const amount = Math.round(safeNumber(value, 0) * rewardMul * rewardBonus)
    if (amount !== 0) resources[key as ResourceKey] = amount
  }
  if (reputation !== 0) resources.reputation = (resources.reputation ?? 0) + reputation
  grantResources(state, resources)

  entry.matches += 1
  state.statistics.competitions += 1
  if (success) {
    entry.wins += 1
    entry.strength += tier.winStrength
    entry.morale = clamp(entry.morale + (big ? 12 : 8), 0, 100)
    state.statistics.competitionWins += 1
    state.legacy.lifetimeCompetitionWins += 1
    entry.bestTierIndex = Math.max(entry.bestTierIndex, tierIndex)
    state.statistics.flags[`teamWin_${def.id}_${tier.id}`] = true
    state.statistics.flags[`teamTier_${tier.id}`] = true
  } else {
    entry.losses += 1
    entry.strength += 1
    entry.morale = clamp(entry.morale - 5, 0, 100)
  }

  // 队员的状态变化
  applyDeltaToAllCohorts(state, {
    stress: success ? 1.5 : 3,
    satisfaction: success ? (big ? 4 : 2.5) : -1.5,
    morality: 0.5,
  })

  if (tier.cardPool) {
    maybeGrantCard(state, tier.cardPool, tier.cardChance * (success ? 1 : 0.3), `${def.shortName} · ${tier.name}`, mods, hooks)
  }

  const headline = big ? '夺冠' : success ? '获胜' : '失利'
  hooks.notify(
    `${teamDisplayName(state, def)} 在${tier.name}${headline}（实力 ${Math.round(entry.strength)}，胜率 ${(chance * 100).toFixed(0)}%）`,
    success ? 'good' : 'bad',
  )
  hooks.log(`${def.shortName} ${tier.name}${headline}`, 'team')
}

/* ------------------------------ 汇总（供界面） ------------------------------ */

export function teamOverview(state: GameState, mods: ModifierIndex) {
  const founded = TEAM_DEFS.filter((def) => state.teams[def.id]?.founded)
  return {
    total: TEAM_DEFS.length,
    founded: founded.length,
    unlocked: TEAM_DEFS.filter((def) => isTeamUnlocked(state, def)).length,
    totalStrength: founded.reduce((sum, def) => sum + (state.teams[def.id]?.strength ?? 0), 0),
    wins: founded.reduce((sum, def) => sum + (state.teams[def.id]?.wins ?? 0), 0),
    losses: founded.reduce((sum, def) => sum + (state.teams[def.id]?.losses ?? 0), 0),
    bestTier: founded.reduce((best, def) => {
      const index = state.teams[def.id]?.bestTierIndex ?? -1
      return index > best ? index : best
    }, -1),
    avgMorale:
      founded.length > 0
        ? founded.reduce((sum, def) => sum + (state.teams[def.id]?.morale ?? 0), 0) / founded.length
        : 0,
  }
}

export function teamRow(state: GameState, def: TeamDef, mods: ModifierIndex) {
  const entry = state.teams[def.id]
  const unlock = teamUnlockStatus(state, def)
  return {
    def,
    entry,
    unlocked: unlock.unlocked,
    reasons: unlock.reasons,
    gain: entry?.founded ? trainingGain(state, def, mods) : 0,
    canFound: canFoundTeam(state, def.id),
  }
}
