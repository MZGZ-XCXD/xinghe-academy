<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { STUDENT_ATTR_META, TEACHER_SUBJECT_META, TEACHER_SUBJECTS } from '../game/types'
import {
  overallAttributes,
  overallWellbeing,
  studentCapacity,
  teacherEfficiency,
  totalStudents,
  totalTeachers,
  enrollmentCount,
} from '../game/formulas'
import { BUILDING_MAP } from '../data'
import { hireCostFor } from '../game/engine/TeacherEngine'
import { fmt, fmtMinutes } from '../ui/format'
import { describeGameDuration, useSpeedContext } from '../ui/duration'
import { hireDurationMinutes } from '../game/formulas'
import Tip from './Tip.vue'

const engine = gameEngine()
const state = gameState()

const attrs = computed(() => overallAttributes(state))
const wellbeing = computed(() => overallWellbeing(state))
const capacity = computed(() => studentCapacity(state, BUILDING_MAP, engine.mods))
const projected = computed(() => enrollmentCount(state, BUILDING_MAP, engine.mods))
const teachers = computed(() => totalTeachers(state))
const efficiency = computed(() => teacherEfficiency(state, engine.mods))
const speedCtx = useSpeedContext()

const gradeNames: Record<number, string> = { 1: '高一', 2: '高二', 3: '高三' }

const teacherRows = computed(() =>
  TEACHER_SUBJECTS.map((subject) => {
    const group = state.teachers.groups.find((g) => g.subject === subject)!
    return {
      meta: TEACHER_SUBJECT_META[subject],
      ...group,
      cost: hireCostFor(state, subject, 1).money ?? 0,
    }
  }),
)
</script>

<template>
  <div class="panel">
    <h3>🎓 学生群体 <span class="tag">共 {{ fmt(totalStudents(state)) }} 人</span></h3>
    <div class="muted small" style="margin-bottom: 8px">
      游戏采用「群体模拟 + 少量代表性事件」的方式：三个年级作为群体成长，高三毕业后转化为校友，高一每年由招生补充。
    </div>
    <table class="data">
      <thead>
        <tr>
          <th>年级</th>
          <th>人数</th>
          <th v-for="meta in STUDENT_ATTR_META.slice(0, 4)" :key="meta.key">{{ meta.name }}</th>
          <th>压力</th>
          <th>满意度</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cohort in state.students.cohorts" :key="cohort.grade">
          <td>{{ gradeNames[cohort.grade] }}</td>
          <td>{{ fmt(cohort.count) }}</td>
          <td v-for="meta in STUDENT_ATTR_META.slice(0, 4)" :key="meta.key">
            {{ ((cohort.attrs as unknown as Record<string, number>)[String(meta.key)] ?? 0).toFixed(1) }}
          </td>
          <td :class="cohort.stress > 65 ? 'value warn' : ''">{{ cohort.stress.toFixed(0) }}</td>
          <td>{{ cohort.satisfaction.toFixed(0) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="grid cols-2" style="margin-top: 12px">
      <div>
        <div v-for="meta in STUDENT_ATTR_META" :key="meta.key" class="stat-row">
          <span class="muted">
            <Tip :label="`${meta.icon} ${meta.name}`" :title="meta.name" :lines="[meta.desc]" />
          </span>
          <span class="value">{{ attrs[meta.key as keyof typeof attrs].toFixed(1) }}</span>
        </div>
      </div>
      <div>
        <div class="stat-row"><span class="muted">😖 平均压力</span><span class="value">{{ wellbeing.stress.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">🙂 平均满意度</span><span class="value">{{ wellbeing.satisfaction.toFixed(1) }}</span></div>
        <div class="stat-row">
          <span class="muted">
            <Tip
              label="学生容量"
              title="容量与招生"
              :lines="['容量由教学楼、宿舍、食堂、操场等建筑提供', '容量不足时招生会被截断']"
            />
          </span>
          <span class="value">{{ fmt(totalStudents(state)) }} / {{ fmt(capacity) }}</span>
        </div>
        <div class="stat-row"><span class="muted">下一年预计新生</span><span class="value">{{ fmt(projected) }} 人</span></div>
        <div class="stat-row">
          <span class="muted">
            <Tip
              label="招生加成（春季活动累积）"
              title="招生加成"
              :lines="[
                '春季的招生宣讲会、校园开放日、招生简章投放会累积招生加成',
                '加成在学年结算时直接计入新生人数（最终仍受学生容量限制）',
                '声望与家长认可度也会影响招生',
              ]"
            />
          </span>
          <span class="value">{{ fmt(state.students.recruitBonus) }} 人</span>
        </div>
        <div class="stat-row"><span class="muted">活跃校友</span><span class="value">{{ fmt(state.students.alumniActive) }} 人</span></div>
        <div class="stat-row"><span class="muted">累计毕业生</span><span class="value">{{ fmt(state.statistics.graduates) }} 人</span></div>
        <div class="stat-row"><span class="muted">校友质量系数</span><span class="value">×{{ state.students.alumniQuality.toFixed(2) }}</span></div>
      </div>
    </div>
  </div>

  <div class="panel">
    <h3>
      🧑‍🏫 教师队伍
      <span class="tag">{{ teachers }} 人</span>
      <span class="tag gold">效率 ×{{ efficiency.toFixed(2) }}</span>
    </h3>
    <table class="data">
      <thead>
        <tr>
          <th>学科组</th>
          <th>人数</th>
          <th>教学能力</th>
          <th>压力</th>
          <th>士气</th>
          <th>招聘成本</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in teacherRows" :key="row.subject">
          <td>{{ row.meta.icon }} {{ row.meta.name }}</td>
          <td>{{ row.count }}</td>
          <td>{{ row.quality.toFixed(0) }}</td>
          <td :class="row.stress > 65 ? 'value warn' : ''">{{ row.stress.toFixed(0) }}</td>
          <td :class="row.morale < 50 ? 'value warn' : ''">{{ row.morale.toFixed(0) }}</td>
          <td>{{ fmt(row.cost) }} 💰</td>
          <td>
            <button class="btn small" @click="engine.hire(row.subject, 1)">招聘 1 人</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="muted small" style="margin-top: 8px">
      招聘需要 {{ describeGameDuration(hireDurationMinutes(1), speedCtx) }}，新教师到岗时能力略低，会随着教研与培训中心逐渐成长。
      教师压力过高会降低教学质量并影响士气。
    </div>
    <div v-if="state.teachers.hireQueue.length" class="row wrap" style="margin-top: 8px">
      <span v-for="hire in state.teachers.hireQueue" :key="hire.subject + hire.endMinute" class="tag">
        招聘中：{{ TEACHER_SUBJECT_META[hire.subject].name }} ×{{ hire.count }}（{{ fmtMinutes(Math.max(0, hire.endMinute - state.time.minutes)) }}）
      </span>
    </div>
  </div>
</template>
