import type { ActivityDef, GameState, ResourceKey } from '../types'
import { ACTIVITY_DEFS, ACTIVITY_MAP } from '../../data'
import {
  activityRewardMultiplier,
  activitySuccessChance,
  activityTeamStrength,
  clamp,
  formatGameDays,
  meetsRequirement,
  safeNumber,
  seasonOf,
  totalStudents,
} from '../formulas'
import { SEASON_LABEL } from '../types'
import type { ModifierIndex } from './ModifierIndex'
import { canAfford, grantResources, payResources } from './ResourceEngine'
import { consumeCardUses, maybeGrantCard } from './CardEngine'
import type { EngineHooks } from './hooks'
import { applyDeltaToAllCohorts } from './CourseEngine'
import { festivalScore } from './ClubEngine'

export function isActivityUnlocked(state: GameState, def: ActivityDef): boolean {
  if (!meetsRequirement(state, def.requires)) return false
  // 季节限定：例如招生类活动只在春季开放
  if (def.seasons && def.seasons.length > 0 && !def.seasons.includes(seasonOf(state.time.minutes))) {
    return false
  }
  return true
}

/** 活动不可参加的原因（含季节说明） */
export function activityBlockReason(state: GameState, def: ActivityDef): string | null {
  if (!meetsRequirement(state, def.requires)) return '尚未解锁（需要对应建筑或科技）'
  if (def.seasons && def.seasons.length > 0 && !def.seasons.includes(seasonOf(state.time.minutes))) {
    const names = def.seasons.map((s) => `${SEASON_LABEL[s]}季`).join('、')
    return `只在${names}举办（当前是${SEASON_LABEL[seasonOf(state.time.minutes)]}季）`
  }
  return null
}

export function activityCheck(
  state: GameState,
  id: string,
  mods: ModifierIndex,
): { ok: boolean; reason?: string; chance?: number; strength?: number } {
  const def = ACTIVITY_MAP[id]
  if (!def) return { ok: false, reason: '活动不存在' }
  const blocked = activityBlockReason(state, def)
  if (blocked) return { ok: false, reason: blocked }
  if (totalStudents(state) < def.studentCost) {
    return { ok: false, reason: `需要 ${def.studentCost} 名学生（当前 ${totalStudents(state)}）` }
  }
  if (state.activeActivities.some((a) => a.defId === id)) return { ok: false, reason: '该活动正在进行中' }
  if (!canAfford(state, def.cost)) return { ok: false, reason: '资源不足' }
  return {
    ok: true,
    chance: activitySuccessChance(state, def, mods, festivalScore(state, mods)),
    strength: activityTeamStrength(state, def, mods),
  }
}

export function startActivity(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const check = activityCheck(state, id, mods)
  const def = ACTIVITY_MAP[id]
  if (!check.ok || !def) {
    if (check.reason) hooks.notify(`${def?.name ?? id}：${check.reason}`, 'bad')
    return false
  }
  payResources(state, def.cost)
  state.activeActivities.push({
    uid: `act_${Math.round(state.time.minutes)}_${Math.round(Math.random() * 1e6)}`,
    defId: id,
    startMinute: state.time.minutes,
    endMinute: state.time.minutes + def.durationMinutes,
    teamStrength: check.strength ?? 0,
  })
  hooks.notify(`已报名「${def.name}」，队伍将在 ${formatGameDays(def.durationMinutes)}后返回。`, 'info')
  hooks.log(`派出队伍：${def.name}`, 'activity')
  return true
}

export function activityProgress(state: GameState, uid: string): number {
  const activity = state.activeActivities.find((a) => a.uid === uid)
  if (!activity) return 1
  const total = Math.max(1, activity.endMinute - activity.startMinute)
  return clamp((state.time.minutes - activity.startMinute) / total, 0, 1)
}

/**
 * 比赛不是简单掷骰子：
 * 学生对应属性 × 教师效率 × 建筑/科技/卡片加成 对抗活动难度，
 * 失败也会带回经验、部分声望与压力代价。
 */
