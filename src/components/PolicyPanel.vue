<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { POLICY_DEFS } from '../data'
import { availablePolicies } from '../game/engine/PolicyEngine'
import { effectText } from '../ui/format'
import { meetingRequirements } from '../ui/requirements'
import CompactCard from './CompactCard.vue'

const engine = gameEngine()
const state = gameState()

const slots = computed(() => engine.policySlotInfo())

const rows = computed(() =>
  availablePolicies(state)
    .filter((entry) => entry.unlocked || entry.active)
    .map((entry) => {
    const unmet = meetingRequirements(state, entry.def.requires)
    const pros = entry.def.effects.filter((e) => e.value > 0).map((e) => `＋ ${effectText(e.target, e.op, e.value)}`)
    const cons = entry.def.effects.filter((e) => e.value < 0).map((e) => `－ ${effectText(e.target, e.op, e.value)}`)
    const lines = [
      entry.def.desc,
      `分类：${entry.def.category} · 占用校规名额 1`,
      pros.length ? `收益：${pros.join('，')}` : '收益：无',
      cons.length ? `代价：${cons.join('，')}` : '代价：无',
      entry.active ? '当前状态：施行中' : '当前状态：未施行',
      unmet.length ? `未解锁条件：${unmet.join('、')}` : '',
      '校规名额有限，废止可立即回收名额。所有加成会实时作用于课程、比赛、招生与收支公式。',
    ].filter(Boolean)
    return {
      id: entry.def.id,
      icon: entry.def.icon,
      name: entry.def.name,
      meta: entry.active ? '施行中' : entry.unlocked ? entry.def.category : '未解锁',
      action: entry.active ? '废止' : '施行',
      disabled: !entry.unlocked,
      tone: (entry.active ? 'active' : entry.unlocked ? '' : 'locked') as '' | 'active' | 'locked' | 'done',
      lines,
    }
    }),
)

const lockedCount = computed(
  () => availablePolicies(state).filter((entry) => !entry.unlocked && !entry.active).length,
)
</script>

<template>
  <div class="panel">
    <h3>
      📜 校规
      <span class="tag" :class="{ warn: slots.used >= slots.total }">名额 {{ slots.used }} / {{ slots.total }}</span>
    </h3>
    <div class="row wrap" style="margin-bottom: 10px">
      <span class="small muted">
        学校刚接手，规矩还很少：目前可制定 {{ rows.length }} 条，另有 {{ lockedCount }} 条会随着建筑与科技的建设逐步开放。
        每条校规都有代价，鼠标移到条目上查看完整的收益与代价。
      </span>
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
        @action="engine.togglePolicy(row.id)"
      />
    </div>
  </div>
</template>
