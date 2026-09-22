import { describe, expect, it } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import {
  BASE_GAME_MINUTES_PER_REAL_SECOND,
  MINUTES_PER_DAY,
  buildDuration,
  buildingCost,
  tuitionPerMinute,
} from '../src/game/formulas'
import { BUILDING_DEFS, BUILDING_MAP, TECH_DEFS } from '../src/data'
import { describeGameDuration, describeGameDurationShort, gameMinutesToRealSeconds } from '../src/ui/duration'

const ONE_X = { speed: 1, paused: false }

/**
 * 节奏回归测试。
 * 起因：玩家反馈「显示要 8 分钟，点一下就好了」——根因是时长用游戏分钟表示，
 * 而 1× 速度下 1 现实秒 = 120 游戏分钟，所以 8 游戏分钟其实是 0.07 现实秒。
 * 这里把「显示 → 现实时长」的换算与整体经济节奏都锁住。
 */
describe('时间换算与推进节奏', () => {
  it('1× 速度下 1 现实秒 = 120 游戏分钟（1 游戏日 ≈ 12 秒）', () => {
    expect(BASE_GAME_MINUTES_PER_REAL_SECOND).toBe(120)
    expect(MINUTES_PER_DAY / BASE_GAME_MINUTES_PER_REAL_SECOND).toBeCloseTo(12, 5)
  })

  it('游戏分钟可以正确换算成现实秒（含速度与暂停）', () => {
    expect(gameMinutesToRealSeconds(120, ONE_X)).toBeCloseTo(1, 5)
    expect(gameMinutesToRealSeconds(3055, ONE_X)).toBeCloseTo(25.5, 1)
    expect(gameMinutesToRealSeconds(3055, { speed: 5, paused: false })).toBeCloseTo(5.1, 1)
    expect(gameMinutesToRealSeconds(3055, { speed: 1, paused: true })).toBeCloseTo(25.5, 1)
  })

  it('界面时长统一写成「游戏天数（现实时间）」，不再出现游戏分钟', () => {
    // 教学楼 Lv.2 工期 3055 游戏分钟 = 2.1 天，1× 下约 25 秒
    expect(describeGameDuration(3055, ONE_X)).toBe('2.1 天（约 25 秒）')
    expect(describeGameDurationShort(1440, ONE_X)).toBe('1.0 天（12 秒）')

    for (const minutes of [30, 720, 1440, 3055, 20000, 100000]) {
      const text = describeGameDuration(minutes, ONE_X)
      expect(text).toContain('天（')
      expect(text).not.toContain('游戏分钟')
      expect(text).not.toContain('游戏小时')
    }
    // 暂停时也要说清楚
    expect(describeGameDuration(1440, { speed: 1, paused: true })).toBe('1.0 天（游戏已暂停）')
  })

  it('每栋建筑第一次升级在 1× 下至少需要 20 现实秒，且不会超过 30 分钟', () => {
    for (const def of BUILDING_DEFS) {
      const seconds = gameMinutesToRealSeconds(buildDuration(def, 2), ONE_X)
      expect(seconds, `${def.name} 的 L2 工期过短`).toBeGreaterThanOrEqual(20)
      expect(seconds, `${def.name} 的 L2 工期过长`).toBeLessThanOrEqual(30 * 60)
    }
  })

  it('建造速度加成不会把工期压到几乎没有（至少 5 现实秒）', () => {
    const mods = { mul: (target: string) => (target === 'build_speed' ? 5 : 1), add: () => 0 }
    for (const def of BUILDING_DEFS) {
      const seconds = gameMinutesToRealSeconds(buildDuration(def, 2, mods), ONE_X)
      expect(seconds, `${def.name} 在 5 倍建造速度下过快`).toBeGreaterThanOrEqual(5)
    }
  })

  it('第一次升级的成本至少值 1 个游戏日的初始收入', () => {
    const state = createInitialState()
    const perDay =
      (tuitionPerMinute(state) + (BUILDING_MAP.canteen.production?.money ?? 0)) * MINUTES_PER_DAY
    const cost = buildingCost(BUILDING_MAP.teachingBuilding, 2).money ?? 0
    expect(cost).toBeGreaterThanOrEqual(perDay)
    // 初始资金不足以立刻买下第一次升级，需要先运营一段时间
    expect(state.resources.money).toBeLessThan(cost)
  })

  it('升级的「攒钱时间」呈阶梯上升（用初始收入衡量）', () => {
    const state = createInitialState()
    const perDay =
      (tuitionPerMinute(state) + (BUILDING_MAP.canteen.production?.money ?? 0)) * MINUTES_PER_DAY
    const daysTo = (level: number) => (buildingCost(BUILDING_MAP.teachingBuilding, level).money ?? 0) / perDay

    // L2 ≈ 1 个游戏日（1× 下约 12 秒），L10 ≈ 12 个游戏日（约 2.5 分钟），L25 ≈ 1500 个游戏日
    expect(daysTo(2)).toBeGreaterThanOrEqual(1)
    expect(daysTo(10)).toBeGreaterThanOrEqual(10)
    expect(daysTo(25)).toBeGreaterThanOrEqual(1000)
    // 而且是单调递增的（越往后越贵）
    expect(daysTo(10)).toBeGreaterThan(daysTo(2))
    expect(daysTo(25)).toBeGreaterThan(daysTo(10))
  })

  it('升级需要真实等待：购买后不会立刻完成', () => {
    const engine = new GameEngine(createInitialState())
    engine.debugUncapStorage()
    engine.debugAddAll(200000)
    expect(engine.build('canteen')).toBe(true)
    const task = engine.state.buildQueue[0]
    const total = task.endMinute - task.startMinute
    expect(total).toBeGreaterThan(MINUTES_PER_DAY) // 至少 1 个游戏日
    engine.advanceMinutes(total * 0.5)
    expect(engine.state.buildQueue.length).toBe(1)
    expect(engine.state.buildings.canteen.level).toBe(1)
    engine.advanceMinutes(total * 0.6)
    expect(engine.state.buildQueue.length).toBe(0)
    expect(engine.state.buildings.canteen.level).toBe(2)
  })

  it('科技研究时间在 600 ~ 21600 游戏分钟之间（1× 下 5 秒 ~ 3 分钟）', () => {
    for (const def of TECH_DEFS) {
      expect(def.researchMinutes, `${def.name} 研究时间过短`).toBeGreaterThanOrEqual(600)
      expect(def.researchMinutes, `${def.name} 研究时间过长`).toBeLessThanOrEqual(21600)
    }
  })
})
