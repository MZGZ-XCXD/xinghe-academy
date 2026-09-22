# 自定义内容指南（不改引擎，只加内容）

## 零、桌面上直接改（推荐给只想玩的人）

如果用的是桌面单文件版，那个文件夹里会有三个文件：

```
星河实验学园.html     游戏本体
校园内容.js           ← 你要编辑的就是这个
如何添加内容.md        详细教程（逐字段示例 + 排错表）
```

打开 `校园内容.js`，把示例前面的 `//` 去掉、填上自己的数值，保存后刷新浏览器即可，**不需要重新打包**。原理是：游戏启动时会读取同目录下这个文件里的 `window.__ACADEMY_CONTENT__`（`src/data/custom/external.ts`），并按类别注册到内容表里。

编辑完可以在【选项】面板底部看到「自定义内容：已加载 N 项」，或在控制台执行 `academy.content()` / `academy.problems()`。

> **这份文件不会被上传**：`校园内容.js` 已被 `.gitignore` 排除，仓库里只保留公开模板 `public/校园内容.示例.js`。
> 在工程里开发时（`npm run dev`），执行一次 `npm run content:init` 会把它复制成 `public/校园内容.js`——那是**你自己的副本**，`git status` 里看不到，`git push` 也不会带上；
> `npm run build:single` 打包时会优先用你这份（没有才用模板）。所以放开了加内容，不用担心泄露。

## 一、在工程里改（开发模式）

所有内容都是数据驱动的。你也可以只编辑一个源码文件：

```
src/data/custom/index.ts
```

里面有一个 `registerCustomContent()` 函数，按注释里的例子往里加内容，保存后刷新页面即可生效——不需要改引擎、界面或存档代码。

## 二、可用接口

```ts
import {
  addBuilding,      // 建筑
  addSynergy,       // 建筑联动
  addCourse,        // 课程
  addClub,          // 社团（部活）
  addTech,          // 科技
  addPolicy,        // 校规
  addEvent,         // 随机事件
  addCard,          // 效果卡
  addActivity,      // 比赛 / 交流
  addAchievement,   // 成就
  addLegacyNode,    // 传承节点
  addTeam,          // 校队（队伍）
  combo, gain, studentDelta, teacherDelta, setFlag, text,   // 事件选项工具
} from '../registry'
```

规则：

- `id` 必须唯一，只能是字母、数字、下划线、短横线。
- 加成的 `target` 只能取 `src/game/types.ts` 里 `EFFECT_META` 的键（写错会被内容自检拦下，并在【选项 · 调试】面板与浏览器控制台显示）。
- `op: 'mul'` 是百分比（`0.1` = +10%，`-0.1` = −10%）；`op: 'add'` 是固定值。
- 注册在**游戏启动前**执行，因此新内容会立刻出现在界面、存档结构与已有存档里（旧存档读取时会自动补齐这些条目）。

## 三、建筑

```ts
addBuilding({
  id: 'myGreenhouse',
  name: '校园温室',
  icon: '🌱',
  desc: '生物社团的实践基地。',
  category: '科研',                 // 教学 / 科研 / 生活 / 体育 / 文化 / 交流 / 行政
  baseCost: { money: 2000, teaching: 400 },
  costGrowth: 1.52,                 // 每级成本倍数
  baseBuildMinutes: 20,             // 一级的建造时间（内部单位；1440 = 1 天，界面显示为天数）
  buildTimeGrowth: 1.3,
  maxLevel: 20,
  studentCapacity: 60,              // 可选的容量
  courseSlots: 1,                   // 可选的课程槽位
  production: { research: 1.2 },    // 每分钟每级产出
  effects: [{ target: 'event_good', op: 'mul', value: 0.03 }],
  perLevelEffects: [{ target: 'student_growth', op: 'mul', value: 0.004 }],
  requires: { buildings: { labBuilding: 1 }, tech: ['basicLab'] },
  tags: ['lab'],
})
```

未满足 `requires` 的建筑**不会显示**在【建筑】面板里，满足条件后自动出现。

## 四、建筑联动

```ts
addSynergy({
  id: 'myGreenChain',
  name: '绿色实验链',
  desc: '温室与实验楼互相供给材料。',
  requires: { myGreenhouse: 2, labBuilding: 2 },   // 同时满足这些建筑等级才生效
  effects: [{ target: 'research_rate', op: 'mul', value: 0.08 }],
})
```

## 五、课程

