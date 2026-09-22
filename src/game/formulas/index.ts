/**
 * 全部核心公式集中在此目录，UI 与数据表不得内联数值公式。
 */
import type {
  ActivityDef,
  BuildingDef,
  CalendarInfo,
  CardDef,
  CourseDef,
  GameState,
  LegacyNodeDef,
  Requirement,
  ResourceKey,
  Season,
  StudentAttributes,
  StudentDelta,
  TeacherSubject,
} from '../types'
import { SEASON_LABEL, TEACHER_SUBJECTS } from '../types'

export type { CalendarInfo } from '../types'

/** ===================== 时间常量 ===================== */
export const MINUTES_PER_HOUR = 60
export const MINUTES_PER_DAY = 1440
export const DAYS_PER_MONTH = 30
export const MINUTES_PER_MONTH = MINUTES_PER_DAY * DAYS_PER_MONTH
export const MONTHS_PER_YEAR = 12
export const START_MONTH = 9
/**
 * 1× 速度下，1 真实秒 = 120 游戏分钟（2 游戏小时）
 * → 1 游戏日 ≈ 12 真实秒，1 学年（360 天）≈ 72 分钟。
 * 这个常量是所有「游戏时间 ⇄ 现实时间」换算的唯一来源。
 */
export const BASE_GAME_MINUTES_PER_REAL_SECOND = 120
export const MAX_TICK_SECONDS = 1

/** ===================== 学生常量 ===================== */
export const FRESHMAN_BASE_ATTR = 26
export const ATTR_MIN = 0
export const ATTR_MAX = 100
export const BASE_ENROLLMENT = 46

/** ===================== 通用工具 ===================== */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function positive(value: unknown, fallback = 0): number {
  const v = safeNumber(value, fallback)
  return Math.max(0, v)
}

export function sanitizeResource(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(Number.MAX_SAFE_INTEGER / 1000, Math.max(0, v))
}

/** 只读的加成视图，ModifierIndex 实现了它，公式层不依赖引擎实现。 */
export interface ModsView {
  /** 乘算修正总和：返回 1 + Σmul（永不为负） */
  mul(target: string): number
  /** 加算修正总和 */
  add(target: string): number
}

export const NO_MODS: ModsView = {
  mul: () => 1,
  add: () => 0,
}

/** ===================== 日历 ===================== */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function calendarFromMinutes(minutes: number): CalendarInfo {
  const safe = Math.max(0, Math.floor(safeNumber(minutes, 0)))
  const totalDays = Math.floor(safe / MINUTES_PER_DAY)
  const monthIndex = Math.floor(totalDays / DAYS_PER_MONTH)
  const day = (totalDays % DAYS_PER_MONTH) + 1
  const month = ((START_MONTH - 1 + (monthIndex % MONTHS_PER_YEAR)) % MONTHS_PER_YEAR) + 1
  const schoolYear = 1 + Math.floor(monthIndex / MONTHS_PER_YEAR)
  const season = seasonOfMonth(month)
  const term: 1 | 2 = month >= 9 || month === 1 ? 1 : 2
  const vacation = month === 8
  return {
    totalDays,
    day,
    month,
    monthIndex,
    schoolYear,
    season,
    term,
    vacation,
    label: `第${schoolYear}学年 ${month}月${day}日 · ${SEASON_LABEL[season]}季`,
  }
}

/** 进入新学年（9 月 1 日）的那一 tick 返回 true */
export function isSchoolYearStart(prevMinutes: number, nextMinutes: number): boolean {
  const a = calendarFromMinutes(prevMinutes)
  const b = calendarFromMinutes(nextMinutes)
  return b.monthIndex > a.monthIndex && b.monthIndex % MONTHS_PER_YEAR === 0
}

export function isMonthStart(prevMinutes: number, nextMinutes: number): number | null {
  const a = calendarFromMinutes(prevMinutes)
  const b = calendarFromMinutes(nextMinutes)
  if (b.monthIndex > a.monthIndex) return b.month
  return null
}

export function seasonOf(minutes: number): Season {
  return calendarFromMinutes(minutes).season
}

/**
 * 时长文字统一用「游戏天数」表示（界面不再出现游戏分钟 / 游戏小时这类小单位）。
 * 不足 1 天保留两位小数，1~10 天保留一位，10 天以上取整。
 */
export function gameDaysOf(minutes: number): number {
  return positive(minutes) / MINUTES_PER_DAY
}

