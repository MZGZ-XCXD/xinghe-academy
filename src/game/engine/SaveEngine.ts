import type { GameState } from '../types'
import { CURRENT_SAVE_VERSION, normalizeState } from './state'

export const SAVE_KEY = 'xinghe-academy-save'
export const BACKUP_KEY = 'xinghe-academy-save-backup'

export interface LoadResult {
  state: GameState
  warnings: string[]
  source: 'slot' | 'backup' | 'new'
}

export function serialize(state: GameState): string {
  state.meta.lastSavedAt = Date.now()
  state.meta.version = CURRENT_SAVE_VERSION
  state.saveVersion = CURRENT_SAVE_VERSION
  return JSON.stringify(state)
}

export function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function saveToStorage(state: GameState): boolean {
  if (!storageAvailable()) return false
  try {
    const previous = localStorage.getItem(SAVE_KEY)
    const payload = serialize(state)
    localStorage.setItem(SAVE_KEY, payload)
    if (previous) localStorage.setItem(BACKUP_KEY, previous)
    return true
  } catch (error) {
    console.warn('[存档] 写入失败', error)
    return false
  }
}

export function loadFromStorage(): LoadResult | null {
  if (!storageAvailable()) return null
  const raw = localStorage.getItem(SAVE_KEY)
  if (raw) {
    const parsed = parseSaveText(raw)
    if (parsed) return { state: parsed.state, warnings: parsed.warnings, source: 'slot' }
  }
  const backup = localStorage.getItem(BACKUP_KEY)
  if (backup) {
    const parsed = parseSaveText(backup)
    if (parsed) {
      return {
        state: parsed.state,
        warnings: [...parsed.warnings, '主存档损坏，已自动读取上一次的备份存档。'],
        source: 'backup',
      }
    }
  }
  return null
}

export function clearStorage(): void {
  clearAllStorage()
}

/**
 * 清空全部存档：主存档与备份槽一起删除（用于「清空全部存档」按钮）。
 * 返回实际删除的键，便于界面提示。
 */
export function clearAllStorage(): string[] {
  if (!storageAvailable()) return []
  const removed: string[] = []
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      if (localStorage.getItem(key) !== null) removed.push(key)
      localStorage.removeItem(key)
    } catch {
      /* 忽略单个键的失败，继续清理其余键 */
    }
  }
  return removed
}

export function parseSaveText(text: string): { state: GameState; warnings: string[] } | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  let jsonText = trimmed
  if (!trimmed.startsWith('{')) {
    // 兼容 base64 压缩导出
    try {
      jsonText = decodeBase64(trimmed)
    } catch {
      return null
    }
  }
  try {
    const raw = JSON.parse(jsonText) as unknown
    const migrated = migrate(JSON.parse(JSON.stringify(raw)) as Record<string, unknown>)
    return normalizeState(migrated)
  } catch (error) {
    console.warn('[存档] 解析失败', error)
    return null
  }
}

/** 导出存档：给出可直接复制的 JSON 字符串 */
export function exportSave(state: GameState, asBase64 = false): string {
  const payload = serialize(state)
  return asBase64 ? encodeBase64(payload) : payload
}

export function importSave(text: string): { state: GameState; warnings: string[] } | null {
  return parseSaveText(text)
}

/**
 * 版本迁移入口。
 * 旧存档缺少的字段由 normalizeState 补全；这里负责结构性的字段改名与类型转换。
 */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = Number(raw.saveVersion ?? raw.version ?? 1)
  const data = raw

  if (version < 2) {
    // v1 → v2：学生属性曾经存放在 students.attributes，现改为按年级分群体存储
    const students = data.students as Record<string, unknown> | undefined
    if (students && !students.cohorts && students.attributes) {
      const attrs = students.attributes as Record<string, number>
      const total = Number(students.total ?? 120)
      students.cohorts = [1, 2, 3].map((grade, index) => ({
        grade,
        count: Math.round(total / 3),
        attrs,
        stress: 35 + index * 2,
        satisfaction: 60,
      }))
    }
    data.saveVersion = 2
  }

  if (version < 3) {
    // v2 → v3：校规由单一字段改为数组，并引入永久加成列表
    const school = data.school as Record<string, unknown> | undefined
    if (school) {
      if (typeof school.policy === 'string') school.activePolicies = [school.policy]
      if (!Array.isArray(school.activePolicies)) school.activePolicies = []
      if (!Array.isArray(school.permanentEffects)) school.permanentEffects = []
      if (typeof school.policySlots !== 'number') school.policySlots = 2
    }
    const stats = data.statistics as Record<string, unknown> | undefined
    if (stats && !stats.yearSnapshot) {
      stats.yearSnapshot = {
        moneyEarned: 0,
        moneySpent: 0,
        graduates: 0,
        wins: 0,
        competitions: 0,
        eventsResolved: 0,
      }
    }
    data.saveVersion = 3
  }

  return data
}

function encodeBase64(text: string): string {
  if (typeof btoa === 'function') {
    try {
      return btoa(unescape(encodeURIComponent(text)))
    } catch {
      /* 继续尝试 Node 环境 */
    }
  }
  const maybeBuffer = (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer
  if (maybeBuffer) return maybeBuffer.from(text, 'utf-8').toString('base64')
  return text
}

function decodeBase64(text: string): string {
  if (typeof atob === 'function') {
    try {
      return decodeURIComponent(escape(atob(text)))
    } catch {
      /* 继续尝试 Node 环境 */
    }
  }
  const maybeBuffer = (globalThis as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer
  if (maybeBuffer) return maybeBuffer.from(text, 'base64').toString('utf-8')
  throw new Error('无法解码 base64 存档')
}

export function saveSizeBytes(state: GameState): number {
  return serialize(state).length
}
