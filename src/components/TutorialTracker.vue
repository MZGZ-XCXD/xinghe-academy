<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine } from '../ui/game'
import GameIcon from './GameIcon.vue'

/**
 * 剧情任务面板：常驻在界面左侧，告诉玩家「现在到哪一步了、该做什么」。
 * 全部章节走完后换成老校长的一句话，可以收起；有评级考核时也在这里提醒。
 */
const engine = gameEngine()

const task = computed(() => engine.tutorialTask())
const exam = computed(() => engine.ratingExam())

function gotoTab(): void {
  if (task.value.tab) engine.setTab(task.value.tab)
}
</script>

<template>
  <div v-if="!task.done" class="panel tracker">
    <h3>
      🧭 剧情引导
      <span class="tag">{{ task.current }} / {{ task.total }}</span>
      <span v-if="task.hasPendingModal" class="tag warn">待阅读</span>
    </h3>
    <div v-if="task.step" class="row">
      <GameIcon :value="task.step.icon" :size="20" />
      <strong>{{ task.step.chapter }} · {{ task.step.title }}</strong>
    </div>
    <div class="small muted" style="margin-top: 4px">当前要做的事：{{ task.objective }}</div>
    <div class="row between" style="margin-top: 8px">
      <span class="small muted">完成这一步就会推进到下一章</span>
      <button v-if="task.tab" class="btn small primary" @click="gotoTab()">前往</button>
    </div>
  </div>

  <div v-else-if="!task.acknowledged" class="panel tracker done">
    <h3>📜 校史第一章 <span class="tag gold">引导完成</span></h3>
    <div class="small">{{ task.closing }}</div>
    <div class="row between" style="margin-top: 8px">
      <span class="small muted">之后可以随时在【选项】里重看这些章节</span>
      <button class="btn small ghost" @click="engine.acknowledgeTutorialComplete()">收起</button>
    </div>
  </div>

  <div v-if="exam" class="panel tracker exam">
    <h3>
      📋 评级考核进行中
      <span class="tag warn">{{ exam.checklist.filter((c) => c.done).length }} / {{ exam.checklist.length }}</span>
    </h3>
    <div class="small">
      {{ exam.exam.examiner }} 正在评估：<strong>{{ exam.exam.name }}</strong>
    </div>
    <div class="row wrap" style="margin-top: 6px">
      <span v-for="item in exam.checklist" :key="item.label" class="tag" :class="item.done ? 'good' : 'warn'">
        {{ item.done ? '✓' : '·' }} {{ item.label }}
      </span>
    </div>
    <div class="row between" style="margin-top: 8px">
      <span class="small muted">未完成的项会被评估组打回来</span>
      <button
        class="btn small"
        :class="{ primary: exam.canSubmit }"
        :disabled="!exam.canSubmit"
        @click="engine.submitRatingExam()"
      >
        提交考核
      </button>
    </div>
  </div>
</template>
