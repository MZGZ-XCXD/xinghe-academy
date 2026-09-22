<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { LEGACY_BRANCHES, LEGACY_NODES, LEGACY_NODE_MAP } from '../data'
import { legacyNodeStatus, totalLegacyInvestment } from '../game/engine/LegacyEngine'
import { effectText, fmt } from '../ui/format'
import Tip from './Tip.vue'
import GameIcon from './GameIcon.vue'

const engine = gameEngine()
const state = gameState()
const filter = ref<string>('全部')
const branches = ['全部', ...LEGACY_BRANCHES]

const preview = computed(() => engine.prestigePreview())

const nodes = computed(() =>
  LEGACY_NODES.filter((def) => filter.value === '全部' || def.branch === filter.value).map((def) => ({
    def,
    status: legacyNodeStatus(state, def.id, engine.mods),
  })),
)

const invested = computed(() => totalLegacyInvestment(state))
</script>

<template>
  <div class="panel">
    <h3>
      🕯️ 学园传承
      <span class="tag gold">传承点 {{ fmt(state.legacy.points) }}</span>
      <span class="tag">校史点 {{ fmt(state.legacy.historyPoints) }}</span>
    </h3>
    <div class="muted small" style="margin-bottom: 10px">
      结束当前学园周期：普通资源、建筑、学生与课程都会重置，但传承树、成就与历史统计永久保留。
      传承树共七个分支，传承点无法点满全部节点——每一轮都需要选择自己的办学流派。
    </div>
    <div class="grid cols-2">
      <div>
        <div class="stat-row"><span class="muted">当前评级</span><span class="value">{{ state.school.rating.toFixed(1) }} · {{ engine.grade }}</span></div>
        <div class="stat-row"><span class="muted">累计毕业生</span><span class="value">{{ fmt(state.statistics.graduates) }}</span></div>
        <div class="stat-row"><span class="muted">比赛胜利</span><span class="value">{{ fmt(state.statistics.competitionWins) }}</span></div>
        <div class="stat-row"><span class="muted">已完成传承</span><span class="value">{{ state.legacy.prestigeCount }} 次</span></div>
        <div class="stat-row"><span class="muted">本次可获得</span><span class="value good">{{ preview.gain }} 传承点</span></div>
      </div>
      <div>
        <div class="stat-row"><span class="muted">传承门槛</span><span class="value small">{{ preview.requirement.join('、') }}</span></div>
        <div v-if="!preview.can" class="small warn">
          尚未满足：
          <div v-for="reason in preview.reasons" :key="reason">· {{ reason }}</div>
        </div>
        <button class="btn primary" style="margin-top: 10px; width: 100%" :disabled="!preview.can" @click="engine.prestige()">
          {{ preview.can ? `进行学园传承（+${preview.gain} 传承点）` : '暂不可传承' }}
        </button>
        <div class="small muted" style="margin-top: 6px">
          已投入 {{ invested }} 级传承节点。传承特性（perk）会在下一轮直接生效。
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <h3>🌳 传承树</h3>
    <div class="row wrap" style="margin-bottom: 10px">
      <button
        v-for="branch in branches"
        :key="branch"
        class="btn small"
        :class="{ primary: filter === branch }"
        @click="filter = branch"
      >
        {{ branch }}
      </button>
    </div>
    <div class="grid cols-2">
      <div v-for="item in nodes" :key="item.def.id" class="card" :class="{ locked: item.status?.locked }">
        <div class="title">
          <span><GameIcon :value="item.def.icon" :size="18" /></span>
          <span>{{ item.def.name }}</span>
          <span class="level">{{ item.status?.level ?? 0 }} / {{ item.def.maxLevel }}</span>
        </div>
        <div class="small muted">{{ item.def.desc }}</div>
        <div class="small muted">{{ item.def.branch }}</div>
        <div class="row wrap">
          <span v-for="effect in item.def.perLevelEffects ?? []" :key="effect.target" class="tag good">
            每级 {{ effectText(effect.target, effect.op, effect.value) }}
          </span>
          <span v-for="effect in item.def.effects ?? []" :key="effect.target" class="tag gold">
            {{ effectText(effect.target, effect.op, effect.value) }}
          </span>
          <span v-if="item.def.perk" class="tag gold">传承特性</span>
        </div>
        <div v-if="item.def.perkDesc" class="small muted">{{ item.def.perkDesc }}</div>
        <div v-if="item.status?.locked" class="small warn">
          需要先解锁：{{ item.status?.missing.map((id) => LEGACY_NODE_MAP[id]?.name ?? id).join('、') }}
        </div>
        <div class="row between" style="margin-top: auto">
          <span class="small muted">
            <Tip
              :label="item.status?.maxed ? '已满级' : `${item.status?.cost ?? 0} 传承点`"
              title="传承点"
              :lines="['传承点在每次学园传承时按评级、毕业生、比赛成绩与成就结算', '校史馆与校史传承节点会降低消耗、提高收益']"
            />
          </span>
          <button
            class="btn small"
            :class="{ primary: Boolean(item.status?.affordable && !item.status?.maxed && !item.status?.locked) }"
            :disabled="Boolean(item.status?.maxed || item.status?.locked || !item.status?.affordable)"
            @click="engine.buyLegacyNode(item.def.id)"
          >
            强化
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
