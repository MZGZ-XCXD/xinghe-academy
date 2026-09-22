import type { EffectDef, EventChoice, GameState, ResourceKey, StudentDelta } from '../types'
import { RESOURCE_DEFS } from '../../data/resources'
import {
  averageTeacherMorale,
  averageTeacherQuality,
  averageTeacherStress,
  overallAttributes,
  overallWellbeing,
  safeNumber,
} from '../formulas'
import { EVENT_MAP } from '../../data'
import { TEAM_DEFS } from '../../data'
import { applyDeclarativeChoice } from '../../data/eventHelpers'

export interface PreviewLine {
  key: string
  label: string
  value: number
}

export interface ChoicePreview {
  /** 需要付出的资源（负值） */
  costs: PreviewLine[]
  /** 获得的资源（正值） */
  gains: PreviewLine[]
  /** 学生属性变化 */
  students: PreviewLine[]
  /** 教师队伍变化 */
  teachers: PreviewLine[]
  /** 校队变化 */
  teams: PreviewLine[]
  /** 永久加成 */
  effects: EffectDef[]
  /** 延迟后续事件 */
  delayed: string[]
  /** 额外给予效果卡三选一 */
  cards: string | null
  /** 结算说明（由事件逻辑本身返回的文字） */
  notes: string[]
}

const ATTR_LABELS: Record<string, string> = {
  academic: '学术',
  sports: '体育',
  arts: '艺术',
  research: '科研',
  morality: '品德',
  social: '社交',
  health: '健康',
  creativity: '创造力',
  stress: '压力',
  satisfaction: '满意度',
}

function cloneState(state: GameState): GameState {
  // 事件选项的实现是纯状态修改，因此可以在一份副本上试算，得到「真实会发生什么」
  return JSON.parse(JSON.stringify(state)) as GameState
}

const previewCache = new Map<string, ChoicePreview>()

/**
 * 结算预览：把选项逻辑在一份状态副本上真的跑一遍，然后对比前后差异。
 * 这样界面上显示的代价与后果永远和实际结算一致（包括资源清零、属性封顶这类边界情况）。
 */
export function previewChoice(
  state: GameState,
  choice: EventChoice,
  cacheKey?: string,
  cacheMinute?: number,
): ChoicePreview {
  const key = cacheKey ? `${cacheKey}:${cacheMinute ?? 0}` : null
  if (key) {
    const cached = previewCache.get(key)
    if (cached) return cached
  }

  const before = cloneState(state)
  const after = cloneState(state)
  let notes: string[] = []
  try {
    notes = applyDeclarativeChoice(after, choice)
  } catch {
    notes = []
  }

  const costs: PreviewLine[] = []
  const gains: PreviewLine[] = []
  for (const def of RESOURCE_DEFS) {
    const delta = safeNumber(after.resources[def.key], 0) - safeNumber(before.resources[def.key], 0)
    if (Math.abs(delta) < 0.005) continue
    const line: PreviewLine = { key: def.key, label: def.name, value: delta }
    if (delta < 0) costs.push(line)
    else gains.push(line)
  }

  const beforeAttrs = overallAttributes(before)
  const afterAttrs = overallAttributes(after)
  const beforeWell = overallWellbeing(before)
  const afterWell = overallWellbeing(after)
  const students: PreviewLine[] = []
  for (const attrKey of Object.keys(beforeAttrs) as (keyof typeof beforeAttrs)[]) {
    const delta = afterAttrs[attrKey] - beforeAttrs[attrKey]
    if (Math.abs(delta) < 0.005) continue
    students.push({ key: attrKey, label: ATTR_LABELS[attrKey] ?? attrKey, value: delta })
  }
  const stressDelta = afterWell.stress - beforeWell.stress
  if (Math.abs(stressDelta) >= 0.005) {
    students.push({ key: 'stress', label: ATTR_LABELS.stress, value: stressDelta })
  }
  const satisfactionDelta = afterWell.satisfaction - beforeWell.satisfaction
  if (Math.abs(satisfactionDelta) >= 0.005) {
    students.push({ key: 'satisfaction', label: ATTR_LABELS.satisfaction, value: satisfactionDelta })
  }

  const teachers: PreviewLine[] = []
  const qualityDelta = averageTeacherQuality(after) - averageTeacherQuality(before)
  if (Math.abs(qualityDelta) >= 0.05) teachers.push({ key: 'quality', label: '教学能力', value: qualityDelta })
  const teacherStressDelta = averageTeacherStress(after) - averageTeacherStress(before)
  if (Math.abs(teacherStressDelta) >= 0.05) teachers.push({ key: 'stress', label: '工作压力', value: teacherStressDelta })
  const moraleDelta = averageTeacherMorale(after) - averageTeacherMorale(before)
  if (Math.abs(moraleDelta) >= 0.05) teachers.push({ key: 'morale', label: '士气', value: moraleDelta })

  const teams: PreviewLine[] = []
  for (const def of TEAM_DEFS) {
    const beforeTeam = before.teams?.[def.id]
    const afterTeam = after.teams?.[def.id]
    if (!beforeTeam || !afterTeam) continue
    const strengthDelta = safeNumber(afterTeam.strength, 0) - safeNumber(beforeTeam.strength, 0)
    const moraleChange = safeNumber(afterTeam.morale, 0) - safeNumber(beforeTeam.morale, 0)
    if (Math.abs(strengthDelta) >= 0.05) {
      teams.push({ key: `${def.id}-strength`, label: `${def.shortName} 实力`, value: strengthDelta })
    }
    if (Math.abs(moraleChange) >= 0.5) {
      teams.push({ key: `${def.id}-morale`, label: `${def.shortName} 士气`, value: moraleChange })
    }
  }

  const delayed: string[] = []
  for (const item of choice.schedule ?? []) {
    const def = EVENT_MAP[item.eventId]
    delayed.push(`${item.days} 天后进入下一阶段：${def?.title ?? item.eventId}`)
  }

  const preview: ChoicePreview = {
    costs,
    gains,
    students,
    teachers,
    teams,
    effects: choice.effects ?? [],
    delayed,
    cards: choice.grantCards ? `${choice.grantCards.count} 张效果卡候选（三选一）` : null,
    notes: notes.filter((line) => typeof line === 'string' && line.length > 0),
  }
  if (key) {
    if (previewCache.size > 80) previewCache.clear()
    previewCache.set(key, preview)
  }
  return preview
}

/** 把学生变化转成可读清单（供测试与调试使用） */
export function describeStudentDelta(delta: StudentDelta): string[] {
  return Object.entries(delta).map(([key, value]) => `${ATTR_LABELS[key] ?? key} ${Number(value) >= 0 ? '+' : ''}${value}`)
}

export function clearPreviewCache(): void {
  previewCache.clear()
}
