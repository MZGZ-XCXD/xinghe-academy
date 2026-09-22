<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { BUILDING_DEFS, RESOURCE_MAP } from '../data'
import { buildingPreview, canStartBuild } from '../game/engine/BuildingEngine'
import { effectText, fmt, fmtMinutes } from '../ui/format'
import { describeGameDuration, describeGameDurationShort, useSpeedContext } from '../ui/duration'
import CompactCard from './CompactCard.vue'

const engine = gameEngine()
const state = gameState()
const filter = ref<string>('全部')
const speedCtx = useSpeedContext()

const categories = ['全部', '教学', '科研', '生活', '体育', '文化', '交流', '行政']

interface Row {
  id: string
  icon: string
  name: string
  meta: string
  action: string
  disabled: boolean
  tone: '' | 'active' | 'locked' | 'done'
  actionTitle: string
  lines: string[]
}

function costText(cost: Partial<Record<string, number>>): string {
  return Object.entries(cost)
    .map(([key, value]) => `${RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]?.name ?? key} ${fmt(Number(value))}`)
    .join('、')
}

const unlockedDefs = computed(() => BUILDING_DEFS.filter((def) => (state.buildings[def.id]?.level ?? 0) > 0 || canStartBuild(state, def.id, engine.mods).ok || isUnlocked(def.id)))

function isUnlocked(id: string): boolean {
  const preview = buildingPreview(state, id, engine.mods)
  return preview?.unlocked === true
}

const lockedCount = computed(() => BUILDING_DEFS.filter((def) => !isUnlocked(def.id) && (state.buildings[def.id]?.level ?? 0) === 0).length)

const rows = computed<Row[]>(() =>
  unlockedDefs.value
    .filter((def) => filter.value === '全部' || def.category === filter.value)
    .map((def) => {
      const preview = buildingPreview(state, def.id, engine.mods)!
      const check = canStartBuild(state, def.id, engine.mods)
      const level = preview.level
      const queued = preview.queued
      const remain = queued ? Math.max(0, queued.endMinute - state.time.minutes) : 0
      const effects = [
        ...(def.effects ?? []).map((e) => effectText(e.target, e.op, e.value)),
        ...(def.perLevelEffects ?? []).map((e) => `每级 ${effectText(e.target, e.op, e.value)}`),
      ]
      const production = Object.entries(def.production ?? {}).map(([key, value]) => {
        const meta = RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]
        return `${meta?.icon ?? '❔'}${meta?.name ?? key} ${fmt(value * 1440)}/游戏日/级`
      })
      const storageLines = Object.entries(def.storage ?? {}).map(([key, value]) => {
        const meta = RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]
        const growth = def.storageGrowth && def.storageGrowth > 1 ? `（每级 ×${def.storageGrowth}）` : ' / 级'
        return `${meta?.icon ?? '❔'}${meta?.name ?? key} +${fmt(value)}${growth}`
      })
      const lines = [
        def.desc,
        `当前等级：Lv.${level} / ${def.maxLevel}`,
        production.length ? `基础产出：${production.join('，')}` : '',
        storageLines.length ? `仓储上限：${storageLines.join('，')}` : '',
        effects.length ? `加成：${effects.join('；')}` : '',
        def.studentCapacity ? `学生容量：+${def.studentCapacity} / 级` : '',
        def.teacherCapacity ? `教师容量：+${def.teacherCapacity} / 级` : '',
        def.courseSlots ? `课程槽位：+${def.courseSlots} / 级` : '',
        queued ? `🛠 施工中：目标 Lv.${queued.targetLevel}，剩余 ${describeGameDuration(remain, speedCtx.value)}` : '',
        preview.maxed ? '已达到最高等级' : `升级成本：${costText(preview.cost)}`,
        preview.maxed ? '' : `建造时间：${describeGameDuration(preview.minutes, speedCtx.value)}`,
        !check.ok && !queued ? `暂时无法升级：${check.reason}` : '',
        '提示：升级成本随时间指数增长，建筑之间的联动会提供额外加成。',
      ].filter(Boolean)
      const meta = queued
        ? `Lv.${level} → ${queued.targetLevel} · ${describeGameDurationShort(remain, speedCtx.value)}`
        : level > 0
          ? `Lv.${level} / ${def.maxLevel}`
          : '未建造'
      return {
        id: def.id,
        icon: def.icon,
        name: def.name,
        meta,
        action: queued ? '施工中' : preview.maxed ? '已满级' : level > 0 ? '升级' : '建造',
        disabled: Boolean(queued) || preview.maxed || !check.ok,
        tone: queued ? 'active' : level > 0 ? 'done' : '',
        actionTitle: check.reason ?? '',
        lines,
      }
    }),
)
</script>

<template>
  <div class="panel">
    <h3>
      🏗️ 建筑与扩建
      <span class="tag">{{ BUILDING_DEFS.filter((d) => (state.buildings[d.id]?.level ?? 0) > 0).length }} 已建成</span>
      <span class="tag">{{ state.buildQueue.length }} / 3 施工中</span>
    </h3>
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
      <span class="small muted" style="margin-left: auto">
        鼠标移到条目上可查看全部细节 · 未解锁的建筑满足条件后才会出现（还有 {{ lockedCount }} 栋）
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
        :action-title="row.actionTitle"
        :tone="row.tone"
        :tip-lines="row.lines"
        @action="engine.build(row.id)"
      />
    </div>
    <div v-if="rows.length === 0" class="empty">该分类下暂时没有可建造的建筑。</div>
  </div>
</template>
