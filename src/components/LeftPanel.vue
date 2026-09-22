<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { fmt, fmtMinutes, fmtPercent } from '../ui/format'
import { SEASON_MAP } from '../data'
import { BUILDING_MAP } from '../data'
import { overallWellbeing, totalStudents, totalTeachers, averageTeacherMorale } from '../game/formulas'
import Tip from './Tip.vue'
import { describeGameDuration, useSpeedContext } from '../ui/duration'

const engine = gameEngine()
const state = gameState()

const calendar = computed(() => engine.calendar())
const seasonInfo = computed(() => SEASON_MAP[engine.season])
const wellbeing = computed(() => overallWellbeing(state))
const teachers = computed(() => totalTeachers(state))
const morale = computed(() => averageTeacherMorale(state))
const capacity = computed(() => engine.capacity())
const students = computed(() => totalStudents(state))
const speedCtx = useSpeedContext()

const queue = computed(() =>
  state.buildQueue.map((task) => {
    const total = Math.max(1, task.endMinute - task.startMinute)
    const passed = Math.min(total, Math.max(0, state.time.minutes - task.startMinute))
    return {
      task,
      name: BUILDING_MAP[task.buildingId]?.name ?? task.buildingId,
      targetLevel: task.targetLevel,
      progress: passed / total,
      remain: Math.max(0, task.endMinute - state.time.minutes),
    }
  }),
)

function seasonTooltip() {
  return [...seasonInfo.value.focus.map((f) => `重点：${f}`), ...seasonInfo.value.effects]
}
</script>

<template>
  <div class="panel">
    <h3>🏫 校园信息</h3>
    <div class="stat-row">
      <span class="muted">学园</span>
      <span class="value">{{ state.school.name }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">日期</span>
      <span class="value">{{ calendar.month }} 月 {{ calendar.day }} 日</span>
    </div>
    <div class="stat-row">
      <span class="muted">学年 / 学期</span>
      <span class="value">第 {{ calendar.schoolYear }} 学年 · 第 {{ calendar.term }} 学期</span>
    </div>
    <div class="stat-row">
      <span class="muted">季节</span>
      <span class="value">
        <Tip :label="`${seasonInfo.icon} ${seasonInfo.name}`" title="季节影响" :lines="seasonTooltip()" />
      </span>
    </div>
    <div class="stat-row">
      <span class="muted">学校评级</span>
      <span class="value">
        <Tip
          :label="`${state.school.rating.toFixed(1)} · ${engine.grade}`"
          title="学校评级构成"
          :lines="[
            '学生学术 / 体育 / 艺术 / 科研：加权 61%',
            '学生压力与道德：加权 5%',
            '教师士气：加权 3%',
            '校园基础设施：加权 15%',
            '社会声望：最多 +12',
          ]"
        />
      </span>
    </div>
    <div class="stat-row">
      <span class="muted">在校学生</span>
      <span class="value">
        <Tip
          :label="`${fmt(students)} / ${fmt(capacity)}`"
          title="学生容量"
          :lines="['容量来自教学楼、宿舍、食堂等建筑与传承加成', '容量满时招生人数会被限制']"
        />
      </span>
    </div>
    <div class="stat-row">
      <span class="muted">教师队伍</span>
      <span class="value">{{ teachers }} 人</span>
    </div>
    <div class="stat-row">
      <span class="muted">社团 / 部室</span>
      <span class="value">
        <Tip
          :label="`${engine.clubInfo().founded} / ${engine.clubInfo().slots}`"
          title="社团（部活）"
          :lines="[
            `社员 ${engine.clubInfo().members} / ${engine.clubInfo().memberCapacity} 人`,
            `社团等级总和 ${engine.clubInfo().totalLevels}`,
            `学园祭评分 ${Math.round(engine.clubInfo().festivalScore)} · ${engine.clubInfo().festivalLabel}`,
          ]"
        />
      </span>
    </div>
    <div class="stat-row">
      <span class="muted">学生压力</span>
      <span class="value" :class="wellbeing.stress > 65 ? 'warn' : 'good'">{{ wellbeing.stress.toFixed(0) }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">学生满意度</span>
      <span class="value" :class="wellbeing.satisfaction < 45 ? 'warn' : 'good'">
        {{ wellbeing.satisfaction.toFixed(0) }}
      </span>
    </div>
    <div class="stat-row">
      <span class="muted">教师士气</span>
      <span class="value" :class="morale < 50 ? 'warn' : 'good'">{{ morale.toFixed(0) }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">累计毕业生</span>
      <span class="value">{{ fmt(state.statistics.graduates) }}</span>
    </div>
    <div v-if="state.legacy.prestigeCount > 0" class="stat-row">
      <span class="muted">传承轮次</span>
      <span class="value">第 {{ state.legacy.prestigeCount + 1 }} 轮（{{ fmtPercent(state.legacy.prestigeCount * 0.04) }} 离线效率）</span>
    </div>
  </div>

  <div class="panel">
    <h3>🏗️ 建造队列 <span class="tag">{{ queue.length }} / 3</span></h3>
    <div v-if="queue.length === 0" class="muted small">当前没有施工项目。</div>
    <div v-for="item in queue" :key="item.task.id" class="card" style="margin-bottom: 8px">
      <div class="row between">
        <strong>{{ item.name }} → Lv.{{ item.targetLevel }}</strong>
        <button class="btn small ghost" @click="engine.cancelBuild(item.task.id)">取消</button>
      </div>
      <div class="bar"><span :style="{ width: `${(item.progress * 100).toFixed(1)}%` }"></span></div>
      <div class="small muted">剩余 {{ describeGameDuration(item.remain, speedCtx) }}</div>
    </div>
  </div>
</template>
