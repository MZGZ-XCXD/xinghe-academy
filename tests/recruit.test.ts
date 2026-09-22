import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { activityBlockReason, isActivityUnlocked } from '../src/game/engine/ActivityEngine'
import { ACTIVITY_DEFS, BUILDING_MAP, COURSE_DEFS, COURSE_MAP } from '../src/data'
import { MINUTES_PER_DAY, enrollmentCount, seasonOfMonth } from '../src/game/formulas'

function makeEngine() {
  return new GameEngine(createInitialState())
}

/**
 * 直接把时间拨到某个季节的第一个月（测试用）。
 * 逐日推进会跑完整 step 管线，速度太慢；这里只关心季节上下文。
 * 学期顺序：9 月起 → 3 月是春季（第 7 个月）。
 */
function jumpToSeason(engine: GameEngine, season: 'spring' | 'autumn'): void {
  engine.state.time.minutes = season === 'spring' ? 6 * 30 * MINUTES_PER_DAY : 0
  expect(seasonOfMonth(engine.calendar().month)).toBe(season)
}

describe('招生是活动，不是课程', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('课程表里不再有「招生宣传」这类课程', () => {
    expect(COURSE_MAP.springRecruit).toBeUndefined()
    const recruitCourses = COURSE_DEFS.filter((c) => c.tags?.includes('recruit'))
    expect(recruitCourses).toEqual([])
    expect(COURSE_DEFS.some((c) => c.name.includes('招生'))).toBe(false)
  })

  it('招生活动被放在「校园活动」里，并且只在春季开放', () => {
    const recruitActivities = ACTIVITY_DEFS.filter((a) => (a.rewards.recruitBonus ?? 0) > 0)
    expect(recruitActivities.length).toBeGreaterThanOrEqual(3)
    for (const def of recruitActivities) {
      expect(def.kind, `${def.name} 应该属于校园活动`).toBe('校园活动')
      expect(def.seasons, `${def.name} 应该限定春季`).toEqual(['spring'])
      expect(def.rewards.recruitBonus).toBeGreaterThan(0)
    }
  })

  it('秋季无法举办招生活动，并给出季节原因', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    // 开局是 9 月（秋季）
    expect(engine.calendar().season).toBe('autumn')
    const def = ACTIVITY_DEFS.find((a) => a.id === 'springRecruitTalk')!
    expect(isActivityUnlocked(engine.state as never, def)).toBe(false)
    expect(activityBlockReason(engine.state as never, def)).toContain('只在春季举办')
    expect(engine.startActivity('springRecruitTalk')).toBe(false)
  })

  it('春季可以举办，完成后累积招生加成，新生人数随之提高', () => {
    const engine = makeEngine()
    // 只给刚好够办活动的资源，避免刷高声望把招生挤到容量上限
    engine.state.resources.money = 3000
    engine.state.resources.teaching = 800
    jumpToSeason(engine, 'spring')
    expect(engine.calendar().season).toBe('spring')

    const before = enrollmentCount(engine.state as never, BUILDING_MAP, engine.mods)
    const bonusBefore = engine.state.students.recruitBonus
    expect(engine.startActivity('springRecruitTalk')).toBe(true)
    engine.advanceMinutes(3 * MINUTES_PER_DAY)

    expect(engine.state.students.recruitBonus).toBeGreaterThan(bonusBefore)
    const after = enrollmentCount(engine.state as never, BUILDING_MAP, engine.mods)
    expect(after).toBeGreaterThan(before)
    const result = engine.state.activityResults.find((r) => r.defId === 'springRecruitTalk')
    expect(result?.log.join(' ')).toContain('招生加成')
  })

  it('招生加成会在学年结算时转化为新生（并且不会突破容量）', () => {
    const engine = makeEngine()
    engine.state.resources.money = 3000
    engine.state.resources.teaching = 800
    jumpToSeason(engine, 'spring')
    engine.startActivity('springRecruitTalk')
    engine.advanceMinutes(3 * MINUTES_PER_DAY)
    const bonus = engine.state.students.recruitBonus
    expect(bonus).toBeGreaterThan(0)

    // 拨到 8 月底，再推进两天跨进 9 月，触发学年结算
    engine.state.time.minutes = 12 * 30 * MINUTES_PER_DAY - 2 * MINUTES_PER_DAY
    engine.advanceMinutes(3 * MINUTES_PER_DAY)
    expect(engine.state.students.recruitBonus).toBe(0) // 结算后清零
    const report = engine.state.school.lastAnnualReport
    expect(report?.enrollment ?? 0).toBeGreaterThan(0)
    // 新生人数不会超过学生容量
    const cap = engine.capacity()
    const total = engine.state.students.cohorts.reduce((sum, c) => sum + c.count, 0)
    expect(total).toBeLessThanOrEqual(Math.ceil(cap))
  })

  it('失败也会带回一部分招生效果，但明显少于成功', () => {
    const success = makeEngine()
    const failure = makeEngine()
    for (const engine of [success, failure]) {
      engine.state.resources.money = 3000
      engine.state.resources.teaching = 800
      jumpToSeason(engine, 'spring')
    }
    success.startActivity('springRecruitTalk')
    success.advanceMinutes(3 * MINUTES_PER_DAY)
    const successBonus = success.state.students.recruitBonus

    vi.restoreAllMocks()
    vi.spyOn(Math, 'random').mockReturnValue(0.999)
    failure.startActivity('springRecruitTalk')
    failure.advanceMinutes(3 * MINUTES_PER_DAY)
    const failureBonus = failure.state.students.recruitBonus
    expect(failureBonus).toBeGreaterThan(0)
    expect(failureBonus).toBeLessThan(successBonus)
  })
})
