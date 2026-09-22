import type { GameEngine } from './engine/GameEngine'

/**
 * 开发用调试工具。
 * 只有在 URL 带 ?debug=1 或 localStorage.debug=1 时才会挂到 window 上，
 * 普通玩家界面不会出现这些入口。
 */
export interface DebugApi {
  unlockAll: () => void
  addResource: (key: string, amount: number) => void
  addAll: (amount?: number) => void
  build: (id: string) => void
  finishQueue: () => void
  advanceDay: (days?: number) => void
  advanceMonth: () => void
  advanceYear: () => void
  triggerEvent: (id?: string) => void
  prestige: () => void
  giveCard: (id?: string) => void
  giveAchievement: (id: string) => void
  setRating: (value: number) => void
  state: () => unknown
}

export function debugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('debug') === '1' || window.localStorage?.getItem('debug') === '1'
  } catch {
    return false
  }
}

export function attachDebug(engine: GameEngine): DebugApi {
  engine.debugEnabled = true
  const api: DebugApi = {
    unlockAll: () => engine.debugUnlockAll(),
    addResource: (key, amount) => engine.debugAddResource(key as never, amount),
    addAll: (amount) => engine.debugAddAll(amount),
    build: (id) => engine.debugBuild(id),
    finishQueue: () => engine.debugFinishQueue(),
    advanceDay: (days) => engine.debugAdvanceDay(days ?? 1),
    advanceMonth: () => engine.debugAdvanceMonth(),
    advanceYear: () => engine.debugAdvanceYear(),
    triggerEvent: (id) => engine.debugTriggerEvent(id),
    prestige: () => engine.debugPrestige(),
    giveCard: (id) => engine.debugGiveCard(id),
    giveAchievement: (id) => engine.debugGiveAchievement(id),
    setRating: (value) => engine.debugSetRating(value),
    state: () => JSON.parse(JSON.stringify(engine.state)),
  }
  if (typeof window !== 'undefined') {
    ;(window as unknown as { academyDebug: DebugApi }).academyDebug = api
  }
  return api
}
