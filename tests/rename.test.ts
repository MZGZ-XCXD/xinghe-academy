import { describe, expect, it } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState, normalizeState } from '../src/game/engine/state'
import { importSave } from '../src/game/engine/SaveEngine'

describe('校名与改名入口', () => {
  it('可以改校名，并写入存档（导出/导入后仍然保留）', () => {
    const engine = new GameEngine(createInitialState())
    expect(engine.state.school.name).toBe('星河实验学园')
    expect(engine.renameSchool('星见丘学园')).toBe(true)
    expect(engine.state.school.name).toBe('星见丘学园')

    const text = engine.exportSave()
    const loaded = importSave(text)
    expect(loaded?.state.school.name).toBe('星见丘学园')
  })

  it('会去掉多余空白并限制长度，空名字被拒绝', () => {
    const engine = new GameEngine(createInitialState())
    expect(engine.renameSchool('  未名  高级中学  ')).toBe(true)
    expect(engine.state.school.name).toBe('未名 高级中学')

    expect(engine.renameSchool('   ')).toBe(false)
    expect(engine.state.school.name).toBe('未名 高级中学')

    expect(engine.renameSchool('一'.repeat(40))).toBe(true)
    expect(engine.state.school.name.length).toBe(24)
  })

  it('改成同名时不会产生无意义更新', () => {
    const engine = new GameEngine(createInitialState())
    expect(engine.renameSchool('星河实验学园')).toBe(false)
  })

  it('旧存档里的自定义校名会被保留，非法校名会被兜底', () => {
    const raw = JSON.parse(engineJSON()) as Record<string, unknown>
    const school = raw.school as Record<string, unknown>
    school.name = '白鹭洲高级中学'
    expect(normalizeState(raw).state.school.name).toBe('白鹭洲高级中学')

    const broken = JSON.parse(engineJSON()) as Record<string, unknown>
    ;(broken.school as Record<string, unknown>).name = 42
    expect(normalizeState(broken).state.school.name.length).toBeGreaterThan(0)
  })
})

function engineJSON(): string {
  return new GameEngine(createInitialState()).exportSave()
}
