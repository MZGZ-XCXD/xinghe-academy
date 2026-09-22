import type { GameState } from '../types'
import { ACTIVITY_DEFS, BUILDING_DEFS, CLUB_DEFS, COURSE_DEFS, POLICY_DEFS, TECH_DEFS } from '../../data'
import { meetsRequirement } from '../formulas'
import { isBuildingUnlocked } from './BuildingEngine'
import { courseIsUnlocked } from './CourseEngine'
import { isPolicyUnlocked } from './PolicyEngine'
import { isClubUnlocked } from './ClubEngine'

export type UnlockKind = 'building' | 'course' | 'tech' | 'policy' | 'activity' | 'club' | 'slot'

export interface UnlockItem {
  kind: UnlockKind
  id: string
  name: string
  icon: string
  desc: string
}

export type CauseKind = 'build' | 'tech' | 'rating' | 'club' | 'team' | 'policy' | 'event' | 'other'

/** 造成解锁的原因：玩家刚刚做了什么 */
export interface UnlockCause {
  kind: CauseKind
  name: string
}

export interface UnlockNotice {
  id: number
  causeKind: CauseKind
  causeName: string
  headline: string
  story: string
  icon: string
  items: UnlockItem[]
}

export const UNLOCK_KIND_LABEL: Record<UnlockKind, string> = {
  building: '建筑',
  course: '课程',
  tech: '科技',
  policy: '校规',
  activity: '活动',
  club: '社团',
  slot: '课表',
}

/**
 * 课程槽位（排课表）变多时的提示条目。
 * 槽位来自建筑的 courseSlots：教学楼 / 图书馆 / 实验楼 / 艺术楼 / 信息中心 / 音乐教室，
 * 每升一级都会多出一格，所以「教学楼升级」这类操作也会带上它。
 */
export function courseSlotItem(total: number, delta: number): UnlockItem {
  return {
    kind: 'slot',
    id: 'courseSlots',
    name: `课程槽位 +${delta}（现在共 ${total} 格）`,
    icon: '📚',
    desc: '教务处的课表上又多出一行空位——教学楼、图书馆、实验楼、艺术楼、信息中心与音乐教室每升一级都会加一格，课表能同时排下的课更多了。',
  }
}

/**
 * 当前「已经可以向玩家开放」的内容清单。
 * 判断标准与各面板一致：建筑 / 课程 / 校规 / 社团满足前置即可见，科技要求前置科技全部解锁。
 */
export function snapshotUnlocks(state: GameState): Map<string, UnlockItem> {
  const map = new Map<string, UnlockItem>()
  const add = (kind: UnlockKind, id: string, name: string, icon: string, desc: string) => {
    map.set(kind + ':' + id, { kind, id, name, icon, desc })
  }
  for (const def of BUILDING_DEFS) {
    if (isBuildingUnlocked(state, def)) add('building', def.id, def.name, def.icon, def.desc)
  }
  for (const def of COURSE_DEFS) {
    if (courseIsUnlocked(state, def)) add('course', def.id, def.name, def.icon, def.desc)
  }
  for (const def of TECH_DEFS) {
    const ready = def.requires.every((id) => state.technologies[id]?.unlocked === true)
    if (ready) add('tech', def.id, def.name, def.icon, def.desc)
  }
  for (const def of POLICY_DEFS) {
    if (isPolicyUnlocked(state, def)) add('policy', def.id, def.name, def.icon, def.desc)
  }
  for (const def of CLUB_DEFS) {
    if (isClubUnlocked(state, def)) add('club', def.id, def.name, def.icon, def.desc)
  }
  for (const def of ACTIVITY_DEFS) {
    // 只看前置条件：季节限定不算「新解锁」，免得每季都弹一次
    if (meetsRequirement(state, def.requires)) add('activity', def.id, def.name, def.icon, def.desc)
  }
  return map
}

export function diffUnlocks(before: Map<string, UnlockItem>, after: Map<string, UnlockItem>): UnlockItem[] {
  const items: UnlockItem[] = []
  for (const [key, item] of after) if (!before.has(key)) items.push(item)
  return items
}

/**
 * 解锁弹窗文案模板：写成「由于……于是……」的校园口吻。
 * 想换语气改这里就行，逻辑不用动。
 */
export const UNLOCK_FLAVOR: Record<CauseKind, { icon: string; headline: (name: string) => string; story: string }> = {
  build: {
    icon: '🏗️',
    headline: (name) => '「' + name + '」落成',
    story: '施工围挡拆掉的那天，几个学生趴在栏杆上看了很久。于是有些原本做不来的事，忽然有了着落——',
  },
  tech: {
    icon: '🔬',
    headline: (name) => '「' + name + '」写进了教研计划',
    story: '教研会的灯亮到很晚，方案最后还是通过了。于是有些门，悄悄开了——',
  },
  rating: {
    icon: '📋',
    headline: (name) => '学校通过了' + name,
    story: '督导组在评估表上签了字，档案袋里那几页终于有了说法。于是——',
  },
  club: {
    icon: '🎪',
    headline: (name) => name + '挂牌了',
    story: '部室的门牌换上了新的字，放学后的走廊又吵起来。于是——',
  },
  team: {
    icon: '🥋',
    headline: (name) => name + '组建完成',
    story: '更衣室里多出一排带名字的柜子，队服也挂上了。于是——',
  },
  policy: {
    icon: '📜',
    headline: (name) => '校规「' + name + '」上墙',
    story: '教务处那面墙上的纸又多了一张，走廊里安静了一会儿。于是——',
  },
  event: {
    icon: '📖',
    headline: (name) => '「' + name + '」处理完毕',
    story: '等走廊重新安静下来，你才发现有些门已经开了——',
  },
  other: {
    icon: '✨',
    headline: (name) => name,
    story: '学校又往前走了一步，于是——',
  },
}

export function buildUnlockNotice(cause: UnlockCause, items: UnlockItem[], id: number): UnlockNotice {
  const flavor = UNLOCK_FLAVOR[cause.kind] ?? UNLOCK_FLAVOR.other
  return {
    id,
    causeKind: cause.kind,
    causeName: cause.name,
    headline: flavor.headline(cause.name),
    story: flavor.story,
    icon: flavor.icon,
    items,
  }
}
