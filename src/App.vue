<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { gameEngine, gameState } from './ui/game'
import { fmt } from './ui/format'
import { formatRealRate, rateExplainer, useSpeedContext } from './ui/duration'
import { totalStudents, totalTeachers, studentCapacity } from './game/formulas'
import { BUILDING_MAP } from './data'

import LeftPanel from './components/LeftPanel.vue'
import RightPanel from './components/RightPanel.vue'
import CampusView from './components/CampusView.vue'
import BuildingPanel from './components/BuildingPanel.vue'
import CoursePanel from './components/CoursePanel.vue'
import StudentPanel from './components/StudentPanel.vue'
import ClubPanel from './components/ClubPanel.vue'
import TeamsPanel from './components/TeamsPanel.vue'
import TechPanel from './components/TechPanel.vue'
import PolicyPanel from './components/PolicyPanel.vue'
import ActivityPanel from './components/ActivityPanel.vue'
import EventPanel from './components/EventPanel.vue'
import LegacyPanel from './components/LegacyPanel.vue'
import AchievementPanel from './components/AchievementPanel.vue'
import StatsPanel from './components/StatsPanel.vue'
import OptionsPanel from './components/OptionsPanel.vue'
import ToastStack from './components/ToastStack.vue'
import CardChoiceModal from './components/CardChoiceModal.vue'
import EventModal from './components/EventModal.vue'
import TutorialModal from './components/TutorialModal.vue'
import RatingExamModal from './components/RatingExamModal.vue'
import TutorialTracker from './components/TutorialTracker.vue'
import Tip from './components/Tip.vue'
import UnlockModal from './components/UnlockModal.vue'

const engine = gameEngine()
const state = gameState()

const TABS = [
  { id: 'campus', label: '校园', icon: '🏫' },
  { id: 'buildings', label: '建筑', icon: '🏗️' },
  { id: 'courses', label: '课程', icon: '📚' },
  { id: 'students', label: '学生', icon: '🎓' },
  { id: 'clubs', label: '社团', icon: '🎽' },
  { id: 'teams', label: '校队', icon: '🥋' },
  { id: 'tech', label: '科技', icon: '🔬' },
  { id: 'policies', label: '校规', icon: '📜' },
  { id: 'competitions', label: '活动', icon: '🏆' },
  { id: 'exchange', label: '交流', icon: '🤝' },
  { id: 'events', label: '事件', icon: '📰' },
  { id: 'legacy', label: '传承', icon: '🕯️' },
  { id: 'achievements', label: '成就', icon: '🏅' },
  { id: 'statistics', label: '统计', icon: '📊' },
  { id: 'options', label: '选项', icon: '⚙️' },
]

const visibleTabs = computed(() => TABS.filter((tab) => state.ui.unlockedTabs.includes(tab.id)))
const activeTab = computed(() => state.ui.activeTab)
const calendar = computed(() => engine.calendar())
const rates = computed(() => engine.rates())
const pendingEvents = computed(() => state.events.active.length)
const speedCtx = useSpeedContext()
const hasOffer = computed(() => state.cards.offers.length > 0)
const capacity = computed(() => studentCapacity(state, BUILDING_MAP, engine.mods))

/** 玩家在【选项】里设的界面倍率（等价于浏览器 Ctrl+滚轮缩放） */
const userScale = computed(() => Math.min(3, Math.max(0.75, Number(state.settings.uiScale) || 1)))

/**
 * 是否按手机 / 触屏窄屏处理。
 * 手机上一律用移动版布局（倍率 1），否则桌面默认的 175% 会把可用宽度压到 220px 左右，根本没法玩。
 */
const isMobile = ref(false)
function detectMobile() {
  if (typeof window === 'undefined') return
  const coarse =
    typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)').matches : false
  isMobile.value = window.innerWidth <= 820 || (coarse && window.innerWidth <= 1024)
}

/** 手机上强制 1×；桌面用玩家设置的倍率 */
const uiScale = computed(() => (isMobile.value ? 1 : userScale.value))
const uiScaleStyle = computed<Record<string, string>>(() => ({ '--ui-scale': String(uiScale.value) }))

/** 缩放后的等效宽度决定要不要收成一栏（媒体查询在缩放后不可靠） */
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
function onResize() {
  viewportWidth.value = window.innerWidth
  detectMobile()
}
onMounted(() => {
  detectMobile()
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('orientationchange', onResize))
const effectiveWidth = computed(() => viewportWidth.value / uiScale.value)
const layoutFlags = computed<Record<string, string | undefined>>(() => ({
  'data-narrow': effectiveWidth.value < 900 ? '1' : undefined,
  'data-tight': effectiveWidth.value < 640 ? '1' : undefined,
  'data-mobile': isMobile.value ? '1' : undefined,
}))

// 悬浮提示是 Teleport 到 body 的，移动端样式需要挂在 body 上才生效
watchEffect(() => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('mobile-ui', isMobile.value)
})

