import type { CourseDef, GameState, ResourceKey, StudentDelta } from '../types'
import { COURSE_DEFS, COURSE_MAP, RECRUIT_COURSE_TAG } from '../../data'
import {
  courseCapacity,
  courseGrowthPerDay,
  courseOutputPerDay,
  courseSlots as baseCourseSlots,
  courseTeachingCostPerDay,
  meetsRequirement,
  safeNumber,
  seasonMultiplierForCourse,
  seasonOf,
  teacherEfficiency,
  teacherGroupCount,
  totalStudents,
} from '../formulas'
import { BUILDING_MAP } from '../../data'
import type { ModifierIndex } from './ModifierIndex'
import { grantResources } from './ResourceEngine'
import type { EngineHooks } from './hooks'

export interface CourseAllocation {
  def: CourseDef
  served: number
  teacherRatio: number
  capacityRatio: number
}

export function courseIsUnlocked(state: GameState, def: CourseDef): boolean {
  if (state.courses[def.id]?.unlocked) return true
  return meetsRequirement(state, def.requires)
}

export function totalCourseSlots(state: GameState): number {
  return baseCourseSlots(state, BUILDING_MAP)
}

export function usedCourseSlots(state: GameState): number {
  let used = 0
  for (const def of COURSE_DEFS) {
    if (state.courses[def.id]?.active) used += def.slotCost
  }
  return used
}

export function teacherRatioFor(state: GameState, def: CourseDef): number {
  const required = Math.max(0, def.teacherRequired)
  if (required <= 0) return 1
  const count = teacherGroupCount(state, def.subject)
  return Math.min(1.5, count / required)
}

/**
 * 课程的覆盖分配。
 *
 * 每门课**各自**覆盖学生：语文覆盖 120 人并不影响数学也覆盖 120 人，
 * 因为所有学生本来就要同时上这两门课。
 * 只有当学生人数超过某门课的有效容量（平行班数量）时，那门课才会只覆盖一部分学生。
 */
export function allocateCourses(state: GameState): CourseAllocation[] {
  const total = totalStudents(state)
  const out: CourseAllocation[] = []
  for (const def of COURSE_DEFS) {
    if (!state.courses[def.id]?.active) continue
    const capacity = courseCapacity(state, def, BUILDING_MAP)
    const served = Math.max(0, Math.min(capacity, total))
    const teacherRatio = teacherRatioFor(state, def)
    out.push({
      def,
      served,
      teacherRatio,
      capacityRatio: total > 0 ? served / total : 0,
    })
  }
  return out
}

/** 学校层面的课程覆盖概况（供界面显示） */
export function courseCoverageSummary(state: GameState): {
  total: number
  worstRatio: number
  limited: { name: string; served: number; capacity: number; ratio: number }[]
} {
  const total = totalStudents(state)
  const limited: { name: string; served: number; capacity: number; ratio: number }[] = []
  let worstRatio = 1
  for (const allocation of allocateCourses(state)) {
    const capacity = courseCapacity(state, allocation.def, BUILDING_MAP)
    const ratio = total > 0 ? allocation.served / total : 1
    worstRatio = Math.min(worstRatio, ratio)
    if (ratio < 0.999) {
      limited.push({ name: allocation.def.name, served: allocation.served, capacity, ratio })
    }
  }
  return { total, worstRatio, limited }
}

export function toggleCourse(state: GameState, id: string, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const def = COURSE_MAP[id]
  const courseState = state.courses[id]
  if (!def || !courseState) return false
  if (courseState.active) {
    courseState.active = false
    hooks.notify(`已停开《${def.name}》`, 'info')
    return true
  }
  if (!courseIsUnlocked(state, def)) {
    hooks.notify(`《${def.name}》尚未解锁：${requirementHint(state, def)}`, 'bad')
    return false
  }
  const slots = totalCourseSlots(state)
  if (usedCourseSlots(state) + def.slotCost > slots) {
    hooks.notify(`课程槽位不足（需要 ${def.slotCost}，剩余 ${slots - usedCourseSlots(state)}）`, 'bad')
    return false
  }
  if (teacherGroupCount(state, def.subject) <= 0) {
    hooks.notify(`没有${def.name}所需的任课教师，请先招聘。`, 'bad')
    return false
  }
  courseState.active = true
  if (teacherRatioFor(state, def) < 1) {
    hooks.notify(`《${def.name}》教师不足，课程效果将按比例下降。`, 'info')
  } else {
    hooks.notify(`已开课《${def.name}》`, 'good')
  }
  state.statistics.activityLog.push({ minute: state.time.minutes, text: `开课：${def.name}`, kind: 'course' })
  return true
}

