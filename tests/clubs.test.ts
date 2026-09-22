import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { MINUTES_PER_DAY, overallAttributes, totalClubLevels, totalClubMembers, totalStudents } from '../src/game/formulas'
import { clubMembersOf, festivalScore, isClubUnlocked } from '../src/game/engine/ClubEngine'
import { CLUB_DEFS, CLUB_MAP, BUILDING_MAP, ACTIVITY_MAP } from '../src/data'

function makeEngine() {
  return new GameEngine(createInitialState())
}

describe('社团（部活）与学园祭', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('内容表包含动漫社 / 轻音社 / 超自然研究社 / 潜水社等社团', () => {
    const ids = CLUB_DEFS.map((c) => c.id)
    expect(ids).toContain('anime')
    expect(ids).toContain('lightMusic')
    expect(ids).toContain('occult')
    expect(ids).toContain('diving')
    expect(CLUB_DEFS.length).toBeGreaterThanOrEqual(25)
    expect(CLUB_MAP.anime.jpName).toBe('漫画研究部')
    for (const club of CLUB_DEFS) {
      expect(club.maxLevel).toBeGreaterThan(0)
      expect(club.baseMembers).toBeGreaterThan(0)
      expect(club.festivalScore).toBeGreaterThan(0)
    }
  })

  it('开局只有满足前置条件的社团可用，其余随建筑与科技解锁', () => {
    const engine = makeEngine()
    const state = engine.state
    const unlockedAtStart = CLUB_DEFS.filter((def) => isClubUnlocked(state as never, def)).map((def) => def.id)
    expect(unlockedAtStart).toContain('anime')
    expect(unlockedAtStart).toContain('ballGame')
    // 需要专门建筑的社团一开始是锁着的
    expect(unlockedAtStart).not.toContain('diving')
    expect(unlockedAtStart).not.toContain('occult')
    expect(unlockedAtStart).not.toContain('lightMusic')

    // 建成音乐教室 / 图书馆 / 游泳馆后对应社团解锁
    engine.debugUncapStorage()
    engine.debugAddAll(1000000)
    engine.debugBuild('teachingBuilding') // 图书馆需要教学楼 2 级
    engine.debugBuild('teachingBuilding')
    for (const id of ['musicRoom', 'library', 'natatorium', 'playground']) {
      engine.debugBuild(id)
      engine.debugBuild(id)
    }
    expect(isClubUnlocked(engine.state as never, CLUB_MAP.lightMusic)).toBe(true)
    expect(isClubUnlocked(engine.state as never, CLUB_MAP.occult)).toBe(true)
    expect(isClubUnlocked(engine.state as never, CLUB_MAP.diving)).toBe(true)
  })

  it('成立社团会消耗资金与活跃度，并按等级增加社员', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    const moneyBefore = engine.state.resources.money
    const activityBefore = engine.state.resources.activity
    expect(engine.upgradeClub('anime')).toBe(true)
    expect(engine.state.clubs.anime.level).toBe(1)
    expect(engine.state.clubs.anime.members).toBe(CLUB_MAP.anime.baseMembers)
    expect(engine.state.resources.money).toBeLessThan(moneyBefore)
    expect(engine.state.resources.activity).toBeLessThan(activityBefore)

    expect(engine.upgradeClub('anime')).toBe(true)
    expect(engine.state.clubs.anime.level).toBe(2)
    expect(engine.state.clubs.anime.members).toBe(clubMembersOf(CLUB_MAP.anime, 2))
  })

  it('未解锁的社团无法成立', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    expect(engine.upgradeClub('diving')).toBe(false)
    expect(engine.state.clubs.diving.level).toBe(0)
  })

  it('社团数量受部室容量限制', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(2000000)
    engine.debugUnlockAll()
    const info = engine.clubInfo()
    let founded = 0
    for (const def of CLUB_DEFS) {
      if (engine.upgradeClub(def.id)) founded += 1
    }
    expect(founded).toBeLessThanOrEqual(info.slots)
    // 扩建社团活动楼与部室栋后部室变多
    for (const id of ['clubBuilding', 'clubRooms']) {
      for (let i = 0; i < 3; i += 1) {
        engine.build(id)
        engine.debugFinishQueue()
      }
    }
    expect(engine.clubInfo().slots).toBeGreaterThan(info.slots)
  })

  it('社员数量受在校学生限制（不会超过 80%）', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(5000000)
    engine.debugUnlockAll()
    let guard = 0
    while (guard < 400) {
      guard += 1
      const target = CLUB_DEFS.find((def) => engine.upgradeClub(def.id))
      if (!target) break
    }
    expect(totalClubMembers(engine.state as never)).toBeLessThanOrEqual(
      Math.floor(totalStudents(engine.state as never) * 0.8) + CLUB_DEFS.length * 40,
    )
  })

  it('社团会带来学生成长与资源产出，同时消耗运营资金', () => {
    const withClub = makeEngine()
    const control = makeEngine()
    withClub.debugUncapStorage()
    withClub.debugAddAll(500000)
    control.debugUncapStorage()
    control.debugAddAll(500000)
    expect(withClub.upgradeClub('anime')).toBe(true)
    const beforeArts = overallAttributes(withClub.state as never).arts
    withClub.advanceMinutes(MINUTES_PER_DAY * 20)
    control.advanceMinutes(MINUTES_PER_DAY * 20)
    expect(overallAttributes(withClub.state as never).arts).toBeGreaterThan(beforeArts)
    expect(withClub.state.resources.culture).toBeGreaterThan(control.state.resources.culture)
    expect(withClub.state.resources.money).toBeLessThan(control.state.resources.money)
    expect(withClub.state.statistics.flags.festivalHeld ?? false).toBe(false)
  })

  it('社团等级会提升学园祭评分，并影响祭典类活动的成功率', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(3000000)
    engine.debugUnlockAll()
    for (let i = 0; i < 4; i += 1) engine.debugBuild('teachingBuilding') // 提供部室
    engine.debugBuild('clubBuilding')
    engine.debugBuild('clubRooms')
    const baseScore = festivalScore(engine.state as never, engine.mods)
    for (const id of ['anime', 'ballGame', 'literature']) engine.upgradeClub(id)
    engine.advanceMinutes(30)
    const scoreAfter = festivalScore(engine.state as never, engine.mods)
    expect(scoreAfter).toBeGreaterThan(baseScore)
    expect(totalClubLevels(engine.state as never)).toBeGreaterThanOrEqual(3)
  })

  it('学园祭需要足够的社团等级总和才能参加', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(3000000)
    engine.debugUnlockAll()
    for (let i = 0; i < 6; i += 1) engine.debugBuild('teachingBuilding')
    for (let i = 0; i < 3; i += 1) engine.debugBuild('clubBuilding')
    for (let i = 0; i < 3; i += 1) engine.debugBuild('clubRooms')
    expect(ACTIVITY_MAP.schoolFestival.requires?.totalClubLevels).toBeGreaterThan(0)
    // 解锁科技但社团等级不足：无法参加
    const before = engine.state.activeActivities.length
    engine.startActivity('schoolFestival')
    expect(engine.state.activeActivities.length).toBe(before)

    // 成立并升级一批社团后可以参加
    for (let round = 0; round < 3; round += 1) {
      for (const def of CLUB_DEFS) engine.upgradeClub(def.id)
    }
    engine.advanceMinutes(60)
    expect(totalClubLevels(engine.state as never)).toBeGreaterThanOrEqual(6)
    expect(engine.startActivity('schoolFestival')).toBe(true)
    engine.advanceMinutes(4 * MINUTES_PER_DAY)
    expect(engine.state.activityResults.some((r) => r.defId === 'schoolFestival')).toBe(true)
  })

  it('校史传承的学园祭特性会在新一轮开局提供中庭广场', () => {
    const engine = makeEngine()
    engine.state.legacy.points = 9999
    engine.state.legacy.nodes.histStart = 1
    engine.state.legacy.nodes.histFestival = 1
    expect(engine.buyLegacyNode('perkFestivalTradition')).toBe(true)
    expect(engine.state.legacy.perks.festivalTradition).toBe(true)
    const next = createInitialState({
      keepLegacy: engine.state.legacy as never,
      applyLegacyPerks: { buildings: { courtyard: 1 }, technologies: [], money: 0, satisfaction: 0 },
    })
    expect(next.buildings.courtyard.level).toBe(1)
    expect(BUILDING_MAP.courtyard.clubSlots).toBeGreaterThan(0)
  })
})