export function formatGameDays(minutes: number): string {
  const days = gameDaysOf(minutes)
  const text = days < 1 ? days.toFixed(2) : days < 10 ? days.toFixed(1) : String(Math.round(days))
  return `${text} 天`
}

/** ===================== 建筑 ===================== */
export function buildingCost(
  def: BuildingDef,
  targetLevel: number,
  mods: ModsView = NO_MODS,
): Partial<Record<ResourceKey, number>> {
  const level = Math.max(1, Math.floor(safeNumber(targetLevel, 1)))
  const growth = Math.max(1.01, safeNumber(def.costGrowth, 1.5))
  const factor = Math.pow(growth, level - 1)
  const discount = Math.max(0.05, mods.mul('build_cost'))
  const out: Partial<Record<ResourceKey, number>> = {}
  for (const [key, value] of Object.entries(def.baseCost)) {
    const base = positive(value)
    const scaled = base * factor * discount
    out[key as ResourceKey] = Math.ceil(scaled * 100) / 100
  }
  return out
}

export function buildDuration(def: BuildingDef, targetLevel: number, mods: ModsView = NO_MODS): number {
  const level = Math.max(1, Math.floor(safeNumber(targetLevel, 1)))
  const growth = Math.max(1, safeNumber(def.buildTimeGrowth, 1.35))
  const base = Math.max(1, safeNumber(def.baseBuildMinutes, 5))
  const speed = Math.max(0.05, mods.mul('build_speed'))
  return Math.max(1, (base * Math.pow(growth, level - 1)) / speed)
}

export function buildingProduction(def: BuildingDef, level: number): Partial<Record<ResourceKey, number>> {
  const lv = Math.max(0, safeNumber(level, 0))
  const out: Partial<Record<ResourceKey, number>> = {}
  if (!def.production || lv <= 0) return out
  const scale = Math.pow(lv, 1.2)
  for (const [key, value] of Object.entries(def.production)) {
    out[key as ResourceKey] = positive(value) * scale
  }
  return out
}

/**
 * 有仓储上限的资源（可存放的实物/资金）与开局自带的容量。
 * 声望、活跃度、认可度、校友贡献、教育基金、国际声誉、影响力属于评价类指标，不设上限。
 */
export const BASE_STORAGE: Partial<Record<ResourceKey, number>> = {
  money: 5000,
  teaching: 800,
  research: 400,
  sports: 400,
  culture: 400,
}

export const STORAGE_KEYS: ResourceKey[] = ['money', 'teaching', 'research', 'sports', 'culture']

export function isStorableResource(key: ResourceKey): boolean {
  return STORAGE_KEYS.includes(key)
}

export function buildingStorage(def: BuildingDef, level: number): Partial<Record<ResourceKey, number>> {
  const lv = Math.max(0, safeNumber(level, 0))
  const out: Partial<Record<ResourceKey, number>> = {}
  if (!def.storage || lv <= 0) return out
  const growth = Math.max(1, safeNumber(def.storageGrowth, 1))
  // growth > 1：按倍数增长（专用仓储建筑）；growth = 1：按等级线性累加（附带的存放空间）
  const scale = growth > 1 ? Math.pow(growth, lv - 1) : lv
  for (const [key, value] of Object.entries(def.storage)) {
    out[key as ResourceKey] = positive(value) * scale
  }
  return out
}

export interface StorageBreakdown {
  key: ResourceKey
  base: number
  buildingTotal: number
  multiplier: number
  total: number
  parts: { source: string; value: number }[]
  capped: boolean
}

export function storageBreakdown(
  state: GameState,
  buildingDefs: Record<string, BuildingDef>,
  key: ResourceKey,
  mods: ModsView = NO_MODS,
): StorageBreakdown {
  if (!isStorableResource(key)) {
    return { key, base: Number.POSITIVE_INFINITY, buildingTotal: 0, multiplier: 1, total: Number.POSITIVE_INFINITY, parts: [], capped: false }
  }
  const base = positive(BASE_STORAGE[key] ?? 0)
  const parts: { source: string; value: number }[] = []
  let buildingTotal = 0
  for (const [id, b] of Object.entries(state.buildings)) {
    const def = buildingDefs[id]
    if (!def || b.level <= 0) continue
    const value = positive(buildingStorage(def, b.level)[key])
    if (value <= 0) continue
    buildingTotal += value
    parts.push({ source: `${def.name} Lv.${b.level}`, value })
  }
  const multiplier = Math.max(0.1, mods.mul('storage'))
  const total = Math.max(0, Math.round((base + buildingTotal) * multiplier))
  return { key, base, buildingTotal, multiplier, total, parts, capped: true }
}

