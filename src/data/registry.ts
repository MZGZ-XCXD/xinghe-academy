/**
 * 内容注册接口。
 *
 * 内置内容来自 src/data/*.ts；这个模块允许在游戏启动前（或自定义内容文件里）
 * 追加新的建筑、课程、科技、校规、事件、效果卡、比赛、成就、传承节点与建筑联动。
 *
 * 典型用法见 src/data/custom/index.ts：
 *
 * ```ts
 * import { addCourse, addEvent, gain, studentDelta } from '../registry'
 * addCourse({ id: 'myCourse', ... })
 * addEvent({ id: 'myEvent', ..., choices: [{ label: '…', apply: combo(gain({ money: 100 })) }] })
 * ```
 *
 * 注册失败（重复 id、id 为空）不会抛异常，而是记录到 problems 里，
 * 由 applyCustomContent() 统一返回，并在调试面板与浏览器控制台展示。
 */
import type {
  AchievementDef,
  ActivityDef,
  BuildingDef,
  CardDef,
  ClubDef,
  CourseDef,
  EventDef,
  LegacyNodeDef,
  PolicyDef,
  TechDef,
  TeamDef,
} from '../game/types'
import { BUILDING_DEFS, BUILDING_MAP, SYNERGY_DEFS, type SynergyDef } from './buildings'
import { COURSE_DEFS, COURSE_MAP } from './courses'
import { TECH_DEFS, TECH_MAP } from './technologies'
import { POLICY_DEFS, POLICY_MAP } from './policies'
import { EVENT_DEFS, EVENT_MAP } from './events'
import { CARD_DEFS, CARD_MAP } from './cards'
import { ACTIVITY_DEFS, ACTIVITY_MAP } from './activities'
import { CLUB_DEFS, CLUB_MAP } from './clubs'
import { TEAM_DEFS, TEAM_MAP } from './teams'
import { ACHIEVEMENT_DEFS, ACHIEVEMENT_MAP } from './achievements'
import { LEGACY_NODES, LEGACY_NODE_MAP } from './legacy'
import { validateContent } from './index'

const problems: string[] = []

export function registrationProblems(): string[] {
  return [...problems]
}

function checkId(kind: string, id: unknown): id is string {
  if (typeof id !== 'string' || id.trim().length === 0) {
    problems.push(`${kind} 缺少合法 id（必须是字符串）`)
    return false
  }
  if (/[^\w-]/.test(id)) {
    problems.push(`${kind} 的 id「${id}」只能包含字母、数字、下划线与短横线`)
    return false
  }
  return true
}

/* ------------------------------ 建筑与联动 ------------------------------ */

export function addBuilding(def: BuildingDef): void {
  if (!checkId('建筑', def?.id)) return
  if (BUILDING_MAP[def.id]) {
    problems.push(`建筑 id 重复：${def.id}`)
    return
  }
  BUILDING_DEFS.push(def)
  BUILDING_MAP[def.id] = def
}

export function addSynergy(def: SynergyDef): void {
  if (!checkId('建筑联动', def?.id)) return
  if (SYNERGY_DEFS.some((s) => s.id === def.id)) {
    problems.push(`建筑联动 id 重复：${def.id}`)
    return
  }
  SYNERGY_DEFS.push(def)
}

/* ------------------------------ 课程 ------------------------------ */

export function addCourse(def: CourseDef): void {
  if (!checkId('课程', def?.id)) return
  if (COURSE_MAP[def.id]) {
    problems.push(`课程 id 重复：${def.id}`)
    return
  }
  COURSE_DEFS.push(def)
  COURSE_MAP[def.id] = def
}

/* ------------------------------ 科技 ------------------------------ */

export function addTech(def: TechDef): void {
  if (!checkId('科技', def?.id)) return
  if (TECH_MAP[def.id]) {
    problems.push(`科技 id 重复：${def.id}`)
    return
  }
  TECH_DEFS.push(def)
  TECH_MAP[def.id] = def
}

/* ------------------------------ 校规 ------------------------------ */

export function addPolicy(def: PolicyDef): void {
  if (!checkId('校规', def?.id)) return
  if (POLICY_MAP[def.id]) {
    problems.push(`校规 id 重复：${def.id}`)
    return
  }
  POLICY_DEFS.push(def)
  POLICY_MAP[def.id] = def
}

/* ------------------------------ 事件 ------------------------------ */

export function addEvent(def: EventDef): void {
  if (!checkId('事件', def?.id)) return
  if (EVENT_MAP[def.id]) {
    problems.push(`事件 id 重复：${def.id}`)
    return
  }
  EVENT_DEFS.push(def)
  EVENT_MAP[def.id] = def
}

/* ------------------------------ 效果卡 ------------------------------ */

export function addCard(def: CardDef): void {
  if (!checkId('效果卡', def?.id)) return
  if (CARD_MAP[def.id]) {
    problems.push(`效果卡 id 重复：${def.id}`)
    return
  }
  CARD_DEFS.push(def)
  CARD_MAP[def.id] = def
}

/* ------------------------------ 比赛 / 交流 ------------------------------ */

export function addActivity(def: ActivityDef): void {
  if (!checkId('活动', def?.id)) return
  if (ACTIVITY_MAP[def.id]) {
    problems.push(`活动 id 重复：${def.id}`)
    return
  }
  ACTIVITY_DEFS.push(def)
  ACTIVITY_MAP[def.id] = def
}

/* ------------------------------ 社团（部活） ------------------------------ */

export function addClub(def: ClubDef): void {
  if (!checkId('社团', def?.id)) return
  if (CLUB_MAP[def.id]) {
    problems.push(`社团 id 重复：${def.id}`)
    return
  }
  CLUB_DEFS.push(def)
  CLUB_MAP[def.id] = def
}

/* ------------------------------ 校队 ------------------------------ */

export function addTeam(def: TeamDef): void {
  if (!checkId('校队', def?.id)) return
  if (TEAM_MAP[def.id]) {
    problems.push(`校队 id 重复：${def.id}`)
    return
  }
  TEAM_DEFS.push(def)
  TEAM_MAP[def.id] = def
}

/* ------------------------------ 成就 ------------------------------ */

export function addAchievement(def: AchievementDef): void {
  if (!checkId('成就', def?.id)) return
  if (ACHIEVEMENT_MAP[def.id]) {
    problems.push(`成就 id 重复：${def.id}`)
    return
  }
  ACHIEVEMENT_DEFS.push(def)
  ACHIEVEMENT_MAP[def.id] = def
}

/* ------------------------------ 传承 ------------------------------ */

export function addLegacyNode(def: LegacyNodeDef): void {
  if (!checkId('传承节点', def?.id)) return
  if (LEGACY_NODE_MAP[def.id]) {
    problems.push(`传承节点 id 重复：${def.id}`)
    return
  }
  LEGACY_NODES.push(def)
  LEGACY_NODE_MAP[def.id] = def
}

/** 注册完成后统一跑一次内容自检，返回全部问题（含重复 id 等） */
export function runContentCheck(): string[] {
  return [...problems, ...validateContent()]
}

/** 事件/选项里常用的效果构造函数，直接从注册接口一起导出，方便自定义内容使用 */
export { applyDeclarativeChoice, combo, gain, setFlag, studentDelta, teacherDelta, text } from './eventHelpers'

export type { SynergyDef }
