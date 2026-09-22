<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { fmt, fmtMinutes, resourceIcon, resourceName } from '../ui/format'
import { ALL_RESOURCES } from '../data/resources'
import { RESOURCE_MAP } from '../data/resources'
import { isStorableResource } from '../game/formulas'
import { STUDENT_ATTR_META } from '../game/types'
import { overallAttributes, overallWellbeing, totalStudents, teacherEfficiency } from '../game/formulas'
import { activeCardSummaries } from '../game/engine/CardEngine'
import { ACTIVITY_MAP, CARD_MAP } from '../data'
import { TEAM_TIERS } from '../data'
import Tip from './Tip.vue'
import GameIcon from './GameIcon.vue'
import { describeGameDurationShort, formatRealRate, rateExplainer, useSpeedContext } from '../ui/duration'

const engine = gameEngine()
const state = gameState()

const rates = computed(() => engine.rates())
const attrs = computed(() => overallAttributes(state))
const wellbeing = computed(() => overallWellbeing(state))
const cards = computed(() => activeCardSummaries(state))
const activities = computed(() =>
  state.activeActivities.map((a) => {
    const def = ACTIVITY_MAP[a.defId]
    const total = Math.max(1, a.endMinute - a.startMinute)
    return {
      uid: a.uid,
      name: def?.name ?? a.defId,
      icon: def?.icon ?? '🎽',
      progress: Math.min(1, Math.max(0, (state.time.minutes - a.startMinute) / total)),
      remain: Math.max(0, a.endMinute - state.time.minutes),
    }
  }),
)
const pendingEvents = computed(() => engine.activeEvents())

function rateLines(key: (typeof ALL_RESOURCES)[number]) {
  const rate = rates.value[key]
  if (!rate) return ['无数据']
  return rate.parts
    .filter((p) => Math.abs(p.value) > 0.0001)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8)
    .map((p) => `${p.source}：${formatRealRate(p.value, speedCtx.value)}`)
}

const teacherEff = computed(() => teacherEfficiency(state))
const clubs = computed(() => engine.clubInfo())
const teams = computed(() => engine.teamInfo())
const speedCtx = useSpeedContext()

/** 有仓储上限的资源：显示「当前 / 上限」，并给出拆解 */
const storage = computed(() =>
  ALL_RESOURCES.map((key) => {
    if (!isStorableResource(key)) return null
    const info = engine.storageInfo(key)
    const value = state.resources[key] ?? 0
    return {
      key,
      value,
      cap: info.total,
      ratio: info.total > 0 ? value / info.total : 0,
      lines: [
        `仓储上限：${fmt(info.total)}`,
        `基础容量：${fmt(info.base)}`,
        ...info.parts.map((p) => `${p.source}：+${fmt(p.value)}`),
        info.multiplier !== 1 ? `仓储加成：×${info.multiplier.toFixed(2)}` : '',
        '超出上限的产出会被浪费；扩建财务处 / 教材库 / 仪器库 / 器材库 / 道具库可以提升上限。',
      ].filter(Boolean),
    }
  }).filter((item): item is NonNullable<typeof item> => item !== null),
)

const storageAlerts = computed(() => storage.value.filter((s) => s.ratio >= 0.95))
</script>

