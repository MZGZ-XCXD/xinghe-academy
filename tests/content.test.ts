import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENT_DEFS,
  ACTIVITY_DEFS,
  BUILDING_DEFS,
  CARD_DEFS,
  COURSE_DEFS,
  EVENT_DEFS,
  LEGACY_NODES,
  POLICY_DEFS,
  TECH_DEFS,
  validateContent,
} from '../src/data'

describe('内容数据表', () => {
  it('内容自检没有任何问题（加成目标、前置 id、重复 id、科技循环依赖）', () => {
    const problems = validateContent()
    expect(problems).toEqual([])
  })

  it('第一版内容数量达到设计下限', () => {
    expect(BUILDING_DEFS.length).toBeGreaterThanOrEqual(20)
    expect(COURSE_DEFS.length).toBeGreaterThanOrEqual(25)
    expect(TECH_DEFS.length).toBeGreaterThanOrEqual(40)
    expect(POLICY_DEFS.length).toBeGreaterThanOrEqual(15)
    expect(EVENT_DEFS.length).toBeGreaterThanOrEqual(30)
    expect(CARD_DEFS.length).toBeGreaterThanOrEqual(40)
    expect(ACTIVITY_DEFS.length).toBeGreaterThanOrEqual(15)
    expect(ACHIEVEMENT_DEFS.length).toBeGreaterThanOrEqual(40)
    expect(LEGACY_NODES.length).toBeGreaterThanOrEqual(20)
  })

  it('每栋建筑都提供非纯数值功能（容量 / 课程槽 / 部室 / 仓储 / 效果 / 产出）', () => {
    for (const def of BUILDING_DEFS) {
      const hasFunction =
        (def.studentCapacity ?? 0) > 0 ||
        (def.teacherCapacity ?? 0) > 0 ||
        (def.courseSlots ?? 0) > 0 ||
        (def.clubSlots ?? 0) > 0 ||
        Object.keys(def.storage ?? {}).length > 0 ||
        (def.effects?.length ?? 0) > 0 ||
        (def.perLevelEffects?.length ?? 0) > 0 ||
        Object.keys(def.production ?? {}).length > 0
      expect(hasFunction, `${def.name} 缺少功能定义`).toBe(true)
    }
  })

  it('所有建筑都定义了合法的最大等级与成本增长', () => {
    for (const def of BUILDING_DEFS) {
      expect(def.maxLevel).toBeGreaterThan(0)
      expect(def.costGrowth).toBeGreaterThan(1)
      expect(def.baseBuildMinutes).toBeGreaterThan(0)
      expect(Object.keys(def.baseCost).length).toBeGreaterThan(0)
    }
  })

  it('课程都有教师需求与成长效果', () => {
    for (const def of COURSE_DEFS) {
      expect(def.teacherRequired).toBeGreaterThan(0)
      expect(Object.keys(def.growth).length).toBeGreaterThan(0)
      expect(def.capacity).toBeGreaterThan(0)
    }
  })

  it('效果卡都有卡池与效果', () => {
    for (const def of CARD_DEFS) {
      expect(def.pools.length).toBeGreaterThan(0)
      expect(def.effects.length).toBeGreaterThan(0)
    }
  })
})
