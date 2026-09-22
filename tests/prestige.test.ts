import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { MINUTES_PER_DAY } from '../src/game/formulas'
import { LEGACY_NODES } from '../src/data'
import { collectPerkBonuses } from '../src/game/engine/LegacyEngine'

function makeEngine() {
  return new GameEngine(createInitialState())
}

describe('学园传承与离线收益', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('未满足条件时无法传承', () => {
    const engine = makeEngine()
    const preview = engine.prestigePreview()
    expect(preview.can).toBe(false)
    expect(engine.prestige()).toBe(false)
    expect(preview.reasons.length).toBeGreaterThan(0)
  })

  it('满足条件后传承会获得传承点并重置校园', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    engine.debugUnlockAll()
    engine.state.statistics.graduates = 400
    engine.state.statistics.competitionWins = 20
    engine.debugSetRating(70)
    engine.toggleCourse('chinese')
    engine.advanceMinutes(MINUTES_PER_DAY * 5)
    const preview = engine.prestigePreview()
    expect(preview.can).toBe(true)
    expect(preview.gain).toBeGreaterThan(0)
    const moneyBefore = engine.state.resources.money
    expect(engine.prestige()).toBe(true)
    expect(engine.state.legacy.points).toBeGreaterThanOrEqual(preview.gain)
    expect(engine.state.legacy.prestigeCount).toBe(1)
    expect(engine.state.time.minutes).toBe(0)
    expect(engine.state.resources.money).toBeLessThan(moneyBefore)
    expect(engine.state.statistics.graduates).toBe(400)
    expect(engine.state.technologies.modernTeaching.unlocked).toBe(false)
  })

  it('传承点可以购买传承节点，成本随等级上升', () => {
    const engine = makeEngine()
    engine.state.legacy.points = 1000
    const node = 'eduGrowth'
    expect(engine.buyLegacyNode(node)).toBe(true)
    const afterFirst = engine.state.legacy.points
    expect(engine.state.legacy.nodes[node]).toBe(1)
    expect(engine.buyLegacyNode(node)).toBe(true)
    const spentSecond = afterFirst - engine.state.legacy.points
    expect(spentSecond).toBeGreaterThan(1000 - afterFirst)
  })

  it('前置未满足时无法购买传承节点', () => {
    const engine = makeEngine()
    engine.state.legacy.points = 1000
    expect(engine.buyLegacyNode('mgnCapacity')).toBe(false)
    expect(engine.buyLegacyNode('mgnSpeed')).toBe(false)
    expect(engine.buyLegacyNode('mgnBudget')).toBe(true)
  })

  it('传承特性会写入 perks 并在下一轮提供开局能力', () => {
    const engine = makeEngine()
    engine.state.legacy.points = 5000
    for (const node of LEGACY_NODES) {
      if (node.perk) {
        // 直接跳过前置（测试用），模拟已解锁状态
        engine.state.legacy.nodes[node.id] = 1
        engine.state.legacy.perks[node.perk] = true
      }
    }
    const bonuses = collectPerkBonuses(engine.state.legacy)
    expect(bonuses.buildings.gym).toBe(1)
    expect(bonuses.technologies).toContain('schoolExchange')
    expect(bonuses.technologies).toContain('basicLab')
  })

  it('所有传承节点都有说明与合法的数值配置', () => {
    for (const node of LEGACY_NODES) {
      expect(node.name.length).toBeGreaterThan(0)
      expect(node.desc.length).toBeGreaterThan(0)
      expect(node.maxLevel).toBeGreaterThanOrEqual(1)
      expect(node.baseCost).toBeGreaterThan(0)
      expect(node.costGrowth).toBeGreaterThanOrEqual(1)
      const hasEffects = (node.effects?.length ?? 0) + (node.perLevelEffects?.length ?? 0) > 0
      expect(hasEffects || Boolean(node.perk)).toBe(true)
    }
  })

  it('离线收益会按比例结算资源并给出报告', () => {
    const engine = makeEngine()
    engine.toggleCourse('chinese')
    engine.state.resources.teaching = 5000
    const moneyBefore = engine.state.resources.money
    const result = engine.applyOffline(3600 * 4)
    expect(result).not.toBeNull()
    expect(result!.countedSeconds).toBeGreaterThan(0)
    expect(result!.gameDays).toBeGreaterThan(0)
    expect(engine.state.resources.money).toBeGreaterThan(moneyBefore)
    expect(result!.notes.length).toBeGreaterThan(0)
  })

  it('离线时间超过上限时会被截断', () => {
    const engine = makeEngine()
    const result = engine.applyOffline(3600 * 72)
    expect(result!.capped).toBe(true)
    expect(result!.countedSeconds).toBeLessThanOrEqual(3600 * 8 + 1)
  })

  it('离线不会让数值爆炸（等效推进受到强限制）', () => {
    const engine = makeEngine()
    const before = engine.state.time.minutes
    engine.applyOffline(3600 * 72)
    expect(engine.state.time.minutes).toBe(before)
    expect(engine.state.resources.money).toBeLessThan(500000)
  })
})