export function resourceCapacity(
  state: GameState,
  buildingDefs: Record<string, BuildingDef>,
  key: ResourceKey,
  mods: ModsView = NO_MODS,
): number {
  return storageBreakdown(state, buildingDefs, key, mods).total
}

export function buildingEffectContributions(
  def: BuildingDef,
  level: number,
): { target: string; op: 'add' | 'mul'; value: number; source: string }[] {
  const out: { target: string; op: 'add' | 'mul'; value: number; source: string }[] = []
  const lv = Math.max(0, safeNumber(level, 0))
  if (lv <= 0) return out
  for (const e of def.effects ?? []) out.push({ ...e, source: `${def.name}` })
  for (const e of def.perLevelEffects ?? []) out.push({ ...e, value: e.value * lv, source: `${def.name} Lv.${lv}` })
  return out
}

/** 建筑联动：同时满足条件的一组建筑给予额外加成 */
export interface SynergyDef {
  id: string
  name: string
  desc: string
  requires: Record<string, number>
  effects: { target: string; op: 'add' | 'mul'; value: number }[]
}

export function activeSynergies(
  synergies: SynergyDef[],
  buildings: Record<string, { level: number }>,
): SynergyDef[] {
  return synergies.filter((s) =>
    Object.entries(s.requires).every(([id, lv]) => (buildings[id]?.level ?? 0) >= lv),
  )
}

/** ===================== 容量 ===================== */
export function studentCapacity(
  state: GameState,
  buildingDefs: Record<string, BuildingDef>,
  mods: ModsView = NO_MODS,
): number {
  let cap = 0
  for (const [id, b] of Object.entries(state.buildings)) {
    const def = buildingDefs[id]
    if (!def || b.level <= 0) continue
    cap += positive(def.studentCapacity) * b.level
  }
  cap += mods.add('student_capacity')
  return Math.max(0, cap * Math.max(0.05, mods.mul('student_capacity')))
}

export function teacherCapacity(
  state: GameState,
  buildingDefs: Record<string, BuildingDef>,
): number {
  let cap = 0
  for (const [id, b] of Object.entries(state.buildings)) {
    const def = buildingDefs[id]
    if (!def || b.level <= 0) continue
    cap += positive(def.teacherCapacity) * b.level
  }
  return Math.max(0, cap)
}

export function courseSlots(state: GameState, buildingDefs: Record<string, BuildingDef>): number {
  let slots = 3
  for (const [id, b] of Object.entries(state.buildings)) {
    const def = buildingDefs[id]
    if (!def || b.level <= 0) continue
    slots += positive(def.courseSlots) * b.level
  }
  return slots
}

/**
 * 每升一级「教学楼」为每门课额外提供的覆盖人数，相当于多开若干平行班。
 * 学生人数超过课程容量时，只有一部分学生能上这门课（覆盖率下降）。
 */
export const COURSE_CAPACITY_PER_TEACHING_LEVEL = 60

/**
 * 课程的**有效容量** = 课程自带容量 + 教学楼带来的平行班容量。
 *
 * 课程之间是并行关系：语文、数学各自独立覆盖学生，不存在「先开的课把学生抢光」。
 * 真实约束是：
 *   1. 课程槽位（同时能开几门课）
 *   2. 教师人数（影响效果，见 teacherRatio）
 *   3. 平行班数量（这里的容量：学生多于容量时只能覆盖一部分人）
 *   4. 教学资源消耗（按覆盖人数计算）
 */
export function courseCapacity(
  state: GameState,
  def: CourseDef,
  buildingDefs: Record<string, BuildingDef>,
): number {
  const teachingLevel = positive(state.buildings?.teachingBuilding?.level)
  const parallelClassBonus = COURSE_CAPACITY_PER_TEACHING_LEVEL * Math.max(0, teachingLevel - 1)
  return Math.max(0, positive(def.capacity) + parallelClassBonus)
}

/** 可容纳的社团数量（来自教学楼、社团活动楼、部室栋、中庭广场等） */
export function clubSlots(state: GameState, buildingDefs: Record<string, BuildingDef>): number {
  let slots = 0
  for (const [id, b] of Object.entries(state.buildings)) {
    const def = buildingDefs[id]
    if (!def || b.level <= 0) continue
    slots += positive(def.clubSlots) * b.level
  }
  return Math.floor(slots)
}

