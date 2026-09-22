import type { CardDef, CardPool, GameState } from '../types'
import { CARD_DEFS, CARD_MAP, RARITY_WEIGHT } from '../../data'
import { cardDuration, cardDrawChance, safeNumber } from '../formulas'
import type { ModifierIndex } from './ModifierIndex'
import type { EngineHooks } from './hooks'

export function cardsInPool(pool: CardPool, state: GameState): CardDef[] {
  const acquired = new Set(state.cards.history.map((h) => h.cardId))
  const candidates = CARD_DEFS.filter((c) => c.pools.includes(pool) || c.pools.includes('any'))
  const filtered = candidates.filter((c) => !(c.once && acquired.has(c.id)))
  return filtered.length > 0 ? filtered : candidates
}

function pickWeighted(defs: CardDef[]): CardDef | null {
  const weights = defs.map((d) => RARITY_WEIGHT[d.rarity] ?? 10)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return defs[0] ?? null
  let roll = Math.random() * total
  for (let i = 0; i < defs.length; i += 1) {
    roll -= weights[i]
    if (roll <= 0) return defs[i]
  }
  return defs[defs.length - 1] ?? null
}

/** 产生一次「三选一」效果卡机会 */
export function drawOffer(
  state: GameState,
  pool: CardPool,
  count: number,
  source: string,
  mods: ModifierIndex,
  hooks: EngineHooks,
): void {
  if (Math.random() > cardDrawChance(1, mods)) return
  const candidates = cardsInPool(pool, state)
  if (candidates.length === 0) return
  const picked: CardDef[] = []
  const poolCopy = [...candidates]
  const want = Math.max(1, Math.min(count, poolCopy.length))
  for (let i = 0; i < want; i += 1) {
    const card = pickWeighted(poolCopy)
    if (!card) break
    picked.push(card)
    poolCopy.splice(poolCopy.indexOf(card), 1)
  }
  if (picked.length === 0) return
  state.cards.offers.push({
    uid: `offer_${Math.round(state.time.minutes)}_${Math.round(Math.random() * 1e6)}`,
    pool,
    cardIds: picked.map((c) => c.id),
    createdAtMinute: state.time.minutes,
    source,
  })
  hooks.notify(`${source}：获得 ${picked.length} 张效果卡候选，请选择 1 张。`, 'card')
}

/** 按概率产生效果卡（活动结算用） */
export function maybeGrantCard(
  state: GameState,
  pool: CardPool,
  chance: number,
  source: string,
  mods: ModifierIndex,
  hooks: EngineHooks,
): boolean {
  const finalChance = cardDrawChance(chance, mods)
  if (Math.random() > finalChance) return false
  drawOffer(state, pool, 3, source, mods, hooks)
  return true
}

export function chooseCard(
  state: GameState,
  offerUid: string,
  index: number,
  mods: ModifierIndex,
  hooks: EngineHooks,
): boolean {
  const offerIndex = state.cards.offers.findIndex((o) => o.uid === offerUid)
  if (offerIndex < 0) return false
  const offer = state.cards.offers[offerIndex]
  const cardId = offer.cardIds[index]
  const def = CARD_MAP[cardId]
  if (!def) return false
  const duration = cardDuration(def, mods)
  state.cards.active.push({
    uid: `card_${Math.round(state.time.minutes)}_${Math.round(Math.random() * 1e6)}`,
    cardId,
    acquiredAtMinute: state.time.minutes,
    expiresAtMinute: duration != null ? state.time.minutes + duration : null,
    usesLeft: def.uses ?? null,
  })
  state.cards.offers.splice(offerIndex, 1)
  state.cards.history.push({ cardId, minute: state.time.minutes })
  state.statistics.cardsGained += 1
  if (def.rarity === '传奇') state.statistics.flags.gotLegendaryCard = true
  hooks.notify(`获得效果卡：${def.name}`, 'card')
  hooks.log(`获得效果卡：${def.name}`, 'card')
  return true
}

export function discardOffer(state: GameState, offerUid: string): void {
  state.cards.offers = state.cards.offers.filter((o) => o.uid !== offerUid)
}

export function tickCards(state: GameState, hooks: EngineHooks): void {
  const before = state.cards.active.length
  state.cards.active = state.cards.active.filter(
    (c) => (c.expiresAtMinute == null || c.expiresAtMinute > state.time.minutes) && (c.usesLeft == null || c.usesLeft > 0),
  )
  if (state.cards.active.length !== before) {
    hooks.notify('部分效果卡已到期。', 'info')
  }
}

/** 活动结算时消耗有次数限制的效果卡 */
export function consumeCardUses(state: GameState): void {
  for (const card of state.cards.active) {
    if (card.usesLeft != null && card.usesLeft > 0) card.usesLeft -= 1
  }
  state.cards.active = state.cards.active.filter((c) => c.usesLeft == null || c.usesLeft > 0)
}

export function activeCardSummaries(state: GameState) {
  return state.cards.active.map((card) => {
    const def = CARD_MAP[card.cardId]
    const remaining = card.expiresAtMinute != null ? Math.max(0, card.expiresAtMinute - state.time.minutes) : null
    return {
      uid: card.uid,
      def,
      remainingMinutes: remaining,
      usesLeft: card.usesLeft,
    }
  })
}

export function cardEffectText(def: CardDef | undefined): string[] {
  if (!def) return []
  return def.effects.map((e) => `${e.target} ${e.op === 'mul' ? `${(e.value * 100).toFixed(0)}%` : `+${e.value}`}`)
}

export function totalCardsOwned(state: GameState): number {
  return safeNumber(state.cards.history.length, 0)
}
