/* ============================================================================
 *  校园内容.js —— 你自己的游戏内容入口
 * ============================================================================
 *
 *  作用：给《星河实验学园》添加内容（课程 / 校规 / 科技 / 事件 / 建筑 / 社团……），
 *       不需要改游戏文件，也不需要重新打包。
 *
 *  怎么用：
 *    1. 用记事本（或 VS Code）打开这个文件 —— 它就在游戏 HTML 旁边（同一个文件夹）。
 *    2. 把下面任意示例前面的 "//" 去掉，改成你想要的名字与数值。
 *    3. 保存，然后刷新浏览器里的游戏页面，新内容会立刻出现在对应面板里。
 *    4. 游戏【选项】面板底部会显示「外部内容：已加载 N 项」，N 变了就说明生效了。
 *
 *  注意：
 *    · 这个文件必须和游戏 HTML 放在同一个文件夹，文件名必须是「校园内容.js」。
 *    · 只写 JavaScript 数据（花括号 {} 与方括号 []），不要写 import / export。
 *    · id 必须唯一，只能使用字母、数字、下划线、短横线，例如 myCourse、my-course-1。
 *    · 每一项末尾要有英文逗号 ,；漏掉逗号或引号会导致整段失效。
 *    · 时间字段（baseBuildMinutes / researchMinutes / durationMinutes）的单位是「游戏时间」：
 *      1 游戏日 = 1440 游戏分钟；1× 速度下 1 现实秒 = 120 游戏分钟。
 *      所以 1 000 游戏分钟 ≈ 8 秒现实时间，10 000 ≈ 83 秒，60 000 ≈ 8 分钟。
 *    · 资源数值参考：开局每天收入约 2 200 资金，所以「一次升级 2 500 资金」≈ 1 个游戏日。
 *    · 资金 / 教学资源 / 科研点 / 体育点 / 文化点有仓储上限，超出会被浪费；
 *      建筑可以写 storage: { money: 2000 }（每级线性）或配合 storageGrowth: 1.5（每级 ×1.5）。
 *    · 图标（icon 字段）三种写法都支持：
 *        emoji：  icon: '🍵'
 *        图片：   icon: './icons/tea.png'   （图片放在游戏 HTML 同一文件夹或其子文件夹）
 *        内嵌：   icon: 'data:image/png;base64,...'
 *      图片加载失败会自动显示 ❔，不会报错。emoji 速查表见「如何添加内容.md」。
 *    · 详细教程见同目录下的「如何添加内容.md」。
 */

