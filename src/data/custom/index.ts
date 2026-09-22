/**
 * ============================================================
 *  自定义内容入口（你只需要改这个文件）
 * ============================================================
 *
 * 打开下面的 registerCustomContent()，按注释里的例子往里面加东西即可。
 * 添加后刷新页面就会生效，不需要改引擎或界面代码。
 *
 * 支持的注册函数（全部从 '../registry' 导入）：
 *   addBuilding      建筑（可带容量 / 课程槽 / 产出 / 加成）
 *   addSynergy       建筑联动（同时满足若干建筑等级时给加成）
 *   addCourse        课程（教师需求、成长、产出、季节加成）
 *   addTech          科技（前置科技、成本、时长、解锁内容）
 *   addPolicy        校规（有代价有收益，占用校规名额）
 *   addEvent         随机事件（含多选项、延迟后续事件）
 *   addCard          效果卡（时长型 / 次数型）
 *   addActivity      比赛与交流活动
 *   addAchievement   成就（带奖励）
 *   addLegacyNode    传承节点（传承树分支与传承特性）
 *
 * 规则速记：
 *   · id 必须唯一，只能包含字母、数字、下划线与短横线。
 *   · 加成的 target 只能在 src/game/types.ts 的 EFFECT_META 里选，写错会被自检拦下。
 *   · op: 'mul' 是百分比（0.1 = +10%），op: 'add' 是固定值。
 *   · 课程 growth / output 的单位是「每个游戏日」；teachingCostPerStudentMinute 是「每名学生每分钟」。
 *   · requires 里可以写 { tech: [...], buildings: { id: 等级 }, schoolRating, graduates, minStudents }。
 *   · 事件选项的 apply 用 combo(gain(...), studentDelta(...), text(...)) 组合；
 *     想安排延迟事件就写 schedule: [{ eventId: '后续事件 id', days: 3 }]（后续事件用 weight: 0 定义）。
 *
 * 更详细的字段说明和完整示例见 docs/CUSTOM_CONTENT.md。
 */

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
  combo,
  gain,
  setFlag,
  studentDelta,
  teacherDelta,
  text,
} from '../registry'

