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
 *    5. 想多加几条？把一整段示例（连最后一行的逗号 , 一起）复制一份，粘贴在它下面，
 *       只要把 id 改成不重复的名字（第二门课就叫 xxx2），再改 name 与数值就行。
 *       要 5 门课就复制 5 段，要 3 条校规就复制 3 段 —— 每个类别都是一个列表，可以放任意多条。
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
 *
 * ============================================================================
 *  【速查表】下面示例里用到的所有「英文键名」都在这里，对照着抄就行
 * ============================================================================
 *
 *  ── 1. 学生属性（写在 growth / studentDelta 里；正数=成长，负数=下降）──────
 *     academic      学术   文化课水平，期末考与学术竞赛的核心属性
 *     sports        体育   体能与运动水平，体育比赛的核心属性
 *     arts          艺术   艺术素养，艺术比赛与文化活动的核心属性
 *     research      科研   探究与实验能力，科研竞赛与科技研究的核心属性
 *     morality      品德   品德与责任感，影响校友质量与事件走向
 *     social        社交   沟通协作能力，影响交流活动与社团效果
 *     health        健康   身体与心理状态，太低会拖慢全部成长
 *     creativity    创造力 创新与项目能力，影响科技与比赛的上限
 *     stress        压力   越小越好：正数是「加压」，负数是「减压」
 *     satisfaction  满意度 学生情绪，低于 45 会明显拖慢成长
 *     （写法：growth: { academic: 0.02, stress: 0.01, satisfaction: -0.01 }）
 *
 *  ── 2. 资源（写在 output / cost / gain / rewardResources 里）──────────────
 *     cost 里只写正数（游戏自动扣）；★ 标记的五种有仓储上限，囤不完
 *     money               资金       ★ 建造、招聘、活动的通用货币
 *     teaching            教学资源   ★ 开课会持续消耗它（教学楼 / 图书馆产出）
 *     reputation          学校声望     影响招生人数、学校评级与上级拨款
 *     research            科研点     ★ 研究科研类科技与高级设施
 *     sports              体育点     ★ 体育类活动、场馆建设与体育比赛
 *     culture             文化点     ★ 文化活动与艺术类课程
 *     activity            学生活跃度   成立 / 升级社团要花它（中庭广场等设施产出）
 *     parentTrust         家长认可度   影响招生与突发事件时的容错
 *     alumniContribution  校友贡献     毕业时结算的捐赠、设备与机会
 *     educationFund       教育基金     上级部门的年度拨款，用于高等级建造
 *     intlReputation      国际声誉     解锁并支撑国际交流与活动
 *     influence           学校影响力   影响传承收益与顶级设施
 *
 *  ── 3. 教师学科（课程的 subject 字段用；没有对应老师就开不了这门课）──────
 *     chinese     语文组（语文、写作、人文表达）
 *     math        数学组（数学、逻辑、竞赛训练）
 *     english     外语组（英语、国际文化）
 *     science     理科组（物理、化学、生物、实验）
 *     humanities  文科组（历史、地理、政治、社会科学）
 *     arts        艺体组（音乐、绘画、戏剧、体育专项）
 *     info        信息组（编程、人工智能、信息技术）
 *     psych       心理组（心理健康、生涯规划、学生辅导）
 *     注意：arts 在 growth 里表示「学生艺术属性」，在 subject 里表示「艺体组老师」，看它写在哪一项里。
 *
 *  ── 4. 加成 target（写在 effects / perLevelEffects / 传承节点 里）─────────
 *     统一写法：{ target: 'exam_score', op: 'mul', value: 0.06 }  表示「考试成绩 +6%」
 *     · op: 'mul' 是百分比（0.1 = +10%，-0.05 = -5%）——绝大多数都用它
 *     · op: 'add' 是固定值，目前只有 policy_slots（校规名额 +1）用它
 *
 *     产出与收入
 *       money_rate          资金产出（学费、食堂等所有资金收入）
 *       tuition             学费收入（每名学生贡献的资金）
 *       teaching_rate       教学资源产出
 *       research_rate       科研点产出
 *       sports_rate         体育点产出
 *       culture_rate        文化点产出
 *       reputation_rate     声望增长（建筑与活动带来的声望）
 *       activity_rate       学生活跃度成长
 *       parenttrust_rate    家长认可度成长
 *       alumni_rate         校友贡献产出与毕业结算收益
 *       fund_rate           教育基金产出与年度拨款
 *       intl_rate           国际声誉产出与交流收益
 *       influence_rate      学校影响力产出
 *     教学与学生
 *       course_efficiency   课程效率（所有课程的成长与产出）
 *       course_cost         课程消耗（每分钟消耗的教学资源，负数=更省）
 *       student_growth      学生成长速度（所有属性的总倍率）
 *       teacher_efficiency  教师效率（课程效果、比赛指导、培养质量）
 *       teacher_stress      教师压力增长
 *       student_stress      学生压力增长
 *       satisfaction_rate   学生满意度变化速度
 *       exam_score          期末考与学年评定的成绩加成
 *       graduation_quality  毕业生转化为校友时的质量系数
 *       student_capacity    招生容量（宿舍 / 教学楼提供的容量）
 *       enrollment          每年新生报到人数
 *       salary              教师薪资支出（负数=更省）
 *     比赛、社团与活动
 *       competition_success 各类比赛与竞赛的成功率
 *       competition_reward  比赛奖励总量
 *       exchange_success    校际 / 国际交流的成功率
 *       club_effect         所有社团的成长与产出效率
 *       festival_score      学园祭评分（祭典类活动的成功率与奖励）
 *       team_training       校队每次训练获得的实力
 *       card_chance         活动后获得效果卡的概率
 *       card_duration       获得的效果卡持续时间
 *     建设与全局
 *       build_cost          建筑建造 / 升级成本（负数=更便宜）
 *       build_speed         建造速度（正数=更快造完）
 *       tech_cost           研究科技所需的资源（负数=更便宜）
 *       storage             仓储上限（资金 / 教学 / 科研 / 体育 / 文化的存量上限）
 *       offline_efficiency  离线时间的结算效率
 *       event_good          随机事件中出现良性选项的概率
 *       event_interval      随机事件间隔（负数=更频繁）
 *       prestige_gain       学园传承时获得的传承点
 *       legacy_cost         传承树节点的传承点消耗（负数=更便宜）
 *       policy_slots        同时生效的校规名额（用 op: 'add'）
 *
 *  ── 5. 其它枚举值（写错会直接被跳过，注意大小写与中文全角）────────────────
 *     课程 category：基础课程 / 能力课程 / 特色课程 / 实验课程
 *     校规 category：教学 / 学生 / 管理 / 特色
 *     科技 branch：教学科技 / 科研科技 / 学生发展 / 校园管理 / 对外交流
 *     社团 category：文化 / 运动 / 学术 / 兴趣 / 特殊
 *     活动 kind：体育比赛 / 学术比赛 / 艺术比赛 / 科研比赛 / 校园活动 / 校际交流 / 国际交流
 *     活动 attribute：用第 1 张表里的学生属性键（决定用哪种能力算成功率）
 *     校队 kind：体育 / 学术 / 艺术 / 科研 / 文化
 *     校队 attribute：用第 1 张表里的学生属性键
 *     效果卡 pool：academic / sports / arts / research / exchange / campus / any
 *     效果卡 rarity：普通 / 稀有 / 史诗 / 传奇
 *     成就 tier：普通 / 隐藏 / 长期 / 极难
 *     传承 branch：管理传承 / 教育传承 / 校友传承 / 体育传承 / 科研传承 / 国际传承 / 校史传承
 *     季节 season：spring 春 / summer 夏 / autumn 秋 / winter 冬
 *
 *  ── 6. 数值怎么填（凭感觉填也不会崩）────────────────────────────────────
 *     · 百分比一律写小数：0.1 = +10%，0.25 = +25%，-0.05 = -5%
 *     · 学生成长 growth：0.01 – 0.035（0.02 约等于一年 +7 点）
 *     · 每天产出的资源 output：2 – 26；容量 capacity：60 – 200
 *     · 资金：开局每天收入约 2 200，一次小升级约 2 500，中型建筑 10 000 – 50 000
 *     · 时间：1 游戏日 = 1440 游戏分钟；1× 速度下 1 现实秒 = 120 游戏分钟
 *       （1000 ≈ 8 秒现实时间，10 000 ≈ 1.4 分钟，60 000 ≈ 8 分钟）
 */

