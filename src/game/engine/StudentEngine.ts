import type { AnnualReport, GameState, StudentAttributes, StudentDelta } from '../types'
import { BUILDING_MAP } from '../../data'
import {
  alumniFromGraduates,
  averageTeacherMorale,
  clamp,
  enrollmentCount,
  freshAttributes,
  overallAttributes,
  overallWellbeing,
  ratingGrade,
  safeNumber,
  totalStudents,
} from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import type { EngineHooks } from './hooks'
import { applyDeltaToAllCohorts } from './CourseEngine'
import { grantResources } from './ResourceEngine'

/**
 * 学生群体模拟：不使用上千个独立个体，而是「三个年级群体 + 聚合属性」。
 * 群体依然会成长、毕业、被新生替换，因此学校的长期曲线是真实的。
 */
export function tickStudentDrift(state: GameState, mods: ModifierIndex, dtDays: number): void {
  const stressMul = Math.max(0.2, mods.mul('student_stress'))
  const satisfactionMul = clamp(mods.mul('satisfaction_rate'), 0.05, 4)
  for (const cohort of state.students.cohorts) {
    if (cohort.count <= 0) continue
    // 压力自然消退：制度越宽松消退越快
    cohort.stress = clamp(cohort.stress - (0.035 * dtDays) / stressMul, 0, 100)
    // 满意度向基线回归
    const target = 58
    cohort.satisfaction = clamp(cohort.satisfaction + (target - cohort.satisfaction) * 0.01 * dtDays * satisfactionMul, 0, 100)
    // 健康向良好水平恢复，高压状态下下降
    const healthTarget = 72
    const healthDrift = cohort.stress > 75 ? -0.02 : 0.02
    cohort.attrs.health = clamp(cohort.attrs.health + healthDrift * dtDays, 0, 100)
    if (cohort.attrs.health > healthTarget) {
      cohort.attrs.health = clamp(cohort.attrs.health - 0.005 * dtDays, 0, 100)
    }
    // 长期不学的学生能力缓慢退化（保证课程不是一次性加成）
    for (const key of ['academic', 'research', 'arts', 'sports'] as (keyof StudentAttributes)[]) {
      if (cohort.attrs[key] > 22) cohort.attrs[key] = clamp(cohort.attrs[key] - 0.0015 * dtDays, 0, 100)
    }
  }
}

/** 冬季期末考：学术能力转化为家长认可与教育基金，同时带来压力 */
export function winterExamSettlement(state: GameState, mods: ModifierIndex, hooks: EngineHooks): void {
  const attrs = overallAttributes(state)
  const students = totalStudents(state)
  if (students <= 0) return
  const examMul = mods.mul('exam_score')
  const score = clamp(attrs.academic * examMul, 0, 130)
  const parentTrust = (score / 100) * 40
  const fund = (score / 100) * 600
  grantResources(state, { parentTrust, educationFund: fund, reputation: score / 20 })
  applyDeltaToAllCohorts(state, { stress: 6, academic: 0.6, satisfaction: -1.5 })
  hooks.notify(
    `期末考结束：平均分指数 ${score.toFixed(1)}，家长认可度 +${parentTrust.toFixed(0)}，教育基金 +${fund.toFixed(0)}`,
    'info',
  )
  hooks.log(`期末考结算：分数指数 ${score.toFixed(1)}`, 'exam')
}

export interface PromotionResult {
  graduates: number
  alumni: number
  contribution: number
  enrollment: number
  quality: number
}

/**
 * 学年结算：升学、毕业、校友转化、新生入学与教育基金拨付。
 * 这是整个游戏闭环的关键节点。
 */