```ts
addCourse({
  id: 'myGardening',
  name: '园艺实践',
  icon: '🪴',
  desc: '把实验田从荒地变成课程。',
  category: '特色课程',              // 基础课程 / 能力课程 / 特色课程 / 实验课程
  subject: 'science',               // chinese / math / english / science / humanities / arts / info / psych
  teacherRequired: 1,
  slotCost: 1,                      // 占用课程槽位
  capacity: 90,                     // 能覆盖的学生数
  teachingCostPerStudentMinute: 0.0012,
  growth: { research: 0.008, health: 0.006, satisfaction: 0.01, stress: -0.01 },   // 每天
  output: { research: 1.5, parentTrust: 0.8 },                                      // 每天（按 40 名学生为基准）
  seasonBonus: [{ season: 'spring', multiplier: 0.5, label: '春季种植季 +50%' }],
  requires: { buildings: { myGreenhouse: 1 } },
  tags: ['research'],
})
```

可用属性键：`academic`、`sports`、`arts`、`research`、`morality`、`social`、`health`、`creativity`、`stress`、`satisfaction`（后两个是压力与满意度）。

参考量级：主属性成长 0.01–0.035 / 天，压力 0.02–0.06 / 天，教学资源消耗 0.001–0.0026 / 生 / 分钟。

> **招生不是课程。** 招生宣讲会、校园开放日、招生简章投放这类内容应该做成 `activities` 里的「校园活动」：用 `seasons: ['spring']` 限定只在春季开放，用 `rewards.recruitBonus` 给出招生加成（学年结算时计入新生人数）。课程仍保留 `tags: ['recruit']` 的兼容支持，但一般不需要。

## 六、社团（部活）

```ts
addClub({
  id: 'myRailwayClub',
  name: '铁道研究会',
  jpName: '鉄道研究会',            // 可选：日式别名，界面会显示
  icon: '🚃',
  category: '兴趣',                // 文化 / 运动 / 学术 / 兴趣 / 特殊
  desc: '周末集体坐新线路，回来交三页时刻表分析。',
  baseMembers: 14,                 // 1 级社员数
  memberPerLevel: 6,
  maxLevel: 5,
  baseCostMoney: 800,              // 成立（1 级）花费的资金
  baseCostActivity: 40,            // 成立时消耗的学生活跃度
  costGrowth: 1.6,                 // 每级成本倍数
  upkeepPerLevelPerDay: 9,         // 每级每天的运营资金
  growth: { creativity: 0.008, social: 0.006, satisfaction: 0.008 },   // 社员每天的成长（按 40 名社员折算）
  output: { activity: 18, culture: 6 },                                // 每天产出（按 40 名社员折算）
  effects: [{ target: 'event_interval', op: 'mul', value: -0.03 }],        // 建成即生效的加成
  perLevelEffects: [{ target: 'festival_score', op: 'mul', value: 0.02 }], // 每级叠加的加成
  festivalScore: 6,                // 每级对学园祭的贡献分
  boostsActivities: ['校园活动'],   // 提升哪些活动的成功率
  requires: { buildings: { clubBuilding: 2 }, tech: ['clubOps'] },   // 随建筑 / 科技 / 评级逐步解锁
  tags: ['hobby'],
})
```

要点：

- 社员名额总额上限为在校学生的 120%（允许兼部），因此社团扩张要和招生一起考虑。
- 社团数量受**部室容量**限制（教学楼每级 +1、社团活动楼每级 +6、部室栋每级 +8、中庭广场每级 +4）。
- `festivalScore` 累积成「学园祭评分」，直接决定学园祭 / 体育祭 / 合唱祭等祭典活动的成功率与奖励。
- 想再加点氛围，可以再配一个社团事件或祭典活动（见下面的事件、活动两节）。

## 七、科技

```ts
addTech({
  id: 'mySustainableCampus',
  name: '绿色校园计划',
  icon: '♻️',
  branch: '校园管理',                // 教学科技 / 科研科技 / 学生发展 / 校园管理 / 对外交流
  desc: '把节电、节水与垃圾分类做成课程。',
  cost: { money: 6000, teaching: 1500, research: 300 },
  researchMinutes: 1800,
  requires: ['digitalCampus'],      // 前置科技 id
  effects: [{ target: 'money_rate', op: 'mul', value: 0.08 }],
  unlocks: { buildings: ['myGreenhouse'], courses: ['myGardening'], policies: [] },
})
```

新增分支也可以：`branch` 写一个新名字，科技面板会自动多出一个分支按钮。

## 八、校规

```ts
addPolicy({
  id: 'myPhoneRule',
  name: '手机集中管理',
  icon: '📵',
  desc: '上课期间手机统一放储物柜。',
  category: '管理',                  // 教学 / 学生 / 管理 / 特色
  effects: [
    { target: 'exam_score', op: 'mul', value: 0.06 },
    { target: 'satisfaction_rate', op: 'mul', value: -0.05 },
  ],
  requires: { buildings: { dorm: 1 } },
  tags: ['管理'],
})
```

