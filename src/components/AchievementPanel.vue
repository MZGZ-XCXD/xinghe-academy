<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { ACHIEVEMENT_DEFS } from '../data'
import { achievementSummary } from '../game/engine/AchievementEngine'
import { effectText, fmt } from '../ui/format'
import GameIcon from './GameIcon.vue'

const engine = gameEngine()
const state = gameState()
const filter = ref('全部')
const tiers = ['全部', '普通', '隐藏', '长期', '极难']

const summary = computed(() => achievementSummary(state))
const list = computed(() =>
  ACHIEVEMENT_DEFS.filter((def) => filter.value === '全部' || def.tier === filter.value).map((def) => {
    const unlocked = state.achievements[def.id]?.unlocked === true
    return { def, unlocked, disguised: def.hidden === true && !unlocked }
  }),
)

void engine
</script>

<template>
  <div class="panel">
    <h3>
      🏅 成就
      <span class="tag">{{ summary.unlocked }} / {{ summary.total }}</span>
    </h3>
    <div class="bar" style="margin-bottom: 10px"><span :style="{ width: `${(summary.ratio * 100).toFixed(1)}%` }"></span></div>
    <div class="row wrap" style="margin-bottom: 10px">
      <button
        v-for="tier in tiers"
        :key="tier"
        class="btn small"
        :class="{ primary: filter === tier }"
        @click="filter = tier"
      >
        {{ tier }}
      </button>
    </div>
    <div class="grid cols-2">
      <div v-for="item in list" :key="item.def.id" class="card" :class="{ active: item.unlocked }">
        <div class="title">
          <span><GameIcon :value="item.def.icon ?? (item.unlocked ? '🏅' : '🔒')" :size="18" /></span>
          <span :class="`rarity-${item.def.tier}`">{{ item.disguised ? '？？？' : item.def.name }}</span>
          <span class="level">{{ item.def.tier }}</span>
        </div>
        <div class="small muted">
          {{ item.disguised ? '隐藏成就：达成条件后显示。' : item.def.desc }}
        </div>
        <div v-if="item.def.reward" class="row wrap">
          <span v-if="item.def.reward.legacyPoints" class="tag gold">传承点 +{{ item.def.reward.legacyPoints }}</span>
          <span v-for="(value, key) in item.def.reward.resources" :key="key" class="tag">
            {{ key }} +{{ fmt(Number(value)) }}
          </span>
          <span v-for="effect in item.def.reward.effects ?? []" :key="effect.target" class="tag good">
            永久 {{ effectText(effect.target, effect.op, effect.value) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