window.__ACADEMY_CONTENT__ = {
  /* ==========================================================================
   * 一、课程（出现在【课程】面板）
   * ==========================================================================
   *  growth / output 的单位是「每个游戏日」，实际效果会按覆盖到的学生人数折算。
   */
  courses: [
    // {
    //   id: 'teaCeremonyCourse',
    //   name: '茶道与礼法',
    //   icon: '🍵',
    //   desc: '把手上的动作做完整，是这门课唯一的要求。',
    //   category: '特色课程',          // 基础课程 / 能力课程 / 特色课程 / 实验课程
    //   subject: 'arts',              // chinese / math / english / science / humanities / arts / info / psych
    //   teacherRequired: 1,
    //   slotCost: 1,                  // 占用几个课程槽位
    //   capacity: 60,                 // 能覆盖多少名学生
    //   teachingCostPerStudentMinute: 0.003,
    //   growth: { arts: 0.012, morality: 0.01, satisfaction: 0.012, stress: -0.012 },
    //   output: { culture: 6, parentTrust: 6 },
    //   seasonBonus: [{ season: 'spring', multiplier: 0.4, label: '春季茶会 +40%' }],
    //   requires: { buildings: { artsBuilding: 1 } },
    //   tags: ['culture'],
    // },
  ],

  /* ==========================================================================
   * 二、校规（出现在【校规】面板；记得同时给好处与代价）
   * ==========================================================================
   *  effects 的 op：'mul' 是百分比（0.1 = +10%），'add' 是固定值。
   */
  policies: [
    // {
    //   id: 'noPhoneInClass',
    //   name: '课堂手机集中管理',
    //   icon: '📵',
    //   desc: '上课期间手机统一放进储物柜。',
    //   category: '管理',             // 教学 / 学生 / 管理 / 特色
    //   effects: [
    //     { target: 'exam_score', op: 'mul', value: 0.06 },
    //     { target: 'satisfaction_rate', op: 'mul', value: -0.05 },
    //   ],
    //   tags: ['管理'],
    // },
  ],

  /* ==========================================================================
   * 三、科技（出现在【科技】面板的对应分支）
   * ========================================================================== */
  techs: [
    // {
    //   id: 'greenCampus',
    //   name: '绿色校园计划',
    //   icon: '♻️',
    //   branch: '校园管理',            // 教学科技 / 科研科技 / 学生发展 / 校园管理 / 对外交流
    //   desc: '把节电、节水与垃圾分类做成课程。',
    //   cost: { money: 18000, teaching: 4800, research: 600 },
    //   researchMinutes: 8000,        // 研究耗时（游戏分钟；8000 ≈ 1× 下 67 秒）
    //   requires: ['digitalCampus'],  // 前置科技 id
    //   effects: [{ target: 'money_rate', op: 'mul', value: 0.08 }],
    //   unlocks: { courses: ['teaCeremonyCourse'] },
    // },
  ],

  /* ==========================================================================
   * 四、事件（触发时以居中浮窗弹出，玩家选一个选项）
   * ==========================================================================
   *  选项里可以直接写 cost（代价）/ gain（获得）/ studentDelta（学生变化）/
   *  teacherDelta（教师变化）/ notes（说明）/ effects（永久加成），
   *  浮窗会自动把它们显示成「代价：…／获得：…／学生：…」。
   */
  events: [
    // {
    //   id: 'morningBell',
    //   title: '清晨的第一声铃',
    //   icon: '🔔',
    //   text: '开学第一个周一，老校钟比平时早了十分钟响。学生们站在操场上，没有人说话。',
    //   category: '校园',             // 校园 / 学生 / 教师 / 比赛 / 季节 / 校友 / 外校 / 特殊
    //   weight: 10,                   // 抽取权重，越大越常出现
    //   cooldownDays: 20,             // 触发后多少游戏天内不再出现
    //   seasons: ['spring'],          // 可选：只在某些季节出现
    //   choices: [
    //     {
    //       label: '让学生自己排升旗队',
    //       hint: '学生的积极性会提高',
    //       cost: { teaching: 300 },
    //       gain: { activity: 120, culture: 80 },
    //       studentDelta: { satisfaction: 5, social: 2 },
    //       notes: ['那天之后，升旗队每次都比铃声响得更早。'],
    //     },
    //     {
    //       label: '由教务处统一安排',
    //       hint: '稳妥但无趣',
    //       cost: { money: 600 },
    //       gain: { parentTrust: 20 },
    //       studentDelta: { satisfaction: -2, stress: 1 },
    //     },
    //   ],
    // },
  ],

  /* ==========================================================================
   * 五、建筑（出现在【建筑】面板；前置条件没满足时不会显示）
   * ========================================================================== */
  buildings: [
    // {
    //   id: 'greenhouse',
    //   name: '校园温室',
    //   icon: '🌱',
    //   desc: '生物社团的实践基地。',
    //   category: '科研',             // 教学 / 科研 / 生活 / 体育 / 文化 / 交流 / 行政
    //   baseCost: { money: 20000, teaching: 4000 },
    //   costGrowth: 1.35,             // 每升一级的成本倍数（1.3 ~ 1.4 比较合适）
    //   baseBuildMinutes: 10000,      // 1 级工期（游戏分钟；10000 ≈ 1× 下 83 秒）
    //   buildTimeGrowth: 1.12,
    //   maxLevel: 20,
    //   clubSlots: 2,                 // 可选：提供几个社团部室
    //   courseSlots: 1,               // 可选：提供几个课程槽位
    //   studentCapacity: 60,          // 可选：学生容量
    //   production: { research: 1.2 },// 每分钟每级产出的资源
    //   storage: { research: 200 },   // 可选：每级提供的仓储上限
    //   storageGrowth: 1.5,           // 可选：仓储按 1.5 倍逐级增长（不写则按等级线性累加）
    //   perLevelEffects: [{ target: 'student_growth', op: 'mul', value: 0.004 }],
    //   requires: { buildings: { labBuilding: 1 } },
    //   tags: ['lab'],
    // },
  ],
  /* ==========================================================================
   * 六、社团 / 部活（出现在【社团】面板）
   * ========================================================================== */
  clubs: [
    // {
    //   id: 'railwayClub',
    //   name: '铁道研究会',
    //   jpName: '鉄道研究会',
    //   icon: '🚃',
    //   category: '兴趣',             // 文化 / 运动 / 学术 / 兴趣 / 特殊
    //   desc: '周末集体坐新线路，回来交三页时刻表分析。',
    //   baseMembers: 14,              // 1 级社员数
    //   memberPerLevel: 6,
    //   maxLevel: 5,
    //   baseCostMoney: 3200,
    //   baseCostActivity: 120,        // 成立时消耗的学生活跃度
    //   costGrowth: 1.6,
    //   upkeepPerLevelPerDay: 36,     // 每级每天的运营资金
    //   growth: { creativity: 0.008, social: 0.006, satisfaction: 0.008 },
    //   output: { activity: 18, culture: 6 },
    //   festivalScore: 6,             // 每级对学园祭的贡献
    //   boostsActivities: ['校园活动'],
    //   requires: { buildings: { clubBuilding: 2 } },
    // },
  ],

  /* ==========================================================================
   * 六·五、校队（出现在【校队】面板）
   * ==========================================================================
   *  解锁链：建筑 → 社团 → 社团等级 / 社员人数 → 上报成立校队 → 训练 → 比赛。
   *  赛事阶梯（共享）：邻校友谊赛 → 区级 → 市级 → 省级 → 全国 → 国际邀请赛。
   */
  teams: [
    // {
    //   id: 'myKendoTeam',
    //   name: '星河·竹风',
    //   shortName: '剑道队',
    //   icon: '🥋',
    //   kind: '体育',                 // 体育 / 学术 / 艺术 / 科研 / 文化
    //   desc: '道场里的第一课是坐姿，第二课才是挥剑。',
    //   attribute: 'sports',          // 决定实力的学生属性
    //   requiresClub: { id: 'kyudo', level: 2, members: 20 },   // 需要哪个社团发展到什么程度
    //   requires: { buildings: { kyudojo: 1 } },                // 还需要什么建筑 / 科技 / 评级
    //   foundingCost: { money: 9000, teaching: 1200 },          // 上报成立的花费
    //   foundingActivity: 140,        // 需要的学生活跃度
    //   minStudents: 70,              // 在校学生下限
    //   maxTierIndex: 5,              // 可参加到第几级赛事（0=友谊赛 … 5=国际邀请赛）
    //   baseStrength: 23,             // 成立时的初始实力
    //   training: {
    //     minutes: 1440,              // 一次训练耗时（游戏分钟，1440 = 1 天）
    //     cost: { money: 900, teaching: 180 },
    //     baseGain: 5,                // 基础收益，实际会乘以等级 / 属性 / 教师效率 / 士气 / 加成
    //     studentDelta: { sports: 0.016, stress: 0.02 },
    //   },
    //   effects: [{ target: 'team_training', op: 'mul', value: 0.15 }],   // 可选：训练加成
    // },
  ],

  /* ==========================================================================
   * 七、比赛 / 交流 / 校园活动（出现在【活动】或【交流】面板）
   * ========================================================================== */
  activities: [
    // {
    //   id: 'cityDebateCup',
    //   name: '全市辩论赛',
    //   icon: '⚖️',
    //   kind: '学术比赛',             // 体育比赛 / 学术比赛 / 艺术比赛 / 科研比赛 / 校园活动 / 校际交流 / 国际交流
    //   desc: '与全市高中同台论辩。',
    //   seasons: ['spring'],          // 可选：只在某些季节开放；招生类活动通常写 ['spring']
    //   durationMinutes: 4320,        // 3 天
    //   cost: { teaching: 1200, money: 2400 },
    //   studentCost: 16,              // 需要多少名学生
    //   attribute: 'social',          // 决定实力的学生属性
    //   difficulty: 60,               // 越高越难
    //   baseSuccess: 0.46,            // 基础成功率
    //   rewards: {
    //     reputation: 16,
    //     resources: { culture: 80, parentTrust: 20 },
    //     cardPool: 'academic',
    //     cardChance: 0.45,
    //     recruitBonus: 20,           // 可选：招生加成，计入下一年的新生人数
    //     unlockTags: ['myDebateWin'],
    //   },
    //   requires: { tech: ['schoolExchange'] },
    // },
  ],

  /* ==========================================================================
   * 八、效果卡（比赛 / 交流 / 事件后三选一时可能出现）
   * ========================================================================== */
  cards: [
    // {
    //   id: 'springFestivalCard',
    //   name: '春日社团祭',
    //   icon: '🎏',
    //   rarity: '稀有',               // 普通 / 稀有 / 史诗 / 传奇
    //   desc: '社团联合祭典带来的人气。7 天内活跃度 +40%、满意度 +15%。',
    //   pools: ['campus', 'any'],     // academic / sports / arts / research / exchange / campus / any
    //   effects: [
    //     { target: 'activity_rate', op: 'mul', value: 0.4 },
    //     { target: 'satisfaction_rate', op: 'mul', value: 0.15 },
    //   ],
    //   durationMinutes: 10080,       // 7 天
    // },
  ],

  /* ==========================================================================
   * 九、成就（达成后发奖励）
   * ==========================================================================
   *  check 是函数：返回 true 就解锁。可以读 s.school.rating、s.statistics.graduates、
   *  s.statistics.flags.myDebateWin、s.resources.money 等等。
   */
  achievements: [
    // {
    //   id: 'firstCustomWin',
    //   name: '第一位自定义冠军',
    //   icon: '🥇',                   // 可选：emoji 或图片路径
    //   desc: '赢下全市辩论赛。',
    //   tier: '隐藏',                 // 普通 / 隐藏 / 长期 / 极难
    //   hidden: true,
    //   check: (s) => s.statistics.flags.myDebateWin === true,
    //   reward: { legacyPoints: 2, resources: { reputation: 50 } },
    // },
  ],

  /* ==========================================================================
   * 十、传承节点（学园传承后永久强化）
   * ========================================================================== */
  legacyNodes: [
    // {
    //   id: 'legacyGarden',
    //   name: '花园传统',
    //   icon: '🌷',
    //   branch: '管理传承',           // 管理 / 教育 / 校友 / 体育 / 科研 / 国际 / 校史传承
    //   desc: '上一轮留下的园艺传统。',
    //   maxLevel: 8,
    //   baseCost: 3,                  // 1 级消耗的传承点
    //   costGrowth: 1.6,
    //   requires: ['mgnBudget'],      // 前置传承节点
    //   perLevelEffects: [{ target: 'satisfaction_rate', op: 'mul', value: 0.03 }],
    // },
  ],

  /* ==========================================================================
   * 十一、建筑联动（同时满足若干建筑等级时生效）
   * ========================================================================== */
  synergies: [
    // {
    //   id: 'greenChain',
    //   name: '绿色实验链',
    //   desc: '温室与实验楼互相供给材料。',
    //   requires: { greenhouse: 2, labBuilding: 2 },
    //   effects: [{ target: 'research_rate', op: 'mul', value: 0.08 }],
    // },
  ],
}

// 控制台提示：按 F12 打开控制台，能看到这个文件有没有被读到
;(function () {
  try {
    var content = window.__ACADEMY_CONTENT__ || {}
    var kinds = Object.keys(content)
    var total = kinds.reduce(function (sum, key) {
      var list = content[key]
      return sum + (Array.isArray(list) ? list.length : 0)
    }, 0)
    console.log('[校园内容.js] 已加载，类别：' + (kinds.join('、') || '（无）') + '，条目数：' + total)
  } catch (error) {
    console.error('[校园内容.js] 读取失败：', error)
  }
})()
