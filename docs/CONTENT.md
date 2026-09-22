# 内容扩展指南

> **最省事的方式**：只编辑 `src/data/custom/index.ts`（使用 `src/data/registry.ts` 提供的 `addBuilding / addCourse / addTech / addPolicy / addEvent / addCard / addActivity / addAchievement / addLegacyNode / addSynergy`），不需要改引擎或界面，存档会立刻识别新条目。完整示例见 [CUSTOM_CONTENT.md](CUSTOM_CONTENT.md)。
>
> 下面这篇是「直接往内置数据表里加内容」的规则，适合维护 `src/data/*.ts` 本身。两种方式共用同一套校验。

所有内容都在 `src/data/` 下定义，新增内容**不需要修改引擎逻辑**（除非要引入全新机制）。新增后运行 `npm test`，`validateContent()` 会检查加成目标拼写、前置 id 是否存在、重复 id 与科技循环依赖。

## 一、效果（EffectDef）

```ts
{ target: 'research_rate', op: 'mul', value: 0.15 }   // 科研产出 +15%
{ target: 'policy_slots', op: 'add', value: 1 }        // 校规名额 +1
```

- `op: 'mul'` 表示相对变化（`0.1` = +10%，`-0.1` = −10%），`op: 'add'` 表示固定加算。
- 允许的 `target` 全部列在 `src/game/types.ts` 的 `EFFECT_META` 中（每个目标都有中文名与说明，同时用于 Tooltip）。写错会立刻被自检捕获。

## 二、新增建筑（`src/data/buildings.ts`）

```ts
{
  id: 'planetarium',            // 唯一 id
  name: '行星馆',
  icon: '🌌',
  desc: '面向全校开放的天象教学空间。',
  category: '科研',             // 教学 / 科研 / 生活 / 体育 / 文化 / 交流 / 行政
  baseCost: { money: 9000, teaching: 1600, research: 400 },
  costGrowth: 1.55,
  baseBuildMinutes: 40,
  buildTimeGrowth: 1.33,
  maxLevel: 20,
  courseSlots: 1,
  production: { research: 3, intlReputation: 0.2 },
  perLevelEffects: [{ target: 'student_growth', op: 'mul', value: 0.004 }],
  effects: [{ target: 'event_good', op: 'mul', value: 0.03 }],
  requires: { buildings: { observatory: 2 }, tech: ['academicPublishing'] },
  tags: ['research'],
}
```

要求：每栋建筑至少提供一种非数值功能（容量 / 课程槽 / 效果 / 产出 / 解锁 / 事件条件）。联动加成写在同文件的 `SYNERGY_DEFS` 中。

## 三、新增课程（`src/data/courses.ts`）

要点：`growth` 与 `output` 以**每个游戏日**为单位，`teachingCostPerStudentMinute` 以每名学生每分钟为单位。

```ts
{
  id: 'quantumLab',
  name: '量子实验室课程',
  icon: '⚛️',
  desc: '……',
  category: '实验课程',          // 基础课程 / 能力课程 / 特色课程 / 实验课程
  subject: 'science',
  teacherRequired: 2,
  slotCost: 2,
  capacity: 90,
  teachingCostPerStudentMinute: 0.0022,
  growth: { research: 0.02, creativity: 0.006, stress: 0.03 },
  output: { research: 5 },
  seasonBonus: [{ season: 'autumn', multiplier: 0.4, label: '秋季集中实验 +40%' }],
  requires: { tech: ['advancedLabTech'], buildings: { advancedLab: 1 } },
  tags: ['research'],
}
```

参考量级：主属性成长 0.01–0.035 / 天（一个学生在三年内累计成长约 30–50 点），压力 0.02–0.06 / 天，教学资源消耗 0.001–0.0026 / 生 / 分钟。

> **招生不是课程。** 招生宣讲、开放日、简章投放属于 `activities` 里的「校园活动」：用 `seasons: ['spring']` 限定春季、用 `rewards.recruitBonus` 提供招生加成。不要做成课程——学生不会去上「招生宣传课」。课程仍保留 `tags: ['recruit']` 的兼容支持，但一般不需要。

## 四、新增科技（`src/data/technologies.ts`）

```ts
{
  id: 'quantumTech',
  name: '量子实验',
  icon: '⚛️',
  branch: '科研科技',            // 教学科技 / 科研科技 / 学生发展 / 校园管理 / 对外交流
  desc: '……',
  cost: { money: 30000, research: 6000, teaching: 8000 },
  researchMinutes: 4200,
  requires: ['advancedLabTech'], // 前置科技 id；自检会检测循环依赖
  effects: [{ target: 'research_rate', op: 'mul', value: 0.18 }],
  unlocks: { buildings: ['planetarium'], courses: ['quantumLab'] },
}
```

## 五、新增校规（`src/data/policies.ts`）

