import type { GameState } from '../types'
import {
  BUILDING_MAP,
  BUILDING_DEFS,
  CARD_MAP,
  LEGACY_NODES,
  POLICY_MAP,
  SYNERGY_DEFS,
  TECH_MAP,
} from '../../data'
import { activeSynergies, buildingEffectContributions } from '../formulas'
import { CLUB_DEFS } from '../../data'
import { TEAM_DEFS } from '../../data'
import type { ModifierIndex } from './ModifierIndex'
import { collectSeasonModifiers } from './TimeEngine'

/**
 * 汇总全部加成来源。
 * 顺序会影响 Tooltip 的可读性，但不影响总数值。
 */
export function collectModifiers(state: GameState, mods: ModifierIndex): void {
  mods.reset()
  const now = state.time.minutes

  // 1. 建筑（含每级效果）
  for (const def of BUILDING_DEFS) {
    const level = state.buildings[def.id]?.level ?? 0
    for (const e of buildingEffectContributions(def, level)) {
      mods.push(e.target, e.op, e.value, e.source)
    }
  }

  // 2. 建筑联动
  for (const synergy of activeSynergies(SYNERGY_DEFS, state.buildings)) {
    for (const e of synergy.effects) {
      mods.push(e.target, e.op, e.value, `联动·${synergy.name}`)
    }
  }

  // 3. 科技
  for (const [id, techState] of Object.entries(state.technologies)) {
    if (!techState.unlocked) continue
    const def = TECH_MAP[id]
    if (!def) continue
    for (const e of def.effects ?? []) mods.push(e.target, e.op, e.value, `科技·${def.name}`)
  }

  // 4. 校规
  for (const id of state.school.activePolicies) {
    const def = POLICY_MAP[id]
    if (!def) continue
    for (const e of def.effects) mods.push(e.target, e.op, e.value, `校规·${def.name}`)
  }

  // 5. 效果卡
  for (const card of state.cards.active) {
    const def = CARD_MAP[card.cardId]
    if (!def) continue
    if (card.expiresAtMinute != null && card.expiresAtMinute <= now) continue
    if (card.usesLeft != null && card.usesLeft <= 0) continue
    for (const e of def.effects) mods.push(e.target, e.op, e.value, `效果卡·${def.name}`)
  }

  // 6. 传承树
  for (const node of LEGACY_NODES) {
    const level = state.legacy.nodes[node.id] ?? 0
    if (level <= 0) continue
    for (const e of node.perLevelEffects ?? []) {
      mods.push(e.target, e.op, e.value * level, `传承·${node.name} Lv.${level}`)
    }
    for (const e of node.effects ?? []) mods.push(e.target, e.op, e.value, `传承·${node.name}`)
  }

  // 7. 事件 / 成就授予的永久加成
  for (const e of state.school.permanentEffects) {
    mods.push(e.target, e.op, e.value, '永久加成')
  }

  // 7.5 社团（部活）
  for (const def of CLUB_DEFS) {
    const level = state.clubs?.[def.id]?.level ?? 0
    if (level <= 0) continue
    for (const e of def.effects ?? []) mods.push(e.target, e.op, e.value, `社团·${def.name}`)
    for (const e of def.perLevelEffects ?? []) {
      mods.push(e.target, e.op, e.value * level, `社团·${def.name} Lv.${level}`)
    }
  }

  // 7.6 校队
  for (const def of TEAM_DEFS) {
    const entry = state.teams?.[def.id]
    if (!entry?.founded) continue
    for (const e of def.effects ?? []) mods.push(e.target, e.op, e.value, `校队·${def.shortName}`)
    for (const e of def.perLevelEffects ?? []) {
      mods.push(e.target, e.op, e.value * entry.level, `校队·${def.shortName} Lv.${entry.level}`)
    }
  }

  // 8. 季节
  collectSeasonModifiers(state, mods)

  // 9. 学校评级带来的软加成（评级越高，社会资源越容易流入）
  const ratingBonus = Math.max(0, (state.school.rating - 30) / 1000)
  if (ratingBonus > 0) {
    mods.push('money_rate', 'mul', ratingBonus, '学校评级')
    mods.push('reputation_rate', 'mul', ratingBonus, '学校评级')
  }
}

/** 供 UI 展示：某个建筑当前是否提供加成 */
export function buildingEffectSummary(id: string, level: number): string[] {
  const def = BUILDING_MAP[id]
  if (!def) return []
  return buildingEffectContributions(def, level).map((e) => `${e.source}：${e.target} ${e.value > 0 ? '+' : ''}${e.value}`)
}