/** 各社团等级总和（学园祭与相关活动的重要指标） */
export function totalClubLevels(state: GameState): number {
  return Object.values(state.clubs ?? {}).reduce((sum, club) => sum + positive(club.level), 0)
}

export function totalClubMembers(state: GameState): number {
  return Object.values(state.clubs ?? {}).reduce((sum, club) => sum + positive(club.members), 0)
}

export function foundedClubCount(state: GameState): number {
  return Object.values(state.clubs ?? {}).filter((club) => positive(club.level) > 0).length
}

/** ===================== 学生 ===================== */
export function totalStudents(state: GameState): number {
  return state.students.cohorts.reduce((sum, c) => sum + positive(c.count), 0)
}

export function cohortByGrade(state: GameState, grade: 1 | 2 | 3) {
  return state.students.cohorts.find((c) => c.grade === grade)
}

const ATTR_KEYS: (keyof StudentAttributes)[] = [
  'academic',
  'sports',
  'arts',
  'research',
  'morality',
  'social',
  'health',
  'creativity',
]

export function overallAttributes(state: GameState): StudentAttributes {
  const total = totalStudents(state)
  const result = blankAttributes()
  if (total <= 0) return result
  for (const cohort of state.students.cohorts) {
    const weight = positive(cohort.count)
    if (weight <= 0) continue
    for (const key of ATTR_KEYS) {
      result[key] += safeNumber(cohort.attrs[key], 0) * weight
    }
  }
  for (const key of ATTR_KEYS) result[key] = result[key] / total
  return result
}

export function overallWellbeing(state: GameState): { stress: number; satisfaction: number } {
  const total = totalStudents(state)
  if (total <= 0) return { stress: 0, satisfaction: 50 }
  let stress = 0
  let satisfaction = 0
  for (const cohort of state.students.cohorts) {
    stress += safeNumber(cohort.stress, 0) * cohort.count
    satisfaction += safeNumber(cohort.satisfaction, 50) * cohort.count
  }
  return { stress: stress / total, satisfaction: satisfaction / total }
}

export function blankAttributes(): StudentAttributes {
  return {
    academic: 0,
    sports: 0,
    arts: 0,
    research: 0,
    morality: 0,
    social: 0,
    health: 0,
    creativity: 0,
  }
}

export function freshAttributes(variationSeed = 0): StudentAttributes {
  const jitter = (offset: number) => FRESHMAN_BASE_ATTR + ((variationSeed * 7 + offset * 13) % 9) - 4
  return {
    academic: jitter(1),
    sports: jitter(2),
    arts: jitter(3),
    research: jitter(4),
    morality: jitter(5) + 6,
    social: jitter(6) + 4,
    health: jitter(7) + 10,
    creativity: jitter(8),
  }
}

export function applyStudentDelta(
  attrs: StudentAttributes,
  delta: StudentDelta,
  wellbeing?: { stress: number; satisfaction: number },
): { attrs: StudentAttributes; stress: number; satisfaction: number } {
  const next = { ...attrs }
  for (const key of ATTR_KEYS) {
    const change = safeNumber(delta[key], 0)
    if (change !== 0) next[key] = clamp(next[key] + change, ATTR_MIN, ATTR_MAX)
  }
  return {
    attrs: next,
    stress: clamp(safeNumber(wellbeing?.stress, 0) + safeNumber(delta.stress, 0), 0, 100),
    satisfaction: clamp(safeNumber(wellbeing?.satisfaction, 50) + safeNumber(delta.satisfaction, 0), 0, 100),
  }
}

/** 健康与压力会整体放大/抑制成长：0.3 ~ 1.35 */
export function wellbeingGrowthModifier(health: number, stress: number): number {
  const healthFactor = 0.45 + clamp(health, 0, 100) / 100
  const stressFactor = 1.35 - (clamp(stress, 0, 100) / 100) * 0.85
  return clamp(healthFactor * stressFactor * 0.72, 0.3, 1.4)
}

/** ===================== 教师 ===================== */
export function teacherGroupCount(state: GameState, subject: TeacherSubject): number {
  return positive(state.teachers.groups.find((g) => g.subject === subject)?.count)
}

export function totalTeachers(state: GameState): number {
  return state.teachers.groups.reduce((sum, g) => sum + positive(g.count), 0)
}

