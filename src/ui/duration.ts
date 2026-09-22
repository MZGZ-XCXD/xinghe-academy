import { BASE_GAME_MINUTES_PER_REAL_SECOND, formatGameDays } from '../game/formulas'
import { computed } from 'vue'
import { gameState } from './game'
import { fmt } from './format'

/**
 * 资源速率统一按**现实时间**显示：
 * 游戏内的「每游戏分钟」乘以「1 现实分钟等于多少游戏分钟」，就是现实一分钟的产出。
 * 1× 速度下 1 现实秒 ≈ 0.08 游戏日，1 现实分钟 ≈ 5 游戏日。
 */
export function gameRateToRealMinute(gamePerMinute: number, ctx: SpeedContext): number {
  const speed = Math.max(0.1, Number(ctx.speed) || 1)
  return gamePerMinute * gameMinutesPerRealMinute(speed)
}

export function gameRateToRealSecond(gamePerMinute: number, ctx: SpeedContext): number {
  const speed = Math.max(0.1, Number(ctx.speed) || 1)
  return gamePerMinute * BASE_GAME_MINUTES_PER_REAL_SECOND * speed
}

/** 1 现实分钟对应多少游戏分钟（随速度变化） */
export function gameMinutesPerRealMinute(speed: number): number {
  return BASE_GAME_MINUTES_PER_REAL_SECOND * Math.max(0.1, speed || 1) * 60
}

/** 例如「+5.4K/分钟」 */
export function formatRealRate(gamePerMinute: number, ctx: SpeedContext): string {
  const perMinute = gameRateToRealMinute(gamePerMinute, ctx)
  const sign = perMinute > 0 ? '+' : ''
  const abs = Math.abs(perMinute)
  return `${sign}${abs >= 10 ? fmt(perMinute, 0) : fmt(perMinute, 2)}/分钟`
}

export function formatRealRateShort(gamePerMinute: number, ctx: SpeedContext): string {
  const perSecond = gameRateToRealSecond(gamePerMinute, ctx)
  const sign = perSecond > 0 ? '+' : ''
  const abs = Math.abs(perSecond)
  return `${sign}${abs >= 10 ? fmt(perSecond, 0) : fmt(perSecond, 2)}/秒`
}

/** 说明文字：现实时间与现实秒的换算关系 */
export function rateExplainer(ctx: SpeedContext): string {
  const speed = Math.max(0.1, ctx.speed || 1)
  const perSecond = BASE_GAME_MINUTES_PER_REAL_SECOND * speed
  return `当前 ${ctx.speed}× 速度：1 现实秒 ≈ ${(perSecond / 1440).toFixed(2)} 游戏日，1 现实分钟 ≈ ${((perSecond * 60) / 1440).toFixed(1)} 游戏日（速率均按现实分钟计）`
}

export interface SpeedContext {
  speed: number
  paused: boolean
}

/** 游戏分钟 → 现实秒（按当前速度） */
export function gameMinutesToRealSeconds(minutes: number, ctx: SpeedContext): number {
  const speed = Math.max(0.1, Number(ctx.speed) || 1)
  return Math.max(0, minutes) / (BASE_GAME_MINUTES_PER_REAL_SECOND * speed)
}

export function formatRealSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return '无限'
  const s = Math.max(0, seconds)
  if (s < 1) return '不到 1 秒'
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} 秒`
  const minutes = s / 60
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} 分钟`
  const hours = minutes / 60
  return `${hours.toFixed(hours < 10 ? 1 : 0)} 小时`
}

/** 游戏时长统一写成「游戏天数」（不再出现游戏分钟这类小单位） */
export function formatGameMinutes(minutes: number): string {
  return formatGameDays(minutes)
}

/**
 * 游戏内时长 → 「游戏天数（现实时间）」，例如「2.4 天（约 25 秒）」。
 * 界面里所有持续时间都用它：先给游戏里的天数，再给现实里要等多久。
 */
export function describeGameDuration(minutes: number, ctx: SpeedContext): string {
  const game = formatGameDays(minutes)
  if (ctx.paused) return `${game}（游戏已暂停）`
  if (!Number.isFinite(minutes)) return game
  return `${game}（约 ${formatRealSeconds(gameMinutesToRealSeconds(minutes, ctx))}）`
}

/** 紧凑写法，适合放在 tag / 卡片角标旁边 */
export function describeGameDurationShort(minutes: number, ctx: SpeedContext): string {
  if (ctx.paused) return '已暂停'
  if (!Number.isFinite(minutes)) return '无限'
  return `${formatGameDays(minutes)}（${formatRealSeconds(gameMinutesToRealSeconds(minutes, ctx))}）`
}

/** 组件里直接用它拿到当前速度上下文 */
export function useSpeedContext() {
  const state = gameState()
  return computed<SpeedContext>(() => ({ speed: state.time.speed, paused: state.time.paused }))
}

/** 把「现实分钟」换算成当前速度下的游戏分钟（用于说明 5 分钟 ≈ 多少游戏时间） */
export function realMinutesToGameMinutes(minutes: number, ctx: SpeedContext): number {
  const speed = Math.max(0.1, Number(ctx.speed) || 1)
  return minutes * 60 * BASE_GAME_MINUTES_PER_REAL_SECOND * speed
}
