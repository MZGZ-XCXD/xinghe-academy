import type { GameState, Requirement, TechDef } from '../game/types'
import { BUILDING_MAP, CLUB_MAP, LEGACY_NODE_MAP, POLICY_MAP, TEAM_MAP, TECH_MAP } from '../data'

export function requirementLines(req?: Requirement): string[] {
  if (!req) return []
  const lines: string[] = []
  if (req.schoolRating != null) lines.push(`学校评级 ≥ ${req.schoolRating}`)
  if (req.schoolYear != null) lines.push(`第 ${req.schoolYear} 学年之后`)
  if (req.graduates != null) lines.push(`累计毕业生 ≥ ${req.graduates}`)
  if (req.totalStudents != null) lines.push(`在校学生 ≥ ${req.totalStudents}`)
  if (req.minStudents != null) lines.push(`在校学生 ≥ ${req.minStudents}`)
  if (req.totalClubLevels != null) lines.push(`社团等级总和 ≥ ${req.totalClubLevels}`)
  if (req.teamFounded) lines.push(...req.teamFounded.map((id) => `已成立校队：${TEAM_MAP[id]?.shortName ?? id}`))
  if (req.teamStrength) {
    for (const [id, value] of Object.entries(req.teamStrength)) {
      lines.push(`${TEAM_MAP[id]?.shortName ?? id} 实力 ≥ ${value}`)
    }
  }
  if (req.clubLevels) {
    for (const [id, level] of Object.entries(req.clubLevels)) {
      lines.push(`社团「${CLUB_MAP[id]?.name ?? id}」Lv.${level}`)
    }
  }
  for (const id of req.tech ?? []) lines.push(`科技：${TECH_MAP[id]?.name ?? id}`)
  for (const [id, level] of Object.entries(req.buildings ?? {})) {
    lines.push(`${BUILDING_MAP[id]?.name ?? id} Lv.${level}`)
  }
  for (const id of req.policies ?? []) lines.push(`校规：${POLICY_MAP[id]?.name ?? id}`)
  for (const id of req.legacyPerks ?? []) lines.push(`传承特性：${LEGACY_NODE_MAP[id]?.name ?? id}`)
  return lines
}

/** 返回「尚未满足」的条件清单 */
export function meetingRequirements(state: GameState, req?: Requirement): string[] {
  if (!req) return []
  const unmet: string[] = []
  if (req.schoolRating != null && state.school.rating < req.schoolRating) unmet.push(`学校评级 ≥ ${req.schoolRating}`)
  if (req.schoolYear != null) {
    const years = Math.floor(state.time.minutes / (1440 * 30 * 12)) + 1
    if (years < req.schoolYear) unmet.push(`第 ${req.schoolYear} 学年之后`)
  }
  if (req.graduates != null && state.statistics.graduates < req.graduates) {
    unmet.push(`累计毕业生 ≥ ${req.graduates}`)
  }
  if (req.totalStudents != null) {
    const total = state.students.cohorts.reduce((sum, c) => sum + c.count, 0)
    if (total < req.totalStudents) unmet.push(`在校学生 ≥ ${req.totalStudents}`)
  }
  if (req.totalClubLevels != null) {
    const total = Object.values(state.clubs ?? {}).reduce((sum, club) => sum + club.level, 0)
    if (total < req.totalClubLevels) unmet.push(`社团等级总和 ≥ ${req.totalClubLevels}`)
  }
  if (req.clubLevels) {
    for (const [id, level] of Object.entries(req.clubLevels)) {
      if ((state.clubs?.[id]?.level ?? 0) < level) unmet.push(`社团「${CLUB_MAP[id]?.name ?? id}」Lv.${level}`)
    }
  }
  if (req.teamFounded) {
    for (const id of req.teamFounded) {
      if (state.teams?.[id]?.founded !== true) unmet.push(`已成立校队：${TEAM_MAP[id]?.shortName ?? id}`)
    }
  }
  if (req.teamStrength) {
    for (const [id, value] of Object.entries(req.teamStrength)) {
      if ((state.teams?.[id]?.strength ?? 0) < value) {
        unmet.push(`${TEAM_MAP[id]?.shortName ?? id} 实力 ≥ ${value}`)
      }
    }
  }
  for (const id of req.tech ?? []) {
    if (!state.technologies[id]?.unlocked) unmet.push(`科技：${TECH_MAP[id]?.name ?? id}`)
  }
  for (const [id, level] of Object.entries(req.buildings ?? {})) {
    if ((state.buildings[id]?.level ?? 0) < level) unmet.push(`${BUILDING_MAP[id]?.name ?? id} Lv.${level}`)
  }
  return unmet
}

export function missingPrereqTechs(state: GameState, def: TechDef): string[] {
  return def.requires.filter((id) => !state.technologies[id]?.unlocked).map((id) => TECH_MAP[id]?.name ?? id)
}
