import { describe, expect, it } from 'vitest'
import {
  buildDuration,
  buildingCost,
  buildingProduction,
  calendarFromMinutes,
  cohortByGrade,
  clamp,
  MINUTES_PER_DAY,
  ratingGrade,
  safeNumber,
  sanitizeResource,
  schoolRating,
  seasonOfMonth,
  studentCapacity,
  teacherEfficiency,
} from '../src/game/formulas'
import { BUILDING_MAP } from '../src/data'
import { createInitialState } from '../src/game/engine/state'
import { ModifierIndex } from '../src/game/engine/ModifierIndex'
import { collectModifiers } from '../src/game/engine/ModifierEngine'

describe('公式层', () => {
  it('日历：开局为第 1 学年 9 月 1 日，12 个月后进入第 2 学年', () => {
    const start = calendarFromMinutes(0)
    expect(start.month).toBe(9)
    expect(start.day).toBe(1)
    expect(start.schoolYear).toBe(1)
    expect(start.season).toBe('autumn')
    const afterYear = calendarFromMinutes(MINUTES_PER_DAY * 30 * 12)
    expect(afterYear.month).toBe(9)
    expect(afterYear.schoolYear).toBe(2)
  })

  it('季节映射符合设计（春 3-5、夏 6-8、秋 9-11、冬 12-2）', () => {
    expect(seasonOfMonth(4)).toBe('spring')
    expect(seasonOfMonth(7)).toBe('summer')
    expect(seasonOfMonth(10)).toBe('autumn')
    expect(seasonOfMonth(1)).toBe('winter')
  })

  it('建筑成本随等级指数增长，建造时间随等级变长', () => {
    const def = BUILDING_MAP.teachingBuilding
    const l1 = buildingCost(def, 1).money ?? 0
    const l2 = buildingCost(def, 2).money ?? 0
    const l5 = buildingCost(def, 5).money ?? 0
    expect(l2).toBeGreaterThan(l1)
    expect(l5).toBeGreaterThan(l2)
    expect(buildDuration(def, 5)).toBeGreaterThan(buildDuration(def, 1))
  })

  it('建筑产出随等级提升', () => {
    const def = BUILDING_MAP.teachingBuilding
    const l1 = buildingProduction(def, 1).teaching ?? 0
    const l5 = buildingProduction(def, 5).teaching ?? 0
    expect(l1).toBeGreaterThan(0)
    expect(l5).toBeGreaterThan(l1 * 3)
  })

  it('加成会影响成本、建造速度与产出', () => {
    const def = BUILDING_MAP.teachingBuilding
    const mods = new ModifierIndex()
    mods.push('build_cost', 'mul', -0.5, '测试')
    mods.push('build_speed', 'mul', 1, '测试')
    const base = buildingCost(def, 3).money ?? 0
    const discounted = buildingCost(def, 3, mods).money ?? 0
    expect(discounted).toBeLessThan(base)
    expect(buildDuration(def, 8, mods)).toBeLessThan(buildDuration(def, 8))
  })

  it('学校评级随基础设施与成绩提升，并映射到评价等级', () => {
    const state = createInitialState()
    const mods = new ModifierIndex()
    collectModifiers(state, mods)
    const before = schoolRating(state, BUILDING_MAP, mods)
    expect(before).toBeGreaterThan(0)
    for (const [id, def] of Object.entries(BUILDING_MAP)) {
      state.buildings[id] = { level: Math.floor(def.maxLevel / 2) }
    }
    for (const cohort of state.students.cohorts) {
      cohort.attrs.academic = 85
      cohort.attrs.morality = 85
    }
    const after = schoolRating(state, BUILDING_MAP, mods)
    expect(after).toBeGreaterThan(before)
    expect(after).toBeLessThanOrEqual(100)
    expect(ratingGrade(10)).toBe('待整改高中')
    expect(ratingGrade(96)).toBe('世界实验标杆校')
  })

  it('学生容量来自建筑，教师效率在合理区间', () => {
    const state = createInitialState()
    const cap = studentCapacity(state, BUILDING_MAP)
    expect(cap).toBeGreaterThan(0)
    const eff = teacherEfficiency(state)
    expect(eff).toBeGreaterThan(0.5)
    expect(eff).toBeLessThan(3)
  })

  it('非法数字会被修正，不会产生 NaN / Infinity', () => {
    expect(clamp(NaN, 0, 10)).toBe(0)
    expect(safeNumber(Infinity, 5)).toBe(5)
    expect(safeNumber(undefined, 3)).toBe(3)
    expect(sanitizeResource(-100)).toBe(0)
    expect(Number.isFinite(sanitizeResource(Number.POSITIVE_INFINITY))).toBe(true)
  })

  it('初始学生分布符合设计（高一 > 高二 > 高三）', () => {
    const state = createInitialState()
    const g1 = cohortByGrade(state, 1)?.count ?? 0
    const g2 = cohortByGrade(state, 2)?.count ?? 0
    const g3 = cohortByGrade(state, 3)?.count ?? 0
    expect(g1).toBeGreaterThan(g2)
    expect(g2).toBeGreaterThan(g3)
    expect(g3).toBeGreaterThan(0)
  })
})
