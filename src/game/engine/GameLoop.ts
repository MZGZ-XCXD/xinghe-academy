/**
 * 真实时间驱动器。
 * 使用固定间隔 + 真实时间差，保证在后台标签页被节流后仍能正确推进（不会漏算时间）。
 */
export interface LoopOptions {
  intervalMs?: number
  /** 单帧最大推进的真实秒数，防止切回标签页时一次性推进过多 */
  maxDeltaSeconds?: number
  onFrame: (dtSeconds: number) => void
}

export class GameLoop {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastTime = 0
  private readonly intervalMs: number
  private readonly maxDeltaSeconds: number
  private readonly onFrame: (dtSeconds: number) => void

  constructor(options: LoopOptions) {
    this.intervalMs = options.intervalMs ?? 250
    this.maxDeltaSeconds = options.maxDeltaSeconds ?? 5
    this.onFrame = options.onFrame
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer !== null) return
    this.lastTime = Date.now()
    this.timer = setInterval(() => this.tick(), this.intervalMs)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibility)
    }
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibility)
    }
  }

  private tick(): void {
    const now = Date.now()
    const dtSeconds = Math.min(this.maxDeltaSeconds, Math.max(0, (now - this.lastTime) / 1000))
    this.lastTime = now
    if (dtSeconds <= 0) return
    this.onFrame(dtSeconds)
  }

  private handleVisibility = (): void => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'visible') {
      this.lastTime = Date.now()
    }
  }
}
