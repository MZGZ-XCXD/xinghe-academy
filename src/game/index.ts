import { GameEngine } from './engine/GameEngine'
import { GameLoop } from './engine/GameLoop'
import { loadFromStorage, saveToStorage } from './engine/SaveEngine'
import { createInitialState } from './engine/state'
import { applyCustomContent } from '../data/custom'

export * from './types'
export * from './formulas'
export * from './engine/GameEngine'
export * from './engine/state'
export * from './engine/SaveEngine'
export * from './engine/OfflineEngine'
export * from './engine/ModifierIndex'
export * from './engine/BuildingEngine'
export * from './engine/CourseEngine'
export * from './engine/StudentEngine'
export * from './engine/TeacherEngine'
export * from './engine/TechEngine'
export * from './engine/PolicyEngine'
export * from './engine/ActivityEngine'
export * from './engine/CardEngine'
export * from './engine/EventEngine'
export * from './engine/AchievementEngine'
export * from './engine/LegacyEngine'
export * from './engine/hooks'
export { applyCustomContent } from '../data/custom'

export interface BootOptions {
  /** 是否读取本地存档 */
  loadSave?: boolean
  /** 是否启动主循环 */
  autoStart?: boolean
}

export interface BootedGame {
  engine: GameEngine
  loop: GameLoop
  warnings: string[]
}

/**
 * 创建游戏实例：读取存档 → 结算离线收益 → 启动主循环。
 * 任何一步出错都不会导致白屏，而是回退到新学园。
 */
export function createGame(options: BootOptions = {}): BootedGame {
  // 先注册自定义内容，保证读取存档（normalizeState）时也能识别新条目
  const warnings: string[] = [...applyCustomContent()]
  let state = createInitialState()
  let lastSavedAt = 0

  if (options.loadSave !== false) {
    try {
      const loaded = loadFromStorage()
      if (loaded) {
        state = loaded.state
        lastSavedAt = loaded.state.meta.lastSavedAt
        warnings.push(...loaded.warnings)
      }
    } catch (error) {
      warnings.push(`存档读取失败：${(error as Error).message}`)
    }
  }

  const engine = new GameEngine(state)
  if (warnings.length > 0) {
    for (const warning of warnings) engine.notify(warning, 'bad')
  }

  if (lastSavedAt > 0) {
    const elapsedSeconds = Math.max(0, (Date.now() - lastSavedAt) / 1000)
    if (elapsedSeconds > 60) {
      try {
        engine.applyOffline(elapsedSeconds)
      } catch (error) {
        engine.notify(`离线结算失败：${(error as Error).message}`, 'bad')
      }
    }
  }

  const loop = new GameLoop({
    intervalMs: 250,
    maxDeltaSeconds: 5,
    onFrame: (dt) => {
      try {
        engine.tickReal(dt)
      } catch (error) {
        console.error('[GameLoop] tick 失败', error)
        engine.notify(`游戏循环出现异常：${(error as Error).message}`, 'bad')
      }
    },
  })

  if (options.autoStart !== false) loop.start()
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      try {
        saveToStorage(engine.state)
      } catch {
        /* 忽略 */
      }
    })
  }

  return { engine, loop, warnings }
}

export type { GameEngine as GameEngineType }