export function annualSettlement(
  state: GameState,
  mods: ModifierIndex,
  hooks: EngineHooks,
): { report: AnnualReport; promotion: PromotionResult } {
  const attrs = overallAttributes(state)
  const wellbeing = overallWellbeing(state)
  const rating = state.school.rating
  const stats = state.statistics

  const grade3 = state.students.cohorts.find((c) => c.grade === 3)
  const graduates = Math.floor(grade3?.count ?? 0)
  const graduateAttrs = grade3?.attrs ?? freshAttributes(0)
  const alumniResult = alumniFromGraduates(graduates, graduateAttrs, mods)

  const wins = stats.competitionWins - stats.yearSnapshot.wins
  const competitions = stats.competitions - stats.yearSnapshot.competitions
  const moneyDelta = (stats.totalMoneyEarned - stats.yearSnapshot.moneyEarned) - (stats.totalMoneySpent - stats.yearSnapshot.moneySpent)
  const events = stats.eventsResolved - stats.yearSnapshot.eventsResolved

  const awards: string[] = []
  const notes: string[] = []
  if (attrs.academic >= 60) awards.push('学术卓越奖')
  if (attrs.sports >= 55) awards.push('体育强校奖')
  if (attrs.arts >= 55) awards.push('艺术之光奖')
  if (attrs.research >= 55) awards.push('科研先锋奖')
  if (wellbeing.satisfaction >= 75) awards.push('幸福校园奖')
  if (averageTeacherMorale(state) >= 75) awards.push('教工之家奖')
  if (wins >= 8) awards.push('竞赛霸主奖')
  if (graduates <= 0) notes.push('本学年没有毕业生，招生规模可能需要扩大。')
  if (wellbeing.stress >= 70) notes.push('学生平均压力偏高，建议开设心理健康课程或增加减压设施。')
  if (moneyDelta < 0) notes.push('本学年资金净流出，注意控制教师薪资与设施维护规模。')
  if (stats.negativeEventsInYear === 0) {
    stats.perfectYears += 1
    awards.push('完美学年')
  } else {
    notes.push(`本学年发生了 ${stats.negativeEventsInYear} 次负面事件。`)
  }

  const report: AnnualReport = {
    schoolYear: Math.max(1, Math.floor(state.time.minutes / (1440 * 30 * 12)) + 1),
    rating,
    academic: attrs.academic,
    sports: attrs.sports,
    arts: attrs.arts,
    research: attrs.research,
    satisfaction: wellbeing.satisfaction,
    teacherMorale: averageTeacherMorale(state),
    reputation: state.resources.reputation,
    competitionWins: wins,
    competitionCount: competitions,
    graduates,
    moneyDelta,
    enrollment: 0,
    gradeLabel: ratingGrade(rating),
    notes,
    awards,
  }

  // 校友转化
  state.students.graduates += graduates
  stats.graduates += graduates
  state.legacy.lifetimeGraduates += graduates
  state.students.alumniActive += alumniResult.alumni
  state.students.alumniQuality = clamp(
    state.students.alumniQuality * 0.7 + alumniResult.quality * 0.3,
    0,
    5,
  )
  const alumniBonus = state.legacy.perks.alumniNetwork ? alumniResult.contribution * 0.5 : 0
  grantResources(state, { alumniContribution: alumniResult.contribution + alumniBonus })

  // 毕业 → 升学
  const grade2 = state.students.cohorts.find((c) => c.grade === 2)
  const grade1 = state.students.cohorts.find((c) => c.grade === 1)
  const grade3Count = grade2?.count ?? 0
  const grade2Count = grade1?.count ?? 0
  if (state.students.cohorts[2]) {
    state.students.cohorts[2].count = grade3Count
    state.students.cohorts[2].stress = clamp(state.students.cohorts[2].stress + 5, 0, 100)
    state.students.cohorts[2].satisfaction = clamp(state.students.cohorts[2].satisfaction - 3, 0, 100)
  }
  if (state.students.cohorts[1]) state.students.cohorts[1].count = grade2Count

  // 新生入学
  const enrollment = enrollmentCount(state, BUILDING_MAP, mods)
  const cap = state.legacy.perks.eliteCohort ? 4 : 0
  const fresh = freshAttributes(Math.floor(state.time.minutes / 1440))
  for (const key of Object.keys(fresh) as (keyof StudentAttributes)[]) {
    fresh[key] = clamp(fresh[key] + cap, 0, 100)
  }
  if (state.students.cohorts[0]) {
    state.students.cohorts[0].count = enrollment
    state.students.cohorts[0].attrs = fresh
    state.students.cohorts[0].stress = 30
    state.students.cohorts[0].satisfaction = 62
  }
  state.students.recruitBonus = 0
  report.enrollment = enrollment

  // 教育基金拨付
  const fund = rating * 40 + graduates * 6 + wins * 250 + (state.legacy.prestigeCount + 1) * 200
  grantResources(state, { educationFund: fund })
  notes.push(`上级部门拨付教育基金 ${fund.toFixed(0)}。`)

  // 重置年度快照
  stats.yearSnapshot = {
    moneyEarned: stats.totalMoneyEarned,
    moneySpent: stats.totalMoneySpent,
    graduates: stats.graduates,
    wins: stats.competitionWins,
    competitions: stats.competitions,
    eventsResolved: stats.eventsResolved,
  }
  stats.negativeEventsInYear = 0
  state.school.lastAnnualReport = report
  state.legacy.lifetimeStudents += enrollment

  hooks.notify(`第 ${report.schoolYear} 学年结束：${report.gradeLabel}，毕业 ${graduates} 人，新生 ${enrollment} 人。`, 'unlock')
  hooks.log(`学年结算：毕业生 ${graduates}，新生 ${enrollment}，评价 ${report.gradeLabel}`, 'year')

  return {
    report,
    promotion: {
      graduates,
      alumni: alumniResult.alumni,
      contribution: alumniResult.contribution + alumniBonus,
      enrollment,
      quality: alumniResult.quality,
    },
  }
}

export function studentOverview(state: GameState) {
  const attrs = overallAttributes(state)
  const wellbeing = overallWellbeing(state)
  return {
    total: totalStudents(state),
    attrs,
    wellbeing,
    cohorts: state.students.cohorts,
  }
}

export function applyEventDelta(state: GameState, delta: StudentDelta): void {
  applyDeltaToAllCohorts(state, delta)
}

export function studentCapacityWarning(state: GameState, capacity: number): boolean {
  const total = totalStudents(state)
  return capacity > 0 && total >= capacity * 0.98 && !state.students.capacityWarned
}

export function markCapacityWarned(state: GameState): void {
  state.students.capacityWarned = true
}

export function stressLabel(stress: number): string {
  const s = safeNumber(stress, 0)
  if (s < 25) return '轻松'
  if (s < 45) return '正常'
  if (s < 65) return '偏紧'
  if (s < 80) return '高压'
  return '濒临崩溃'
}
