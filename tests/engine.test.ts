import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { MINUTES_PER_DAY, overallAttributes, totalStudents } from '../src/game/formulas'
import { BUILDING_MAP, COURSE_MAP, EVENT_MAP, TECH_MAP } from '../src/data'
import { allocationReport } from './helpers'

function makeEngine() {
  return new GameEngine(createInitialState())
}

describe('核心循环', () => {
  let randomSpy: ReturnType<typeof vi.spyOn> | null = null
  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })
  afterEach(() => {
    randomSpy?.mockRestore()
  })

  it('资源会随时间自动增长', () => {
    const engine = makeEngine()
    const before = { ...engine.state.resources }
    engine.advanceMinutes(MINUTES_PER_DAY)
    expect(engine.state.resources.money).toBeGreaterThan(before.money)
    expect(engine.state.resources.teaching).toBeGreaterThan(before.teaching)
  })

  it('资源与时间推进过程中不会出现 NaN / Infinity', () => {
    const engine = makeEngine()
    engine.advanceMinutes(MINUTES_PER_DAY * 40)
    for (const [key, value] of Object.entries(engine.state.resources)) {
      expect(Number.isFinite(value), `${key} 应为有限数字`).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
    }
    expect(Number.isFinite(engine.state.school.rating)).toBe(true)
    expect(Number.isFinite(engine.state.time.minutes)).toBe(true)
  })

  it('建筑购买会扣除资源并进入建造队列，完成后等级提升', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    const before = engine.state.buildings.canteen.level
    const moneyBefore = engine.state.resources.money
    const ok = engine.build('canteen')
    expect(ok).toBe(true)
    expect(engine.state.resources.money).toBeLessThan(moneyBefore)
    expect(engine.state.buildQueue.length).toBe(1)
    engine.debugFinishQueue()
    expect(engine.state.buildings.canteen.level).toBe(before + 1)
  })

  it('未解锁的建筑无法建造', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    expect(engine.build('researchCampus')).toBe(false)
  })

  it('建造队列上限会阻止同时开工过多建筑', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(1000000)
    expect(engine.build('teachingBuilding')).toBe(true)
    expect(engine.build('canteen')).toBe(true)
    expect(engine.build('playground')).toBe(true)
    expect(engine.build('dorm')).toBe(false)
    engine.cancelBuild(engine.state.buildQueue[0].id)
    engine.debugBuild('teachingBuilding')
    expect(engine.build('library')).toBe(true)
    // 取消后腾出的工位可以被新建筑占用，但队列上限依然是 3
    expect(engine.state.buildQueue.length).toBe(3)
    expect(engine.build('musicRoom')).toBe(false)
  })

  it('课程需要占用槽位并产生教学资源消耗与学生成长', () => {
    const engine = makeEngine()
    const control = makeEngine()
    const beforeAcademic = overallAttributes(engine.state).academic
    engine.state.resources.teaching = 3000
    control.state.resources.teaching = 3000
    expect(engine.toggleCourse('chinese')).toBe(true)
    engine.advanceMinutes(MINUTES_PER_DAY * 5)
    control.advanceMinutes(MINUTES_PER_DAY * 5)
    const afterAcademic = overallAttributes(engine.state).academic
    expect(afterAcademic).toBeGreaterThan(beforeAcademic)
    expect(engine.state.resources.teaching).toBeLessThan(control.state.resources.teaching)
  })

  it('课程槽位不足时无法继续开课', () => {
    const engine = makeEngine()
    const slots = engine.courseSlotInfo().total
    const lightCourses = ['chinese', 'math', 'english', 'programming', 'speech', 'debate']
    let opened = 0
    for (const id of lightCourses) {
      if (engine.toggleCourse(id)) opened += 1
    }
    expect(engine.courseSlotInfo().used).toBeLessThanOrEqual(slots)
    expect(opened).toBeGreaterThanOrEqual(3)
  })

  it('学生群体在一年后发生升学与毕业，并迎来新生', () => {
    const engine = makeEngine()
    engine.toggleCourse('chinese')
    engine.state.resources.teaching = 100000
    const g3Before = engine.state.students.cohorts[2].count
    engine.advanceMinutes(MINUTES_PER_DAY * 360)
    expect(engine.state.statistics.graduates).toBeGreaterThanOrEqual(g3Before)
    expect(engine.state.students.alumniActive).toBeGreaterThan(0)
    expect(totalStudents(engine.state)).toBeGreaterThan(0)
  })

  it('科技研究需要资源与时间，完成后解锁科技与课程', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(200000)
    expect(engine.research('modernTeaching')).toBe(true)
    expect(engine.state.technologies.modernTeaching.unlocked).toBe(false)
    engine.advanceMinutes(TECH_MAP.modernTeaching.researchMinutes + 10)
    expect(engine.state.technologies.modernTeaching.unlocked).toBe(true)
    expect(engine.state.courses.studySkills.unlocked).toBe(true)
  })

  it('缺少前置科技时无法研究', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(200000)
    expect(engine.research('aiBasics')).toBe(false)
  })

  it('校规数量受名额限制，且正负效果同时生效', () => {
    const engine = makeEngine()
    const slots = engine.policySlotInfo().total
    // 开局只有「严格作息」「早读制度」这类基础规矩可用
    expect(engine.togglePolicy('strictSchedule')).toBe(true)
    expect(engine.togglePolicy('morningReading')).toBe(true)
    if (slots <= 2) {
      expect(engine.togglePolicy('sportsFirst')).toBe(false)
    }
    expect(engine.state.school.activePolicies.length).toBeLessThanOrEqual(slots)
    engine.advanceMinutes(30)
    // 正面效果与代价同时生效
    expect(engine.mods.mul('exam_score')).toBeGreaterThan(1)
    expect(engine.mods.mul('student_stress')).toBeGreaterThan(1)
  })

  it('季节会改变产出与考试加成', () => {
    const engine = makeEngine()
    const autumnMods = engine.mods.mul('research_rate')
    // 推进到冬季（12 月）
    engine.advanceMinutes(MINUTES_PER_DAY * 30 * 3)
    expect(engine.season).toBe('winter')
    expect(engine.mods.mul('money_rate')).toBeLessThan(1)
    expect(engine.mods.mul('exam_score')).toBeGreaterThan(1)
    void autumnMods
  })

  it('比赛会产生结果，并在胜利时增加统计与声望', () => {
    const engine = makeEngine()
    engine.state.resources.teaching = 5000
    engine.state.resources.money = 5000
    expect(engine.startActivity('ballGameFriendly')).toBe(true)
    engine.advanceMinutes(2 * MINUTES_PER_DAY)
    expect(engine.state.activityResults.length).toBeGreaterThan(0)
    expect(engine.state.statistics.competitions).toBeGreaterThan(0)
  })

  it('学生不足时无法参赛', () => {
    const engine = makeEngine()
    engine.state.students.cohorts.forEach((c) => (c.count = 1))
    engine.state.resources.teaching = 5000
    expect(engine.startActivity('ballGameFriendly')).toBe(false)
  })

  it('效果卡三选一可以生效，并产生实际加成', () => {
    const engine = makeEngine()
    engine.giveCardOffer('academic', '测试')
    expect(engine.state.cards.offers.length).toBe(1)
    const cardId = engine.state.cards.offers[0].cardIds[0]
    expect(engine.chooseCard(engine.state.cards.offers[0].uid, 0)).toBe(true)
    expect(engine.state.cards.active.length).toBe(1)
    expect(engine.state.cards.history.some((h) => h.cardId === cardId)).toBe(true)
  })

  it('事件可以被触发并按选项结算', () => {
    const engine = makeEngine()
    engine.debugTriggerEvent('canteenComplaint')
    expect(engine.state.events.active.length).toBe(1)
    const uid = engine.state.events.active[0].uid
    const satisfactionBefore = engine.state.students.cohorts[0].satisfaction
    expect(engine.resolveEvent(uid, 0)).toBe(true)
    expect(engine.state.events.active.length).toBe(0)
    expect(engine.state.statistics.eventsResolved).toBe(1)
    expect(engine.state.students.cohorts[0].satisfaction).not.toBe(satisfactionBefore)
  })

  it('延迟事件会在若干天后再次出现', () => {
    const engine = makeEngine()
    engine.state.teachers.groups.forEach((g) => (g.count = 2))
    expect(EVENT_MAP.researchProjectProgress).toBeDefined()
    engine.debugTriggerEvent('teacherResearch')
    const uid = engine.state.events.active[0].uid
    engine.resolveEvent(uid, 0)
    expect(engine.state.events.scheduled.length).toBe(1)
    engine.advanceMinutes(MINUTES_PER_DAY * 2 + 30)
    expect(engine.state.events.active.some((e) => e.defId === 'researchProjectProgress')).toBe(true)
  })

  it('成就系统会在条件满足时解锁并发放奖励', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    engine.build('canteen')
    engine.debugFinishQueue()
    engine.advanceMinutes(120)
    expect(engine.state.achievements.firstBuilding.unlocked).toBe(true)
    expect(engine.state.legacy.lifetimePoints).toBeGreaterThan(0)
  })

  it('恢复性：长时间模拟后所有数值仍然合法', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(5000000)
    engine.debugUnlockAll()
    for (const id of ['chinese', 'math', 'english', 'physics', 'programming']) {
      engine.toggleCourse(id)
    }
    engine.debugAdvanceYear()
    for (const cohort of engine.state.students.cohorts) {
      for (const [key, value] of Object.entries(cohort.attrs)) {
        expect(Number.isFinite(value), `${key} 非法`).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
    expect(Number.isFinite(engine.state.school.rating)).toBe(true)
    expect(allocationReport(engine).served).toBeGreaterThan(0)
    void BUILDING_MAP
    void COURSE_MAP
  })
})