export function tickActivities(state: GameState, mods: ModifierIndex, hooks: EngineHooks): void {
  const remaining: typeof state.activeActivities = []
  for (const activity of state.activeActivities) {
    if (state.time.minutes + 1e-6 < activity.endMinute) {
      remaining.push(activity)
      continue
    }
    const def = ACTIVITY_MAP[activity.defId]
    if (!def) continue
    const power = festivalScore(state, mods)
    const strength = activityTeamStrength(state, def, mods)
    const chance = activitySuccessChance(state, def, mods, power)
    const roll = Math.random()
    const success = roll < chance
    const big = success && roll < chance * 0.3
    const rewardMul = activityRewardMultiplier(def, success, big, mods, power)
    const log: string[] = []

    const resources: Partial<Record<ResourceKey, number>> = {}
    for (const [key, value] of Object.entries(def.rewards.resources ?? {})) {
      const amount = Math.round(safeNumber(value, 0) * rewardMul)
      if (amount !== 0) resources[key as ResourceKey] = amount
    }
    const reputation = Math.round(safeNumber(def.rewards.reputation, 0) * rewardMul)
    if (reputation !== 0) resources.reputation = (resources.reputation ?? 0) + reputation
    grantResources(state, resources)
    // 招生加成：把这次活动的成果计入下一年的新生人数
    const recruitBonus = safeNumber(def.rewards.recruitBonus, 0)
    if (recruitBonus > 0) {
      const gained = recruitBonus * rewardMul
      state.students.recruitBonus += gained
      log.push(`招生加成 +${gained.toFixed(0)}`)
    }
    for (const [key, value] of Object.entries(resources)) {
      if (value) log.push(`${key} ${value > 0 ? '+' : ''}${value}`)
    }

    // 学生状态影响
    if (def.kind === '体育比赛') {
      applyDeltaToAllCohorts(state, { stress: success ? 2 : 4, sports: success ? 0.8 : 0.3, satisfaction: success ? 1.5 : -1 })
    } else if (def.kind === '学术比赛' || def.kind === '科研比赛') {
      applyDeltaToAllCohorts(state, { stress: success ? 3 : 5, academic: 0.4, research: success ? 0.8 : 0.2 })
    } else if (def.kind === '艺术比赛') {
      applyDeltaToAllCohorts(state, { stress: success ? 2 : 3, arts: success ? 0.8 : 0.3, satisfaction: success ? 1.2 : -0.5 })
    } else if (def.kind === '校园活动') {
      applyDeltaToAllCohorts(state, {
        satisfaction: success ? 3 : -1,
        social: success ? 1 : 0.3,
        arts: success ? 0.8 : 0.2,
        stress: success ? 1 : 2,
      })
    } else {
      applyDeltaToAllCohorts(state, { social: success ? 1 : 0.4, satisfaction: success ? 1 : -0.5 })
    }

    state.statistics.competitions += 1
    if (def.kind === '校际交流' || def.kind === '国际交流') state.statistics.exchanges += 1
    const isContest = def.kind !== '校园活动'
    if (success && isContest) {
      state.statistics.competitionWins += 1
      state.legacy.lifetimeCompetitionWins += 1
    }
    if (success) {
      for (const tag of def.rewards.unlockTags ?? []) {
        state.statistics.flags[tag] = true
      }
    }
    if (success && def.id === 'nationalAcademic') state.statistics.flags.wonNationalAcademic = true

    consumeCardUses(state)
    let cardGranted = false
    if (def.rewards.cardPool) {
      cardGranted = maybeGrantCard(
        state,
        def.rewards.cardPool,
        safeNumber(def.rewards.cardChance, 0) * (success ? 1 : 0.25),
        `${def.name}${big ? '（大成功）' : ''}`,
        mods,
        hooks,
      )
    }

    state.activityResults.unshift({
      uid: activity.uid,
      defId: def.id,
      name: def.name,
      success,
      big,
      atMinute: state.time.minutes,
      log,
    })
    state.activityResults = state.activityResults.slice(0, 30)

    const headline = big ? '大成功' : success ? '成功' : '未获奖'
    hooks.notify(`${def.name}：${headline}（成功率 ${(chance * 100).toFixed(0)}%，实力 ${strength.toFixed(1)}）`, success ? 'good' : 'bad')
    hooks.log(`${def.name} ${headline}${cardGranted ? '，获得效果卡' : ''}`, 'activity')
  }
  state.activeActivities = remaining
}

export function availableActivities(state: GameState) {
  return ACTIVITY_DEFS.map((def) => ({
    def,
    unlocked: isActivityUnlocked(state, def),
    blockReason: activityBlockReason(state, def),
  }))
}

export function groupedActivities(state: GameState, kind?: string) {
  return availableActivities(state).filter((a) => !kind || a.def.kind === kind)
}
