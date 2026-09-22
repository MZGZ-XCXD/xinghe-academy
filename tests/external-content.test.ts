// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { applyExternalContent, externalContentStatus } from '../src/data/custom/external'
import { applyCustomContent, resetCustomContentFlag } from '../src/data/custom'
import { BUILDING_MAP, CLUB_MAP, COURSE_MAP, EVENT_MAP, POLICY_MAP, TECH_MAP } from '../src/data'
import type { ExternalContent } from '../src/data/custom/external'

const SAMPLE: ExternalContent = {
  courses: [
    {
      id: 'extTeaCourse',
      name: '外部茶道课',
      icon: '🍵',
      desc: '来自校园内容.js 的测试课程。',
      category: '特色课程',
      subject: 'arts',
      teacherRequired: 1,
      slotCost: 1,
      capacity: 60,
      teachingCostPerStudentMinute: 0.001,
      growth: { arts: 0.01, satisfaction: 0.01 },
      output: { culture: 5 },
      requires: { buildings: { teachingBuilding: 1 } },
    },
  ],
  policies: [
    {
      id: 'extPhoneRule',
      name: '外部手机校规',
      icon: '📵',
      desc: '来自校园内容.js 的测试校规。',
      category: '管理',
      effects: [{ target: 'exam_score', op: 'mul', value: 0.05 }],
    },
  ],
  techs: [
    {
      id: 'extGreenTech',
      name: '外部绿色科技',
      icon: '♻️',
      branch: '校园管理',
      desc: '来自校园内容.js 的测试科技。',
      cost: { money: 100 },
      researchMinutes: 60,
      requires: [],
      effects: [{ target: 'money_rate', op: 'mul', value: 0.05 }],
    },
  ],
  events: [
    {
      id: 'extMorningBell',
      title: '外部事件：清晨的第一声铃',
      icon: '🔔',
      text: '测试事件。',
      category: '校园',
      weight: 5,
      choices: [
        {
          label: '让学生自己排升旗队',
          hint: '学生更有积极性',
          cost: { teaching: 100 },
          gain: { activity: 60 },
          studentDelta: { satisfaction: 5, social: 2 },
          notes: ['测试结算文字。'],
        },
        { label: '不做改变', hint: '什么都不会发生', gain: { parentTrust: 5 } },
      ],
    },
  ],
  buildings: [
    {
      id: 'extGreenhouse',
      name: '外部温室',
      icon: '🌱',
      desc: '来自校园内容.js 的测试建筑。',
      category: '科研',
      baseCost: { money: 500 },
      costGrowth: 1.5,
      baseBuildMinutes: 5,
      buildTimeGrowth: 1.3,
      maxLevel: 5,
      production: { research: 0.5 },
      requires: { buildings: { teachingBuilding: 1 } },
    },
  ],
  clubs: [
    {
      id: 'extRailwayClub',
      name: '外部铁道研究会',
      icon: '🚃',
      category: '兴趣',
      desc: '来自校园内容.js 的测试社团。',
      baseMembers: 10,
      memberPerLevel: 5,
      maxLevel: 5,
      baseCostMoney: 100,
      baseCostActivity: 10,
      costGrowth: 1.5,
      upkeepPerLevelPerDay: 2,
      growth: { creativity: 0.005 },
      festivalScore: 4,
      requires: { buildings: { teachingBuilding: 1 } },
    },
  ],
}

describe('桌面「校园内容.js」外部内容入口', () => {
  beforeEach(() => {
    delete window.__ACADEMY_CONTENT__
    applyExternalContent()
    window.__ACADEMY_CONTENT__ = SAMPLE
  })
  afterEach(() => {
    delete window.__ACADEMY_CONTENT__
  })

  it('文件不存在时不会报错，也不会注册任何内容', () => {
    delete window.__ACADEMY_CONTENT__
    applyExternalContent()
    const status = externalContentStatus()
    expect(status.found).toBe(false)
    expect(status.count).toBe(0)
    expect(status.problems).toEqual([])
  })

  it('可以一次性注册课程 / 校规 / 科技 / 事件 / 建筑 / 社团', () => {
    applyExternalContent()
    const status = externalContentStatus()
    expect(status.found).toBe(true)
    expect(status.count).toBe(6)
    expect(status.byKind['课程']).toBe(1)
    expect(status.byKind['事件']).toBe(1)
    expect(status.problems).toEqual([])
    expect(COURSE_MAP.extTeaCourse).toBeDefined()
    expect(POLICY_MAP.extPhoneRule).toBeDefined()
    expect(TECH_MAP.extGreenTech).toBeDefined()
    expect(EVENT_MAP.extMorningBell).toBeDefined()
    expect(BUILDING_MAP.extGreenhouse).toBeDefined()
    expect(CLUB_MAP.extRailwayClub).toBeDefined()
  })

  it('新内容会进入新存档，并出现在对应系统里', () => {
    applyExternalContent()
    const engine = new GameEngine(createInitialState())
    expect(engine.state.courses.extTeaCourse).toBeDefined()
    expect(engine.state.buildings.extGreenhouse).toBeDefined()
    expect(engine.state.clubs.extRailwayClub).toBeDefined()
    expect(engine.state.technologies.extGreenTech).toBeDefined()
    expect(engine.state.achievements).toBeDefined()
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    expect(engine.build('extGreenhouse')).toBe(true)
    engine.debugFinishQueue()
    expect(engine.state.buildings.extGreenhouse.level).toBe(1)
  })

  it('外部事件的声明式选项会被正确结算并生成预览', () => {
    applyExternalContent()
    const engine = new GameEngine(createInitialState())
    engine.state.resources.teaching = 3000
    engine.debugTriggerEvent('extMorningBell')
    expect(engine.state.events.active.length).toBe(1)
    const activityBefore = engine.state.resources.activity
    const satisfactionBefore = engine.state.students.cohorts[0].satisfaction
    engine.resolveEvent(engine.state.events.active[0].uid, 0)
    expect(engine.state.resources.teaching).toBeLessThan(3000)
    expect(engine.state.resources.activity).toBeGreaterThan(activityBefore)
    expect(engine.state.students.cohorts[0].satisfaction).toBeGreaterThan(satisfactionBefore)
    expect(engine.state.events.log[0].lines.join(' ')).toContain('测试结算文字')
  })

  it('格式写错时会给出可读的问题提示，而不是崩溃', () => {
    window.__ACADEMY_CONTENT__ = {
      courses: 'not-an-array',
      policies: [null, { id: 'dup id with space', name: '坏校规', effects: [] }],
    } as unknown as ExternalContent
    applyExternalContent()
    const status = externalContentStatus()
    expect(status.problems.some((p) => p.includes('必须是数组'))).toBe(true)
    expect(status.problems.length).toBeGreaterThan(0)
  })

  it('applyCustomContent 会同时加载源码内自定义内容与外部文件', () => {
    // 用一组全新的 id，避免和前面几个用例已经注册的内容冲突
    window.__ACADEMY_CONTENT__ = {
      courses: [
        {
          ...SAMPLE.courses![0],
          id: 'extSecondCourse',
          name: '外部茶道课 2',
        },
      ],
    } as ExternalContent
    resetCustomContentFlag()
    const problems = applyCustomContent()
    const status = externalContentStatus()
    expect(status.found).toBe(true)
    expect(status.count).toBeGreaterThan(0)
    expect(problems.filter((p) => p.includes('extSecondCourse'))).toEqual([])
    expect(COURSE_MAP.extSecondCourse).toBeDefined()
  })
})