// 下面每个类别都是一个列表：想加几条就复制几段（改掉 id 与 name）。
// 所有英文键名（academic / arts / culture / parentTrust / exam_score …）的含义见文件顶部【速查表】。
window.__ACADEMY_CONTENT__ = {
  /* ==========================================================================
   * 一、课程（出现在【课程】面板）
   * ==========================================================================
   *  growth / output 的单位是「每个游戏日」，实际效果会按覆盖到的学生人数折算。
   *  growth 里能写哪些属性 → 速查表 1；output 能写哪些资源 → 速查表 2；
   *  subject（哪位老师教）→ 速查表 3。想加第二门课，直接把示例 1 复制一份改 id。
   */
  courses: [
    // ★ 想多加几门课：把下面「示例 1」整段复制一份贴在它下面，改掉 id 与 name 即可。
    //   （id 不能重复：第一门是 teaCeremonyCourse，第二门就叫 flowerArrangingCourse）

    // 示例 1：茶道与礼法
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

    // 示例 2：花道与插花（就是复制示例 1 改出来的，字段可以比示例 1 少，只要有 id / name / icon / desc 等必需项）
    // {
    //   id: 'flowerArrangingCourse',
    //   name: '花道与插花',
    //   icon: '💐',
    //   desc: '一节课只做一件事：把一枝花放进瓶里，放得好看。',
    //   category: '特色课程',
    //   subject: 'arts',
    //   teacherRequired: 1,
    //   slotCost: 1,
    //   capacity: 60,
    //   teachingCostPerStudentMinute: 0.003,
    //   growth: { arts: 0.01, creativity: 0.012, satisfaction: 0.01 },
    //   output: { culture: 5 },
    //   requires: { buildings: { artsBuilding: 1 } },
    //   tags: ['culture'],
    // },
  ],

  /* ==========================================================================
   * 二、校规（出现在【校规】面板；记得同时给好处与代价）
   * ==========================================================================
   *  effects 的 op：'mul' 是百分比（0.1 = +10%），'add' 是固定值。
   *  target 能写什么 → 速查表 4（考试、压力、满意度、资金产出、比赛成功率……）
   */
  policies: [
    // ★ 想多加几条校规：把下面「示例 1」整段复制一份贴在它下面，改掉 id 与 name 即可。
    //   校规名额有限（默认 2 条，随传承/科技提升），所以多写几条备用、临场挑着用是常见玩法。

    // 示例 1：课堂手机集中管理（有好处也有代价）
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

    // 示例 2：早自习签到制
    // {
    //   id: 'morningCheckIn',
    //   name: '早自习签到制',
    //   icon: '🌅',
    //   desc: '七点半到教室签到，迟到要在门口站一分钟。',
    //   category: '学生',
    //   effects: [
    //     { target: 'exam_score', op: 'mul', value: 0.04 },
    //     { target: 'student_stress', op: 'mul', value: 0.08 },
    //     { target: 'satisfaction_rate', op: 'mul', value: -0.03 },
    //   ],
    //   tags: ['学生'],
    // },
  ],

  /* ==========================================================================
   * 三、科技（出现在【科技】面板的对应分支）
   * ========================================================================== */
  techs: [
    // 想多加几项科技：整段复制，改 id / name，并用 requires: ['前置科技id'] 串起来。
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
    // 想多加几个事件：整段复制，改 id / title（写完可以在控制台用 academy.problems() 自检）。
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
    // 想多加几栋楼：整段复制，改 id / name；requires 里可以写前置建筑或科技。
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
    // 想多加几个社团：整段复制，改 id / name，并给 requires 写清楚前置条件。
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
    // 想多加几支校队：整段复制，改 id / nickname / shortName（校队名 = 学校名 + 后缀 + 队）。
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
    // 想多加几个活动：整段复制，改 id / name；kind 决定它出现在【活动】还是【交流】面板。
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
    // 想多加几张效果卡：整段复制，改 id / name / desc 与持续时间。
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
    // 想多加几个成就：整段复制，改 id / name，并把 check 改成你要的条件。
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
    // 想多加几个传承节点：整段复制，改 id / name；branch 决定它在传承树的哪一支。
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
    // 想多加几条建筑联动：整段复制，改 id 与两个建筑 id（这是纯加成，没有名称字段）。
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
