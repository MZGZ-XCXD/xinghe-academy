/**
 * 外部内容文件加载器。
 *
 * 游戏启动时会读取同目录下的 `校园内容.js`（它只做一件事：给 window.__ACADEMY_CONTENT__ 赋值），
 * 因此放在桌面的单文件版可以在**不重新打包、不改任何源码**的情况下增加课程 / 校规 / 科技 / 事件等内容。
 *
 * 文件缺失或格式错误都不会影响游戏启动，问题会记在 externalContentStatus() 里，
 * 并在【选项 · 调试工具】面板与控制台显示。
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
} from '../../game/types'
import type { SynergyDef } from '../buildings'
import {
  addAchievement,
  addActivity,
  addBuilding,
  addCard,
  addClub,
  addCourse,
  addEvent,
  addLegacyNode,
  addPolicy,
  addSynergy,
  addTech,
  addTeam,
  registrationProblems,
} from '../registry'

export interface ExternalContent {
  buildings?: BuildingDef[]
  synergies?: SynergyDef[]
  courses?: CourseDef[]
  clubs?: ClubDef[]
  techs?: TechDef[]
  policies?: PolicyDef[]
  events?: EventDef[]
  cards?: CardDef[]
  activities?: ActivityDef[]
  achievements?: AchievementDef[]
  legacyNodes?: LegacyNodeDef[]
  teams?: TeamDef[]
}

declare global {
  interface Window {
    __ACADEMY_CONTENT__?: ExternalContent
  }
}

export interface ExternalContentStatus {
  /** 是否找到了 window.__ACADEMY_CONTENT__ */
  found: boolean
  /** 成功注册的条目数 */
  count: number
  /** 每个类别的条目数 */
  byKind: Record<string, number>
  problems: string[]
}

let status: ExternalContentStatus = { found: false, count: 0, byKind: {}, problems: [] }

export function externalContentStatus(): ExternalContentStatus {
  return { ...status, byKind: { ...status.byKind } }
}

type Registrar = (def: never) => void

export function applyExternalContent(): void {
  const data = typeof window !== 'undefined' ? window.__ACADEMY_CONTENT__ : undefined
  if (!data || typeof data !== 'object') {
    status = { found: false, count: 0, byKind: {}, problems: [] }
    return
  }

  const problemsBefore = registrationProblems().length
  const byKind: Record<string, number> = {}
  let count = 0

  const register = (label: string, list: unknown, fn: Registrar) => {
    if (list == null) return
    if (!Array.isArray(list)) {
      status.problems.push(`校园内容.js：${label} 必须是数组`)
      return
    }
    let ok = 0
    for (const item of list) {
      if (!item || typeof item !== 'object') {
        status.problems.push(`校园内容.js：${label} 里有一项不是对象，已跳过`)
        continue
      }
      try {
        fn(item as never)
        ok += 1
        count += 1
      } catch (error) {
        status.problems.push(`校园内容.js：${label} 注册失败（${(error as Error).message}）`)
      }
    }
    byKind[label] = ok
  }

  register('建筑', data.buildings, addBuilding as Registrar)
  register('建筑联动', data.synergies, addSynergy as Registrar)
  register('课程', data.courses, addCourse as Registrar)
  register('社团', data.clubs, addClub as Registrar)
  register('科技', data.techs, addTech as Registrar)
  register('校规', data.policies, addPolicy as Registrar)
  register('事件', data.events, addEvent as Registrar)
  register('效果卡', data.cards, addCard as Registrar)
  register('活动', data.activities, addActivity as Registrar)
  register('成就', data.achievements, addAchievement as Registrar)
  register('传承节点', data.legacyNodes, addLegacyNode as Registrar)
  register('校队', data.teams, addTeam as Registrar)

  status = {
    found: true,
    count,
    byKind,
    problems: [...status.problems, ...registrationProblems().slice(problemsBefore)],
  }
}
