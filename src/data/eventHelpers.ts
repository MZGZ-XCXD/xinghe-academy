import type { GameState, ResourceKey, StudentDelta } from '../game/types'
import { RESOURCE_MAP } from './resources'
import { clamp } from '../game/formulas'

export type EventApply = (state: GameState) => string[]

function fmt(n: number): string {
  const rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

/** 直接结算资源（可正可负，不会低于 0） */
export function gain(res: Partial<Record<ResourceKey, number>>, note?: string): EventApply {
  return (state) => {
    const lines: string[] = []
    for (const [key, value] of Object.entries(res)) {
      const k = key as ResourceKey
      const v = Number(value) || 0
      state.resources[k] = clamp((state.resources[k] ?? 0) + v, 0, Number.MAX_SAFE_INTEGER / 1000)
      lines.push(`${RESOURCE_MAP[k]?.name ?? k} ${fmt(v)}`)
    }
    if (note) lines.push(note)
    return lines
  }
}

/** 全体学生属性变化（每天的量，这里按一次性总量处理） */
export function studentDelta(delta: StudentDelta, note?: string): EventApply {
  return (state) => {
    const lines: string[] = []
    for (const cohort of state.students.cohorts) {
      if (cohort.count <= 0) continue
      for (const [key, value] of Object.entries(delta)) {
        const v = Number(value) || 0
        if (key === 'stress') cohort.stress = clamp(cohort.stress + v, 0, 100)
        else if (key === 'satisfaction') cohort.satisfaction = clamp(cohort.satisfaction + v, 0, 100)
        else {
          const k = key as keyof typeof cohort.attrs
          cohort.attrs[k] = clamp(cohort.attrs[k] + v, 0, 100)
        }
      }
    }
    const parts = Object.entries(delta).map(([k, v]) => `${k} ${fmt(Number(v))}`)
    lines.push(parts.join('，'))
    if (note) lines.push(note)
    return lines
  }
}

/** 教师队伍状态变化 */
export function teacherDelta(delta: { quality?: number; stress?: number; morale?: number }): EventApply {
  return (state) => {
    for (const g of state.teachers.groups) {
      if (delta.quality != null) g.quality = clamp(g.quality + delta.quality, 0, 100)
      if (delta.stress != null) g.stress = clamp(g.stress + delta.stress, 0, 100)
      if (delta.morale != null) g.morale = clamp(g.morale + delta.morale, 0, 100)
    }
    const parts: string[] = []
    if (delta.quality != null) parts.push(`教师能力 ${fmt(delta.quality)}`)
    if (delta.stress != null) parts.push(`教师压力 ${fmt(delta.stress)}`)
    if (delta.morale != null) parts.push(`教师士气 ${fmt(delta.morale)}`)
    return [parts.join('，')]
  }
}

/** 设置统计标记（供成就与条件事件使用） */
export function setFlag(name: string, value = true): EventApply {
  return (state) => {
    state.statistics.flags[name] = value
    return []
  }
}

export function combo(...fns: EventApply[]): EventApply {
  return (state) => fns.flatMap((fn) => fn(state)).filter(Boolean)
}

export function text(...lines: string[]): EventApply {
  return () => lines
}

/**
 * 结算一个事件选项：先处理「声明式」字段（cost / gain / studentDelta / teacherDelta / notes），
 * 再执行自定义的 apply 函数。
 *
 * 声明式字段的好处：外部内容文件（校园内容.js）不需要任何辅助函数就能写事件，
 * 而且「代价 / 后果预览」可以自动把它们算出来。
 */
export function applyDeclarativeChoice(
  state: GameState,
  choice: {
    cost?: Partial<Record<ResourceKey, number>>
    gain?: Partial<Record<ResourceKey, number>>
    studentDelta?: StudentDelta
    teacherDelta?: { quality?: number; stress?: number; morale?: number }
    teamDelta?: { teamId: string; strength?: number; morale?: number }
    notes?: string[]
    apply?: EventApply
  },
): string[] {
  const lines: string[] = []
  if (choice.cost) {
    const negative: Partial<Record<ResourceKey, number>> = {}
    for (const [key, value] of Object.entries(choice.cost)) {
      negative[key as ResourceKey] = -Math.abs(Number(value) || 0)
    }
    lines.push(...gain(negative)(state))
  }
  if (choice.gain) lines.push(...gain(choice.gain)(state))
  if (choice.studentDelta) lines.push(...studentDelta(choice.studentDelta)(state))
  if (choice.teacherDelta) lines.push(...teacherDelta(choice.teacherDelta)(state))
  if (choice.teamDelta) {
    const team = state.teams?.[choice.teamDelta.teamId]
    if (team) {
      const strength = Number(choice.teamDelta.strength) || 0
      const morale = Number(choice.teamDelta.morale) || 0
      if (strength !== 0) {
        team.strength = Math.max(0, team.strength + strength)
        lines.push(`队伍实力 ${strength > 0 ? '+' : ''}${strength}`)
      }
      if (morale !== 0) {
        team.morale = clamp(team.morale + morale, 0, 100)
        lines.push(`队伍士气 ${morale > 0 ? '+' : ''}${morale}`)
      }
    }
  }
  if (choice.notes) lines.push(...choice.notes)
  if (choice.apply) lines.push(...choice.apply(state))
  return lines.filter((line) => typeof line === 'string' && line.length > 0)
}
