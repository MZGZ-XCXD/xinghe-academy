<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { CARD_MAP } from '../data'
import { effectText, fmt, fmtMinutes } from '../ui/format'
import GameIcon from './GameIcon.vue'
import { describeGameDuration, useSpeedContext } from '../ui/duration'

const engine = gameEngine()
const state = gameState()
const speedCtx = useSpeedContext()

const offer = computed(() => state.cards.offers[0] ?? null)
const cards = computed(() =>
  (offer.value?.cardIds ?? []).map((id) => CARD_MAP[id]).filter((card) => Boolean(card)),
)
</script>

<template>
  <Transition name="modal-fade">
  <div v-if="offer" class="modal-backdrop">
    <div class="modal">
      <h2>🎴 效果卡三选一</h2>
      <div class="muted small">
        来源：{{ offer.source }} · 只能选择 1 张，其余将消失。持续时间以游戏时间计算。
      </div>
      <div class="choices">
        <button
          v-for="(card, index) in cards"
          :key="card!.id"
          class="choice"
          @click="engine.chooseCard(offer.uid, index)"
        >
          <div class="row between">
            <span class="label" :class="`rarity-${card!.rarity}`"><GameIcon :value="card!.icon" :size="20" /> {{ card!.name }}</span>
            <span class="tag">{{ card!.rarity }}</span>
          </div>
          <div class="small muted">{{ card!.desc }}</div>
          <div class="row wrap" style="margin-top: 6px">
            <span v-for="effect in card!.effects" :key="effect.target" class="tag good">
              {{ effectText(effect.target, effect.op, effect.value) }}
            </span>
            <span v-if="card!.durationMinutes" class="tag">
              持续 {{ describeGameDuration(card!.durationMinutes, speedCtx) }}
            </span>
            <span v-if="card!.uses" class="tag">{{ card!.uses }} 次</span>
          </div>
        </button>
      </div>
      <div class="row between" style="margin-top: 12px">
        <span class="small muted">今日已获得卡片：{{ fmt(state.cards.history.length) }} 张</span>
        <button class="btn ghost small" @click="engine.discardOffer(offer.uid)">全部放弃</button>
      </div>
    </div>
  </div>
  </Transition>
</template>
