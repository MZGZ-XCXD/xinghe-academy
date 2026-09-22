<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { COURSE_DEFS, RESOURCE_MAP } from '../data'
import { TEACHER_SUBJECT_META } from '../game/types'
import {
  allocateCourses,
  courseCoverageSummary,
  courseIsUnlocked,
  teacherRatioFor,
  totalCourseSlots,
  usedCourseSlots,
} from '../game/engine/CourseEngine'
import {
  COURSE_CAPACITY_PER_TEACHING_LEVEL,
  courseCapacity,
  courseGrowthPerDay,
  courseOutputPerDay,
  courseTeachingCostPerDay,
  seasonOf,
  teacherEfficiency,
  totalStudents,
} from '../game/formulas'
import { BUILDING_MAP } from '../data'
import { fmt, studentStatLabel } from '../ui/format'
import { formatRealRate, useSpeedContext } from '../ui/duration'
import { meetingRequirements } from '../ui/requirements'
import CompactCard from './CompactCard.vue'

const engine = gameEngine()
const state = gameState()
const filter = ref('基础课程')
const categories = ['基础课程', '能力课程', '特色课程', '实验课程']

const allocations = computed(() => allocateCourses(state))
const allocationMap = computed(() => new Map(allocations.value.map((a) => [a.def.id, a])))
const slotInfo = computed(() => ({ used: usedCourseSlots(state), total: totalCourseSlots(state) }))
const students = computed(() => totalStudents(state))
const efficiency = computed(() => teacherEfficiency(state, engine.mods))
const coverage = computed(() => courseCoverageSummary(state))
const speedCtx = useSpeedContext()
const teachingUse = computed(() => {
  const perDay = allocations.value.reduce(
    (sum, a) => sum + courseTeachingCostPerDay(a.def, a.served, engine.mods),
    0,
  )
  const incomePerDay = Math.max(0, engine.rates().teaching.total) * 1440
  return { perDay, incomePerDay, ratio: incomePerDay > 0 ? perDay / incomePerDay : perDay > 0 ? 99 : 0 }
})

const rows = computed(() =>
  COURSE_DEFS.filter((def) => def.category === filter.value).map((def) => {
    const allocation = allocationMap.value.get(def.id)
    const served = allocation?.served ?? 0
    const ctx = {
      cohortCount: students.value,
      servedStudents: served,
      teacherRatio: teacherRatioFor(state, def),
      capacityRatio: students.value > 0 ? served / students.value : 0,
      efficiency: efficiency.value,
      season: seasonOf(state.time.minutes),
    }
    const active = state.courses[def.id]?.active === true
    const unlocked = courseIsUnlocked(state, def)
    const unmet = meetingRequirements(state, def.requires)
    const capacity = courseCapacity(state, def, BUILDING_MAP)
    const ratio = students.value > 0 ? served / students.value : 1
    const growth = Object.entries(courseGrowthPerDay(def, ctx, engine.mods)).map(
      ([key, value]) => `${studentStatLabel(key)} ${fmt(value, 3)} / 天`,
    )
    const output = Object.entries(courseOutputPerDay(def, ctx, engine.mods)).map(([key, value]) => {
      const meta = RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]
      return `${meta?.icon ?? '❔'}${meta?.name ?? key} ${fmt(value, 2)} / 天`
    })
    const teacherMeta = TEACHER_SUBJECT_META[def.subject]
    const lines = [
      def.desc,
      `任课教师：${teacherMeta.icon}${teacherMeta.name} ×${def.teacherRequired}（现有 ${state.teachers.groups.find((g) => g.subject === def.subject)?.count ?? 0}）`,
      `平行班容量：${fmt(capacity)} 人（课程自带 ${fmt(def.capacity)} + 教学楼平行班 ${fmt(capacity - def.capacity)}）`,
      `当前覆盖：${fmt(served)} 人 / 全校 ${fmt(students.value)} 人（${(ratio * 100).toFixed(0)}%）${
        ratio < 0.999 ? '　⚠ 教室不足，只有一部分学生能上这门课' : ''
      }`,
      `占用课程槽位：${def.slotCost}`,
      growth.length ? `学生成长：${growth.join('，')}` : '',
      output.length ? `资源产出：${output.join('，')}` : '',
      (def.seasonBonus ?? []).length
        ? `季节加成：${(def.seasonBonus ?? []).map((b) => b.label).join('、')}`
        : '',
      `教学资源消耗：${formatRealRate(courseTeachingCostPerDay(def, served, engine.mods) / 1440, speedCtx.value)}（现实时间；覆盖人数越多消耗越大）`,
      teacherRatioFor(state, def) < 1 ? '⚠ 教师不足，课程效果会按比例下降' : '',
      unmet.length ? `未解锁条件：${unmet.join('、')}` : '',
      `每门课各自覆盖学生（所有学生同时上这些课，不存在先开的课抢光学生）；只有学生数超过平行班容量时才需要扩建教学楼（每级 +${COURSE_CAPACITY_PER_TEACHING_LEVEL} 人）。`,
      '教学资源不足时课程仍继续，但效果按比例下降。',
    ].filter((line) => line !== '')
    return {
      id: def.id,
      icon: def.icon,
      name: def.name,
      meta: active
        ? `开课中 · 覆盖 ${(ratio * 100).toFixed(0)}%`
        : unlocked
          ? '未开课'
          : '未解锁',
      action: active ? '停课' : '开课',
      disabled: !unlocked,
      tone: (active ? 'active' : unlocked ? '' : 'locked') as '' | 'active' | 'locked' | 'done',
      lines,
    }
  }),
)
</script>

