import type { GameState, TeacherSubject } from '../types'
import { TEACHER_SUBJECT_META } from '../types'
import { clamp, formatGameDays, hireCost, hireDurationMinutes, safeNumber, totalTeachers } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { canAfford, payResources } from './ResourceEngine'
import type { EngineHooks } from './hooks'

/**
 * 教师队伍结算：质量随培训与教研成长，压力随课程量上升，士气随压力下降。
 */
export function tickTeachers(state: GameState, mods: ModifierIndex, dtDays: number, activeCourses: number, hasShortage: boolean): void {
  const load = activeCourses / Math.max(1, totalTeachers(state) / 3)
  const stressMul = Math.max(0.2, mods.mul('teacher_stress'))
  for (const group of state.teachers.groups) {
    if (group.count <= 0) continue
    const workload = clamp(load, 0, 3)
    group.stress = clamp(group.stress + (0.05 * workload - 0.06) * dtDays * stressMul, 0, 100)
    if (hasShortage) group.stress = clamp(group.stress + 0.03 * dtDays, 0, 100)
    const moraleDrift = group.stress > 65 ? -0.04 : 0.03
    group.morale = clamp(group.morale + moraleDrift * dtDays, 0, 100)
    // 教学相长：质量缓慢提升，压力过高时反而下降
    const qualityDrift = group.stress > 80 ? -0.01 : 0.012
    const bonus = Math.max(0, mods.mul('teacher_efficiency') - 1) * 0.002
    group.quality = clamp(group.quality + (qualityDrift + bonus) * dtDays, 0, 100)
  }
}

export function hireCostFor(state: GameState, subject: TeacherSubject, count: number) {
  return hireCost(subject, count, state)
}

export function startHire(
  state: GameState,
  subject: TeacherSubject,
  count: number,
  hooks: EngineHooks,
): boolean {
  const amount = Math.max(1, Math.floor(count))
  const cost = hireCost(subject, amount, state)
  if (!canAfford(state, cost)) {
    hooks.notify('资金不足，无法完成招聘。', 'bad')
    return false
  }
  payResources(state, cost)
  const minutes = hireDurationMinutes(amount)
  state.teachers.hireQueue.push({ subject, count: amount, endMinute: state.time.minutes + minutes })
  hooks.notify(`正在招聘 ${amount} 名${TEACHER_SUBJECT_META[subject].name}教师（${formatGameDays(minutes)}）`, 'info')
  return true
}

export function tickHireQueue(state: GameState, hooks: EngineHooks): void {
  const remaining: typeof state.teachers.hireQueue = []
  for (const hire of state.teachers.hireQueue) {
    if (state.time.minutes >= hire.endMinute) {
      const group = state.teachers.groups.find((g) => g.subject === hire.subject)
      if (group) {
        group.count += hire.count
        group.quality = clamp(group.quality - 2, 0, 100)
        group.morale = clamp(group.morale - 2, 0, 100)
      }
      hooks.notify(`${TEACHER_SUBJECT_META[hire.subject].name} ${hire.count} 名新教师到岗。`, 'good')
      hooks.log(`新教师到岗：${TEACHER_SUBJECT_META[hire.subject].name} ×${hire.count}`, 'teacher')
    } else {
      remaining.push(hire)
    }
  }
  state.teachers.hireQueue = remaining
}

export function teacherOverview(state: GameState) {
  return state.teachers.groups.map((group) => ({
    ...group,
    meta: TEACHER_SUBJECT_META[group.subject],
  }))
}

export function moraleLabel(morale: number): string {
  if (morale >= 85) return '士气如虹'
  if (morale >= 70) return '状态良好'
  if (morale >= 55) return '勉强运转'
  if (morale >= 40) return '情绪低落'
  return '濒临离职'
}

export function salaryEstimate(state: GameState, mods: ModifierIndex): number {
  const perMinute = state.teachers.groups.reduce(
    (sum, g) => sum + g.count * (0.02 + clamp(safeNumber(g.quality, 0), 0, 100) / 100 * 0.02),
    0,
  )
  return perMinute * Math.max(0.1, mods.mul('salary'))
}