建议每条校规都同时有收益与代价，否则会破坏流派平衡。校规名额由 `BASE_POLICY_SLOTS`（默认 2）与 `policy_slots` 加成决定。

## 九、随机事件

```ts
addEvent({
  id: 'myLostCat',
  title: '走失的校犬',
  icon: '🐕',
  text: '校犬「土豆」在周末走丢了，学生在群里发了两百多条寻狗消息。',
  category: '校园',                  // 校园 / 学生 / 教师 / 比赛 / 季节 / 校友 / 外校 / 特殊
  weight: 10,                       // 抽取权重（0 表示只通过 schedule 触发）
  cooldownDays: 30,
  once: false,                      // true 表示整局只出现一次
  seasons: ['spring'],              // 可选：只在某些季节出现
  minSchoolYear: 1,                 // 可选：最早出现的学年
  requires: { buildings: { canteen: 1 }, tech: ['clubSystem'] },
  choices: [
    {
      label: '组织学生分片寻找',
      hint: '满意度与社交能力提升，占用一点课程时间',
      apply: combo(
        studentDelta({ satisfaction: 6, social: 2 }, '第二天早上，土豆自己回来了。'),
        gain({ teaching: -80 }),
      ),
    },
    {
      label: '交给社区一起找',
      hint: '低调处理，家长认可度略升',
      apply: combo(gain({ parentTrust: 8 }), studentDelta({ satisfaction: -2 })),
      effects: [{ target: 'event_good', op: 'mul', value: 0.02 }],   // 可选：永久加成
    },
  ],
})
```

可用的组合函数：

| 函数 | 作用 |
| --- | --- |
| `gain({ money: 100, research: 50 })` | 直接结算资源（可负） |
| `studentDelta({ academic: 1, stress: 3 })` | 全体学生属性变化 |
| `teacherDelta({ quality: 2, morale: 5 })` | 教师队伍变化 |
| `setFlag('flagName')` | 设置统计标记（可被成就或后续事件读取） |
| `text('一行日志')` | 只输出一段结算说明 |
| `combo(a, b, c)` | 依次执行多个效果 |

**延迟事件**：在选项里写 `schedule: [{ eventId: 'myFollowUp', days: 3 }]`，然后定义后续事件（`weight: 0`，不会进随机池）：

```ts
addEvent({
  id: 'myFollowUp',
  title: '三天之后',
  icon: '⏳',
  text: '……',
  category: '校园',
  weight: 0,
  cooldownDays: 5,
  choices: [
    { label: '继续投入', hint: '高回报', apply: combo(gain({ money: -500, research: 300 })) },
    { label: '就此收尾', hint: '稳健', apply: combo(gain({ research: 60 })) },
  ],
})
```

## 十、效果卡

```ts
addCard({
  id: 'mySpringFestival',
  name: '春日社团祭',
  icon: '🎏',
  rarity: '稀有',                    // 普通 / 稀有 / 史诗 / 传奇（权重 62 / 26 / 10 / 2）
  desc: '社团联合祭典带来的人气。7 天内活跃度 +40%、满意度 +15%。',
  pools: ['campus', 'any'],          // academic / sports / arts / research / exchange / campus / any
  effects: [
    { target: 'activity_rate', op: 'mul', value: 0.4 },
    { target: 'satisfaction_rate', op: 'mul', value: 0.15 },
  ],
  durationMinutes: 7 * 1440,         // 时长型（= 7 天）
  // uses: 5,                       // 或者次数型：参加活动时消耗一次
})
```

## 十一、比赛、交流与校园活动

```ts
addActivity({
  id: 'myCityDebateCup',
  name: '全市辩论赛',
  icon: '⚖️',
  kind: '学术比赛',                  // 体育比赛 / 学术比赛 / 艺术比赛 / 科研比赛 / 校际交流 / 国际交流
  desc: '与全市高中同台论辩。',
  seasons: ['spring'],              // 可选：只在某些季节开放（招生类活动用它限定春季）
  durationMinutes: 3 * 1440,
  cost: { teaching: 300, money: 600 },
  studentCost: 16,                  // 需要的学生人数（同时是实力基数）
  attribute: 'social',              // 决定队伍实力的学生属性
  difficulty: 60,                   // 越高越难
  baseSuccess: 0.46,
  rewards: {
    reputation: 16,
    resources: { culture: 80, parentTrust: 20 },
    cardPool: 'academic',
    cardChance: 0.45,
    recruitBonus: 20,               // 可选：招生加成，计入下一年的新生人数
    unlockTags: ['customDebateWin'],  // 会写入 statistics.flags，可用于成就判断
  },
  requires: { tech: ['schoolExchange'] },
})
```

## 十二、成就

