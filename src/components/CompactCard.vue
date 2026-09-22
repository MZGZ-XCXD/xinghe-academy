<script setup lang="ts">
import Tip from './Tip.vue'
import GameIcon from './GameIcon.vue'

/**
 * 紧凑条目：界面上只显示「图标 + 名称 + 一行状态 + 一个按钮」，
 * 所有细节（描述、成本、效果、前置条件…）都放进悬浮提示。
 */
defineProps<{
  icon: string
  name: string
  meta?: string
  action?: string
  disabled?: boolean
  actionTitle?: string
  tone?: '' | 'active' | 'locked' | 'done'
  tipTitle?: string
  tipLines?: string[]
}>()

defineEmits<{ action: [] }>()
</script>

<template>
  <Tip block :title="tipTitle ?? name" :lines="tipLines ?? []" :width="330">
    <div class="info-card" :class="tone">
      <span class="ic-icon"><GameIcon :value="icon" :size="18" /></span>
      <span class="ic-name">{{ name }}</span>
      <span v-if="meta" class="ic-meta">{{ meta }}</span>
      <button
        v-if="action"
        class="btn small"
        :class="{ primary: !disabled }"
        :disabled="disabled"
        :title="actionTitle ?? ''"
        @click.stop="$emit('action')"
      >
        {{ action }}
      </button>
    </div>
  </Tip>
</template>
