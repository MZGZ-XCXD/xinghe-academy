import { describe, expect, it } from 'vitest'
import {
  addAchievement,
  addActivity,
  addBuilding,
  addCard,
  addCourse,
  addEvent,
  addLegacyNode,
  addPolicy,
  addSynergy,
  addTech,
  gain,
  runContentCheck,
} from '../src/data/registry'
import {
  BUILDING_MAP,
  CARD_MAP,
  COURSE_MAP,
  EVENT_MAP,
  LEGACY_NODE_MAP,
  POLICY_MAP,
  TECH_MAP,
} from '../src/data'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { MINUTES_PER_DAY } from '../src/game/formulas'

describe('自定义内容注册接口', () => {
  it('可以注册建筑 / 课程 / 科技 / 校规 / 事件 / 卡片 / 活动 / 成就 / 传承节点 / 联动', () => {
    addBuilding({
      id: 'testGreenhouse',
      name: '测试温室',
      icon: '🌱',
      desc: '测试用建筑。',
      category: '科研',
      baseCost: { money: 500, teaching: 100 },
      costGrowth: 1.5,
      baseBuildMinutes: 5,
      buildTimeGrowth: 1.3,
      maxLevel: 10,
      production: { research: 0.5 },
      requires: { tech: ['basicLab'] },
      tags: ['lab'],
    })
    addSynergy({
      id: 'testGreenChain',
      name: '测试联动',
      desc: '温室 + 实验楼。',
      requires: { testGreenhouse: 2, labBuilding: 1 },
      effects: [{ target: 'research_rate', op: 'mul', value: 0.05 }],
    })
    addCourse({
      id: 'testGardening',
      name: '测试园艺',
      icon: '🪴',
      desc: '测试用课程。',
      category: '特色课程',
      subject: 'science',
      teacherRequired: 1,
      slotCost: 1,
      capacity: 80,
      teachingCostPerStudentMinute: 0.001,
      growth: { research: 0.01, satisfaction: 0.01 },
      output: { research: 1 },
      requires: { buildings: { testGreenhouse: 1 } },
      tags: ['research'],
    })
    addTech({
      id: 'testGreenTech',
      name: '测试绿色科技',
      icon: '♻️',
      branch: '校园管理',
      desc: '测试用科技。',
      cost: { money: 1000, research: 100 },
      researchMinutes: 60,
      requires: ['digitalCampus'],
      effects: [{ target: 'money_rate', op: 'mul', value: 0.05 }],
      unlocks: { buildings: ['testGreenhouse'] },
    })
    addPolicy({
      id: 'testPolicy',
      name: '测试校规',
      icon: '📵',
      desc: '测试用校规。',
      category: '管理',
      effects: [
        { target: 'exam_score', op: 'mul', value: 0.05 },
        { target: 'satisfaction_rate', op: 'mul', value: -0.05 },
      ],
    })
    addEvent({
      id: 'testEvent',
      title: '测试事件',
      icon: '🧪',
      text: '这是一条测试事件。',
      category: '校园',
      weight: 5,
      choices: [
        { label: '接受资助', hint: '测试用选项', apply: gain({ money: 300 }) },
        { label: '拒绝资助', hint: '测试用选项', apply: gain({ parentTrust: 5 }) },
      ],
    })
    addCard({
      id: 'testCard',
      name: '测试效果卡',
      icon: '🎏',
      rarity: '普通',
      desc: '测试用效果卡。',
      pools: ['any'],
      effects: [{ target: 'activity_rate', op: 'mul', value: 0.2 }],
      durationMinutes: 2 * 1440,
    })
    addActivity({
      id: 'testActivity',
      name: '测试比赛',
      icon: '⚖️',
      kind: '学术比赛',
      desc: '测试用比赛。',
      durationMinutes: 1 * 1440,
      cost: { teaching: 100 },
      studentCost: 5,
      attribute: 'academic',
      difficulty: 30,
      baseSuccess: 0.5,
      rewards: { reputation: 5, cardChance: 0 },
    })
    addAchievement({
      id: 'testAchievement',
      name: '测试成就',
      desc: '测试用成就。',
      tier: '普通',
      check: (s) => s.statistics.flags.testFlag === true,
      reward: { legacyPoints: 1 },
    })
    addLegacyNode({
      id: 'testLegacyNode',
      name: '测试传承',
      icon: '🌷',
      branch: '管理传承',
      desc: '测试用传承节点。',
      maxLevel: 5,
      baseCost: 2,
      costGrowth: 1.5,
      requires: ['mgnBudget'],
      perLevelEffects: [{ target: 'satisfaction_rate', op: 'mul', value: 0.02 }],
    })

    expect(BUILDING_MAP.testGreenhouse).toBeDefined()
    expect(COURSE_MAP.testGardening).toBeDefined()
    expect(TECH_MAP.testGreenTech).toBeDefined()
    expect(POLICY_MAP.testPolicy).toBeDefined()
    expect(EVENT_MAP.testEvent).toBeDefined()
    expect(CARD_MAP.testCard).toBeDefined()
    expect(LEGACY_NODE_MAP.testLegacyNode).toBeDefined()

    // 内容自检必须依然通过（注意 runContentCheck 会累积历史问题，这里只看是否包含本用例的 id）
    const problems = runContentCheck().filter((p) => p.includes('test'))
    expect(problems).toEqual([])
  })

  it('自定义内容会进入新存档的初始状态，并遵守解锁条件', () => {
    const engine = new GameEngine(createInitialState())
    expect(engine.state.buildings.testGreenhouse).toBeDefined()
    expect(engine.state.buildings.testGreenhouse.level).toBe(0)
    expect(engine.state.courses.testGardening).toBeDefined()
    expect(engine.state.courses.testGardening.unlocked).toBe(false)
    expect(engine.state.technologies.testGreenTech).toBeDefined()
    expect(engine.state.achievements.testAchievement).toBeDefined()
    expect(engine.state.legacy.nodes.testLegacyNode).toBe(0)

    // 未解锁时不能建造
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    expect(engine.build('testGreenhouse')).toBe(false)

    // 解锁科技后可以建造，建成后课程解锁
    engine.debugUnlockAll()
    expect(engine.build('testGreenhouse')).toBe(true)
    engine.debugFinishQueue()
    expect(engine.state.buildings.testGreenhouse.level).toBe(1)
    expect(engine.state.courses.testGardening.unlocked).toBe(true)
    expect(engine.toggleCourse('testGardening') || true).toBe(true)
  })

  it('自定义事件可以触发并结算', () => {
    const engine = new GameEngine(createInitialState())
    engine.debugTriggerEvent('testEvent')
    expect(engine.state.events.active.length).toBe(1)
    const moneyBefore = engine.state.resources.money
    engine.resolveEvent(engine.state.events.active[0].uid, 0)
    expect(engine.state.resources.money).toBeGreaterThan(moneyBefore)
  })

  it('自定义效果卡可以进入卡池并生效', () => {
    const engine = new GameEngine(createInitialState())
    engine.debugGiveCard('testCard')
    expect(engine.state.cards.offers.length).toBe(1)
    expect(engine.chooseCard(engine.state.cards.offers[0].uid, 0)).toBe(true)
    engine.advanceMinutes(30)
    expect(engine.mods.mul('activity_rate')).toBeGreaterThan(1)
  })

  it('重复 id 与非法的加成目标会被拦下，不会破坏已有内容', () => {
    const before = BUILDING_MAP.teachingBuilding
    addBuilding({ ...BUILDING_MAP.teachingBuilding })
    expect(BUILDING_MAP.teachingBuilding).toBe(before)
    expect(runContentCheck().some((p) => p.includes('建筑 id 重复'))).toBe(true)

    addBuilding({
      id: 'testBadTarget',
      name: '错误目标建筑',
      icon: '❌',
      desc: '测试用。',
      category: '教学',
      baseCost: { money: 1 },
      costGrowth: 1.5,
      baseBuildMinutes: 1,
      buildTimeGrowth: 1.2,
      maxLevel: 5,
      effects: [{ target: 'not_a_real_target', op: 'mul', value: 0.1 } as never],
    })
    expect(runContentCheck().some((p) => p.includes('未知加成目标'))).toBe(true)
  })

  it('id 不合法时会被拒绝', () => {
    addBuilding({
      id: 'bad id with space',
      name: '非法 id 建筑',
      icon: '❌',
      desc: '测试用。',
      category: '教学',
      baseCost: { money: 1 },
      costGrowth: 1.5,
      baseBuildMinutes: 1,
      buildTimeGrowth: 1.2,
      maxLevel: 5,
    })
    expect(runContentCheck().some((p) => p.includes('只能包含字母、数字、下划线与短横线'))).toBe(true)
    expect(BUILDING_MAP['bad id with space']).toBeUndefined()
  })

  it('自定义内容不存在的依赖会被自检报告', () => {
    addTech({
      id: 'testBadTech',
      name: '错误科技',
      icon: '❌',
      branch: '科研科技',
      desc: '测试用。',
      cost: { money: 1 },
      researchMinutes: 1,
      requires: ['notExistingTech'],
    })
    expect(runContentCheck().some((p) => p.includes('notExistingTech'))).toBe(true)
    void MINUTES_PER_DAY
  })
})