function requirementHint(state: GameState, def: CourseDef): string {
  const req = def.requires
  if (!req) return '无'
  const parts: string[] = []
  for (const t of req.tech ?? []) if (!state.technologies[t]?.unlocked) parts.push('需要对应科技')
  for (const [id, level] of Object.entries(req.buildings ?? {})) {
    if ((state.buildings[id]?.level ?? 0) < level) parts.push(`需要 ${BUILDING_MAP[id]?.name ?? id} Lv.${level}`)
  }
  if (req.schoolRating != null && state.school.rating < req.schoolRating) parts.push(`学校评级 ≥ ${req.schoolRating}`)
  return parts.length > 0 ? parts.join('、') : '条件未满足'
}

export interface CourseTickSummary {
  servedStudents: number
  teachingSpent: number
  teachingShortage: boolean
  activeCount: number
}

/**
 * 课程结算：教学资源消耗 → 学生成长 → 资源产出。
 * 教学资源不足时课程仍会继续，但效果下降（不会出现负数资源或死锁）。
 */
export function tickCourses(
  state: GameState,
  mods: ModifierIndex,
  dtDays: number,
  dtMinutes: number,
  hooks: EngineHooks,
): CourseTickSummary {
  const allocations = allocateCourses(state)
  const summary: CourseTickSummary = {
    servedStudents: allocations.reduce((sum, a) => sum + a.served, 0),
    teachingSpent: 0,
    teachingShortage: false,
    activeCount: allocations.length,
  }
  if (allocations.length === 0) return summary

  const season = seasonOf(state.time.minutes)
  const efficiency = teacherEfficiency(state, mods)
  const total = totalStudents(state)

  let plannedCost = 0
  for (const a of allocations) {
    plannedCost += courseTeachingCostPerDay(a.def, a.served, mods) * dtDays
  }
  const available = Math.max(0, safeNumber(state.resources.teaching, 0))
  const affordability = plannedCost > 0 ? Math.min(1, available / plannedCost) : 1
  const growthScale = 0.4 + 0.6 * affordability
  summary.teachingShortage = affordability < 1

  for (const a of allocations) {
    if (a.served <= 0) continue
    const ctx = {
      cohortCount: total,
      servedStudents: a.served,
      teacherRatio: a.teacherRatio,
      capacityRatio: a.capacityRatio,
      efficiency,
      season,
    }
    const delta: StudentDelta = courseGrowthPerDay(a.def, ctx, mods)
    const scaled: StudentDelta = {}
    for (const [key, value] of Object.entries(delta)) {
      scaled[key as keyof StudentDelta] = safeNumber(value, 0) * dtDays * growthScale
    }
    applyDeltaToAllCohorts(state, scaled)

    const outputs = courseOutputPerDay(a.def, ctx, mods)
    const gain: Partial<Record<ResourceKey, number>> = {}
    for (const [key, value] of Object.entries(outputs)) {
      gain[key as ResourceKey] = safeNumber(value, 0) * dtDays * growthScale
    }
    if (Object.keys(gain).length > 0) grantResources(state, gain)

    if (a.def.tags?.includes(RECRUIT_COURSE_TAG)) {
      const seasonMult = seasonMultiplierForCourse(a.def, season)
      state.students.recruitBonus += (a.served / 40) * dtDays * 1.5 * seasonMult
    }
    const st = state.courses[a.def.id]
    if (st) st.totalServedMinutes += a.served * dtMinutes
  }

  const spend = plannedCost * affordability
  state.resources.teaching = Math.max(0, available - spend)
  summary.teachingSpent = spend
  state.statistics.studentsTaught += (total * dtDays) / 360

  if (summary.teachingShortage && Math.random() < dtDays) {
    hooks.notify('教学资源见底，部分课程只能按最低强度维持。', 'bad')
  }
  return summary
}

export function applyDeltaToAllCohorts(state: GameState, delta: StudentDelta, scale = 1): void {
  for (const cohort of state.students.cohorts) {
    if (cohort.count <= 0) continue
    for (const [key, value] of Object.entries(delta)) {
      const v = safeNumber(value, 0) * scale
      if (v === 0) continue
      if (key === 'stress') cohort.stress = clamp100(cohort.stress + v)
      else if (key === 'satisfaction') cohort.satisfaction = clamp100(cohort.satisfaction + v)
      else {
        const k = key as keyof typeof cohort.attrs
        if (k in cohort.attrs) cohort.attrs[k] = clamp100(cohort.attrs[k] + v)
      }
    }
  }
}

function clamp100(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, v))
}
