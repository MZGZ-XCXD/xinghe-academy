import { BUILDING_DEFS, BUILDING_MAP, STARTING_BUILDINGS, SYNERGY_DEFS } from './buildings'
import { COURSE_DEFS, COURSE_MAP, RECRUIT_COURSE_TAG } from './courses'
import { TECH_DEFS, TECH_MAP } from './technologies'
import { POLICY_DEFS, POLICY_MAP, BASE_POLICY_SLOTS } from './policies'
import { EVENT_DEFS, EVENT_MAP, RANDOM_EVENT_IDS } from './events'
import { CARD_DEFS, CARD_MAP, RARITY_WEIGHT } from './cards'
import { ACTIVITY_DEFS, ACTIVITY_MAP } from './activities'
import { CLUB_DEFS, CLUB_MAP } from './clubs'
import { TEAM_DEFS, TEAM_MAP, TEAM_TIERS, TEAM_TIER_MAP } from './teams'
import { TUTORIAL_STEPS, TUTORIAL_MAP } from './tutorial'
import { RATING_TIERS, RATING_EXAMS, RATING_EXAM_MAP, ratingCapFor, ratingTierOf } from './rating'
import { ACHIEVEMENT_DEFS, ACHIEVEMENT_MAP } from './achievements'
import { LEGACY_NODES, LEGACY_NODE_MAP, LEGACY_BRANCHES } from './legacy'
import { SEASON_DEFS, SEASON_MAP } from './seasons'
import { RESOURCE_DEFS, RESOURCE_MAP, ALL_RESOURCES } from './resources'
import { EFFECT_TARGETS } from '../game/types'

export {
  BUILDING_DEFS,
  BUILDING_MAP,
  STARTING_BUILDINGS,
  SYNERGY_DEFS,
  COURSE_DEFS,
  COURSE_MAP,
  RECRUIT_COURSE_TAG,
  TECH_DEFS,
  TECH_MAP,
  POLICY_DEFS,
  POLICY_MAP,
  BASE_POLICY_SLOTS,
  EVENT_DEFS,
  EVENT_MAP,
  RANDOM_EVENT_IDS,
  CARD_DEFS,
  CARD_MAP,
  RARITY_WEIGHT,
  ACTIVITY_DEFS,
  ACTIVITY_MAP,
  CLUB_DEFS,
  CLUB_MAP,
  TEAM_DEFS,
  TEAM_MAP,
  TEAM_TIERS,
  TEAM_TIER_MAP,
  TUTORIAL_STEPS,
  TUTORIAL_MAP,
  RATING_TIERS,
  RATING_EXAMS,
  RATING_EXAM_MAP,
  ratingCapFor,
  ratingTierOf,
  ACHIEVEMENT_DEFS,
  ACHIEVEMENT_MAP,
  LEGACY_NODES,
  LEGACY_NODE_MAP,
  LEGACY_BRANCHES,
  SEASON_DEFS,
  SEASON_MAP,
  RESOURCE_DEFS,
  RESOURCE_MAP,
  ALL_RESOURCES,
}

/**
 * 内容自检：在开发模式下运行，也能被单元测试直接调用。
 * 防止出现拼错的加成目标、悬空的前置 id、重复 id 等数据事故。
 */