关键点：**必须同时有正负效果**，否则会破坏流派平衡。

```ts
{
  id: 'nightSelfStudy',
  name: '夜间自习制',
  icon: '🌙',
  desc: '晚十点前教学楼不熄灯。',
  category: '教学',
  effects: [
    { target: 'exam_score', op: 'mul', value: 0.09 },
    { target: 'student_stress', op: 'mul', value: 0.18 },
    { target: 'teacher_stress', op: 'mul', value: 0.08 },
  ],
  tags: ['学术'],
}
```

校规名额由 `BASE_POLICY_SLOTS`（默认 2）与 `policy_slots` 加成一并决定。

## 六、新增随机事件（`src/data/events.ts`）

事件使用 `eventHelpers.ts` 提供的工具函数（`gain` / `studentDelta` / `teacherDelta` / `setFlag` / `text` / `combo`）：

```ts
{
  id: 'midnightBell',
  title: '午夜的钟声',
  icon: '🔔',
  text: '夜里十二点，校钟自己响了十三下。值班教师说，他听见楼上有学生唱歌。',
  category: '校园',              // 校园 / 学生 / 教师 / 比赛 / 季节 / 校友 / 外校 / 特殊
  weight: 8,
  cooldownDays: 25,
  seasons: ['autumn'],           // 可选：只在某些季节出现
  minSchoolYear: 2,              // 可选：最早出现的学年
  requires: { buildings: { auditorium: 1 } },   // 可选：条件
  choices: [
    {
      label: '带学生一起去看个究竟',
      hint: '满意度与创造力提升',
      apply: combo(
        studentDelta({ satisfaction: 6, creativity: 2 }, '那一夜成了学园的传说。'),
        gain({ culture: 80 }),
      ),
    },
    {
      label: '封锁钟楼',
      hint: '纪律与家长认可上升',
      apply: combo(gain({ parentTrust: 10 }), studentDelta({ satisfaction: -3 })),
      effects: [{ target: 'event_good', op: 'mul', value: 0.02 }],  // 可选：永久效果
    },
  ],
}
```

**延迟事件**：在选项里写 `schedule: [{ eventId: 'followUpId', days: 3 }]`，并在同一文件中定义 `weight: 0` 的后续事件（`weight: 0` 的事件不会进入随机池，只在排期到期时出现）。

**剧本事件（剧情引导专用）**：`weight: 0` 的事件同样可以被剧情章节用 `demoEvent: '事件id'` 直接派发。例如 `TUTORIAL_STEPS` 里的「第六章 · 走廊上的声音」写了 `demoEvent: 'tutorialErrand'`，玩家走到这一章时「开学第一周」会立刻以浮窗弹出——这样在随机事件关闭的引导阶段，玩家也能体验事件系统。

**剧情章节（`src/data/tutorial.ts`）**：新增章节时守住三条约定——`objective` 必须等于该章 `trigger` 的达成条件（任务面板显示的就是它）；故事在**该章达成时**弹出，所以结尾要引出**下一章**的任务；`unlocks` 也在该章达成时生效，因此要解锁的是**下一章**要用的界面。`tests/tutorial.test.ts` 会检查「任务面板要去的界面那时已经解锁」和「整条链能一路走通」。

**「新解锁」中心弹窗（`src/game/engine/UnlockEngine.ts`）**：玩家建成建筑 / 研究科技 / 通过评级考核 / 成立社团或校队 / 处理事件之后，引擎会把「当前已开放内容」和上一次快照做差集，只要有新内容就弹一段「由于……于是……」的说明。

- 你新加的建筑 / 课程 / 科技 / 校规 / 活动 / 社团**会自动进入这个弹窗**，不需要额外配置（判断标准就是各条目的 `requires`）。
- 想换语气就改 `UNLOCK_FLAVOR`：按 `build / tech / rating / club / team / policy / event / other` 分句，`headline(name)` 是标题，`story` 是正文那句剧情。
- 弹窗里每一条都会显示条目自己的 `icon`、`name`、`desc`，所以给自定义内容写好 `desc` 就等于写好了弹窗里的说明。

## 七、新增效果卡（`src/data/cards.ts`）

```ts
{
  id: 'midsummerNight',
  name: '仲夏夜之梦',
  icon: '🌠',
  rarity: '史诗',                    // 普通 / 稀有 / 史诗 / 传奇（权重 62 / 26 / 10 / 2）
  desc: '……',
  pools: ['research', 'arts'],       // academic / sports / arts / research / exchange / campus / any
  effects: [{ target: 'student_growth', op: 'mul', value: 0.3 }],
  durationMinutes: 10 * 1440,        // 时长型
  // uses: 5,                        // 或次数型（参加活动时消耗）
}
```

## 八、新增比赛 / 交流（`src/data/activities.ts`）

