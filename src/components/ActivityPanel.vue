<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { ACTIVITY_DEFS, ACTIVITY_MAP, RESOURCE_MAP } from '../data'
import { activityCheck, activityProgress } from '../game/engine/ActivityEngine'
import { fmt } from '../ui/format'
import { describeGameDuration, useSpeedContext } from '../ui/duration'
import { meetingRequirements } from '../ui/requirements'
import { festivalLabel, festivalScore } from '../game/engine/ClubEngine'
import { SEASON_LABEL, type ResourceKey } from '../game/types'
import Tip from './Tip.vue'
import GameIcon from './GameIcon.vue'
import CompactCard from './CompactCard.vue'

const props = defineProps<{ mode: 'competition' | 'exchange' }>()

const engine = gameEngine()
const state = gameState()

const kinds = computed(() =>
  props.mode === 'exchange'
    ? ['校际交流', '国际交流']
    : ['体育比赛', '学术比赛', '艺术比赛', '科研比赛', '校园活动'],
)

const filter = ref('全部')
const filterOptions = computed(() => ['全部', ...kinds.value])
const score = computed(() => festivalScore(state, engine.mods))
const speedCtx = useSpeedContext()
const showBlocked = ref(false)

const activities = computed(() =>
  ACTIVITY_DEFS.filter(
    (def) => kinds.value.includes(def.kind) && (filter.value === '全部' || def.kind === filter.value),
  ).map((def) => {
    const check = activityCheck(state, def.id, engine.mods)
    return {
      def,
      check,
      unmet: meetingRequirements(state, def.requires),
      chance: (check.chance ?? 0) * 100,
      strength: check.strength ?? 0,
    }
  }),
)

/** 上面：现在就能派出队伍的；下面：暂时还差前置条件的（默认折叠） */
const available = computed(() => activities.value.filter((item) => item.check.ok))
const blocked = computed(() => activities.value.filter((item) => !item.check.ok))

const running = computed(() =>
  state.activeActivities.map((activity) => ({
    activity,
    def: ACTIVITY_MAP[activity.defId],
    progress: activityProgress(state, activity.uid),
    remain: Math.max(0, activity.endMinute - state.time.minutes),
  })),
)

type Item = (typeof activities.value)[number]

function costText(cost: Partial<Record<string, number>>) {
  const text = Object.entries(cost ?? {})
    .map(([key, value]) => `${RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]?.name ?? key} ${fmt(Number(value))}`)
    .join(' · ')
  return text || '无'
}

function rewardText(def: Item['def']): string {
  const parts: string[] = [`学校声望 +${def.rewards.reputation ?? 0}`]
  if (def.rewards.recruitBonus) parts.push(`招生 +${def.rewards.recruitBonus} 人（计入下一年新生）`)
  for (const [key, value] of Object.entries(def.rewards.resources ?? {})) {
    parts.push(`${RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]?.name ?? key} +${fmt(Number(value))}`)
  }
  parts.push(`效果卡 ${((def.rewards.cardChance ?? 0) * 100).toFixed(0)}%`)
  return parts.join('、')
}

/** 悬浮提示：活动的全部细节都在这里，列表上只留名字与状态 */
function tipLines(item: Item): string[] {
  const def = item.def
  const seasons = def.seasons?.length ? `（仅${def.seasons.map((s) => SEASON_LABEL[s]).join('、')}季开放）` : ''
  return [
    def.desc,
    `类别：${def.kind}${seasons}`,
    item.check.ok
      ? `成功率：${item.chance.toFixed(0)}%（对应属性 ${def.attribute}，队伍实力 ${item.strength.toFixed(1)} / 难度 ${def.difficulty}）`
      : `暂时不能开展：${item.check.reason ?? '条件不满足'}`,
    `耗时：${describeGameDuration(def.durationMinutes, speedCtx.value)}`,
    `学生需求：≥ ${def.studentCost} 人`,
    `成本：${costText(def.cost)}`,
    `奖励：${rewardText(def)}`,
    def.kind === '校园活动' ? '祭典类活动：成功率与奖励受学园祭评分影响' : '',
    item.unmet.length ? `前置条件：${item.unmet.join('、')}` : '',
  ].filter(Boolean)
}

/** 折叠清单上的一行说明：优先写清「差什么」，而不是笼统的「尚未解锁」 */
function blockedMeta(item: Item): string {
  if (item.unmet.length) return `差：${item.unmet.join('、')}`
  const missing = Object.entries(item.def.cost ?? {})
    .filter(([key, value]) => (state.resources[key as ResourceKey] ?? 0) + 1e-6 < Number(value))
    .map(([key, value]) => `${RESOURCE_MAP[key as ResourceKey]?.name ?? key} ${fmt(Number(value))}`)
  if (missing.length) return `缺：${missing.join('、')}`
  return item.check.reason ?? '条件不满足'
}
</script>