<template>
  <div class="panel">
    <h3>
      💰 学校资源
      <span v-if="storageAlerts.length" class="tag warn">⚠ {{ storageAlerts.length }} 项接近上限</span>
    </h3>
    <div class="small muted" style="margin-bottom: 6px">
      所有增减都按现实时间显示：{{ rateExplainer(speedCtx) }}
    </div>
    <div v-if="storageAlerts.length" class="small muted" style="margin-bottom: 6px">
      {{ storageAlerts.map((s) => resourceName(s.key)).join('、') }} 快满了，超出仓储上限的产出会被浪费。
    </div>
    <div v-for="key in ALL_RESOURCES" :key="key" class="stat-row">
      <span class="muted">
        {{ resourceIcon(key) }} {{ resourceName(key) }}
      </span>
      <span class="value" :class="{ warn: isStorableResource(key) && (storage.find((s) => s.key === key)?.ratio ?? 0) >= 0.95 }">
        <Tip
          :label="
            isStorableResource(key)
              ? `${fmt(state.resources[key])} / ${fmt(storage.find((s) => s.key === key)?.cap ?? 0)}`
              : fmt(state.resources[key])
          "
          :title="`${resourceName(key)} 明细（${RESOURCE_MAP[key].tier}资源）`"
          :lines="[
            RESOURCE_MAP[key].desc,
            ...rateLines(key),
            ...(storage.find((s) => s.key === key)?.lines ?? []),
          ]"
        />
      </span>
    </div>
  </div>

  <div class="panel">
    <h3>🎓 学生状态 <span class="tag">{{ fmt(totalStudents(state)) }} 人</span></h3>
    <div v-for="meta in STUDENT_ATTR_META" :key="meta.key" class="stat-row">
      <span class="muted">
        <Tip :label="`${meta.icon} ${meta.name}`" :title="meta.name" :lines="[meta.desc]" />
      </span>
      <span class="value">{{ (attrs[meta.key as keyof typeof attrs] ?? 0).toFixed(1) }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">😖 压力</span>
      <span class="value" :class="wellbeing.stress > 65 ? 'warn' : 'good'">{{ wellbeing.stress.toFixed(0) }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">🙂 满意度</span>
      <span class="value" :class="wellbeing.satisfaction < 45 ? 'warn' : 'good'">{{ wellbeing.satisfaction.toFixed(0) }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">📣 教师效率</span>
      <span class="value">×{{ teacherEff.toFixed(2) }}</span>
    </div>
  </div>

  <div class="panel">
    <h3>🎽 社团（部活）</h3>
    <div class="stat-row">
      <span class="muted">社团 / 部室</span>
      <span class="value">{{ clubs.founded }} / {{ clubs.slots }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">社员</span>
      <span class="value">{{ fmt(clubs.members) }} / {{ fmt(clubs.memberCapacity) }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">社团等级总和</span>
      <span class="value">{{ clubs.totalLevels }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">
        <Tip
          label="学园祭评分"
          title="学园祭评分"
          :lines="[
            '每个社团每级都会贡献祭典分数',
            '学园祭 / 体育祭 / 合唱祭等祭典类活动的成功率与奖励由此决定',
            '中庭广场、学园祭筹办科技、校规「文化祭停课筹备」都能提升它',
          ]"
        />
      </span>
      <span class="value gold">{{ Math.round(clubs.festivalScore) }} · {{ clubs.festivalLabel }}</span>
    </div>
  </div>

  <div v-if="state.ui.unlockedTabs.includes('teams')" class="panel">
    <h3>🥋 校队</h3>
    <div class="stat-row">
      <span class="muted">已成立</span>
      <span class="value">{{ teams.founded }} / {{ teams.total }}</span>
    </div>
    <div class="stat-row">
      <span class="muted">战绩</span>
      <span class="value">{{ teams.wins }} 胜 {{ teams.losses }} 负</span>
    </div>
    <div class="stat-row">
      <span class="muted">
        <Tip
          label="总实力"
          title="校队实力"
          :lines="[
            '每支校队独立训练、独立参赛',
            '训练收益受队员属性、教师效率、士气与科技/传承加成影响',
            '实力决定能报名哪一级赛事（友谊赛 → 区 → 市 → 省 → 全国 → 国际）',
          ]"
        />
      </span>
      <span class="value">{{ fmt(teams.totalStrength) }}</span>
    </div>
    <div v-if="teams.bestTier >= 0" class="stat-row">
      <span class="muted">最高赛事</span>
      <span class="value gold">{{ TEAM_TIERS[teams.bestTier]?.name }}</span>
    </div>
  </div>

  <div class="panel">
    <h3>📌 进行中</h3>
    <div v-if="pendingEvents.length === 0 && activities.length === 0 && cards.length === 0" class="muted small">
      当前没有待处理的事件、活动或效果卡。
    </div>
    <div v-for="entry in pendingEvents" :key="entry.event.uid" class="card" style="margin-bottom: 8px">
      <div class="row between">
        <strong>{{ entry.def.icon }} {{ entry.def.title }}</strong>
        <span class="tag warn">待决策</span>
      </div>
      <div class="small muted">{{ entry.event.source }}</div>
      <button class="btn small primary" @click="engine.setTab('events')">前往处理</button>
    </div>
    <div v-for="item in activities" :key="item.uid" class="card" style="margin-bottom: 8px">
      <div class="row between">
        <strong>{{ item.icon }} {{ item.name }}</strong>
        <span class="small muted">{{ fmtMinutes(item.remain) }}</span>
      </div>
      <div class="bar"><span :style="{ width: `${(item.progress * 100).toFixed(1)}%` }"></span></div>
    </div>
    <div v-for="card in cards" :key="card.uid" class="card" style="margin-bottom: 8px">
      <div class="row between">
        <strong :class="`rarity-${card.def?.rarity}`"><GameIcon :value="card.def?.icon" :size="16" /> {{ card.def?.name }}</strong>
        <span class="tag">
          {{ card.usesLeft != null ? `${card.usesLeft} 次` : card.remainingMinutes != null ? describeGameDurationShort(card.remainingMinutes, speedCtx) : '永久' }}
        </span>
      </div>
      <div class="small muted">{{ card.def?.desc }}</div>
    </div>
  </div>
</template>
