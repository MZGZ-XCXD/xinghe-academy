<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { CLUB_MAP, RESOURCE_MAP, TEAM_DEFS, TEAM_TIERS, TEAM_TIER_MAP } from '../data'
import {
  canFoundTeam,
  canTrainTeam,
  teamDisplayName,
  teamMatchChance,
  teamNameSuggestions,
  teamTierStatus,
  teamUnlockStatus,
  teamUpgradeCost,
} from '../game/engine/TeamEngine'
import type { TeamDef } from '../game/types'
import { describeGameDuration, useSpeedContext } from '../ui/duration'
import { fmt } from '../ui/format'
import { meetingRequirements } from '../ui/requirements'
import GameIcon from './GameIcon.vue'
import Tip from './Tip.vue'

/**
 * 校队面板：列表只留「图标 + 队名 + 一行状态 + 按钮」，
 * 所有细节（训练消耗、扩编成本、组建条件、赛事资格……）都放进悬浮提示，
 * 需要改队名 / 挑赛事时再选一支队伍，在下面的详情区里操作。
 */
const engine = gameEngine()
const state = gameState()
const speedCtx = useSpeedContext()
const selectedId = ref<string>(TEAM_DEFS[0]?.id ?? '')
const draftNames = ref<Record<string, string>>({})
const renaming = ref(false)

function displayName(def: TeamDef): string {
  return teamDisplayName(state, def)
}

function draftFor(def: TeamDef): string {
  return draftNames.value[def.id] ?? displayName(def)
}

function setDraft(def: TeamDef, value: string): void {
  draftNames.value = { ...draftNames.value, [def.id]: value }
}

function costText(cost: Partial<Record<string, number>> | undefined): string {
  const text = Object.entries(cost ?? {})
    .map(([key, value]) => `${RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]?.name ?? key} ${fmt(Number(value))}`)
    .join('、')
  return text || '免费'
}

const info = computed(() => engine.teamInfo())

const rows = computed(() =>
  TEAM_DEFS.map((def) => {
    const entry = state.teams[def.id]
    const founded = entry?.founded === true
    const unlock = teamUnlockStatus(state, def)
    const canFound = canFoundTeam(state, def.id)
    const canTrain = founded ? canTrainTeam(state, def.id) : { ok: false, gain: 0 }
    const trainingRemain = entry?.training ? Math.max(0, entry.training.endMinute - state.time.minutes) : 0
    const matchRemain = entry?.match ? Math.max(0, entry.match.endMinute - state.time.minutes) : 0
    const upgradeCost = founded ? teamUpgradeCost(def, (entry?.level ?? 0) + 1) : {}
    const lines = founded
      ? [
          def.desc,
          `${def.shortName}（${def.kind}）· 靠「${def.attribute}」打比赛`,
          `实力 ${(entry?.strength ?? 0).toFixed(0)} · Lv.${entry?.level ?? 0} · 士气 ${(entry?.morale ?? 0).toFixed(0)}`,
          `战绩：${entry?.wins ?? 0} 胜 ${entry?.losses ?? 0} 负`,
          `单次训练：${describeGameDuration(def.training.minutes, speedCtx.value)}，消耗 ${costText(def.training.cost)}，实力 +${canTrain.gain.toFixed(1)}`,
          entry?.training
            ? `训练中，剩余 ${describeGameDuration(trainingRemain, speedCtx.value)}`
            : entry?.match
              ? `正在参加：${TEAM_TIER_MAP[entry.match.tierId]?.name ?? ''}`
              : '',
          `扩编到 Lv.${(entry?.level ?? 0) + 1}：${costText(upgradeCost)}（全员实力上限提高）`,
          '点「赛事」可以在这支队伍的详情里改名、报名比赛。',
        ]
      : [
          def.desc,
          `项目：${def.shortName}（${def.kind}）· 靠「${def.attribute}」打比赛`,
          `组建条件：${clubRequirementText(def)}`,
          unlock.reasons.length ? `还差：${unlock.reasons.join('、')}` : '条件已满足',
          `组建花费：${costText(def.foundingCost)}${
            def.foundingActivity ? ` · 学生活跃度 ${def.foundingActivity}` : ''
          } · 最低 ${def.minStudents} 名学生`,
          `起步实力 ${def.baseStrength} · 训练一次 ${describeGameDuration(def.training.minutes, speedCtx.value)}`,
          `推荐队名：${teamNameSuggestions(state, def, 3).join(' / ')}（选中后可在详情里自己改）`,
        ]
    return {
      def,
      entry,
      founded,
      unlock,
      canFound,
      canTrain,
      trainingRemain,
      matchRemain,
      matchTier: entry?.match ? TEAM_TIER_MAP[entry.match.tierId] : null,
      meta: founded
        ? entry?.training
          ? `训练中 · 剩余 ${describeGameDuration(trainingRemain, speedCtx.value)}`
          : entry?.match
            ? `比赛中 · ${TEAM_TIER_MAP[entry.match.tierId]?.name ?? ''}`
            : `Lv.${entry?.level ?? 0} · 实力 ${(entry?.strength ?? 0).toFixed(0)} · 士气 ${(entry?.morale ?? 0).toFixed(0)} · ${entry?.wins ?? 0} 胜 ${entry?.losses ?? 0} 负`
        : unlock.reasons.length
          ? `还差：${unlock.reasons.join('、')}`
          : `可以组建 · 起步实力 ${def.baseStrength}${
              def.foundingActivity ? ` · 需要学生活跃度 ${def.foundingActivity}` : ''
            }`,
      lines: lines.filter(Boolean),
    }
  }).sort((a, b) => Number(b.founded) - Number(a.founded)),
)

