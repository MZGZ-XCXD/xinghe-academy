import type { ClubDef, GameState, ResourceKey, StudentDelta } from '../types'
import { CLUB_DEFS, CLUB_MAP, BUILDING_MAP } from '../../data'
import {
  clubSlots,
  foundedClubCount,
  meetsRequirement,
  safeNumber,
  totalStudents,
  totalClubLevels,
  totalClubMembers,
} from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { grantResources } from './ResourceEngine'
import { applyDeltaToAllCohorts } from './CourseEngine'
import type { EngineHooks } from './hooks'

/**
 * 社员名额相对在校学生的比例。
 * 大于 1 是因为允许「兼部」：一个学生同时参加两个社团在日本校园里很常见。
 */
export const CLUB_MEMBER_RATIO = 1.2

export function isClubUnlocked(state: GameState, def: ClubDef): boolean {
  return meetsRequirement(state, def.requires)
}

export function clubMemberCapacity(state: GameState): number {
  return Math.floor(totalStudents(state) * CLUB_MEMBER_RATIO)
}

export function clubMembersOf(def: ClubDef, level: number): number {
  if (level <= 0) return 0
  return def.baseMembers + def.memberPerLevel * (level - 1)
}

export function clubUpgradeCost(state: GameState, def: ClubDef, level: number): { money: number; activity: number } {
  const target = Math.max(1, level)
  const growth = Math.pow(def.costGrowth, target - 1)
  return {
    money: Math.ceil(def.baseCostMoney * growth),
    activity: Math.ceil((def.baseCostActivity ?? 0) * growth),
  }
}

export interface ClubCheck {
  ok: boolean
  reason?: string
  money: number
  activity: number
  nextLevel: number
  members: number
}

export function canUpgradeClub(state: GameState, id: string, mods: ModifierIndex): ClubCheck {
  const def = CLUB_MAP[id]
  const entry = state.clubs[id]
  if (!def || !entry) return { ok: false, reason: '社团不存在', money: 0, activity: 0, nextLevel: 0, members: 0 }
  const nextLevel = entry.level + 1
  const cost = clubUpgradeCost(state, def, nextLevel)
  const nextMembers = clubMembersOf(def, nextLevel)
  const extraMembers = nextMembers - entry.members
  const base: ClubCheck = {
    ok: false,
    money: cost.money,
    activity: cost.activity,
    nextLevel,
    members: nextMembers,
  }

  if (!isClubUnlocked(state, def)) return { ...base, reason: '尚未解锁（需要满足前置条件）' }
  if (entry.level >= def.maxLevel) return { ...base, reason: '已达到最高等级' }
  if (entry.level === 0) {
    const slots = clubSlots(state, BUILDING_MAP)
    if (foundedClubCount(state) >= slots) {
      return { ...base, reason: `部室不足（${foundedClubCount(state)} / ${slots}），需要扩建社团活动楼或部室栋` }
    }
  }
  if (totalClubMembers(state) + extraMembers > clubMemberCapacity(state)) {
    return { ...base, reason: '社员名额不足（在校学生太少），需要扩大招生' }
  }
  if (safeNumber(state.resources.money, 0) < cost.money) return { ...base, reason: `资金不足（需要 ${cost.money}）` }
  if ((state.resources.activity ?? 0) < cost.activity) {
    return { ...base, reason: `学生活跃度不足（需要 ${cost.activity}）` }
  }
  return { ...base, ok: true }
}

export function upgradeClub(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const def = CLUB_MAP[id]
  const check = canUpgradeClub(state, id, mods)
  if (!def || !check.ok) {
    if (def && check.reason) hooks.notify(`「${def.name}」${check.reason}`, 'bad')
    return false
  }
  state.resources.money = Math.max(0, safeNumber(state.resources.money, 0) - check.money)
  state.resources.activity = Math.max(0, safeNumber(state.resources.activity, 0) - check.activity)
  const entry = state.clubs[id]
  entry.level = check.nextLevel
  entry.members = check.members
  entry.unlocked = true
  entry.joinedAtMinute = entry.joinedAtMinute ?? state.time.minutes
  const verb = check.nextLevel === 1 ? '成立' : '升级'
  hooks.notify(`${verb}社团：${def.name}${def.jpName ? `（${def.jpName}）` : ''} Lv.${entry.level}，社员 ${entry.members} 人`, 'good')
  hooks.log(`社团${verb}：${def.name} Lv.${entry.level}`, 'club')
  return true
}

/**
 * 社团结算：社员带来属性成长与资源产出，同时消耗运营资金。
 * 成长按「社员数 / 40」折算，因此社团规模越大越有效。
 */
export function tickClubs(state: GameState, mods: ModifierIndex, dtDays: number): void {
  const effectMul = Math.max(0.05, mods.mul('club_effect'))
  let upkeep = 0
  for (const def of CLUB_DEFS) {
    const entry = state.clubs[def.id]
    if (!entry || entry.level <= 0) continue
    const members = clubMembersOf(def, entry.level)
    entry.members = members
    const scale = (members / 40) * effectMul
    if (scale <= 0) continue

    if (def.growth) {
      const delta: StudentDelta = {}
      for (const [key, value] of Object.entries(def.growth)) {
        delta[key as keyof StudentDelta] = safeNumber(value, 0) * scale * dtDays
      }
      applyDeltaToAllCohorts(state, delta)
    }
    if (def.output) {
      const gain: Partial<Record<ResourceKey, number>> = {}
      for (const [key, value] of Object.entries(def.output)) {
        const amount = safeNumber(value, 0) * scale * dtDays
        if (amount !== 0) gain[key as ResourceKey] = amount
      }
      grantResources(state, gain)
    }
    upkeep += def.upkeepPerLevelPerDay * entry.level * dtDays
  }
  if (upkeep > 0) {
    state.resources.money = Math.max(0, safeNumber(state.resources.money, 0) - upkeep)
  }
}

/** 学园祭评分：所有社团的祭典贡献之和，再乘加成 */
export function festivalScore(state: GameState, mods: ModifierIndex): number {
  let score = 0
  for (const def of CLUB_DEFS) {
    const level = state.clubs[def.id]?.level ?? 0
    if (level <= 0) continue
    score += def.festivalScore * level
  }
  return score * Math.max(0.05, mods.mul('festival_score'))
}

export function festivalLabel(score: number): string {
  if (score <= 0) return '还未起步'
  if (score < 20) return '小型文化祭'
  if (score < 50) return '像样的学园祭'
  if (score < 90) return '全区知名的学园祭'
  if (score < 150) return '需要预约入场的学园祭'
  return '传说中的学园祭'
}

export function clubOverview(state: GameState, mods: ModifierIndex) {
  const slots = clubSlots(state, BUILDING_MAP)
  return {
    defs: CLUB_DEFS,
    founded: foundedClubCount(state),
    slots,
    members: totalClubMembers(state),
    memberCapacity: clubMemberCapacity(state),
    totalLevels: totalClubLevels(state),
    festivalScore: festivalScore(state, mods),
    festivalLabel: festivalLabel(festivalScore(state, mods)),
  }
}

export function clubUnlockCount(state: GameState): { unlocked: number; locked: number } {
  let unlocked = 0
  let locked = 0
  for (const def of CLUB_DEFS) {
    if (isClubUnlocked(state, def)) unlocked += 1
    else locked += 1
  }
  return { unlocked, locked }
}
