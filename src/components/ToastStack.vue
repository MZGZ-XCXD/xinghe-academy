<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { gameEngine } from '../ui/game'

const engine = gameEngine()
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    const now = Date.now()
    engine.notices.value = engine.notices.value.filter((notice) => {
      const stamp = (notice as unknown as { stamp?: number }).stamp ?? now
      ;(notice as unknown as { stamp?: number }).stamp = stamp
      return now - stamp < 6000
    })
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="toasts">
    <TransitionGroup name="toast">
      <div
        v-for="notice in engine.notices.value.slice(0, 4)"
        :key="notice.id"
        class="toast"
        :class="notice.kind"
        @click="engine.dismissNotice(notice.id)"
      >
        {{ notice.text }}
      </div>
    </TransitionGroup>
  </div>
</template>
