<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import GameIcon from './GameIcon.vue'

/**
 * 剧情引导浮窗：按章节一步步把系统介绍给玩家。
 * 「继续」= 看下一章；「不再显示教程」= 关掉弹窗（系统仍会照常解锁，可在【选项】里重开）。
 */
const engine = gameEngine()
const state = gameState()

const step = computed(() => engine.pendingTutorial())
const progress = computed(() => engine.tutorialProgress())
const hasCardOffer = computed(() => state.cards.offers.length > 0)
</script>

<template>
  <Transition name="modal-fade">
  <div v-if="step && !hasCardOffer" class="modal-backdrop tutorial-backdrop">
    <div class="modal tutorial-modal">
      <div class="row between">
        <h2><GameIcon :value="step.icon" :size="22" /> {{ step.title }}</h2>
        <span class="tag gold">{{ step.chapter }}</span>
      </div>
      <div class="small muted" style="margin-top: 4px">
        剧情引导 {{ progress.current }} / {{ progress.total }}
      </div>
      <div class="story">
        <p v-for="(paragraph, index) in step.paragraphs" :key="index">{{ paragraph }}</p>
      </div>
      <div class="row between" style="margin-top: 14px">
        <button class="btn ghost small" @click="engine.disableTutorials()">不再显示教程</button>
        <button class="btn primary" @click="engine.advanceTutorial()">继续</button>
      </div>
    </div>
  </div>
  </Transition>
</template>