export function averageTeacherQuality(state: GameState): number {
  const total = totalTeachers(state)
  if (total <= 0) return 0
  return state.teachers.groups.reduce((sum, g) => sum + positive(g.quality) * positive(g.count), 0) / total
}

export function averageTeacherMorale(state: GameState): number {
  const total = totalTeachers(state)
  if (total <= 0) return 50
  return state.teachers.groups.reduce((sum, g) => sum + positive(g.morale) * positive(g.count), 0) / total
}

export function averageTeacherStress(state: GameState): number {
  const total = totalTeachers(state)
  if (total <= 0) return 0
  return state.teachers.groups.reduce((sum, g) => sum + positive(g.stress) * positive(g.count), 0) / total
}

export function teacherEfficiency(state: GameState, mods: ModsView = NO_MODS): number {
  const quality = averageTeacherQuality(state)
  const morale = averageTeacherMorale(state)
  const stress = averageTeacherStress(state)
  const base = 0.55 + (clamp(quality, 0, 100) / 100) * 0.85
  const moraleFactor = 0.75 + clamp(morale, 0, 100) / 200
  const stressFactor = 1.05 - clamp(stress, 0, 100) / 260
  return clamp(base * moraleFactor * stressFactor * Math.max(0.05, mods.mul('teacher_efficiency')), 0.05, 6)
}

export function teacherSalaryPerMinute(state: GameState, mods: ModsView = NO_MODS): number {
  const teachers = totalTeachers(state)
  const quality = averageTeacherQuality(state)
  const perTeacher = (0.02 + (clamp(quality, 0, 100) / 100) * 0.02)
  return teachers * perTeacher * Math.max(0.1, mods.mul('salary'))
}

/** ===================== 课程 ===================== */
export interface CourseContext {
  cohortCount: number
  servedStudents: number
  teacherRatio: number
  capacityRatio: number
  efficiency: number
  season: Season
}

export function seasonMultiplierForCourse(def: CourseDef, season: Season): number {
  let mult = 1
  for (const bonus of def.seasonBonus ?? []) {
    if (bonus.season === season) mult *= Math.max(0, 1 + bonus.multiplier)
  }
  return mult
}

export function courseGrowthPerDay(def: CourseDef, ctx: CourseContext, mods: ModsView = NO_MODS): StudentDelta {
  const global = Math.max(0.05, mods.mul('student_growth'))
  const courseEff = Math.max(0.05, mods.mul('course_efficiency'))
  const seasonMult = seasonMultiplierForCourse(def, ctx.season)
  const scale =
    global *
    courseEff *
    ctx.efficiency *
    seasonMult *
    clamp(ctx.teacherRatio, 0, 1.5) *
    clamp(ctx.capacityRatio, 0, 1.5)
  const out: StudentDelta = {}
  for (const [key, value] of Object.entries(def.growth)) {
    out[key as keyof StudentDelta] = safeNumber(value, 0) * scale
  }
  return out
}

export function courseTeachingCostPerDay(
  def: CourseDef,
  servedStudents: number,
  mods: ModsView = NO_MODS,
): number {
  const perStudent = Math.max(0, safeNumber(def.teachingCostPerStudentMinute, 0))
  const costMul = Math.max(0.05, mods.mul('course_cost'))
  return perStudent * MINUTES_PER_DAY * Math.max(0, servedStudents) * costMul
}

export function courseOutputPerDay(
  def: CourseDef,
  ctx: CourseContext,
  mods: ModsView = NO_MODS,
): Partial<Record<ResourceKey, number>> {
  const out: Partial<Record<ResourceKey, number>> = {}
  if (!def.output) return out
  const courseEff = Math.max(0.05, mods.mul('course_efficiency'))
  const seasonMult = seasonMultiplierForCourse(def, ctx.season)
  const scale = (ctx.servedStudents / 40) * courseEff * seasonMult * clamp(ctx.teacherRatio, 0, 1.5)
  for (const [key, value] of Object.entries(def.output)) {
    out[key as ResourceKey] = positive(value) * scale
  }
  return out
}

/** ===================== 评级 ===================== */
const CATEGORY_WEIGHT: Record<string, number> = {
  教学: 1.25,
  科研: 1.3,
  体育: 1.05,
  文化: 1.05,
  生活: 0.85,
  交流: 1.15,
  行政: 0.9,
}