<template>
  <div class="panel">
    <h3>
      📚 课程安排
      <span class="tag" :class="{ warn: slotInfo.used >= slotInfo.total }">槽位 {{ slotInfo.used }} / {{ slotInfo.total }}</span>
      <span class="tag">教师效率 ×{{ efficiency.toFixed(2) }}</span>
      <span class="tag" :class="{ warn: coverage.worstRatio < 0.999 }">
        最低覆盖率 {{ (coverage.worstRatio * 100).toFixed(0) }}%
      </span>
      <span class="tag" :class="{ warn: teachingUse.ratio > 1 }">
        教学资源 消耗 {{ formatRealRate(teachingUse.perDay / 1440, speedCtx) }} / 产出
        {{ formatRealRate(teachingUse.incomePerDay / 1440, speedCtx) }}（现实时间）
      </span>
    </h3>
    <div v-if="teachingUse.ratio > 1" class="card" style="margin-bottom: 10px; border-color: rgba(240, 169, 74, 0.5)">
      <strong class="small">⚠ 教学资源不够支撑全部课程</strong>
      <div class="small muted">
        课程会继续开，但效果按比例下降。扩建教学楼 / 图书馆 / 信息中心，或减少开课数量；
        课程消耗按「覆盖的学生人数」计算，所以学生越多、开的课越多，消耗越大。
      </div>
    </div>
    <div v-if="coverage.limited.length" class="card" style="margin-bottom: 10px; border-color: rgba(240, 169, 74, 0.5)">
      <strong class="small">⚠ 有 {{ coverage.limited.length }} 门课因教室不足只能覆盖部分学生</strong>
      <div class="small muted">
        {{ coverage.limited.map((c) => `${c.name} ${c.served}/${coverage.total} 人`).join('、') }}
        —— 升级教学楼可以增加平行班容量（每级 +{{ COURSE_CAPACITY_PER_TEACHING_LEVEL }} 人/门课）。
      </div>
    </div>
    <div class="row wrap" style="margin-bottom: 10px">
      <button
        v-for="category in categories"
        :key="category"
        class="btn small"
        :class="{ primary: filter === category }"
        @click="filter = category"
      >
        {{ category }}
      </button>
      <span class="small muted" style="margin-left: auto">鼠标移到条目上查看成长、产出、消耗与容量明细</span>
    </div>
    <div class="grid compact">
      <CompactCard
        v-for="row in rows"
        :key="row.id"
        :icon="row.icon"
        :name="row.name"
        :meta="row.meta"
        :action="row.action"
        :disabled="row.disabled"
        :tone="row.tone"
        :tip-lines="row.lines"
        @action="engine.toggleCourse(row.id)"
      />
    </div>
  </div>
</template>
