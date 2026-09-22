import type { GameEngine } from '../src/game/engine/GameEngine'
import { allocateCourses } from '../src/game/engine/CourseEngine'
import type { GameState } from '../src/game/types'

export function allocationReport(engine: GameEngine) {
  const allocations = allocateCourses(engine.state as GameState)
  return {
    courses: allocations.length,
    served: allocations.reduce((sum, a) => sum + a.served, 0),
  }
}
