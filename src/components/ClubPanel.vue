<script setup lang="ts">
import { computed, ref } from 'vue'
import { gameEngine, gameState } from '../ui/game'
import { CLUB_DEFS } from '../data'
import { canUpgradeClub, clubMembersOf, festivalScore, festivalLabel, isClubUnlocked } from '../game/engine/ClubEngine'
import { fmt, studentStatLabel } from '../ui/format'
import { RESOURCE_MAP } from '../data'
import { meetingRequirements } from '../ui/requirements'
import CompactCard from './CompactCard.vue'

const engine = gameEngine()
const state = gameState()
const filter = ref('全部')
const categories = ['全部', '文化', '运动', '学术', '兴趣', '特殊']

const info = computed(() => engine.clubInfo())
const score = computed(() => festivalScore(state, engine.mods))

const rows = computed(() =>
  CLUB_DEFS.filter((def) => filter.value === '全部' || def.category === filter.value)
    .filter((def) => isClubUnlocked(state, def) || (state.clubs[def.id]?.level ?? 0) > 0)
    .map((def) => {
      const entry = state.clubs[def.id]!
      const check = canUpgradeClub(state, def.id, engine.mods)
      const level = entry.level
      const nextMembers = clubMembersOf(def, Math.max(1, check.nextLevel))
      const growth = Object.entries(def.growth ?? {}).map(
        ([key, value]) => `${studentStatLabel(key)} ${fmt(value, 3)} / 天`,
      )
      const output = Object.entries(def.output ?? {}).map(([key, value]) => {
        const meta = RESOURCE_MAP[key as keyof typeof RESOURCE_MAP]
        return `${meta?.icon ?? '❔'}${meta?.name ?? key} ${fmt(value, 1)} / 天`
      })
      const lines = [
        def.jpName ? `${def.name}（${def.jpName}）` : def.name,
        def.desc,
        `分类：${def.category}`,
        `社员：${level > 0 ? `${entry.members} 人` : `成立后 ${def.baseMembers} 人`}（升级后 ${nextMembers} 人）`,
        level > 0 ? `当前等级：Lv.${level} / ${def.maxLevel}` : '尚未成立',
        check.ok || level < def.maxLevel
          ? `${level === 0 ? '成立' : '升级'}需要：资金 ${check.money}、学生活跃度 ${check.activity}`
          : '已达到最高等级',
        `运营成本：${def.upkeepPerLevelPerDay * Math.max(1, level)} 资金 / 天`,
        growth.length ? `社员成长：${growth.join('，')}（按社员规模折算）` : '',
        output.length ? `日常产出：${output.join('，')}` : '',
        `学园祭贡献：${def.festivalScore * Math.max(1, level)} 分 / 级`,
        (def.boostsActivities ?? []).length ? `提升活动：${(def.boostsActivities ?? []).join('、')}` : '',
        unmetOf(def.id).length ? `未解锁条件：${unmetOf(def.id).join('、')}` : '',
        check.reason && level < def.maxLevel ? `无法${level === 0 ? '成立' : '升级'}：${check.reason}` : '',
      ].filter(Boolean)
      return {
        id: def.id,
        icon: def.icon,
        name: def.name,
        meta: level > 0 ? `Lv.${level} · ${entry.members} 人` : '未成立',
        action: check.ok ? (level === 0 ? '成立' : '升级') : level >= def.maxLevel ? '已满级' : '升级',
        disabled: !check.ok,
        tone: (level > 0 ? 'active' : '') as '' | 'active' | 'locked' | 'done',
        lines,
      }
    }),
)

function unmetOf(id: string): string[] {
  const def = CLUB_DEFS.find((c) => c.id === id)
  return def ? meetingRequirements(state, def.requires) : []
}

const lockedCount = computed(() => CLUB_DEFS.filter((def) => !isClubUnlocked(state, def) && (state.clubs[def.id]?.level ?? 0) === 0).length)
</script>

<template>
  <div class="panel">
    <h3>
      🎽 社团（部活）
      <span class="tag">部室 {{ info.founded }} / {{ info.slots }}</span>
      <span class="tag">社员 {{ fmt(info.members) }} / {{ fmt(info.memberCapacity) }}</span>
      <span class="tag gold">学园祭评分 {{ fmt(score) }} · {{ festivalLabel(score) }}</span>
    </h3>
    <div class="muted small" style="margin-bottom: 8px">
      社团由学生自己运营：占用部室与社员名额（允许兼部，一个学生可以同时参加两个社团），每天消耗运营资金，换来属性成长、资源产出与学园祭评分。
      学园祭、体育祭、合唱祭等祭典类活动的成功率与奖励都由学园祭评分决定。
      社团会随着建筑（音乐教室、艺术楼、大礼堂、游泳馆、弓道场、天文台、创客实验室……）与科技（社团体系、部会运营、学园祭筹办）逐步开放。
    </div>
    <div class="muted small" style="margin-bottom: 8px">
      🎈 成立与升级社团都要花「学生活跃度」，而它只由校园设施产出：
      <strong>中庭广场</strong>（需要教学楼 Lv.2，是最先能建的来源）→ 社团活动楼 → 部室栋 → 学生活动中心。
      部室不足时，扩建社团活动楼或部室栋可以增加社团名额。
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
      <span class="small muted" style="margin-left: auto">
        鼠标移到条目上查看社员、成长、产出与成本 · 还有 {{ lockedCount }} 个社团未解锁
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
        @action="engine.upgradeClub(row.id)"
      />
    </div>
    <div v-if="rows.length === 0" class="empty">该分类下暂时没有可成立的社团。</div>
  </div>
</template>