// 浏览器标签页标题跟随校名（改名后立即更新）
watchEffect(() => {
  if (typeof document !== 'undefined') document.title = `${state.school.name} · 学园经营`
})

function selectTab(id: string) {
  engine.setTab(id)
}

/** 顶栏速率悬浮明细：把「为什么是这个数」摊开给玩家看（全部按现实时间） */
function topRateLines(key: 'money' | 'teaching'): string[] {
  const rate = rates.value[key]
  if (!rate) return []
  const parts = rate.parts
    .filter((part) => Math.abs(part.value) > 1e-4)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8)
    .map((part) => `${part.source}：${formatRealRate(part.value, speedCtx.value)}`)
  return [...parts, `合计：${formatRealRate(rate.total, speedCtx.value)}`, rateExplainer(speedCtx.value)]
}
</script>

<template>
  <div class="app" :style="uiScaleStyle" v-bind="layoutFlags">
    <header class="topbar">
      <div class="brand">
        🏫 {{ state.school.name }}
        <small>公立普通高中 · 第 {{ state.meta.runIndex }} 轮办学</small>
      </div>
      <div class="row small">
        <span class="tag">{{ calendar.label }}</span>
        <span class="tag gold">评级 {{ state.school.rating.toFixed(1) }} · {{ engine.grade }}</span>
        <span class="tag">🎓 {{ fmt(totalStudents(state)) }} / {{ fmt(capacity) }}</span>
        <span class="tag hide-tight">🧑‍🏫 {{ totalTeachers(state) }}</span>
        <span class="tag">
          <Tip
            :label="`💰 ${formatRealRate(rates.money.total, speedCtx)}（现实）`"
            title="资金收支（现实时间）"
            :lines="topRateLines('money')"
          />
        </span>
        <span class="tag hide-tight">
          <Tip
            :label="`📚 ${formatRealRate(rates.teaching.total, speedCtx)}（现实）`"
            title="教学资源收支（现实时间）"
            :lines="topRateLines('teaching')"
          />
        </span>
      </div>
      <div class="spacer"></div>
      <div class="row">
        <button
          v-for="speed in state.settings.speedPresets"
          :key="speed"
          class="btn small"
          :class="{ primary: state.time.speed === speed && !state.time.paused }"
          @click="engine.setSpeed(speed)"
        >
          {{ speed }}×
        </button>
        <button class="btn small" :class="{ warn: state.time.paused }" @click="engine.togglePause()">
          {{ state.time.paused ? '继续' : '暂停' }}
        </button>
        <button class="btn small" @click="engine.save()">保存</button>
        <span v-if="engine.debugEnabled" class="tag warn">Debug</span>
      </div>
    </header>

    <main class="layout">
      <aside class="column">
        <TutorialTracker />
        <LeftPanel />
      </aside>
      <section class="column">
        <CampusView v-if="activeTab === 'campus'" />
        <BuildingPanel v-else-if="activeTab === 'buildings'" />
        <CoursePanel v-else-if="activeTab === 'courses'" />
        <StudentPanel v-else-if="activeTab === 'students'" />
        <ClubPanel v-else-if="activeTab === 'clubs'" />
        <TeamsPanel v-else-if="activeTab === 'teams'" />
        <TechPanel v-else-if="activeTab === 'tech'" />
        <PolicyPanel v-else-if="activeTab === 'policies'" />
        <ActivityPanel v-else-if="activeTab === 'competitions'" mode="competition" />
        <ActivityPanel v-else-if="activeTab === 'exchange'" mode="exchange" />
        <EventPanel v-else-if="activeTab === 'events'" />
        <LegacyPanel v-else-if="activeTab === 'legacy'" />
        <AchievementPanel v-else-if="activeTab === 'achievements'" />
        <StatsPanel v-else-if="activeTab === 'statistics'" />
        <OptionsPanel v-else-if="activeTab === 'options'" />
        <div v-else class="panel">
          <h3>该功能尚未解锁</h3>
          <div class="muted small">继续经营学园，新系统会在满足条件后自动开放。</div>
        </div>
      </section>
      <aside class="column">
        <RightPanel />
      </aside>
    </main>

    <nav class="bottom-nav">
      <button
        v-for="tab in visibleTabs"
        :key="tab.id"
        class="nav-btn"
        :class="{ active: activeTab === tab.id }"
        @click="selectTab(tab.id)"
      >
        {{ tab.icon }} {{ tab.label }}
        <span v-if="tab.id === 'events' && pendingEvents > 0" class="dot"></span>
        <span v-if="tab.id === 'campus' && hasOffer" class="dot"></span>
      </button>
      <span class="muted small hide-mobile" style="margin-left: auto; align-self: center">
        未解锁：{{ TABS.filter((t) => !state.ui.unlockedTabs.includes(t.id)).map((t) => t.label).join('、') || '全部已解锁' }}
      </span>
    </nav>

    <ToastStack />
    <UnlockModal />
    <TutorialModal />
    <RatingExamModal />
    <EventModal />
    <CardChoiceModal />
  </div>
</template>