export function infrastructureScore(state: GameState, buildingDefs: Record<string, BuildingDef>): number {
  let weighted = 0
  for (const [id, b] of Object.entries(state.buildings)) {
    const def = buildingDefs[id]
    if (!def || b.level <= 0) continue
    weighted += positive(b.level) * (CATEGORY_WEIGHT[def.category] ?? 1)
  }
  return 100 * (weighted / (weighted + 70))
}

export function schoolRating(state: GameState, buildingDefs: Record<string, BuildingDef>, mods: ModsView = NO_MODS): number {
  const attrs = overallAttributes(state)
  const wb = overallWellbeing(state)
  const infra = infrastructureScore(state, buildingDefs)
  const reputation = safeNumber(state.resources.reputation, 0)
  // 声望对评级的贡献刻意收紧：学校要靠教学与设施拿分，而不是靠刷声望
  const repBonus = clamp(Math.log10(1 + reputation) * 1.8, 0, 8)
  const morale = averageTeacherMorale(state)
  const composite =
    0.26 * attrs.academic +
    0.15 * attrs.sports +
    0.12 * attrs.arts +
    0.13 * attrs.research +
    0.06 * attrs.morality +
    0.05 * attrs.creativity +
    0.06 * attrs.social +
    0.05 * (100 - wb.stress) +
    0.03 * morale +
    0.11 * infra +
    repBonus
  /**
   * 相对基准分：一所刚接手的破败学校（学生属性 30 上下、只有几栋旧楼）应当从十几分起步，
   * 而不是一上来就摸到「普通高中」。属性 30 → 0 分，属性 100 → 满分。
   */
  const adjusted = (composite - RATING_BASELINE) * Math.max(0.05, mods.mul('exam_score'))
  return clamp(adjusted, 0, 100)
}

/** 评级基准线：低于这个综合分的学校直接算 0 分 */
export const RATING_BASELINE = 20

export function ratingGrade(rating: number): string {
  const r = clamp(rating, 0, 100)
  if (r < 20) return '待整改高中'
  if (r < 35) return '普通高中'
  if (r < 50) return '区级示范高中'
  if (r < 62) return '市级示范高中'
  if (r < 74) return '省级重点高中'
  if (r < 86) return '全国名校'
  if (r < 95) return '国际知名实验校'
  return '世界实验标杆校'
}

/** ===================== 收支 ===================== */
export function tuitionPerMinute(state: GameState, mods: ModsView = NO_MODS): number {
  const students = totalStudents(state)
  const rating = clamp(state.school.rating, 0, 100)
  // 学费收入刻意压低：开局每天约 1 000 资金，让「攒钱」成为真实决策
  const perStudent = (0.005 + (rating / 100) * 0.007) * Math.max(0.05, mods.mul('tuition'))
  return students * perStudent * Math.max(0.05, mods.mul('money_rate'))
}

export function buildingUpkeepPerMinute(state: GameState): number {
  let levels = 0
  for (const b of Object.values(state.buildings)) levels += Math.max(0, b.level)
  return levels * 0.008
}

/** ===================== 招生与毕业 ===================== */
export function enrollmentCount(
  state: GameState,
  buildingDefs: Record<string, BuildingDef>,
  mods: ModsView = NO_MODS,
): number {
  const reputation = safeNumber(state.resources.reputation, 0)
  const parentTrust = safeNumber(state.resources.parentTrust, 0)
  const base = BASE_ENROLLMENT + reputation * 0.35 + parentTrust * 0.12 + positive(state.students.recruitBonus)
  const scale = Math.max(0, mods.mul('enrollment'))
  const cap = studentCapacity(state, buildingDefs, mods)
  const current = totalStudents(state)
  const room = Math.max(0, cap - current)
  return Math.max(0, Math.min(Math.round(base * scale), Math.floor(room)))
}

export function alumniFromGraduates(
  graduates: number,
  attrs: StudentAttributes,
  mods: ModsView = NO_MODS,
): { alumni: number; contribution: number; quality: number } {
  const qualityBase =
    (attrs.academic * 0.3 + attrs.morality * 0.25 + attrs.social * 0.15 + attrs.research * 0.15 + attrs.creativity * 0.15) /
    100
  const quality = clamp(qualityBase * Math.max(0.1, mods.mul('graduation_quality')), 0, 3)
  const alumni = Math.max(0, Math.round(graduates * 0.82))
  const contribution = graduates * 0.9 * quality * Math.max(0.1, mods.mul('alumni_rate'))
  return { alumni, contribution, quality }
}

