import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { clearPreviewCache, previewChoice } from '../src/game/engine/EventPreview'
import { EVENT_MIN_REAL_SECONDS, eventTimeRemaining } from '../src/game/engine/EventEngine'
import { EVENT_DEFS, EVENT_MAP, RESOURCE_MAP } from '../src/data'
import { MINUTES_PER_DAY } from '../src/game/formulas'

function makeEngine() {
  return new GameEngine(createInitialState())
}

describe('事件结算预览与处理时间', () => {
  beforeEach(() => {
    clearPreviewCache()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('每一个事件选项都能算出结算预览，且不会抛异常', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    const state = engine.state
    let checked = 0
    for (const def of EVENT_DEFS) {
      for (const choice of def.choices) {
        const preview = previewChoice(state as never, choice, `${def.id}:${choice.label}`, 0)
        checked += 1
        expect(Array.isArray(preview.costs)).toBe(true)
        expect(Array.isArray(preview.gains)).toBe(true)
        expect(choice.label.length).toBeGreaterThan(0)
      }
    }
    expect(checked).toBeGreaterThanOrEqual(90)
  })

  it('绝大多数选项都会明确列出代价或后果', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    const silent: string[] = []
    for (const def of EVENT_DEFS) {
      def.choices.forEach((choice) => {
        const preview = previewChoice(engine.state as never, choice, `${def.id}:${choice.label}`, 0)
        const hasInfo =
          preview.costs.length +
            preview.gains.length +
            preview.students.length +
            preview.teachers.length +
            preview.effects.length +
            preview.delayed.length +
            preview.notes.length >
          0
        if (!hasInfo) silent.push(`${def.id} / ${choice.label}`)
      })
    }
    expect(silent).toEqual([])
  })

  it('代价与收益的数值和真实结算一致（含资源清零边界）', () => {
    const engine = makeEngine()
    engine.state.resources.money = 5000
    const choice = EVENT_MAP.canteenComplaint.choices[0]
    const preview = previewChoice(engine.state as never, choice, 'canteen', 0)
    const money = preview.costs.find((line) => line.key === 'money')
    expect(money?.value).toBeCloseTo(-1200, 5)
    const trust = preview.gains.find((line) => line.key === 'parentTrust')
    expect(trust?.value).toBeCloseTo(15, 5)
    const satisfaction = preview.students.find((line) => line.key === 'satisfaction')
    expect(satisfaction?.value).toBeCloseTo(7, 5)

    // 资源不足时预览反映真实的清零结果，而不是显示一个付不起的数字
    const poor = makeEngine()
    poor.state.resources.money = 300
    const clipped = previewChoice(poor.state as never, choice, 'canteen-poor', 0)
    expect(clipped.costs.find((line) => line.key === 'money')?.value).toBeCloseTo(-300, 5)
  })

  it('选项的延迟后续与效果卡奖励也会写进预览', () => {
    const engine = makeEngine()
    const research = EVENT_MAP.teacherResearch.choices[0]
    const preview = previewChoice(engine.state as never, research, 'research', 0)
    expect(preview.delayed.some((line) => line.includes('课题进入关键期'))).toBe(true)
  })

  it('新触发的事件至少有 5 分钟现实时间可以处理', () => {
    const engine = makeEngine()
    const before = Date.now()
    engine.debugTriggerEvent('clubConflict')
    const event = engine.state.events.active[0]
    expect(event.expiresAtEpoch).toBeDefined()
    expect(event.expiresAtEpoch! - before).toBeGreaterThanOrEqual(EVENT_MIN_REAL_SECONDS * 1000 - 50)
    const info = eventTimeRemaining(engine.state as never, event)
    expect(info.realSeconds).toBeGreaterThanOrEqual(EVENT_MIN_REAL_SECONDS - 1)
  })

  it('即使游戏时间推进很久，现实时间下限没到就不会自动处理事件', () => {
    const engine = makeEngine()
    engine.debugTriggerEvent('clubConflict')
    const uid = engine.state.events.active[0].uid
    engine.state.resources.teaching = 100000
    engine.state.resources.money = 100000
    // 推进 200 个游戏日（远超旧的 5 天自动结束时间），但现实只过了几毫秒
    engine.advanceMinutes(MINUTES_PER_DAY * 200)
    expect(engine.state.events.active.some((e) => e.uid === uid)).toBe(true)
  })

  it('游戏时间与现实时间都到期后，事件才会自动结算并写入日志', () => {
    const engine = makeEngine()
    engine.debugTriggerEvent('clubConflict')
    const event = engine.state.events.active[0]
    const logBefore = engine.state.events.log.length
    // 现实时间下限已过
    event.expiresAtEpoch = Date.now() - 1000
    engine.advanceMinutes(MINUTES_PER_DAY * 200)
    expect(engine.state.events.active.some((e) => e.uid === event.uid)).toBe(false)
    expect(engine.state.events.log.length).toBeGreaterThan(logBefore)
  })

  it('游戏暂停时事件不会自动结束', () => {
    const engine = makeEngine()
    engine.debugTriggerEvent('clubConflict')
    const event = engine.state.events.active[0]
    engine.state.time.paused = true
    const info = eventTimeRemaining(engine.state as never, event)
    expect(info.paused).toBe(true)
    expect(Number.isFinite(info.realSeconds)).toBe(false)
  })

  it('所有资源名称都能在预览里正常显示', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(50000)
    for (const def of EVENT_DEFS.slice(0, 12)) {
      for (const choice of def.choices) {
        const preview = previewChoice(engine.state as never, choice, `${def.id}:${choice.label}`, 0)
        for (const line of [...preview.costs, ...preview.gains]) {
          expect(RESOURCE_MAP[line.key as keyof typeof RESOURCE_MAP]?.name).toBeTruthy()
        }
      }
    }
  })
})
