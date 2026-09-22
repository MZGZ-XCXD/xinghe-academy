<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 统一图标渲染。
 * icon 字段可以写：
 *   · emoji：'🍵'、'🎸'、'🏹'
 *   · 普通文字：'茶'（会当成文字显示）
 *   · 图片路径（和游戏 HTML 放同一文件夹，或子文件夹）：'./icons/tea.png'、'icons/tea.svg'
 *   · 内嵌图片：'data:image/png;base64,...'
 *   · 在线图片：'https://.../tea.png'
 * 图片加载失败时会自动退回 ❔，不会破坏布局。
 */
const props = defineProps<{
  value?: string
  /** 图标边长（像素） */
  size?: number
}>()

const failed = ref(false)
const px = computed(() => props.size ?? 18)

const isImage = computed(() => {
  const raw = (props.value ?? '').trim()
  if (!raw) return false
  if (/^data:image\//i.test(raw)) return true
  if (/^https?:\/\//i.test(raw)) return true
  if (/\.(png|jpe?g|gif|webp|svg|avif|ico)(\?.*)?$/i.test(raw)) return true
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return true
  if (/^\.{0,2}[\\/]/.test(raw)) return true
  return false
})

watch(
  () => props.value,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <img
    v-if="isImage && !failed"
    class="game-icon-img"
    :src="value"
    :style="{ width: `${px}px`, height: `${px}px` }"
    alt=""
    @error="failed = true"
  />
  <span v-else class="game-icon" :style="{ fontSize: `${px}px` }">
    {{ failed ? '❔' : value || '❔' }}
  </span>
</template>
