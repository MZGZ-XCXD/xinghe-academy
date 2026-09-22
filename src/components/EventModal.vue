<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { previewChoice } from '../game/engine/EventPreview'
import { eventTimeRemaining } from '../game/engine/EventEngine'
import EventChoicePreview from './EventChoicePreview.vue'
import GameIcon from './GameIcon.vue'

/**
 * 事件浮窗：事件触发时直接以居中弹窗出现。
 * · 同时有多个待处理事件时，按触发顺序一个一个来（右下角会提示排队数量）。
 * · 点「稍后处理」可以收起浮窗，事件仍然留在【事件】面板与右侧「进行中」列表里。
 * · 如果正好有「效果卡三选一」在等待，浮窗会让位给卡片，避免两层弹窗叠在一起。
 */
const engine = gameEngine()
const state = gameState()

const dismissed = ref<string[]>([])

const hasCardOffer = computed(() => state.cards.offers.length > 0)
const pending = computed(() =>
  engine.activeEvents().filter((entry) => !dismissed.value.includes(entry.event.uid)),
)
const current = computed(() => pending.value[0] ?? null)

const previews = computed(() => {
  if (!current.value) return []
  const minute = Math.round(state.time.minutes)
  return current.value.def.choices.map((choice, index) =>
    previewChoice(state, choice, `${current.value!.event.uid}:${index}`, minute),
  )
})

const remaining = computed(() => {
  if (!current.value) return { text: '', paused: false }
  const info = eventTimeRemaining(state, current.value.event)
  if (info.paused || !Number.isFinite(info.realSeconds)) {
    return { text: '游戏已暂停，事件不会自动结束', paused: true }
  }
  const minutes = info.realSeconds / 60
  const text =
    minutes >= 1
      ? `你还有 ${minutes.toFixed(1)} 分钟（现实时间）可以考虑`
      : `大约 ${Math.max(1, Math.round(info.realSeconds))} 秒后会自动结束`
  return { text, paused: false }
})

function choose(index: number) {
  if (!current.value) return
  engine.resolveEvent(current.value.event.uid, index)
}

function later() {
  if (!current.value) return
  dismissed.value = [...dismissed.value, current.value.event.uid]
}
</script>

<template>
  <Transition name="modal-fade">
  <div v-if="current && !hasCardOffer" class="modal-backdrop event-backdrop" @click.self="later">
    <div class="modal event-modal">
      <div class="row between">
        <h2><GameIcon :value="current.def.icon" :size="22" /> {{ current.def.title }}</h2>
        <div class="row">
          <span class="tag">{{ current.def.category }}</span>
          <span class="tag">{{ current.event.source }}</span>
        </div>
      </div>
      <div class="small muted" style="margin-top: 4px">
        学园出现了一个需要你拍板的情况 · {{ remaining.text }}
      </div>
      <p class="event-text">{{ current.def.text }}</p>
      <div class="choices">
        <button
          v-for="(choice, index) in current.def.choices"
          :key="choice.label"
          class="choice"
          @click="choose(index)"
        >
          <div class="label">{{ choice.label }}</div>
          <div v-if="choice.hint" class="small muted">{{ choice.hint }}</div>
          <EventChoicePreview :preview="previews[index]" />
        </button>
      </div>
      <div class="row between" style="margin-top: 12px">
        <span class="small muted">
          <template v-if="pending.length > 1">还有 {{ pending.length - 1 }} 个事件在排队等你处理</template>
          <template v-else>选择后立即结算，结果会记入【事件】日志</template>
        </span>
        <button class="btn ghost small" @click="later">稍后处理</button>
      </div>
    </div>
  </div>
  </Transition>
</template>