export function validateContent(): string[] {
  const problems: string[] = []
  const targets = new Set<string>(EFFECT_TARGETS)

  const checkEffects = (effects: { target: string }[] | undefined, where: string) => {
    for (const e of effects ?? []) {
      if (!targets.has(e.target)) problems.push(`${where} 使用了未知加成目标：${e.target}`)
    }
  }

  const dupCheck = (ids: string[], label: string) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${label} 存在重复 id：${id}`)
      seen.add(id)
    }
  }

  dupCheck(BUILDING_DEFS.map((b) => b.id), '建筑')
  dupCheck(COURSE_DEFS.map((c) => c.id), '课程')
  dupCheck(TECH_DEFS.map((t) => t.id), '科技')
  dupCheck(POLICY_DEFS.map((p) => p.id), '校规')
  dupCheck(EVENT_DEFS.map((e) => e.id), '事件')
  dupCheck(CARD_DEFS.map((c) => c.id), '效果卡')
  dupCheck(ACTIVITY_DEFS.map((a) => a.id), '活动')
  dupCheck(CLUB_DEFS.map((c) => c.id), '社团')
  dupCheck(TEAM_DEFS.map((t) => t.id), '校队')
  dupCheck(TEAM_TIERS.map((t) => t.id), '赛事层级')
  dupCheck(ACHIEVEMENT_DEFS.map((a) => a.id), '成就')
  dupCheck(LEGACY_NODES.map((n) => n.id), '传承节点')

  for (const b of BUILDING_DEFS) {
    checkEffects(b.effects, `建筑 ${b.id}`)
    checkEffects(b.perLevelEffects, `建筑 ${b.id}`)
    for (const dep of Object.keys(b.requires?.buildings ?? {})) {
      if (!BUILDING_MAP[dep]) problems.push(`建筑 ${b.id} 依赖不存在的建筑：${dep}`)
    }
    for (const dep of b.requires?.tech ?? []) {
      if (!TECH_MAP[dep]) problems.push(`建筑 ${b.id} 依赖不存在的科技：${dep}`)
    }
  }
  for (const c of COURSE_DEFS) {
    for (const dep of Object.keys(c.requires?.buildings ?? {})) {
      if (!BUILDING_MAP[dep]) problems.push(`课程 ${c.id} 依赖不存在的建筑：${dep}`)
    }
    for (const dep of c.requires?.tech ?? []) {
      if (!TECH_MAP[dep]) problems.push(`课程 ${c.id} 依赖不存在的科技：${dep}`)
    }
  }
  for (const t of TECH_DEFS) {
    checkEffects(t.effects, `科技 ${t.id}`)
    for (const dep of t.requires) {
      if (!TECH_MAP[dep]) problems.push(`科技 ${t.id} 依赖不存在的科技：${dep}`)
    }
    for (const id of t.unlocks?.buildings ?? []) {
      if (!BUILDING_MAP[id]) problems.push(`科技 ${t.id} 解锁了不存在的建筑：${id}`)
    }
    for (const id of t.unlocks?.courses ?? []) {
      if (!COURSE_MAP[id]) problems.push(`科技 ${t.id} 解锁了不存在的课程：${id}`)
    }
  }
  for (const p of POLICY_DEFS) {
    checkEffects(p.effects, `校规 ${p.id}`)
    for (const dep of p.requires?.tech ?? []) {
      if (!TECH_MAP[dep]) problems.push(`校规 ${p.id} 依赖不存在的科技：${dep}`)
    }
  }
  for (const e of EVENT_DEFS) {
    for (const choice of e.choices) {
      checkEffects(choice.effects, `事件 ${e.id}`)
      for (const s of choice.schedule ?? []) {
        if (!EVENT_MAP[s.eventId]) problems.push(`事件 ${e.id} 调度了不存在的事件：${s.eventId}`)
      }
      if (choice.grantCards && choice.grantCards.count <= 0) {
        problems.push(`事件 ${e.id} 的卡片数量非法`)
      }
    }
  }
  for (const c of CARD_DEFS) checkEffects(c.effects, `效果卡 ${c.id}`)
  for (const n of LEGACY_NODES) {
    checkEffects(n.effects, `传承节点 ${n.id}`)
    checkEffects(n.perLevelEffects, `传承节点 ${n.id}`)
    for (const dep of n.requires) {
      if (!LEGACY_NODE_MAP[dep]) problems.push(`传承节点 ${n.id} 依赖不存在的节点：${dep}`)
    }
  }
  for (const s of SYNERGY_DEFS) {
    checkEffects(s.effects, `建筑联动 ${s.id}`)
    for (const dep of Object.keys(s.requires)) {
      if (!BUILDING_MAP[dep]) problems.push(`建筑联动 ${s.id} 依赖不存在的建筑：${dep}`)
    }
  }
  for (const club of CLUB_DEFS) {
    checkEffects(club.effects, `社团 ${club.id}`)
    checkEffects(club.perLevelEffects, `社团 ${club.id}`)
    for (const dep of Object.keys(club.requires?.buildings ?? {})) {
      if (!BUILDING_MAP[dep]) problems.push(`社团 ${club.id} 依赖不存在的建筑：${dep}`)
    }
    for (const dep of club.requires?.tech ?? []) {
      if (!TECH_MAP[dep]) problems.push(`社团 ${club.id} 依赖不存在的科技：${dep}`)
    }
    for (const dep of Object.keys(club.requires?.clubLevels ?? {})) {
      if (!CLUB_MAP[dep]) problems.push(`社团 ${club.id} 依赖不存在的社团：${dep}`)
    }
  }
  for (const team of TEAM_DEFS) {
    checkEffects(team.effects, `校队 ${team.id}`)
    checkEffects(team.perLevelEffects, `校队 ${team.id}`)
    if (team.requiresClub && !CLUB_MAP[team.requiresClub.id]) {
      problems.push(`校队 ${team.id} 依赖不存在的社团：${team.requiresClub.id}`)
    }
    for (const dep of Object.keys(team.requires?.buildings ?? {})) {
      if (!BUILDING_MAP[dep]) problems.push(`校队 ${team.id} 依赖不存在的建筑：${dep}`)
    }
    for (const dep of team.requires?.tech ?? []) {
      if (!TECH_MAP[dep]) problems.push(`校队 ${team.id} 依赖不存在的科技：${dep}`)
    }
    if (team.maxTierIndex >= TEAM_TIERS.length) {
      problems.push(`校队 ${team.id} 的最高赛事层级超出范围`)
    }
  }
  for (const tier of TEAM_TIERS) {
    for (const dep of tier.requires?.tech ?? []) {
      if (!TECH_MAP[dep]) problems.push(`赛事 ${tier.id} 依赖不存在的科技：${dep}`)
    }
  }
  for (const activity of ACTIVITY_DEFS) {
    for (const dep of Object.keys(activity.requires?.clubLevels ?? {})) {
      if (!CLUB_MAP[dep]) problems.push(`活动 ${activity.id} 依赖不存在的社团：${dep}`)
    }
  }
  for (const r of RESOURCE_DEFS) {
    if (!ALL_RESOURCES.includes(r.key)) problems.push(`资源定义未登记：${r.key}`)
  }

  // 循环依赖检测（科技）
  const visiting = new Set<string>()
  const done = new Set<string>()
  const visit = (id: string, path: string[]) => {
    if (done.has(id)) return
    if (visiting.has(id)) {
      problems.push(`科技存在循环前置：${[...path, id].join(' → ')}`)
      return
    }
    visiting.add(id)
    for (const dep of TECH_MAP[id]?.requires ?? []) visit(dep, [...path, id])
    visiting.delete(id)
    done.add(id)
  }
  for (const t of TECH_DEFS) visit(t.id, [])

  return problems
}
