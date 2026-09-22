<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { UNLOCK_KIND_LABEL } from '../game/engine/UnlockEngine'
import GameIcon from './GameIcon.vue'

/**
 * 新解锁浮窗：建筑落成 / 科技完成 / 评级通过 / 社团挂牌……带来新内容时，
 * 用一段有剧情味的说明在屏幕中央告诉玩家「做了什么 → 于是多出了什么」。
 */
const engine = gameEngine()
const state = gameState()

const notice = computed(() => engine.currentUnlockNotice())
/** 卡片三选一与剧情章节优先，避免两层弹窗叠在一起 */
const visible = computed(
  () => notice.value !== null && state.cards.offers.length === 0 && engine.pendingTutorial() === null,
)
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="visible && notice" class="modal-backdrop unlock-backdrop">
      <div class="modal unlock-modal">
        <div class="row between">
          <h2><GameIcon :value="notice.icon" :size="22" /> {{ notice.headline }}</h2>
          <span class="tag gold">新解锁</span>
        </div>
        <p class="unlock-story">{{ notice.story }}</p>
        <div class="small muted">于是学校多出了这些可能（{{ notice.items.length }}）：</div>
        <div class="unlock-list">
          <div v-for="item in notice.items" :key="item.kind + ':' + item.id" class="unlock-row">
            <GameIcon :value="item.icon" :size="18" />
            <div>
              <div class="unlock-name">
                {{ item.name }}
                <span class="tag">{{ UNLOCK_KIND_LABEL[item.kind] }}</span>
              </div>
              <div class="small muted">{{ item.desc }}</div>
            </div>
          </div>
        </div>
        <div class="row between" style="margin-top: 14px">
          <span class="small muted">
            这些条目已经出现在对应面板里<template v-if="engine.unlockNotices.value.length > 1">
              · 还有 {{ engine.unlockNotices.value.length - 1 }} 条解锁记录在排队</template>
          </span>
          <button class="btn primary" @click="engine.dismissUnlockNotice(notice.id)">知道了</button>
        </div>
      </div>
    </div>
  </Transition>
</template>
