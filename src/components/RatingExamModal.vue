<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { RESOURCE_MAP } from '../data'
import { fmt } from '../ui/format'
import GameIcon from './GameIcon.vue'

/**
 * 评级考核浮窗：每次评级升级都要过一次评估。
 * 评估组带着清单来学校逐项核对；没通过之前评级数值涨不上去。
 */
const engine = gameEngine()
const state = gameState()
const dismissed = ref<string[]>([])

const exam = computed(() => engine.ratingExam())
const scopeId = computed(() => (exam.value ? `exam-${exam.value.exam.tierIndex}` : ''))
const visible = computed(
  () =>
    exam.value !== null &&
    state.cards.offers.length === 0 &&
    engine.pendingTutorial() === null &&
    !dismissed.value.includes(scopeId.value),
)

watch(scopeId, () => {
  dismissed.value = []
})

function later(): void {
  if (scopeId.value) dismissed.value = [...dismissed.value, scopeId.value]
}

function submit(): void {
  if (engine.submitRatingExam()) later()
}

const rewardText = computed(() => {
  if (!exam.value) return ''
  return Object.entries(exam.value.exam.reward)
    .map(([key, value]) => `${RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]?.name ?? key} +${fmt(Number(value))}`)
    .join('、')
})
</script>

<template>
  <Transition name="modal-fade">
  <div v-if="visible && exam" class="modal-backdrop exam-backdrop">
    <div class="modal exam-modal">
      <div class="row between">
        <h2><GameIcon :value="exam.exam.icon" :size="22" /> {{ exam.exam.title }}</h2>
        <span class="tag gold">{{ exam.exam.examiner }}</span>
      </div>
      <div class="small muted" style="margin-top: 4px">
        评级考核 · {{ exam.exam.name }} · 通过后学校才会被正式评为更高一级
      </div>
      <div class="story">
        <p v-for="(paragraph, index) in exam.exam.paragraphs" :key="index">{{ paragraph }}</p>
      </div>
      <div class="checklist">
        <div v-for="item in exam.checklist" :key="item.label" class="check-row">
          <span :class="item.done ? 'ok' : 'todo'">{{ item.done ? '✓' : '○' }}</span>
          <span>{{ item.label }}</span>
        </div>
      </div>
      <div class="small muted" style="margin-top: 6px">通过奖励：{{ rewardText }}</div>
      <div class="row between" style="margin-top: 14px">
        <button class="btn ghost small" @click="later()">稍后再评估</button>
        <button class="btn" :class="{ primary: exam.canSubmit }" :disabled="!exam.canSubmit" @click="submit()">
          {{ exam.canSubmit ? '提交考核' : '条件未达成' }}
        </button>
      </div>
    </div>
  </div>
  </Transition>
</template>