/** ===================== 活动（比赛 / 交流） ===================== */
export function activityTeamStrength(
  state: GameState,
  def: ActivityDef,
  mods: ModsView = NO_MODS,
): number {
  const attrs = overallAttributes(state)
  const base = safeNumber(attrs[def.attribute], 30)
  const eff = teacherEfficiency(state, mods)
  const bonus = def.kind === '校际交流' || def.kind === '国际交流' ? 1 : 0
  const rel = bonus ? Math.max(0.05, mods.mul('exchange_success')) : Math.max(0.05, mods.mul('competition_success'))
  return base * (0.7 + eff * 0.6) * rel
}

export function activitySuccessChance(
  state: GameState,
  def: ActivityDef,
  mods: ModsView = NO_MODS,
  festivalPower = 0,
): number {
  const strength = activityTeamStrength(state, def, mods)
  const margin = (strength - def.difficulty) / Math.max(20, def.difficulty)
  const festival = def.kind === '校园活动' ? festivalActivityBonus(festivalPower) : 0
  const raw = def.baseSuccess + margin * 0.55 + festival
  return clamp(raw, 0.03, 0.97)
}

/** 学园祭评分对祭典类活动的影响：评分越高，成功率与奖励越高（最多 +40%） */
export function festivalActivityBonus(festivalPower: number): number {
  return clamp(positive(festivalPower) / 300, 0, 0.4)
}

export function activityRewardMultiplier(
  def: ActivityDef,
  success: boolean,
  big: boolean,
  mods: ModsView = NO_MODS,
  festivalPower = 0,
): number {
  const base = success ? (big ? 1.75 : 1) : 0.25
  const festivalMul = def.kind === '校园活动' ? 1 + festivalActivityBonus(festivalPower) : 1
  return base * Math.max(0.1, mods.mul('competition_reward')) * festivalMul
}

/** ===================== 卡片 ===================== */
export function cardDuration(def: CardDef, mods: ModsView = NO_MODS): number | null {
  if (def.durationMinutes == null) return null
  return Math.max(60, def.durationMinutes * Math.max(0.1, mods.mul('card_duration')))
}

export function cardDrawChance(base: number, mods: ModsView = NO_MODS): number {
  return clamp(base * Math.max(0.05, mods.mul('card_chance')), 0, 1)
}

/** ===================== 传承 ===================== */
export function prestigeRequirementsMet(state: GameState): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  const rating = state.school.rating
  if (rating < 52) reasons.push(`学校评级需达到 52（当前 ${rating.toFixed(1)}）`)
  if (state.statistics.graduates < 200) reasons.push(`累计毕业生需达到 200（当前 ${state.statistics.graduates}）`)
  if (state.legacy.prestigeCount === 0 && state.statistics.competitionWins < 1) {
    reasons.push('至少获得 1 次比赛胜利')
  }
  return { ok: reasons.length === 0, reasons }
}

export function prestigeGain(state: GameState, mods: ModsView = NO_MODS): number {
  const ratingScore = Math.max(0, state.school.rating - 44) / 3.4
  const gradScore = state.statistics.graduates / 45
  const winScore = state.statistics.competitionWins / 9
  const researchScore = state.statistics.research / 25000
  const achievementScore = Object.values(state.achievements).filter((a) => a.unlocked).length * 0.3
  const raw = ratingScore + gradScore + winScore + researchScore + achievementScore
  return Math.max(1, Math.floor(raw * Math.max(0.1, mods.mul('prestige_gain'))))
}

export function legacyNodeCost(def: LegacyNodeDef, currentLevel: number, mods: ModsView = NO_MODS): number {
  const level = Math.max(0, Math.floor(safeNumber(currentLevel, 0)))
  const growth = Math.max(1, safeNumber(def.costGrowth, 1.6))
  const raw = Math.max(1, safeNumber(def.baseCost, 1)) * Math.pow(growth, level)
  return Math.max(1, Math.ceil(raw * Math.max(0.1, mods.mul('legacy_cost'))))
}

/** ===================== 离线 ===================== */
export const OFFLINE_BASE_HOURS = 8
/** 离线结算只按在线速率的一小部分计入，避免长时间离线直接跳过年份 */
export const OFFLINE_BASE_RATE = 0.01
/** 单次离线最多折算的游戏天数（防止离线收益压过在线经营） */
export const OFFLINE_MAX_GAME_DAYS = 20

