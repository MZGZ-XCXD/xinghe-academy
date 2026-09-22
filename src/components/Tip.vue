<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 悬浮提示：内容渲染到 body（Teleport + fixed 定位），
 * 因此不会被子面板的滚动容器裁剪，靠近屏幕底部时会自动切换到上方。
 */
const props = defineProps<{
  label?: string
  title?: string
  lines?: string[]
  /** 作为块级容器使用（例如包裹整张卡片） */
  block?: boolean
  width?: number
}>()

const visible = ref(false)
const position = ref<Record<string, string>>({ left: '0px', top: '0px', width: '300px' })
const root = ref<HTMLElement | null>(null)
let anchor: DOMRect | null = null

function reposition() {
  const box = anchor
  if (!box || typeof window === 'undefined') return
  const width = props.width ?? 300
  const viewportWidth = window.innerWidth || 1280
  const viewportHeight = window.innerHeight || 800
  const left = Math.min(Math.max(8, box.left), Math.max(8, viewportWidth - width - 12))
  const spaceBelow = viewportHeight - box.bottom
  const placeAbove = spaceBelow < 240 && box.top > spaceBelow
  position.value = {
    left: `${left}px`,
    top: placeAbove ? `${box.top - 8}px` : `${box.bottom + 8}px`,
    width: `${width}px`,
    ...(placeAbove ? { transform: 'translateY(-100%)' } : {}),
  }
}

function show(event: Event) {
  const element = (event.currentTarget as HTMLElement | null) ?? root.value
  if (!element) return
  anchor = element.getBoundingClientRect()
  visible.value = true
  reposition()
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)
}

function hide() {
  visible.value = false
  if (typeof window === 'undefined') return
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
}

/**
 * 触屏没有鼠标悬停：点一下切换提示。
 * 点在卡片里的按钮 / 输入框上时不弹提示，免得挡住操作。
 */
function onTouchStart(event: TouchEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, input, textarea, select, a')) return
  if (visible.value) hide()
  else show(event)
}

/** 点提示以外的地方就收起来 */
function onDocumentPointerDown(event: PointerEvent) {
  if (!visible.value) return
  const target = event.target as Node | null
  if (target && root.value?.contains(target)) return
  hide()
}

onMounted(() => {
  if (typeof document === 'undefined') return
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  hide()
  if (typeof document === 'undefined') return
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})
</script>

<template>
  <span
    ref="root"
    class="tip"
    :class="{ block }"
    tabindex="0"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @touchstart.passive="onTouchStart"
  >
    <slot>{{ label }}</slot>
    <Teleport to="body">
      <div v-if="visible" class="float-tip" :style="position">
        <div v-if="title" class="tip-title">{{ title }}</div>
        <div v-if="!lines || lines.length === 0" class="muted small">暂无明细</div>
        <div v-for="(line, index) in lines ?? []" :key="index" class="tip-line">{{ line }}</div>
      </div>
    </Teleport>
  </span>
</template>
