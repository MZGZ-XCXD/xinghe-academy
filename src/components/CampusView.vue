<script setup lang="ts">
import { computed } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { BUILDING_DEFS } from '../data'
import { buildingPreview } from '../game/engine/BuildingEngine'
import { fmt, fmtMinutes } from '../ui/format'
import { CARD_MAP, SEASON_MAP } from '../data'
import Tip from './Tip.vue'
import GameIcon from './GameIcon.vue'

const engine = gameEngine()
const state = gameState()

const tiles = computed(() =>
  BUILDING_DEFS.map((def) => {
    const preview = buildingPreview(state, def.id, engine.mods)
    const level = state.buildings[def.id]?.level ?? 0
    const task = state.buildQueue.find((t) => t.buildingId === def.id)
    const progress = task
      ? Math.min(1, Math.max(0, (state.time.minutes - task.startMinute) / Math.max(1, task.endMinute - task.startMinute)))
      : level > 0
        ? 1
        : 0
    return { def, level, task, progress, preview }
  }).filter((t) => t.level > 0 || t.task || (t.preview?.unlocked ?? false)),
)

const seasonInfo = computed(() => SEASON_MAP[engine.season])
const report = computed(() => state.school.lastAnnualReport)
const recentCards = computed(() => state.cards.active.map((c) => CARD_MAP[c.cardId]).filter(Boolean))
</script>

<template>
  <div class="panel">
    <h3>
      🏫 校园主视图
      <span class="tag gold">总建筑等级 {{ Object.values(state.buildings).reduce((sum, b) => sum + b.level, 0) }}</span>
    </h3>
    <div class="muted small" style="margin-bottom: 10px">
      {{ seasonInfo.icon }} {{ seasonInfo.name }}：{{ seasonInfo.effects.join('；') }}
    </div>
    <div class="grid campus">
      <div
        v-for="tile in tiles"
        :key="tile.def.id"
        class="campus-tile"
        :class="{ building: Boolean(tile.task) }"
      >
        <div class="icon"><GameIcon :value="tile.def.icon" :size="26" /></div>
        <strong class="small">{{ tile.def.name }}</strong>
        <div class="small muted">
          <template v-if="tile.task">施工中 → Lv.{{ tile.task.targetLevel }}</template>
          <template v-else-if="tile.level > 0">Lv.{{ tile.level }} / {{ tile.def.maxLevel }}</template>
          <template v-else>未建造</template>
        </div>
        <div class="progress">
          <div class="bar"><span :style="{ width: `${(tile.progress * 100).toFixed(0)}%` }"></span></div>
        </div>
      </div>
    </div>
    <div v-if="tiles.length === 0" class="empty">校园里还什么都没有。</div>
  </div>

  <div class="panel">
    <h3>📋 学年报告 <span class="tag">{{ report ? `第 ${report.schoolYear} 学年` : '尚未结算' }}</span></h3>
    <div v-if="!report" class="muted small">
      第一个学年结束后会在这里生成完整报告（学术、体育、艺术、满意度、财务、比赛成绩与奖项）。
    </div>
    <template v-else>
      <div class="grid cols-3">
        <div class="stat-row"><span class="muted">学术</span><span class="value">{{ report.academic.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">体育</span><span class="value">{{ report.sports.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">艺术</span><span class="value">{{ report.arts.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">科研</span><span class="value">{{ report.research.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">满意度</span><span class="value">{{ report.satisfaction.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">评级</span><span class="value">{{ report.rating.toFixed(1) }}</span></div>
        <div class="stat-row"><span class="muted">比赛</span><span class="value">{{ report.competitionWins }} / {{ report.competitionCount }}</span></div>
        <div class="stat-row"><span class="muted">毕业生</span><span class="value">{{ fmt(report.graduates) }}</span></div>
        <div class="stat-row">
          <span class="muted">财务</span>
          <span class="value" :class="report.moneyDelta >= 0 ? 'good' : 'warn'">{{ fmt(report.moneyDelta) }}</span>
        </div>
      </div>
      <div v-if="report.awards.length" class="row wrap" style="margin-top: 8px">
        <span v-for="award in report.awards" :key="award" class="tag gold">🏅 {{ award }}</span>
      </div>
      <div v-for="note in report.notes" :key="note" class="small muted" style="margin-top: 4px">· {{ note }}</div>
    </template>
  </div>

  <div class="panel">
    <h3>🎴 当前生效的效果卡</h3>
    <div v-if="recentCards.length === 0" class="muted small">暂无生效中的效果卡。参加比赛、交流与事件有机会获得。</div>
    <div v-else class="row wrap">
      <Tip
        v-for="card in recentCards"
        :key="card!.id"
        :label="`${card!.icon} ${card!.name}`"
        :title="`${card!.rarity} · ${card!.name}`"
        :lines="[card!.desc, ...card!.effects.map((e) => `${e.target} ${e.op === 'mul' ? `${(e.value * 100).toFixed(0)}%` : `+${e.value}`}`)]"
      />
    </div>
  </div>
</template>
