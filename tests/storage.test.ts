import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState, normalizeState } from '../src/game/engine/state'
import { capacityOf } from '../src/game/engine/ResourceEngine'
import { clampToCapacity, grantResources } from '../src/game/engine/ResourceEngine'
import {
  BASE_STORAGE,
  MINUTES_PER_DAY,
  STORAGE_KEYS,
  buildingStorage,
  isStorableResource,
  storageBreakdown,
  tuitionPerMinute,
} from '../src/game/formulas'
import { BUILDING_MAP, BUILDING_DEFS } from '../src/data'

function makeEngine() {
  return new GameEngine(createInitialState())
}

/**
 * 仓储上限系统回归测试。
 * 设计目标：挂机不能无限囤资源（尤其是资金），事件与升级的花费才有重量；
 * 仓储类建筑（财务处 / 教材库 / 仪器库 / 器材库 / 道具库）负责提升上限。
 */
describe('仓储上限', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('只有资金 / 教学资源 / 科研点 / 体育点 / 文化点有上限，评价类资源没有', () => {
    for (const key of STORAGE_KEYS) expect(isStorableResource(key)).toBe(true)
    for (const key of ['reputation', 'activity', 'parentTrust', 'educationFund', 'influence'] as const) {
      expect(isStorableResource(key)).toBe(false)
    }
    expect(BASE_STORAGE.money).toBeGreaterThan(0)
  })

  it('开局资金上限约为 4~2 个游戏日的收入：挂机不能无限囤钱', () => {
    const state = createInitialState()
    state.school.rating = 32 // 开局评级（createInitialState 里还没算过）
    const info = storageBreakdown(state, BUILDING_MAP, 'money')
    expect(info.capped).toBe(true)
    // 基础 5 000 + 食堂 L1 250
    expect(info.total).toBeGreaterThan(5000)
    // 用真实开局收入衡量：攒满仓储需要 1~6 个游戏日（挂机不能无限囤钱）
    const perDay = (tuitionPerMinute(state as never) + (BUILDING_MAP.canteen.production?.money ?? 0) - 0.47) * 1440
    expect(info.total / perDay).toBeLessThanOrEqual(6)
    expect(info.total / perDay).toBeGreaterThanOrEqual(1)
  })

  it('产量到达上限后不再增长', () => {
    const engine = makeEngine()
    engine.advanceMinutes(MINUTES_PER_DAY * 30)
    for (const key of STORAGE_KEYS) {
      const cap = storageBreakdown(engine.state as never, BUILDING_MAP, key, engine.mods).total
      expect(engine.state.resources[key]).toBeLessThanOrEqual(cap + 0.001)
    }
    // 资金确实在上限处停住（而不是继续涨）
    const moneyCap = storageBreakdown(engine.state as never, BUILDING_MAP, 'money', engine.mods).total
    expect(engine.state.resources.money).toBeCloseTo(moneyCap, 0)
  })

  it('直接发放资源也会被上限裁剪', () => {
    const engine = makeEngine()
    grantResources(engine.state as never, { money: 9999999 })
    const cap = storageBreakdown(engine.state as never, BUILDING_MAP, 'money', engine.mods).total
    expect(engine.state.resources.money).toBeLessThanOrEqual(cap)
    // 不设上限的资源不受影响
    grantResources(engine.state as never, { reputation: 9999999 })
    expect(engine.state.resources.reputation).toBeGreaterThan(1000000)
  })

  it('财务处会显著提升资金上限（每级 ×1.5 增长）', () => {
    const state = createInitialState()
    const before = storageBreakdown(state, BUILDING_MAP, 'money').total
    state.buildings.financeOffice = { level: 1 }
    const atOne = storageBreakdown(state, BUILDING_MAP, 'money').total
    state.buildings.financeOffice = { level: 2 }
    const atTwo = storageBreakdown(state, BUILDING_MAP, 'money').total
    // 每级 ×1.5 增长：1 级贡献 2 500，2 级贡献 3 750
    expect(atOne - before).toBeCloseTo(2500, 0)
    expect(atTwo - before).toBeCloseTo(3750, 0)
    expect(buildingStorage(BUILDING_MAP.financeOffice, 3).money).toBeCloseTo(5625, 0)
    expect(BUILDING_MAP.financeOffice.storageGrowth).toBe(1.5)
  })

  it('五座仓储建筑分别对应五种资源', () => {
    const map = {
      financeOffice: 'money',
      textbookStore: 'teaching',
      instrumentStore: 'research',
      equipmentStore: 'sports',
      propStore: 'culture',
    } as const
    for (const [id, key] of Object.entries(map)) {
      const def = BUILDING_MAP[id]
      expect(def, `${id} 应该存在`).toBeDefined()
      expect(def.storage?.[key as keyof typeof def.storage]).toBeGreaterThan(0)
      expect(def.storageGrowth).toBeGreaterThan(1)
    }
  })

  it('仓储随等级提升，且附带仓储的建筑按等级线性累加', () => {
    const def = BUILDING_MAP.library
    const l1 = buildingStorage(def, 1).teaching ?? 0
    const l4 = buildingStorage(def, 4).teaching ?? 0
    expect(l4).toBeCloseTo(l1 * 4, 5)

    const finance = BUILDING_MAP.financeOffice
    const f1 = buildingStorage(finance, 1).money ?? 0
    const f3 = buildingStorage(finance, 3).money ?? 0
    expect(f3).toBeCloseTo(f1 * 2.25, 5)
  })

  it('升级成本不会超过当前仓储上限（保证不会卡死）', () => {
    const engine = makeEngine()
    // 允许玩家逐级攒钱：在只靠财务处提升上限的情况下，成本不应长期超过上限
    for (let level = 1; level <= 6; level += 1) {
      engine.debugBuild('financeOffice')
    }
    const cap = storageBreakdown(engine.state as never, BUILDING_MAP, 'money', engine.mods).total
    expect(cap).toBeGreaterThan(5000 + 2500 * 5)
  })

  it('旧存档里超上限的资源会被裁剪并提示', () => {
    const raw = JSON.parse(JSON.stringify(createInitialState())) as Record<string, unknown>
    ;(raw.resources as Record<string, number>).money = 9999999
    ;(raw.resources as Record<string, number>).reputation = 777
    const { state } = normalizeState(raw)
    const engine = new GameEngine(state)
    const cap = storageBreakdown(engine.state as never, BUILDING_MAP, 'money', engine.mods).total
    expect(engine.state.resources.money).toBeLessThanOrEqual(cap)
    // 评价类资源不会被裁剪
    expect(engine.state.resources.reputation).toBe(777)
  })

  it('离线收益同样受上限约束（不会带回来一堆溢出资源）', () => {
    const engine = makeEngine()
    engine.applyOffline(3600 * 8)
    for (const key of STORAGE_KEYS) {
      const cap = storageBreakdown(engine.state as never, BUILDING_MAP, key, engine.mods).total
      expect(engine.state.resources[key]).toBeLessThanOrEqual(cap + 0.001)
    }
  })

  it('容量查询与裁剪函数保持一致', () => {
    const engine = makeEngine()
    const cap = capacityOf(engine.state as never, 'money')
    expect(engine.state.resources.money).toBeLessThanOrEqual(cap)
    const clamped = clampToCapacity(engine.state as never, 'money', cap * 10)
    expect(clamped).toBeCloseTo(cap, 0)
    expect(capacityOf(engine.state as never, 'reputation')).toBe(Number.POSITIVE_INFINITY)
  })

  it('每栋建筑的仓储字段都是合法数值', () => {
    for (const def of BUILDING_DEFS) {
      for (const [key, value] of Object.entries(def.storage ?? {})) {
        expect(isStorableResource(key as never), `${def.name} 的 ${key} 不应该是可仓储资源`).toBe(true)
        expect(Number(value)).toBeGreaterThan(0)
      }
      if (def.storageGrowth != null) expect(def.storageGrowth).toBeGreaterThanOrEqual(1)
    }
  })
})