export function offlineCapSeconds(mods: ModsView = NO_MODS): number {
  const hours = OFFLINE_BASE_HOURS * Math.max(0.1, mods.mul('offline_efficiency'))
  return clamp(hours, 1, 24) * 3600
}

export function offlineRate(state: GameState, mods: ModsView = NO_MODS): number {
  const prestigeBonus = 1 + Math.min(0.5, state.legacy.prestigeCount * 0.04)
  return clamp(OFFLINE_BASE_RATE * prestigeBonus * Math.max(0.1, mods.mul('offline_efficiency')), 0.01, 0.5)
}

/** ===================== 条件判定 ===================== */
export function hasTech(state: GameState, id: string): boolean {
  return state.technologies[id]?.unlocked === true
}

export function meetsRequirement(state: GameState, req?: Requirement): boolean {
  if (!req) return true
  if (req.schoolRating != null && state.school.rating + 0.001 < req.schoolRating) return false
  if (req.schoolYear != null && calendarFromMinutes(state.time.minutes).schoolYear < req.schoolYear) return false
  if (req.graduates != null && state.statistics.graduates < req.graduates) return false
  if (req.totalStudents != null && totalStudents(state) < req.totalStudents) return false
  if (req.minStudents != null && totalStudents(state) < req.minStudents) return false
  if (req.clubLevels) {
    for (const [id, level] of Object.entries(req.clubLevels)) {
      if ((state.clubs?.[id]?.level ?? 0) < level) return false
    }
  }
  if (req.totalClubLevels != null && totalClubLevels(state) < req.totalClubLevels) return false
  if (req.teamFounded && !req.teamFounded.every((id) => state.teams?.[id]?.founded === true)) return false
  if (req.teamStrength) {
    for (const [id, strength] of Object.entries(req.teamStrength)) {
      if (safeNumber(state.teams?.[id]?.strength, 0) < strength) return false
    }
  }
  if (req.tech && !req.tech.every((id) => hasTech(state, id))) return false
  if (req.buildings) {
    for (const [id, level] of Object.entries(req.buildings)) {
      if ((state.buildings[id]?.level ?? 0) < level) return false
    }
  }
  if (req.policies && !req.policies.every((id) => state.school.activePolicies.includes(id))) return false
  if (req.legacyPerks && !req.legacyPerks.every((id) => state.legacy.perks[id] === true)) return false
  return true
}

export function requirementText(req?: Requirement, nameOf: (id: string) => string = (id) => id): string[] {
  if (!req) return []
  const out: string[] = []
  if (req.schoolRating != null) out.push(`学校评级 ≥ ${req.schoolRating}`)
  if (req.schoolYear != null) out.push(`第 ${req.schoolYear} 学年之后`)
  if (req.graduates != null) out.push(`累计毕业生 ≥ ${req.graduates}`)
  if (req.totalStudents != null) out.push(`在校学生 ≥ ${req.totalStudents}`)
  if (req.minStudents != null) out.push(`在校学生 ≥ ${req.minStudents}`)
  if (req.totalClubLevels != null) out.push(`社团等级总和 ≥ ${req.totalClubLevels}`)
  if (req.teamFounded) out.push(...req.teamFounded.map((id) => `已成立校队：${nameOf(id)}`))
  if (req.teamStrength) {
    for (const [id, value] of Object.entries(req.teamStrength)) out.push(`${nameOf(id)} 实力 ≥ ${value}`)
  }
  if (req.clubLevels) {
    for (const [id, level] of Object.entries(req.clubLevels)) out.push(`${nameOf(id)} Lv.${level}`)
  }
  if (req.tech) out.push(...req.tech.map((id) => `科技：${nameOf(id)}`))
  if (req.buildings) {
    for (const [id, lv] of Object.entries(req.buildings)) out.push(`${nameOf(id)} Lv.${lv}`)
  }
  if (req.policies) out.push(...req.policies.map((id) => `校规：${nameOf(id)}`))
  if (req.legacyPerks) out.push(...req.legacyPerks.map((id) => `传承特性：${nameOf(id)}`))
  return out
}

/** ===================== 教师招聘 ===================== */
export function hireCost(subject: TeacherSubject, count: number, state: GameState): Partial<Record<ResourceKey, number>> {
  const base = 260 + totalTeachers(state) * 26
  return { money: Math.ceil(base * count) }
}

export function hireDurationMinutes(count: number): number {
  return 90 * count
}

export function teacherSubjectName(subject: TeacherSubject): string {
  return TEACHER_SUBJECTS.includes(subject) ? subject : subject
}
