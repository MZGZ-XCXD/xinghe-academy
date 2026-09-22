import { describe, expect, it } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState, CURRENT_SAVE_VERSION, normalizeState } from '../src/game/engine/state'
import { exportSave, importSave, migrate, serialize } from '../src/game/engine/SaveEngine'
import { MINUTES_PER_DAY } from '../src/game/formulas'

describe('存档系统', () => {
  it('导出与导入可以完整往返', () => {
    const engine = new GameEngine(createInitialState())
    engine.debugUncapStorage()
    engine.debugAddAll(12345)
    engine.toggleCourse('chinese')
    engine.advanceMinutes(MINUTES_PER_DAY)
    const text = engine.exportSave()
    const result = importSave(text)
    expect(result).not.toBeNull()
    expect(result!.state.resources.money).toBeCloseTo(engine.state.resources.money, 3)
    expect(result!.state.time.minutes).toBeCloseTo(engine.state.time.minutes, 5)
    expect(result!.state.courses.chinese.active).toBe(true)
  })

  it('base64 导出同样可以导入', () => {
    const engine = new GameEngine(createInitialState())
    const text = exportSave(engine.state as never, true)
    const result = importSave(text)
    expect(result).not.toBeNull()
    expect(result!.state.time.minutes).toBe(0)
  })

  it('存档中记录了版本号', () => {
    const engine = new GameEngine(createInitialState())
    const parsed = JSON.parse(serialize(engine.state as never)) as { saveVersion: number }
    expect(parsed.saveVersion).toBe(CURRENT_SAVE_VERSION)
  })

  it('v1 旧存档可以迁移且不会崩溃', () => {
    const legacySave = {
      saveVersion: 1,
      time: { minutes: 1000 },
      school: { name: '旧存档学园', policy: 'sportsFirst' },
      resources: { money: 5000, teaching: 200 },
      students: { total: 180, attributes: { academic: 40, sports: 30, arts: 25, research: 20, morality: 50, social: 40, health: 60, creativity: 30 } },
      teachers: { groups: [{ subject: 'math', count: 5, quality: 60, stress: 20, morale: 70 }] },
      buildings: { teachingBuilding: { level: 4 } },
    }
    const migrated = migrate(JSON.parse(JSON.stringify(legacySave)))
    const { state, warnings } = normalizeState(migrated)
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION)
    expect(warnings).toEqual([])
    const direct = normalizeState(JSON.parse(JSON.stringify(legacySave)))
    expect(direct.warnings.some((w) => w.includes('旧版本存档'))).toBe(true)
    expect(state.time.minutes).toBe(1000)
    expect(state.school.name).toBe('旧存档学园')
    expect(state.school.activePolicies).toContain('sportsFirst')
    expect(state.students.cohorts.length).toBe(3)
    expect(state.buildings.teachingBuilding.level).toBe(4)
    expect(state.resources.money).toBe(5000)
  })

  it('非法数值会被修正为安全值（防 NaN / Infinity 坏档）', () => {
    const broken = {
      saveVersion: 3,
      time: { minutes: Number.NaN },
      resources: { money: Number.POSITIVE_INFINITY, teaching: -999 },
      school: { name: 42 },
      students: {
        cohorts: [{ grade: 1, count: Number.NaN, attrs: { academic: Number.NEGATIVE_INFINITY }, stress: 500, satisfaction: -50 }],
      },
      buildings: { teachingBuilding: { level: 9999 }, unknownBuilding: { level: 3 } },
    }
    const { state } = normalizeState(broken)
    expect(Number.isFinite(state.time.minutes)).toBe(true)
    expect(Number.isFinite(state.resources.money)).toBe(true)
    expect(state.resources.teaching).toBeGreaterThanOrEqual(0)
    expect(state.school.name.length).toBeGreaterThan(0)
    expect(state.students.cohorts[0].stress).toBeLessThanOrEqual(100)
    expect(state.students.cohorts[0].satisfaction).toBeGreaterThanOrEqual(0)
    expect(state.buildings.teachingBuilding.level).toBeLessThanOrEqual(40)
    expect(state.buildings.unknownBuilding).toBeUndefined()
  })

  it('空内容 / 错误结构与未来版本都不会导致崩溃', () => {
    expect(normalizeState(null).state.time.minutes).toBe(0)
    expect(normalizeState('not a save').state.school.name.length).toBeGreaterThan(0)
    const future = { ...JSON.parse(serialize(createInitialState())), saveVersion: 99 }
    const { warnings } = normalizeState(future)
    expect(warnings.some((w) => w.includes('高于当前游戏版本'))).toBe(true)
  })

  it('非法文本导入会返回失败而不是抛异常', () => {
    expect(importSave('{ 这不是 JSON')).toBeNull()
    expect(importSave('')).toBeNull()
  })

  it('导入后会替换引擎状态', () => {
    const engine = new GameEngine(createInitialState())
    const other = new GameEngine(createInitialState({ schoolName: '另一所学园' }))
    other.debugUncapStorage()
    other.debugAddAll(999)
    const text = other.exportSave()
    const result = engine.importSave(text)
    expect(result.ok).toBe(true)
    expect(engine.state.school.name).toBe('另一所学园')
  })
})
