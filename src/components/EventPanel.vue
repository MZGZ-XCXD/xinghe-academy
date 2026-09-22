<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { activeEventList } from '../game/engine/EventEngine'
import { EVENT_MAP } from '../data'
import { previewChoice } from '../game/engine/EventPreview'
import EventChoicePreview from './EventChoicePreview.vue'
import GameIcon from './GameIcon.vue'

const engine = gameEngine()
const state = gameState()

const pending = computed(() => activeEventList(state))
const scheduled = computed(() =>
  state.events.scheduled.map((entry) => ({
    entry,
    def: EVENT_MAP[entry.defId],
    dueIn: Math.max(0, entry.triggeredAtMinute - state.time.minutes),
  })),
)

const seen = computed(() => Object.keys(state.events.seenCount).length)

const previews = computed(() => {
  const minute = Math.round(state.time.minutes)
  const map = new Map<string, ReturnType<typeof previewChoice>[]>()
  for (const entry of pending.value) {
    map.set(
      entry.event.uid,
      entry.def.choices.map((choice, index) =>
        previewChoice(state, choice, `${entry.event.uid}:${index}`, minute),
      ),
    )
  }
  return map
})
</script>

<template>
  <div class="panel">
    <h3>
      📰 校园事件
      <span class="tag">{{ pending.length }} 待处理</span>
      <span class="tag">已历 {{ seen }} 种</span>
    </h3>
    <div class="muted small" style="margin-bottom: 10px">
      事件会根据建筑、科技、校规与季节条件出现。部分事件是延迟事件：选择之后会在数天后进入下一阶段，期间可能需要追加投入或及时止损。
    </div>
    <div v-if="pending.length === 0" class="muted small">当前没有待处理事件。学园正在安静地运转。</div>
    <div v-for="entry in pending" :key="entry.event.uid" class="card" style="margin-bottom: 10px">
      <div class="title">
        <span><GameIcon :value="entry.def.icon" :size="20" /></span>
        <span>{{ entry.def.title }}</span>
        <span class="level">{{ entry.def.category }}</span>
      </div>
      <div class="small">{{ entry.def.text }}</div>
      <div class="choices">
        <button
          v-for="(choice, index) in entry.def.choices"
          :key="choice.label"
          class="choice"
          @click="engine.resolveEvent(entry.event.uid, index)"
        >
          <div class="label">{{ choice.label }}</div>
          <div v-if="choice.hint" class="small muted">{{ choice.hint }}</div>
          <EventChoicePreview :preview="previews.get(entry.event.uid)?.[index]!" />
        </button>
      </div>
    </div>
  </div>

  <div class="panel">
    <h3>⏳ 已排期的后续事件</h3>
    <div v-if="scheduled.length === 0" class="muted small">没有排期中的事件。</div>
    <div v-for="item in scheduled" :key="item.entry.uid" class="stat-row">
      <span class="muted"><GameIcon :value="item.def?.icon" :size="16" /> {{ item.def?.title }}</span>
      <span class="value">{{ (item.dueIn / 1440).toFixed(1) }} 天后</span>
    </div>
  </div>

  <div class="panel">
    <h3>🗂️ 事件日志</h3>
    <div v-if="state.events.log.length === 0" class="muted small">还没有处理过事件。</div>
    <div class="scrollable">
      <div v-for="item in state.events.log" :key="item.uid + item.minute" class="card" style="margin-bottom: 8px">
        <div class="row between">
          <strong class="small">{{ item.title }}</strong>
          <span class="small muted">第 {{ Math.floor(item.minute / 1440) }} 天</span>
        </div>
        <div v-for="(line, index) in item.lines" :key="index" class="small muted">· {{ line }}</div>
      </div>
    </div>
  </div>
</template>