/** 列表分三组：上面已成立，中间能成立，最下面暂时不能成立 */
const groups = computed(() => [
  { id: 'founded', title: '✅ 已成立', rows: rows.value.filter((row) => row.founded) },
  {
    id: 'available',
    title: '🏗️ 可以组建',
    rows: rows.value.filter((row) => !row.founded && row.canFound.ok),
  },
  {
    id: 'locked',
    title: '🚫 暂时不能成立',
    rows: rows.value.filter((row) => !row.founded && !row.canFound.ok),
  },
])

const selectable = computed(() => rows.value.find((row) => row.def.id === selectedId.value) ?? rows.value[0] ?? null)

const tiers = computed(() => {
  const def = selectable.value?.def
  if (!def) return []
  return TEAM_TIERS.slice(0, def.maxTierIndex + 1).map((tier) => ({
    tier,
    status: teamTierStatus(state, def.id, tier),
    chance: teamMatchChance(state, def, tier, engine.mods),
    unmet: meetingRequirements(state, tier.requires),
  }))
})

const recentResults = computed(() => state.statistics.activityLog.filter((entry) => entry.kind === 'team').slice(0, 4))

function clubRequirementText(def: TeamDef): string {
  if (!def.requiresClub) return '无需社团'
  const club = CLUB_MAP[def.requiresClub.id]
  const parts: string[] = []
  if (def.requiresClub.level) parts.push(`Lv.${def.requiresClub.level}`)
  if (def.requiresClub.members) parts.push(`社员 ≥ ${def.requiresClub.members} 人`)
  return `${club?.name ?? def.requiresClub.id}${parts.length ? ` ${parts.join(' 且 ')}` : ''}`
}
</script>