```ts
{
  id: 'worldRobotCup',
  name: '世界机器人大赛',
  icon: '🦾',
  kind: '科研比赛',                  // 体育比赛 / 学术比赛 / 艺术比赛 / 科研比赛 / 校际交流 / 国际交流
  desc: '……',
  durationMinutes: 9 * 1440,
  cost: { teaching: 3000, money: 9000, research: 1500 },
  studentCost: 24,                  // 学生人数门槛
  attribute: 'research',            // 决定实力的学生属性
  difficulty: 130,                  // 与队伍实力对抗
  baseSuccess: 0.38,
  rewards: {
    reputation: 90,
    resources: { research: 1200, influence: 70, intlReputation: 120 },
    cardPool: 'research',
    cardChance: 0.9,
    unlockTags: ['worldChampion'],
  },
  requires: { tech: ['aiBasics'], buildings: { makerLab: 3 } },
}
```

## 九、新增成就（`src/data/achievements.ts`）

```ts
{
  id: 'robotChampion',
  name: '机器人冠军',
  desc: '赢得一次世界机器人大赛。',
  tier: '极难',                     // 普通 / 隐藏 / 长期 / 极难
  hidden: false,                    // 隐藏成就未解锁时界面显示为 ？？？
  check: (s) => s.statistics.flags.worldChampion === true,
  reward: {
    legacyPoints: 6,
    resources: { research: 3000 },
    effects: [{ target: 'competition_success', op: 'mul', value: 0.05 }],
  },
}
```

条件函数接收 `GameState`，可以读取任何数值、标记或计算式；内部抛出异常不会影响游戏循环（引擎会捕获并把该成就视为未达成）。

## 十、新增传承节点（`src/data/legacy.ts`）

```ts
{
  id: 'legQuantum',
  name: '量子研究传统',
  icon: '⚛️',
  branch: '科研传承',
  desc: '……',
  maxLevel: 8,
  baseCost: 5,
  costGrowth: 1.65,
  requires: ['sciInfluence'],
  perLevelEffects: [{ target: 'research_rate', op: 'mul', value: 0.04 }],
  // 特性型节点：
  // effects: [...], perk: 'quantumSeed', perkDesc: '开局解锁量子实验科技。',
}
```

新增 `perk` 时，需要在 `LegacyEngine.collectPerkBonuses()` 中实现它的开局效果（建造 / 科技 / 资金），并在 README 的传承特性列表里补一行。

## 十一、新增资源（较少见）

需要同时修改：`src/game/types.ts` 的 `ResourceKey`、`src/data/resources.ts` 的 `RESOURCE_DEFS` 与分档数组、`src/game/engine/ResourceEngine.ts` 的 `RATE_TARGET` 映射，以及相应建筑的 `production`。

## 十二、新增社团（部活）

```ts
{
  id: 'kyudo',
  name: '弓道社',
  jpName: '弓道部',
  icon: '🏹',
  category: '运动',                 // 文化 / 运动 / 学术 / 兴趣 / 特殊
  desc: '拉弓、呼吸、放箭。道场里只有弦响与呼吸声。',
  baseMembers: 16,                  // 1 级社员
  memberPerLevel: 7,                // 每级新增社员
  maxLevel: 5,
  baseCostMoney: 1500,              // 成立花费
  baseCostActivity: 70,             // 成立消耗学生活跃度
  costGrowth: 1.7,
  upkeepPerLevelPerDay: 13,         // 每级每天运营资金
  growth: { sports: 0.012, morality: 0.01, health: 0.008, stress: -0.01 },  // 社员每天成长
  output: { sports: 12, parentTrust: 6 },                                   // 每天产出（按 40 名社员折算）
  festivalScore: 6,                 // 每级对学园祭的贡献
  boostsActivities: ['体育比赛'],    // 提高哪些活动的成功率
  requires: { buildings: { kyudojo: 1 } },
  tags: ['sport'],
}
```

参考量级：1 级社员 12–30 人、每级 +5–12 人，运营成本 5–25 资金/级/天，成长 0.006–0.018 / 天，产出 6–26 / 天。
祭典类活动（`kind: '校园活动'`）可用 `requires: { totalClubLevels: N, clubLevels: { 社团id: 等级 } }` 与社团挂钩。

## 十三、检查清单

新增内容后请依次确认：

1. `npm test` 通过（内容自检 + 数量下限 + 引擎行为）。
2. `npm run build` 通过（类型检查 + 构建）。
3. 界面中该内容可见：建筑在【建筑】、课程在【课程】、社团在【社团】、科技在【科技】、校规在【校规】、活动在【活动】/【交流】、成就与传承在对应面板。
4. Tooltip 能解释它的数值（若引入了新的加成组合，确认 `engine.rates()` 或 `mods.breakdown()` 能显示来源）。