export function registerCustomContent(): void {
  /* ------------------------------------------------------------------
   * 例子 1：加一栋建筑
   * ------------------------------------------------------------------
  addBuilding({
    id: 'myGreenhouse',
    name: '校园温室',
    icon: '🌱',
    desc: '生物社团的实践基地。',
    category: '科研',
    baseCost: { money: 2000, teaching: 400 },
    costGrowth: 1.52,
    baseBuildMinutes: 20,
    buildTimeGrowth: 1.3,
    maxLevel: 20,
    courseSlots: 1,
    studentCapacity: 60,
    production: { research: 1.2 },
    perLevelEffects: [{ target: 'student_growth', op: 'mul', value: 0.004 }],
    requires: { buildings: { labBuilding: 1 } },
    tags: ['lab'],
  })
  */

  /* ------------------------------------------------------------------
   * 例子 2：加一门课程（会自动出现在【课程】里）
   * ------------------------------------------------------------------
  addCourse({
    id: 'myGardening',
    name: '园艺实践',
    icon: '🪴',
    desc: '把实验田从荒地变成课程。',
    category: '特色课程',
    subject: 'science',
    teacherRequired: 1,
    slotCost: 1,
    capacity: 90,
    teachingCostPerStudentMinute: 0.0012,
    growth: { research: 0.008, health: 0.006, satisfaction: 0.01, stress: -0.01 },
    output: { research: 1.5, parentTrust: 0.8 },
    seasonBonus: [{ season: 'spring', multiplier: 0.5, label: '春季种植季 +50%' }],
    requires: { buildings: { myGreenhouse: 1 } },
    tags: ['research'],
  })
  */

  /* ------------------------------------------------------------------
   * 例子 3：加一项科技（解锁建筑 / 课程 / 校规）
   * ------------------------------------------------------------------
  addTech({
    id: 'mySustainableCampus',
    name: '绿色校园计划',
    icon: '♻️',
    branch: '校园管理',
    desc: '把节电、节水与垃圾分类做成课程。',
    cost: { money: 6000, teaching: 1500, research: 300 },
    researchMinutes: 1800,
    requires: ['digitalCampus'],
    effects: [
      { target: 'money_rate', op: 'mul', value: 0.08 },
      { target: 'satisfaction_rate', op: 'mul', value: 0.05 },
    ],
    unlocks: { buildings: ['myGreenhouse'] },
  })
  */

  /* ------------------------------------------------------------------
   * 例子 4：加一条校规（记得同时给正负效果）
   * ------------------------------------------------------------------
  addPolicy({
    id: 'myPhoneRule',
    name: '手机集中管理',
    icon: '📵',
    desc: '上课期间手机统一放储物柜。',
    category: '管理',
    effects: [
      { target: 'exam_score', op: 'mul', value: 0.06 },
      { target: 'satisfaction_rate', op: 'mul', value: -0.05 },
    ],
    tags: ['管理'],
  })
  */

  /* ------------------------------------------------------------------
   * 例子 5：加一个随机事件（多选项 + 延迟后续事件）
   * ------------------------------------------------------------------
  addEvent({
    id: 'myLostCat',
    title: '走失的校犬',
    icon: '🐕',
    text: '校犬「土豆」在周末走丢了，学生在群里发了两百多条寻狗消息。',
    category: '校园',
    weight: 10,
    cooldownDays: 30,
    choices: [
      {
        label: '组织学生分片寻找',
        hint: '满意度与社交能力提升，占用一点课程时间',
        apply: combo(
          studentDelta({ satisfaction: 6, social: 2 }, '第二天早上，土豆自己回来了，还带回了半根火腿肠。'),
          gain({ teaching: -80 }),
        ),
      },
      {
        label: '交给社区一起找',
        hint: '低调处理，家长认可度略升',
        apply: combo(gain({ parentTrust: 8 }), studentDelta({ satisfaction: -2 })),
      },
    ],
  })
  */

  /* ------------------------------------------------------------------
   * 例子 6：加一张效果卡 / 一个比赛 / 一个成就 / 一个传承节点
   * ------------------------------------------------------------------
  addCard({
    id: 'mySpringFestival',
    name: '春日社团祭',
    icon: '🎏',
    rarity: '稀有',
    desc: '社团联合祭典带来的人气。7 天内活跃度 +40%、满意度 +15%。',
    pools: ['campus', 'any'],
    effects: [
      { target: 'activity_rate', op: 'mul', value: 0.4 },
      { target: 'satisfaction_rate', op: 'mul', value: 0.15 },
    ],
    durationMinutes: 7 * 1440,
  })

  addActivity({
    id: 'myCityDebateCup',
    name: '全市辩论赛',
    icon: '⚖️',
    kind: '学术比赛',
    desc: '与全市高中同台论辩。',
    durationMinutes: 3 * 1440,
    cost: { teaching: 300, money: 600 },
    studentCost: 16,
    attribute: 'social',
    difficulty: 60,
    baseSuccess: 0.46,
    rewards: {
      reputation: 16,
      resources: { culture: 80, parentTrust: 20 },
      cardPool: 'academic',
      cardChance: 0.45,
    },
    requires: { tech: ['schoolExchange'] },
  })

  addAchievement({
    id: 'myFirstCustom',
    name: '第一位自定义成就',
    desc: '在【比赛】里赢下全市辩论赛。',
    tier: '隐藏',
    hidden: true,
    check: (s) => s.statistics.flags.customDebateWin === true,
    reward: { legacyPoints: 2, resources: { reputation: 50 } },
  })

  addLegacyNode({
    id: 'myLegacyGarden',
    name: '校园花园传统',
    icon: '🌷',
    branch: '管理传承',
    desc: '上一轮留下的园艺传统。',
    maxLevel: 8,
    baseCost: 3,
    costGrowth: 1.6,
    requires: ['mgnBudget'],
    perLevelEffects: [{ target: 'satisfaction_rate', op: 'mul', value: 0.03 }],
  })

  addSynergy({
    id: 'myGreenChain',
    name: '绿色实验链',
    desc: '温室与实验楼互相供给材料。',
    requires: { myGreenhouse: 2, labBuilding: 2 },
    effects: [{ target: 'research_rate', op: 'mul', value: 0.08 }],
  })
  */

  /* ------------------------------------------------------------------
   * 例子 7：加一个社团（部活）
   * ------------------------------------------------------------------
  addClub({
    id: 'myRailwayClub',
    name: '铁道研究会',
    jpName: '鉄道研究会',
    icon: '🚃',
    category: '兴趣',                 // 文化 / 运动 / 学术 / 兴趣 / 特殊
    desc: '周末集体坐新线路，回来交三页时刻表分析。',
    baseMembers: 14,                  // 1 级社员数
    memberPerLevel: 6,
    maxLevel: 5,
    baseCostMoney: 800,
    baseCostActivity: 40,             // 成立时消耗的学生活跃度
    costGrowth: 1.6,
    upkeepPerLevelPerDay: 9,          // 每级每天的运营资金
    growth: { creativity: 0.008, social: 0.006, satisfaction: 0.008 },   // 社员每天的成长
    output: { activity: 18, culture: 6 },                                 // 每天产出（按 40 名社员折算）
    festivalScore: 6,                 // 每级对学园祭的贡献
    boostsActivities: ['校园活动'],    // 提升哪些活动的成功率
    requires: { buildings: { clubBuilding: 2 } },   // 随建筑 / 科技 / 评级逐步解锁
    tags: ['hobby'],
  })
  */

  // 保持这些引用可见，方便你直接在上面取消注释使用：
  void addBuilding
  void addSynergy
  void addCourse
  void addClub
  void addTech
  void addPolicy
  void addEvent
  void addCard
  void addActivity
  void addAchievement
  void addLegacyNode
  void addTeam
  void combo
  void gain
  void setFlag
  void studentDelta
  void teacherDelta
  void text
}

/* ----------------------------------------------------------------------
 * 启动接线（一般不需要改）
 * -------------------------------------------------------------------- */
import { runContentCheck } from '../registry'
import { applyExternalContent, externalContentStatus } from './external'

let applied = false
let result: string[] = []

/** 把自定义内容注册进内容表；重复调用只会执行一次（幂等）。返回内容自检问题列表。 */
export function applyCustomContent(): string[] {
  if (!applied) {
    applied = true
    try {
      registerCustomContent()
    } catch (error) {
      result.push(`自定义内容注册失败：${(error as Error).message}`)
    }
    // 再加载桌面上的「校园内容.js」（如果有）
    applyExternalContent()
    result = [...result, ...runContentCheck()]
  }
  return result
}

export { externalContentStatus }
export type { ExternalContent, ExternalContentStatus } from './external'

/** 仅供测试：重置幂等状态 */
export function resetCustomContentFlag(): void {
  applied = false
  result = []
}