```ts
addAchievement({
  id: 'myFirstCustom',
  name: '第一位自定义成就',
  desc: '在【比赛】里赢下全市辩论赛。',
  tier: '隐藏',                      // 普通 / 隐藏 / 长期 / 极难
  hidden: true,                      // 未解锁时显示为 ？？？
  check: (s) => s.statistics.flags.customDebateWin === true,
  reward: {
    legacyPoints: 2,
    resources: { reputation: 50 },
    effects: [{ target: 'competition_success', op: 'mul', value: 0.03 }],  // 永久加成
  },
})
```

`check` 里可以读取任何状态，例如：

```ts
check: (s) => s.statistics.graduates >= 500,
check: (s) => Object.values(s.buildings).reduce((a, b) => a + b.level, 0) >= 120,
check: (s) => s.students.alumniActive >= 300 && s.school.rating >= 70,
```

## 十三、传承节点

```ts
addLegacyNode({
  id: 'myLegacyGarden',
  name: '校园花园传统',
  icon: '🌷',
  branch: '管理传承',                // 七个内置分支之外也可以写新分支名
  desc: '上一轮留下的园艺传统。',
  maxLevel: 8,
  baseCost: 3,
  costGrowth: 1.6,
  requires: ['mgnBudget'],           // 前置传承节点
  perLevelEffects: [{ target: 'satisfaction_rate', op: 'mul', value: 0.03 }],
})
```

**传承特性（perk）** 需要额外的开局逻辑，写法如下（并在 `LegacyEngine.collectPerkBonuses()` 里加一句实现）：

```ts
addLegacyNode({
  id: 'myPerkNode',
  name: '传承特性：温室传统',
  icon: '🌿',
  branch: '管理传承',
  desc: '开局即拥有温室。',
  maxLevel: 1,
  baseCost: 10,
  costGrowth: 1,
  requires: ['myLegacyGarden'],
  perk: 'myGreenhousePerk',
  perkDesc: '每一轮开局自带校园温室。',
})
```

## 十四、校队（队伍）

校队是「建筑 → 社团 → 招够人 → 上报成立 → 日常训练 → 打比赛」这条链的终点，用 `addTeam` 注册：

```ts
addTeam({
  id: 'myKendoTeam',
  name: '星河·竹风',
  shortName: '剑道队',
  icon: '🥋',
  kind: '体育',                    // 体育 / 学术 / 艺术 / 科研 / 文化
  desc: '道场里的第一课是坐姿，第二课才是挥剑。',
  attribute: 'sports',             // 决定实力的学生属性
  requiresClub: { id: 'kyudo', level: 2, members: 20 },   // 需要哪个社团发展到什么程度
  requires: { buildings: { kyudojo: 1 } },
  foundingCost: { money: 9000, teaching: 1200 },
  foundingActivity: 140,
  minStudents: 70,
  maxTierIndex: 5,                 // 可参加到第几级赛事（0=邻校友谊赛 … 5=国际邀请赛）
  baseStrength: 23,
  training: {
    minutes: 1440,
    cost: { money: 900, teaching: 180 },
    baseGain: 5,
    studentDelta: { sports: 0.016, stress: 0.02 },
  },
  perLevelEffects: [{ target: 'competition_success', op: 'mul', value: 0.01 }],
})
```

赛事阶梯由 `src/data/teams.ts` 的 `TEAM_TIERS` 统一定义（友谊赛 → 区 → 市 → 省 → 全国 → 国际），要求实力门槛与参赛资格（科技 / 评级）。
队伍加成可用 `team_training`（训练收益）、`competition_success` / `competition_reward`（比赛）。

## 十五、验证与排错

1. 保存文件后刷新页面。若内容没有出现，先看浏览器控制台：注册问题会以 `[内容自检]` 打出来。
2. 用 `?debug=1` 打开游戏，在【选项 · 调试工具】面板底部可以看到内容自检结果。
3. 跑一次 `npm test`：`tests/custom-content.test.ts` 会验证注册接口，`tests/content.test.ts` 会验证所有内容（含自定义）的加成目标、前置 id、重复 id 与科技循环依赖。

常见错误：

| 现象 | 原因 |
| --- | --- |
| 内容不显示 | `id` 重复或为空、加成 `target` 拼错、`requires` 里的 id 不存在 —— 会出现在自检结果里 |
| 建筑一直不出现 | 前置条件没满足（科技 / 前置建筑 / 评级）；未解锁建筑按设计不显示 |
| 课程开不了 | 校规名额 / 课程槽位 / 教师数量 / 前置建筑任一项不满足 |
| 事件从不出现 | `weight` 为 0（只用于 schedule）、季节不匹配、`minSchoolYear` 未到，或冷却期未结束 |
