<script setup lang="ts">
import { computed } from 'vue'
import type { ChoicePreview } from '../game/engine/EventPreview'
import { effectText, fmt } from '../ui/format'

const props = defineProps<{ preview: ChoicePreview; compact?: boolean }>()

function num(value: number): string {
  const abs = Math.abs(value)
  const digits = abs < 10 ? 1 : 0
  const sign = value > 0 ? '+' : ''
  return `${sign}${abs < 10000 ? value.toFixed(digits) : fmt(value)}`
}

const costText = computed(() =>
  props.preview.costs.map((line) => `${line.label} ${num(line.value)}`).join(' · '),
)
const gainText = computed(() =>
  props.preview.gains.map((line) => `${line.label} ${num(line.value)}`).join(' · '),
)
const studentText = computed(() =>
  props.preview.students.map((line) => `${line.label} ${num(line.value)}`).join(' · '),
)
const teacherText = computed(() =>
  props.preview.teachers.map((line) => `${line.label} ${num(line.value)}`).join(' · '),
)
</script>

<template>
  <div class="preview">
    <div class="row wrap">
      <span v-if="preview.costs.length" class="tag bad">代价：{{ costText }}</span>
      <span v-if="preview.gains.length" class="tag good">获得：{{ gainText }}</span>
      <span v-if="preview.students.length" class="tag good">学生：{{ studentText }}</span>
      <span v-if="preview.teachers.length" class="tag warn">教师：{{ teacherText }}</span>
      <span v-for="effect in preview.effects" :key="effect.target + effect.value" class="tag gold">
        永久 {{ effectText(effect.target, effect.op, effect.value) }}
      </span>
      <span v-for="item in preview.delayed" :key="item" class="tag warn">⏳ {{ item }}</span>
      <span v-if="preview.cards" class="tag gold">额外：{{ preview.cards }}</span>
      <span
        v-if="!preview.costs.length && !preview.gains.length && !preview.students.length && !preview.teachers.length"
        class="tag"
      >
        无数值变化
      </span>
    </div>
    <div v-if="preview.notes.length && !props.compact" class="small muted" style="margin-top: 4px">
      结算说明：{{ preview.notes.join('；') }}
    </div>
  </div>
</template>