<template>
  <div class="panel">
    <h3>
      🥋 校队
      <span class="tag">{{ info.founded }} / {{ info.total }} 已成立</span>
      <span class="tag">可组建 {{ info.unlocked }}</span>
      <span class="tag gold">战绩 {{ info.wins }} 胜 {{ info.losses }} 负</span>
      <Tip
        label="❔"
        title="校队是怎么来的"
        :lines="[
          '解锁链：建筑 → 社团 → 社团等级与人数 → 上报成立校队',
          '例如：音乐教室 → 轻音社 → 轻音社 Lv.3 且社员 ≥ 30 人 → 上报成立乐队',
          '队名默认按学校名生成（学校叫「星丘」就会推荐「星丘火鸟队」），选中队伍后可以自己改',
          '队伍靠日常训练累积实力，实力够了才能报名更高级别的赛事：友谊赛 → 区 → 市 → 省 → 全国 → 国际',
          '训练与比赛会影响队员状态；队员退役、恋爱之类的事会以事件形式出现',
        ]"
      />
    </h3>
    <div class="muted small" style="margin-bottom: 10px">
      已成立的队伍排在最上面；能组建的排第二组；暂时不满足条件的收在最后一组（鼠标移上去能看到还差什么）。
      点「详情」在下方改名、扩编或报名比赛。
    </div>

    <template v-for="group in groups" :key="group.id">
      <template v-if="group.rows.length">
        <div class="section-head">
          {{ group.title }}（{{ group.rows.length }}）
          <span v-if="group.id === 'locked'" class="small muted">满足条件后会自动移到上一组</span>
        </div>
        <div class="grid teams">
          <Tip v-for="row in group.rows" :key="row.def.id" block :title="displayName(row.def)" :lines="row.lines" :width="340">
            <div
              class="info-card team-card"
              :class="{ locked: !row.founded && !row.canFound.ok, active: selectedId === row.def.id }"
            >
              <span class="ic-icon"><GameIcon :value="row.def.icon" :size="18" /></span>
              <span class="ic-name">{{ displayName(row.def) }}</span>
              <span class="tag">{{ row.def.shortName }}</span>
              <span class="team-actions">
                <button
                  v-if="row.founded"
                  class="btn small"
                  :class="{ primary: row.canTrain.ok }"
                  :disabled="!row.canTrain.ok"
                  :title="row.canTrain.reason ?? ''"
                  @click.stop="engine.trainTeam(row.def.id)"
                >
                  训练
                </button>
                <button
                  v-else-if="row.canFound.ok"
                  class="btn small"
                  primary
                  :title="row.canFound.reason ?? ''"
                  @click.stop="engine.foundTeam(row.def.id, displayName(row.def))"
                >
                  上报成立
                </button>
                <button class="btn small ghost" @click.stop="selectedId = row.def.id">详情</button>
              </span>
              <span class="team-status">{{ row.meta }}</span>
            </div>
          </Tip>
        </div>
      </template>
    </template>
  </div>

  <div v-if="selectable" class="panel">
    <h3>
      <GameIcon :value="selectable.def.icon" :size="18" />
      {{ displayName(selectable.def) }}
      <span class="tag">{{ selectable.def.shortName }}</span>
      <template v-if="selectable.founded">
        <span class="tag gold">实力 {{ (selectable.entry?.strength ?? 0).toFixed(0) }}</span>
        <span class="tag">士气 {{ (selectable.entry?.morale ?? 0).toFixed(0) }}</span>
        <Tip
          label="详情"
          title="这支队伍"
          :lines="[
            `Lv.${selectable.entry?.level ?? 0} · 战绩 ${selectable.entry?.wins ?? 0} 胜 ${selectable.entry?.losses ?? 0} 负`,
            `单次训练 ${describeGameDuration(selectable.def.training.minutes, speedCtx)}，消耗 ${costText(selectable.def.training.cost)}`,
            `扩编到 Lv.${(selectable.entry?.level ?? 0) + 1}：${costText(teamUpgradeCost(selectable.def, (selectable.entry?.level ?? 0) + 1))}`,
            selectable.def.desc,
          ]"
        />
      </template>
      <span v-else class="tag warn">尚未组建</span>
    </h3>

    <!-- 未成立：在这里挑队名并上报 -->
    <template v-if="!selectable.founded">
      <div class="small muted" style="margin-bottom: 6px">
        组建条件：{{ clubRequirementText(selectable.def) }}
        <template v-if="selectable.unlock.reasons.length"> · 还差 {{ selectable.unlock.reasons.join('、') }}</template>
        · 花费 {{ costText(selectable.def.foundingCost) }}
        <template v-if="selectable.def.foundingActivity"> · 学生活跃度 {{ selectable.def.foundingActivity }}</template>
      </div>
      <div class="row wrap" style="margin-bottom: 6px">
        <span class="small muted">推荐队名</span>
        <button
          v-for="name in teamNameSuggestions(state, selectable.def, 4)"
          :key="name"
          class="btn small ghost"
          @click="setDraft(selectable.def, name)"
        >
          {{ name }}
        </button>
      </div>
      <div class="row wrap" style="margin-bottom: 8px">
        <input
          :value="draftFor(selectable.def)"
          class="name-input"
          maxlength="24"
          @input="setDraft(selectable.def, ($event.target as HTMLInputElement).value)"
        />
        <span class="small muted">也可以自己写，最多 24 字</span>
        <button
          class="btn small"
          :class="{ primary: selectable.canFound.ok }"
          :disabled="!selectable.canFound.ok"
          :title="selectable.canFound.reason ?? ''"
          @click="engine.foundTeam(selectable.def.id, draftFor(selectable.def))"
        >
          上报成立
        </button>
      </div>
    </template>

    <!-- 已成立：改名 / 扩编 + 赛事列表 -->
    <template v-else>
      <div class="row wrap" style="margin-bottom: 8px">
        <template v-if="renaming">
          <input
            :value="draftFor(selectable.def)"
            class="name-input"
            maxlength="24"
            @input="setDraft(selectable.def, ($event.target as HTMLInputElement).value)"
          />
          <button
            class="btn small primary"
            @click="engine.renameTeam(selectable.def.id, draftFor(selectable.def)); renaming = false"
          >
            确认改名
          </button>
          <button class="btn small ghost" @click="renaming = false">取消</button>
        </template>
        <template v-else>
          <button class="btn small ghost" @click="setDraft(selectable.def, displayName(selectable.def)); renaming = true">
            ✏️ 改名
          </button>
          <span class="small muted">当前队名：{{ displayName(selectable.def) }}</span>
        </template>
      </div>

      <div class="grid compact">
        <Tip
          v-for="item in tiers"
          :key="item.tier.id"
          block
          :title="item.tier.name"
          :lines="[
            item.tier.desc,
            `门槛：实力 ≥ ${item.tier.minStrength}（当前 ${(selectable.entry?.strength ?? 0).toFixed(0)}）· 对手强度 ${item.tier.difficulty}`,
            `胜率 ${(item.chance * 100).toFixed(0)}%`,
            `耗时 ${describeGameDuration(item.tier.durationMinutes, speedCtx)}（括号内是现实时间）`,
            `报名费 ${costText(item.tier.cost)} · 需要 ${item.tier.memberCost} 名队员`,
            `奖励：声望 +${item.tier.rewardReputation}${item.tier.cardChance ? ` · 卡片 ${(item.tier.cardChance * 100).toFixed(0)}%` : ''}`,
            item.unmet.length ? `参赛资格未满足：${item.unmet.join('、')}` : '参赛资格已满足',
            item.status.available ? '' : `暂时不能报名：${item.status.reason ?? ''}`,
          ].filter(Boolean)"
          :width="340"
        >
          <div class="info-card" :class="{ locked: !item.status.available }">
            <span class="ic-icon"><GameIcon :value="item.tier.icon" :size="18" /></span>
            <span class="ic-name">{{ item.tier.name }}</span>
            <span class="ic-meta">胜率 {{ (item.chance * 100).toFixed(0) }}%</span>
            <button
              class="btn small"
              :class="{ primary: item.status.available }"
              :disabled="!item.status.available"
              :title="item.status.reason ?? ''"
              @click="engine.teamMatch(selectable!.def.id, item.tier.id)"
            >
              参赛
            </button>
          </div>
        </Tip>
      </div>
    </template>
  </div>

  <div v-if="recentResults.length" class="panel">
    <h3>📜 近期赛事记录</h3>
    <div class="scrollable">
      <div v-for="(entry, index) in recentResults" :key="index" class="stat-row">
        <span class="muted small">第 {{ Math.floor(entry.minute / 1440) }} 天</span>
        <span class="small">{{ entry.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 分组标题 */
.section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 10px 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.section-head:first-of-type {
  margin-top: 0;
}

/* 队伍卡片：队名独占一行，不会被按钮挤成一个字 */
.grid.teams {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.team-card {
  flex-wrap: wrap;
  align-items: center;
  row-gap: 4px;
}

.team-card .ic-name {
  flex: 1 1 auto;
  min-width: 0;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}

.team-card .team-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.team-card .team-status {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--muted);
}
</style>
