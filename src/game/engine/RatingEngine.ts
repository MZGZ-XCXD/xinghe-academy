import type { GameState, RatingExamDef } from '../types'
import { BUILDING_MAP, RATING_EXAMS, RATING_EXAM_MAP, RATING_TIERS, ratingCapFor } from '../../data'
import { clamp, schoolRating } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import { grantResources } from './ResourceEngine'
import type { EngineHooks } from './hooks'

export interface RatingExamStatus {
  exam: RatingExamDef
  canSubmit: boolean
  checklist: { label: string; done: boolean }[]
  currentTier: number
  pending: boolean
}

/** 未经考核时，评级数值被锁在下一等级门槛之下 */
export function applyRatingCap(state: GameState, raw: number): number {
  return clamp(Math.min(raw, ratingCapFor(state.school.ratingTier)), 0, 100)
}

export function rawRating(state: GameState, mods: ModifierIndex): number {
  return schoolRating(state, BUILDING_MAP, mods)
}

/** 检查是否达到下一等级的考核门槛 */
export function checkRatingExam(state: GameState, mods: ModifierIndex, hooks: EngineHooks): void {
  if (state.school.pendingRatingExam != null) return
  const nextTier = state.school.ratingTier + 1
  const tier = RATING_TIERS[nextTier]
  if (!tier) return
  // 用「未受上限限制的评级」判断：否则评级被锁住后永远触发不了考核
  if (rawRating(state, mods) + 0.001 < tier.min) return
  state.school.pendingRatingExam = nextTier
  const exam = RATING_EXAM_MAP[nextTier]
  hooks.notify(`${exam?.examiner ?? '评估组'} 到达学校：${exam?.name ?? '评级考核'} 已开始`, 'unlock')
  hooks.log(`评级考核开始：${exam?.name ?? nextTier}`, 'rating')
}

export function ratingExamStatus(state: GameState): RatingExamStatus | null {
  const tierIndex = state.school.pendingRatingExam
  if (tierIndex == null) return null
  const exam = RATING_EXAM_MAP[tierIndex]
  if (!exam) return null
  const checklist = exam.requirements.map((req) => {
    let done = false
    try {
      done = req.check(state) === true
    } catch {
      done = false
    }
    return { label: req.label, done }
  })
  return {
    exam,
    canSubmit: checklist.every((item) => item.done),
    checklist,
    currentTier: state.school.ratingTier,
    pending: true,
  }
}

/** 提交考核：条件都满足就通过，评级等级提升并获得上级奖励 */
export function submitRatingExam(state: GameState, mods: ModifierIndex, hooks: EngineHooks): boolean {
  const status = ratingExamStatus(state)
  if (!status) return false
  if (!status.canSubmit) {
    hooks.notify('考核条件还没全部达成，评估组不会签字。', 'bad')
    return false
  }
  const { exam } = status
  state.school.ratingTier = exam.tierIndex
  state.school.pendingRatingExam = null
  grantResources(state, exam.reward)
  const tier = RATING_TIERS[exam.tierIndex]
  hooks.notify(`评级考核通过：学校被评为「${tier?.label ?? exam.name}」`, 'unlock')
  hooks.log(`评级提升：${tier?.label ?? exam.name}`, 'rating')
  // 通过后立刻检查下一等级
  checkRatingExam(state, mods, hooks)
  return true
}

/** 推迟考核（只是关掉弹窗，考核仍在进行中） */
export function ratingExamProgress(state: GameState): { done: number; total: number } {
  const status = ratingExamStatus(state)
  if (!status) return { done: 0, total: 0 }
  return { done: status.checklist.filter((item) => item.done).length, total: status.checklist.length }
}

export function nextRatingExam(state: GameState): RatingExamDef | null {
  const tierIndex = state.school.ratingTier + 1
  return RATING_EXAM_MAP[tierIndex] ?? null
}

export function ratingTierLabel(tierIndex: number): string {
  return RATING_TIERS[Math.min(RATING_TIERS.length - 1, Math.max(0, tierIndex))]?.label ?? '待整改高中'
}

export function totalExamCount(): number {
  return RATING_EXAMS.length
}
