export type NoticeKind = 'info' | 'good' | 'bad' | 'unlock' | 'card' | 'event'

export interface Notice {
  id: number
  text: string
  kind: NoticeKind
  minute: number
}

/** 引擎与 UI 之间的通知接口，避免引擎直接依赖任何 UI 代码。 */
export interface EngineHooks {
  notify(text: string, kind?: NoticeKind): void
  log(text: string, kind?: string): void
}
