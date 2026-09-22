import { EFFECT_META, STUDENT_ATTR_META, type EffectTarget, type ResourceKey } from '../game/types'
import { RESOURCE_MAP } from '../data/resources'
import { MINUTES_PER_DAY } from '../game/formulas'

export function fmt(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (abs >= 10000) return `${(value / 1000).toFixed(1)}K`
  return value.toFixed(digits)
}

export function fmtRate(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${fmt(value, Math.abs(value) < 10 ? 2 : 0)}/分钟`
}

export function fmtSigned(value: number, digits = 0): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${fmt(value, digits)}`
}

export function fmtMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} 分钟`
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (hours < 24) return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours > 0 ? `${days} 天 ${restHours} 小时` : `${days} 天`
}

export function fmtDays(minutes: number): string {
  return `${(minutes / MINUTES_PER_DAY).toFixed(1)} 天`
}

export function fmtPercent(value: number, digits = 0): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(digits)}%`
}

export function resourceName(key: ResourceKey): string {
  return RESOURCE_MAP[key]?.name ?? key
}

export function resourceIcon(key: ResourceKey): string {
  return RESOURCE_MAP[key]?.icon ?? '❔'
}

/** 把加成定义转成人类可读文字 */
export function effectText(target: string, op: 'add' | 'mul', value: number): string {
  const meta = EFFECT_META[target as EffectTarget]
  const label = meta?.label ?? target
  if (op === 'add') return `${label} ${value > 0 ? '+' : ''}${value}`
  return `${label} ${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`
}

export function statusClass(value: number, goodHigh = true): string {
  const v = goodHigh ? value : 100 - value
  if (v >= 75) return 'good'
  if (v >= 50) return 'ok'
  if (v >= 30) return 'warn'
  return 'bad'
}

const STUDENT_STAT_LABELS: Record<string, string> = {
  ...STUDENT_ATTR_META.reduce<Record<string, string>>((acc, meta) => {
    acc[meta.key] = `${meta.icon}${meta.name}`
    return acc
  }, {}),
  stress: '😖压力',
  satisfaction: '🙂满意度',
}

export function studentStatLabel(key: string): string {
  return STUDENT_STAT_LABELS[key] ?? key
}
