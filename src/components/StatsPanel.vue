<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { BUILDING_DEFS, COURSE_DEFS, TECH_DEFS } from '../data'
import { fmt, fmtMinutes } from '../ui/format'
import { MINUTES_PER_DAY } from '../game/formulas'

const engine = gameEngine()
const state = gameState()
void engine

const playTime = computed(() => {
  const seconds = state.statistics.totalPlaySeconds
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`
})

const gameTime = computed(() => {
  const days = Math.floor(state.time.minutes / MINUTES_PER_DAY)
  return `${Math.floor(days / 360)} 学年 ${days % 360} 天`
})

const buildingLevels = computed(() => Object.values(state.buildings).reduce((sum, b) => sum + b.level, 0))
const activeCourses = computed(() => Object.values(state.courses).filter((c) => c.active).length)
const unlockedTechs = computed(() => Object.values(state.technologies).filter((t) => t.unlocked).length)
</script>

<template>
  <div class="panel">
    <h3>📁 学校档案</h3>
    <div class="grid cols-2">
      <div>
        <div class="stat-row"><span class="muted">累计收入</span><span class="value">{{ fmt(state.statistics.totalMoneyEarned) }} 💰</span></div>
        <div class="stat-row"><span class="muted">累计支出</span><span class="value">{{ fmt(state.statistics.totalMoneySpent) }} 💰</span></div>
        <div class="stat-row"><span class="muted">累计教学资源</span><span class="value">{{ fmt(state.statistics.totalTeachingEarned) }}</span></div>
        <div class="stat-row"><span class="muted">累计科研点</span><span class="value">{{ fmt(state.statistics.research) }}</span></div>
        <div class="stat-row"><span class="muted">累计培养（学生学年）</span><span class="value">{{ fmt(state.statistics.studentsTaught) }}</span></div>
        <div class="stat-row"><span class="muted">累计毕业生</span><span class="value">{{ fmt(state.statistics.graduates) }}</span></div>
        <div class="stat-row"><span class="muted">累计比赛</span><span class="value">{{ fmt(state.statistics.competitions) }}</span></div>
        <div class="stat-row"><span class="muted">比赛胜利</span><span class="value">{{ fmt(state.statistics.competitionWins) }}</span></div>
        <div class="stat-row"><span class="muted">累计交流</span><span class="value">{{ fmt(state.statistics.exchanges) }}</span></div>
      </div>
      <div>
        <div class="stat-row"><span class="muted">累计事件</span><span class="value">{{ fmt(state.statistics.eventsResolved) }}</span></div>
        <div class="stat-row"><span class="muted">获得效果卡</span><span class="value">{{ fmt(state.statistics.cardsGained) }}</span></div>
        <div class="stat-row"><span class="muted">完成传承</span><span class="value">{{ fmt(state.statistics.prestiges) }}</span></div>
        <div class="stat-row"><span class="muted">建造完成次数</span><span class="value">{{ fmt(state.statistics.buildingsBuilt) }}</span></div>
        <div class="stat-row"><span class="muted">历史最高学生数</span><span class="value">{{ fmt(state.statistics.peakStudents) }}</span></div>
        <div class="stat-row"><span class="muted">历史最高评级</span><span class="value">{{ state.statistics.peakRating.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">最长在线时长</span><span class="value">{{ fmtMinutes(state.statistics.longestSessionSeconds / 60) }}</span></div>
        <div class="stat-row"><span class="muted">累计游玩时长</span><span class="value">{{ playTime }}</span></div>
        <div class="stat-row"><span class="muted">当前游戏时间</span><span class="value">{{ gameTime }}</span></div>
      </div>
    </div>
  </div>

  <div class="panel">
    <h3>📊 建设进度</h3>
    <div class="stat-row"><span class="muted">建筑总等级</span><span class="value">{{ buildingLevels }}</span></div>
    <div class="stat-row">
      <span class="muted">已建成建筑</span>
      <span class="value">{{ Object.values(state.buildings).filter((b) => b.level > 0).length }} / {{ BUILDING_DEFS.length }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">开课数量</span>
      <span class="value">{{ activeCourses }} / {{ COURSE_DEFS.length }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">解锁科技</span>
      <span class="value">{{ unlockedTechs }} / {{ TECH_DEFS.length }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">活跃校友</span>
      <span class="value">{{ fmt(state.students.alumniActive) }}</span>
    </div>
  </div>

  <div class="panel">
    <h3>📝 学园日志</h3>
    <div v-if="state.statistics.activityLog.length === 0" class="muted small">暂无记录。</div>
    <div class="scrollable">
      <div v-for="(entry, index) in state.statistics.activityLog" :key="index" class="stat-row">
        <span class="muted small">第 {{ Math.floor(entry.minute / 1440) }} 天</span>
        <span class="small">{{ entry.text }}</span>
      </div>
    </div>
  </div>
</template>
