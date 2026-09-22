import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { RATING_EXAMS, RATING_TIERS, TUTORIAL_STEPS } from '../src/data'
import { ratingCapFor, ratingTierOf } from '../src/data/rating'
import { MINUTES_PER_DAY, totalStudents } from '../src/game/formulas'
import { gameRateToRealMinute, gameRateToRealSecond, formatRealRate } from '../src/ui/duration'

function makeEngine() {
  return new GameEngine(createInitialState())
}

describe('评级考核（每次升级都要过评估）', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('开局评级较低，属于「待整改高中」', () => {
    const engine = makeEngine()
    expect(engine.state.school.ratingTier).toBe(0)
    // 刚接手的破败学校：十几分，离「普通高中」还有一段路
    expect(engine.state.school.rating).toBeLessThan(15)
    expect(engine.state.school.pendingRatingExam).toBeNull()
    expect(ratingTierOf(engine.state.school.rating).label).toBe('待整改高中')
  })

  it('评级涨到门槛会触发考核，并且被锁在门槛之下', () => {
    const engine = makeEngine()
    for (const cohort of engine.state.students.cohorts) {
      cohort.attrs.academic = 45
      cohort.attrs.sports = 40
      cohort.attrs.arts = 38
      cohort.attrs.research = 38
      cohort.attrs.morality = 50
      cohort.attrs.health = 60
      cohort.stress = 25
    }
    engine.advanceMinutes(60)
    expect(engine.state.school.pendingRatingExam).toBe(1)
    // 没过考核之前，评级被锁在 20 以下
    expect(engine.state.school.rating).toBeLessThanOrEqual(ratingCapFor(0) + 0.001)
    const status = engine.ratingExam()
    expect(status?.exam.tierIndex).toBe(1)
    expect(status?.checklist.length).toBeGreaterThan(0)
  })

  it('条件未达成时无法通过考核', () => {
    const engine = makeEngine()
    engine.state.school.pendingRatingExam = 1
    expect(engine.ratingExam()?.canSubmit).toBe(false)
    expect(engine.submitRatingExam()).toBe(false)
    expect(engine.state.school.ratingTier).toBe(0)
  })

  it('满足清单后提交考核：等级提升、拿到奖励、评级上限放开', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    engine.debugBuild('teachingBuilding') // 教学楼 Lv.2
    engine.state.students.cohorts[0].count = 200
    for (const cohort of engine.state.students.cohorts) cohort.attrs.academic = 40
    engine.state.school.pendingRatingExam = 1
    const status = engine.ratingExam()!
    expect(status.canSubmit).toBe(true)
    const fundBefore = engine.state.resources.educationFund
    expect(engine.submitRatingExam()).toBe(true)
    expect(engine.state.school.ratingTier).toBe(1)
    // 如果学校实力已经远超下一级门槛，会紧接着进入下一次考核
    expect([null, 2]).toContain(engine.state.school.pendingRatingExam)
    expect(engine.state.resources.educationFund).toBeGreaterThan(fundBefore)
    expect(ratingCapFor(1)).toBeGreaterThan(30)
  })

  it('每个等级都有考核剧情、清单与奖励', () => {
    expect(RATING_EXAMS.length).toBe(RATING_TIERS.length - 1)
    for (const exam of RATING_EXAMS) {
      expect(exam.paragraphs.length).toBeGreaterThan(0)
      expect(exam.requirements.length).toBeGreaterThanOrEqual(3)
      expect(exam.examiner.length).toBeGreaterThan(0)
      expect(Object.keys(exam.reward).length).toBeGreaterThan(0)
    }
  })

  it('评级上限随已通过的等级提升', () => {
    expect(ratingCapFor(0)).toBeLessThan(20)
    expect(ratingCapFor(1)).toBeLessThan(35)
    expect(ratingCapFor(2)).toBeLessThan(50)
    expect(ratingCapFor(RATING_TIERS.length - 1)).toBe(100)
  })

  it('debugSetRating 会同时推进已达到的等级（方便调试）', () => {
    const engine = makeEngine()
    engine.debugSetRating(70)
    expect(engine.state.school.rating).toBe(70)
    expect(engine.state.school.ratingTier).toBeGreaterThanOrEqual(4)
    expect(engine.prestigePreview().can).toBe(false) // 还需要毕业生
    engine.state.statistics.graduates = 400
    engine.state.statistics.competitionWins = 5
    expect(engine.prestigePreview().can).toBe(true)
  })

  it('剧情引导未结束时不会刷随机事件', () => {
    const engine = makeEngine()
    expect(engine.state.ui.tutorialStep).toBeLessThan(TUTORIAL_STEPS.length)
    engine.advanceMinutes(MINUTES_PER_DAY * 120)
    expect(engine.state.events.log.length).toBe(0)
    expect(engine.state.events.active.length).toBe(0)
  })

  it('剧情引导走完后事件才会开始出现', () => {
    const engine = makeEngine()
    engine.state.ui.tutorialStep = 99 // 视为剧情全部完成
    engine.advanceMinutes(MINUTES_PER_DAY * 80)
    expect(engine.state.events.log.length + engine.state.events.active.length).toBeGreaterThan(0)
  })

  it('资源速率按现实时间换算（1× 速度下 1 游戏分钟产出 = 7 200/现实分钟）', () => {
    const ctx = { speed: 1, paused: false }
    // 1 现实秒 = 120 游戏分钟 → 1 现实分钟 = 7 200 游戏分钟
    expect(gameRateToRealMinute(1, ctx)).toBeCloseTo(7200, 5)
    expect(formatRealRate(1, ctx)).toContain('/分钟')
    expect(gameRateToRealSecond(1, ctx)).toBeCloseTo(120, 5)
    const speed5 = { speed: 5, paused: false }
    expect(gameRateToRealMinute(1, speed5)).toBeCloseTo(36000, 5)
    expect(gameRateToRealSecond(1, speed5)).toBeCloseTo(600, 5)
  })

  it('教程任务面板数据完整', () => {
    const engine = makeEngine()
    const task = engine.tutorialTask()
    expect(task.done).toBe(false)
    expect(task.objective.length).toBeGreaterThan(0)
    expect(task.tab).toBeTruthy()
    expect(totalStudents(engine.state as never)).toBeGreaterThan(0)
    // 全部走完后给出寄语
    engine.state.ui.tutorialStep = 99
    const finished = engine.tutorialTask()
    expect(finished.done).toBe(true)
    expect(finished.closing).toContain('老校长')
    engine.acknowledgeTutorialComplete()
    expect(engine.tutorialTask().acknowledged).toBe(true)
  })
})
