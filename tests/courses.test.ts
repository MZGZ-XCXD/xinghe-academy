import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { allocateCourses, courseCoverageSummary } from '../src/game/engine/CourseEngine'
import {
  COURSE_CAPACITY_PER_TEACHING_LEVEL,
  MINUTES_PER_DAY,
  courseCapacity,
  overallAttributes,
  totalStudents,
} from '../src/game/formulas'
import { BUILDING_MAP, COURSE_MAP } from '../src/data'

function makeEngine() {
  return new GameEngine(createInitialState())
}

/**
 * 课程覆盖模型回归测试。
 * 起因：早期用「先到先得」把学生分给课程，120 个学生时语文吃满 120 人、
 * 数学覆盖 0 人——真实高中里学生是同时上多门课的。
 */
describe('课程覆盖（每门课并行覆盖全校学生）', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('同时开语文与数学时，两门课都覆盖全部学生', () => {
    const engine = makeEngine()
    expect(engine.toggleCourse('chinese')).toBe(true)
    expect(engine.toggleCourse('math')).toBe(true)
    const allocations = allocateCourses(engine.state as never)
    expect(allocations.length).toBe(2)
    for (const allocation of allocations) {
      expect(allocation.served).toBe(totalStudents(engine.state as never))
      expect(allocation.capacityRatio).toBeCloseTo(1, 5)
    }
  })

  it('开满 4 门基础课，覆盖率不会互相挤占', () => {
    const engine = makeEngine()
    for (const id of ['chinese', 'math', 'english', 'history']) engine.toggleCourse(id)
    const allocations = allocateCourses(engine.state as never)
    const students = totalStudents(engine.state as never)
    expect(allocations.length).toBe(4)
    expect(allocations.every((a) => a.served === students)).toBe(true)
    // 教学资源消耗按「覆盖人数」计算，因此 4 门课都会真实消耗
    for (const allocation of allocations) {
      expect(allocation.served).toBeGreaterThan(0)
    }
  })

  it('学生超过平行班容量时，只覆盖一部分学生，并给出提示数据', () => {
    const engine = makeEngine()
    // 把学生扩到 600 人，同时保持教学楼 1 级
    engine.state.students.cohorts[0].count = 400
    engine.state.students.cohorts[1].count = 150
    engine.state.students.cohorts[2].count = 50
    engine.toggleCourse('chinese')
    const summary = courseCoverageSummary(engine.state as never)
    expect(summary.total).toBe(600)
    expect(summary.worstRatio).toBeLessThan(1)
    expect(summary.limited.some((c) => c.name === '语文')).toBe(true)
  })

  it('升级教学楼会增加平行班容量，覆盖率随之提高', () => {
    const engine = makeEngine()
    engine.state.students.cohorts[0].count = 400
    engine.state.students.cohorts[1].count = 150
    engine.state.students.cohorts[2].count = 50
    engine.toggleCourse('chinese')
    const before = courseCapacity(engine.state as never, COURSE_MAP.chinese, BUILDING_MAP)
    engine.debugBuild('teachingBuilding')
    engine.debugBuild('teachingBuilding')
    const after = courseCapacity(engine.state as never, COURSE_MAP.chinese, BUILDING_MAP)
    expect(after - before).toBe(COURSE_CAPACITY_PER_TEACHING_LEVEL * 2)
    const served = allocateCourses(engine.state as never)[0]
    expect(served.served).toBe(Math.min(after, 600))
  })

  it('小容量的精英课程（竞赛训练）只覆盖一部分学生，这是预期行为', () => {
    const engine = makeEngine()
    engine.debugUnlockAll()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    expect(engine.toggleCourse('olympiadMath')).toBe(true)
    const allocation = allocateCourses(engine.state as never).find((a) => a.def.id === 'olympiadMath')
    const students = totalStudents(engine.state as never)
    expect(allocation!.served).toBeLessThanOrEqual(COURSE_MAP.olympiadMath.capacity + COURSE_CAPACITY_PER_TEACHING_LEVEL)
    expect(allocation!.served).toBeLessThan(students)
  })

  it('覆盖到的学生才会获得成长：覆盖率低时整体平均值涨得更慢', () => {
    const wide = makeEngine()
    const narrow = makeEngine()
    for (const engine of [wide, narrow]) {
      engine.state.resources.teaching = 500000
      engine.toggleCourse('chinese')
    }
    // narrow：学生数远超容量，只有一部分人能上语文
    narrow.state.students.cohorts[0].count = 500
    narrow.state.students.cohorts[1].count = 200
    narrow.state.students.cohorts[2].count = 100
    const wideBefore = overallAttributes(wide.state as never).academic
    const narrowBefore = overallAttributes(narrow.state as never).academic
    wide.advanceMinutes(MINUTES_PER_DAY * 10)
    narrow.advanceMinutes(MINUTES_PER_DAY * 10)

    const wideGain = overallAttributes(wide.state as never).academic - wideBefore
    const narrowGain = overallAttributes(narrow.state as never).academic - narrowBefore
    expect(wideGain).toBeGreaterThan(0)
    // 覆盖到的学生仍在成长，但全校平均值被未覆盖的学生稀释，因此涨幅更小
    expect(narrowGain).toBeGreaterThan(0)
    expect(narrowGain).toBeLessThan(wideGain)
  })
})