<template>
  <div class="panel">
    <h3>
      {{ props.mode === 'exchange' ? '🤝 校外交流' : '🏆 比赛与校园活动' }}
      <span class="tag">{{ available.length }} 可开展</span>
      <span v-if="blocked.length" class="tag">{{ blocked.length }} 暂不可</span>
      <span v-if="props.mode === 'competition'" class="tag gold">
        学园祭评分 {{ Math.round(score) }} · {{ festivalLabel(score) }}
      </span>
    </h3>
    <div class="row wrap" style="margin-bottom: 8px">
      <button
        v-for="kind in filterOptions"
        :key="kind"
        class="btn small"
        :class="{ primary: filter === kind }"
        @click="filter = kind"
      >
        {{ kind }}
      </button>
    </div>
    <div class="muted small" style="margin-bottom: 10px">
      成功率由「对应学生属性 × 教师效率 × 建筑 / 科技 / 卡片加成」对抗活动难度决定；鼠标移到条目上可查看全部细节。
      暂时不能开展的活动都收在下面，满足前置条件后会自动移上来。
    </div>

    <div v-if="running.length" class="grid cols-2" style="margin-bottom: 12px">
      <div v-for="item in running" :key="item.activity.uid" class="card active">
        <div class="title">
          <span><GameIcon :value="item.def?.icon" :size="20" /></span>
          <span>{{ item.def?.name }}</span>
          <span class="level">{{ describeGameDuration(item.remain, speedCtx) }}</span>
        </div>
        <div class="bar"><span :style="{ width: `${(item.progress * 100).toFixed(1)}%` }"></span></div>
        <div class="small muted">队伍实力 {{ item.activity.teamStrength.toFixed(1) }}</div>
      </div>
    </div>

    <div class="section-head">✅ 可以开展（{{ available.length }}）</div>
    <div v-if="available.length" class="grid cols-2">
      <div v-for="item in available" :key="item.def.id" class="card activity-card">
        <div class="title">
          <span><GameIcon :value="item.def.icon" :size="18" /></span>
          <span>{{ item.def.name }}</span>
          <span class="level">
            {{ item.def.kind }}
            <template v-if="item.def.seasons?.length">
              · 仅{{ item.def.seasons.map((s) => SEASON_LABEL[s]).join('、') }}季
            </template>
          </span>
        </div>
        <div class="small muted">{{ item.def.desc }}</div>
        <div class="stat-row">
          <span class="muted">成功率</span>
          <span class="value" :class="item.chance >= 60 ? 'good' : item.chance >= 40 ? '' : 'warn'">
            <Tip
              :label="`${item.chance.toFixed(0)}%`"
              title="成功率计算"
              :lines="[
                `对应属性：${item.def.attribute}`,
                `队伍实力：${item.strength.toFixed(1)}`,
                `活动难度：${item.def.difficulty}`,
                `基础成功率：${(item.def.baseSuccess * 100).toFixed(0)}%`,
              ]"
            />
          </span>
        </div>
        <div class="stat-row">
          <span class="muted">耗时</span>
          <span class="value">{{ describeGameDuration(item.def.durationMinutes, speedCtx) }}</span>
        </div>
        <div class="stat-row"><span class="muted">学生需求</span><span class="value">≥ {{ item.def.studentCost }} 人</span></div>
        <div class="stat-row">
          <span class="muted">成本</span>
          <span class="value">{{ costText(item.def.cost) }}</span>
        </div>
        <div class="row wrap">
          <span class="tag gold">声望 +{{ item.def.rewards.reputation ?? 0 }}</span>
          <span v-if="item.def.kind === '校园活动'" class="tag good">祭典 · 受学园祭评分影响</span>
          <span v-if="item.def.rewards.recruitBonus" class="tag gold">
            🎓 招生 +{{ item.def.rewards.recruitBonus }} 人（计入下一年新生）
          </span>
          <span v-for="(value, key) in item.def.rewards.resources" :key="key" class="tag">
            {{ RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]?.name }} +{{ fmt(Number(value)) }}
          </span>
          <span class="tag">卡片 {{ ((item.def.rewards.cardChance ?? 0) * 100).toFixed(0) }}%</span>
        </div>
        <div class="row between" style="margin-top: auto">
          <span class="small muted">{{ item.check.reason ?? '条件满足' }}</span>
          <button class="btn small primary" @click="engine.startActivity(item.def.id)">派出队伍</button>
        </div>
      </div>
    </div>
    <div v-else class="empty">这一类活动暂时都开展不了，先去看看下面缺什么条件。</div>

    <template v-if="blocked.length">
      <div class="row between section-head">
        <span>🚫 暂时无法开展（{{ blocked.length }}）</span>
        <button class="btn small ghost" @click="showBlocked = !showBlocked">
          {{ showBlocked ? '收起' : '展开' }}
        </button>
      </div>
      <div v-if="showBlocked" class="grid compact blocked-activities">
        <CompactCard
          v-for="item in blocked"
          :key="item.def.id"
          :icon="item.def.icon"
          :name="item.def.name"
          :meta="item.check.reason ?? '条件不满足'"
          tone="locked"
          :tip-lines="tipLines(item)"
        />
      </div>
      <div v-else class="small muted">
        原因多是差建筑、科技、社团等级或学生人数——鼠标移到名称上可看细节，点「展开」查看完整清单。
      </div>
    </template>

    <h3 style="margin-top: 16px">📜 最近结果</h3>
    <div v-if="state.activityResults.length === 0" class="muted small">还没有参加任何活动。</div>
    <table v-else class="data">
      <thead>
        <tr><th>活动</th><th>结果</th><th>获得</th></tr>
      </thead>
      <tbody>
        <tr v-for="result in state.activityResults.slice(0, 12)" :key="result.uid">
          <td>{{ result.name }}</td>
          <td>
            <span class="tag" :class="result.big ? 'gold' : result.success ? 'good' : 'bad'">
              {{ result.big ? '大成功' : result.success ? '成功' : '未获奖' }}
            </span>
          </td>
          <td class="small muted">{{ result.log.join('，') || '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.blocked-activities {
  opacity: 0.85;
}
</style>
