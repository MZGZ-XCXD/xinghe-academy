import { createGame, type BootedGame } from '../game'
import { debugEnabled, attachDebug } from '../game/debug'
import type { GameState } from '../game/types'

let booted: BootedGame | null = null

export function bootGame(): BootedGame {
  if (!booted) {
    booted = createGame({ loadSave: true, autoStart: true })
    if (debugEnabled()) {
      attachDebug(booted.engine)
      booted.engine.debugEnabled = true
    }
  }
  return booted
}

export function gameEngine() {
  return bootGame().engine
}

/**
 * 返回带类型的响应式状态引用。
 * 运行时对象依旧是 Vue 的 reactive 代理，因此模板中的读取仍会被追踪。
 */
export function gameState(): GameState {
  return gameEngine().state as unknown as GameState
}

/** 关闭主循环（单元测试与热更新时使用） */
export function stopGame(): void {
  booted?.loop.stop()
  booted = null
}
