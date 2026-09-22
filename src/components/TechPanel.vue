<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { BUILDING_MAP, COURSE_MAP, RESOURCE_MAP, TECH_DEFS } from '../data'
import { canResearch, researchProgress, techCost, techDuration } from '../game/engine/TechEngine'
import { effectText, fmt, fmtMinutes } from '../ui/format'
import { describeGameDuration, useSpeedContext } from '../ui/duration'
import { missingPrereqTechs } from '../ui/requirements'
import CompactCard from './CompactCard.vue'

const engine = gameEngine()
const state = gameState()
const branches = ['教学科技', '科研科技', '学生发展', '校园管理', '对外交流']
const filter = ref(branches[0])
const speedCtx = useSpeedContext()

const progressByBranch = computed(() =>
  branches.map((branch) => {
    const list = TECH_DEFS.filter((def) => def.branch === branch)
    const unlocked = list.filter((def) => state.technologies[def.id]?.unlocked).length
    return { branch, unlocked, total: list.length }
  }),
)

const rows = computed(() =>
  TECH_DEFS.filter((def) => def.branch === filter.value).map((def) => {
    const entry = state.technologies[def.id]
    const unlocked = entry?.unlocked === true
    const researching = Boolean(entry?.researching)
    const progress = researchProgress(state, def.id)
    const check = canResearch(state, def.id, engine.mods)
    const cost = techCost(def, engine.mods)
    const costText = Object.entries(cost)
      .map(([key, value]) => `${RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]?.name ?? key} ${fmt(Number(value))}`)
      .join('、')
    const unlockNames = [
      ...(def.unlocks?.buildings ?? []).map((id) => `建筑「${BUILDING_MAP[id]?.name ?? id}」`),
      ...(def.unlocks?.courses ?? []).map((id) => `课程「${COURSE_MAP[id]?.name ?? id}」`),
      ...(def.unlocks?.policies ?? []).map((id) => `校规「${id}」`),
    ]
    const missing = missingPrereqTechs(state, def)
    const lines = [
      def.desc,
      `分支：${def.branch}`,
      `研究成本：${costText}`,
      `研究时间：${describeGameDuration(techDuration(def, engine.mods), speedCtx.value)}`,
      (def.effects ?? []).length
        ? `效果：${(def.effects ?? []).map((e) => effectText(e.target, e.op, e.value)).join('；')}`
        : '',
      unlockNames.length ? `解锁：${unlockNames.join('、')}` : '',
      def.requires.length ? `前置科技：${def.requires.join('、')}` : '前置科技：无',
      researching ? `研究中：进度 ${(progress * 100).toFixed(0)}%` : '',
      !check.ok && !unlocked ? `暂时无法研究：${check.reason}` : '',
      missing.length ? `缺少：${missing.join('、')}` : '',
    ].filter(Boolean)
    return {
      id: def.id,
      icon: def.icon,
      name: def.name,
      meta: unlocked ? '已解锁' : researching ? `研究中 ${(progress * 100).toFixed(0)}%` : missing.length ? '未解锁' : '可研究',
      action: unlocked ? '已完成' : researching ? '研究中' : '研究',
      disabled: unlocked || researching || !check.ok,
      tone: (unlocked ? 'done' : researching ? 'active' : missing.length ? 'locked' : '') as '' | 'active' | 'locked' | 'done',
      lines,
    }
  }),
)
</script>

<template>
  <div class="panel">
    <h3>
      🔬 科技树
      <span class="tag">{{ progressByBranch.reduce((sum, b) => sum + b.unlocked, 0) }} / {{ TECH_DEFS.length }}</span>
    </h3>
    <div class="row wrap" style="margin-bottom: 10px">
      <button
        v-for="item in progressByBranch"
        :key="item.branch"
        class="btn small"
        :class="{ primary: filter === item.branch }"
        @click="filter = item.branch"
      >
        {{ item.branch }} {{ item.unlocked }}/{{ item.total }}
      </button>
      <span class="small muted" style="margin-left: auto">鼠标移到条目上查看成本、效果与解锁内容</span>
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
        @action="engine.research(row.id)"
      />
    </div>
  </div>
</template>
