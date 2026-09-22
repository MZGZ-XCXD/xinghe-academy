/**
 * 《星河实验学园》核心类型定义。
 * 所有数据表（src/data/*）与引擎（src/game/engine/*）都遵循这里的结构。
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export const SEASON_LABEL: Record<Season, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
}

export const SEASON_NAME: Record<Season, string> = {
  spring: '春季学期',
  summer: '夏季学期',
  autumn: '秋季学期',
  winter: '冬季学期',
}

export type ResourceKey =
  | 'money' // 资金
  | 'teaching' // 教学资源
  | 'reputation' // 学校声望
  | 'research' // 科研点
  | 'sports' // 体育点
  | 'culture' // 文化点
  | 'activity' // 学生活跃度
  | 'parentTrust' // 家长认可度
  | 'alumniContribution' // 校友贡献
  | 'educationFund' // 教育基金
  | 'intlReputation' // 国际声誉
  | 'influence' // 学校影响力

export type ResourceTier = '基础' | '中期' | '后期'

export interface ResourceMeta {
  key: ResourceKey
  name: string
  icon: string
  tier: ResourceTier
  desc: string
}

/** 效果作用目标：数据表中只允许使用以下字符串，validateContent() 会校验拼写。 */
export type EffectTarget =
  | 'build_cost' // 建造与升级成本
  | 'build_speed' // 建造速度
  | 'money_rate'
  | 'teaching_rate'
  | 'research_rate'
  | 'sports_rate'
  | 'culture_rate'
  | 'influence_rate'
  | 'reputation_rate'
  | 'activity_rate'
  | 'parenttrust_rate'
  | 'alumni_rate'
  | 'fund_rate'
  | 'intl_rate'
  | 'course_efficiency' // 课程成长与产出
  | 'course_cost' // 课程教学资源消耗（负数为节省）
  | 'student_growth' // 全部学生成长
  | 'teacher_efficiency'
  | 'teacher_stress'
  | 'student_stress'
  | 'satisfaction_rate'
  | 'competition_success'
  | 'competition_reward'
  | 'exchange_success'
  | 'card_chance'
  | 'card_duration'
  | 'offline_efficiency'
  | 'student_capacity'
  | 'enrollment'
  | 'tech_cost'
  | 'salary'
  | 'prestige_gain'
  | 'legacy_cost'
  | 'event_good'
  | 'event_interval'
  | 'exam_score'
  | 'graduation_quality'
  | 'tuition'
  | 'policy_slots'
  | 'club_effect' // 社团成长与产出
  | 'festival_score' // 学园祭 / 文化祭评分
  | 'storage' // 所有资源的仓储上限
  | 'team_training' // 校队训练效率

export interface EffectMeta {
  label: string
  percent: boolean
  desc: string
}

export const EFFECT_META: Record<EffectTarget, EffectMeta> = {
  build_cost: { label: '建造/升级成本', percent: true, desc: '影响所有建筑建造与升级的资金、教学资源成本。' },
  build_speed: { label: '建造速度', percent: true, desc: '缩短建造队列中的所需时间。' },
  money_rate: { label: '资金产出', percent: true, desc: '学费、食堂收入等所有资金收入。' },
  teaching_rate: { label: '教学资源产出', percent: true, desc: '教学楼、图书馆等设施的教学资源产出。' },
  research_rate: { label: '科研点产出', percent: true, desc: '实验楼、科研中心等设施的科研点产出。' },
  sports_rate: { label: '体育点产出', percent: true, desc: '操场、体育馆等设施的体育点产出。' },
  culture_rate: { label: '文化点产出', percent: true, desc: '艺术楼、大礼堂等设施的文化点产出。' },
  influence_rate: { label: '学校影响力产出', percent: true, desc: '荣誉展览馆、研究型校园的影响力产出。' },
  reputation_rate: { label: '声望增长', percent: true, desc: '各类建筑与活动带来的学校声望成长。' },
  activity_rate: { label: '学生活跃度', percent: true, desc: '社团与学生活动带来的活跃度成长。' },
  parenttrust_rate: { label: '家长认可度', percent: true, desc: '家长认可度的成长速度。' },
  alumni_rate: { label: '校友贡献', percent: true, desc: '校友贡献的产出与毕业结算收益。' },
  fund_rate: { label: '教育基金', percent: true, desc: '教育基金的产出一与年度拨款。' },
  intl_rate: { label: '国际声誉', percent: true, desc: '国际声誉的产出与交流收益。' },
  course_efficiency: { label: '课程效率', percent: true, desc: '所有课程的成长与产出效率。' },
  course_cost: { label: '课程消耗', percent: true, desc: '课程每分钟消耗的教学资源。' },
  student_growth: { label: '学生成长速度', percent: true, desc: '所有学生属性成长的总倍率。' },
  teacher_efficiency: { label: '教师效率', percent: true, desc: '影响课程效果、比赛指导与培养质量。' },
  teacher_stress: { label: '教师压力', percent: true, desc: '教师压力的增长速度。' },
  student_stress: { label: '学生压力', percent: true, desc: '学生压力的增长速度。' },
  satisfaction_rate: { label: '满意度变化', percent: true, desc: '学生满意度的变化速度。' },
  competition_success: { label: '比赛成功率', percent: true, desc: '各类比赛与竞赛的成功概率。' },
  competition_reward: { label: '比赛奖励', percent: true, desc: '比赛与竞赛获得的奖励总量。' },
  exchange_success: { label: '交流成功率', percent: true, desc: '校际 / 国际交流活动的成功概率。' },
  card_chance: { label: '效果卡掉落', percent: true, desc: '活动后获得效果卡的概率。' },
  card_duration: { label: '效果卡时长', percent: true, desc: '获得的效果卡持续时间。' },
  offline_efficiency: { label: '离线效率', percent: true, desc: '离线时间的结算效率。' },
  student_capacity: { label: '学生容量', percent: true, desc: '宿舍、教学楼提供的招生容量。' },
  enrollment: { label: '招生人数', percent: true, desc: '每年新生报到人数。' },
  tech_cost: { label: '科技成本', percent: true, desc: '研究科技所需的资源。' },
  salary: { label: '教师薪资', percent: true, desc: '教师每月的工资支出。' },
  prestige_gain: { label: '传承收益', percent: true, desc: '学园传承时获得的传承点。' },
  legacy_cost: { label: '传承消耗', percent: true, desc: '传承树节点的传承点消耗。' },
  event_good: { label: '良性事件概率', percent: true, desc: '随机事件中出现良性选项的概率。' },
  event_interval: { label: '事件间隔', percent: true, desc: '随机事件出现的时间间隔（负数为更频繁）。' },
  exam_score: { label: '考试成绩', percent: true, desc: '期末考与学年评定的成绩加成。' },
  graduation_quality: { label: '毕业生质量', percent: true, desc: '毕业生转化为校友时的质量系数。' },
  tuition: { label: '学费收入', percent: true, desc: '每名学生贡献的资金收入。' },
  policy_slots: { label: '校规名额', percent: false, desc: '同时生效的校规数量（加算）。' },
  club_effect: { label: '社团效果', percent: true, desc: '所有社团的成长与资源产出效率。' },
  festival_score: { label: '学园祭评分', percent: true, desc: '学园祭类活动的成功率与奖励。' },
  storage: { label: '仓储上限', percent: true, desc: '资金、教学资源、科研点、体育点、文化点的存储上限。' },
  team_training: { label: '校队训练效率', percent: true, desc: '校队每次训练获得的实力。' },
}

export const EFFECT_TARGETS = Object.keys(EFFECT_META) as EffectTarget[]

export interface EffectDef {
  target: EffectTarget
  /** add = 加算（少量固定值）；mul = 乘算修正（0.1 表示 +10%，-0.1 表示 -10%） */
  op: 'add' | 'mul'
  value: number
}

/** 解锁 / 出现条件。所有字段都是“与”关系。 */
export interface Requirement {
  schoolRating?: number
  schoolYear?: number
  graduates?: number
  tech?: string[]
  buildings?: Record<string, number>
  policies?: string[]
  legacyPerks?: string[]
  totalStudents?: number
  minStudents?: number
  /** 需要指定社团达到的等级 */
  clubLevels?: Record<string, number>
  /** 需要指定社团的社员人数 */
  clubMembers?: Record<string, number>
  /** 需要已经成立指定校队 */
  teamFounded?: string[]
  /** 需要指定校队达到的实力 */
  teamStrength?: Record<string, number>
  /** 需要全校社团等级总和 */
  totalClubLevels?: number
}

export interface StudentAttributes {
  academic: number
  sports: number
  arts: number
  research: number
  morality: number
  social: number
  health: number
  creativity: number
}

export const STUDENT_ATTR_META: { key: keyof StudentDelta; name: string; icon: string; desc: string }[] = [
  { key: 'academic', name: '学术', icon: '📘', desc: '文化课水平，期末与学术竞赛的核心属性。' },
  { key: 'sports', name: '体育', icon: '🏃', desc: '体能与运动水平，体育比赛的核心属性。' },
  { key: 'arts', name: '艺术', icon: '🎨', desc: '艺术素养，艺术比赛与文化活动的核心属性。' },
  { key: 'research', name: '科研', icon: '🔬', desc: '探究与实验能力，科研竞赛与科技研究的核心属性。' },
  { key: 'morality', name: '品德', icon: '🫱', desc: '品德与责任感，影响校友质量与事件走向。' },
  { key: 'social', name: '社交', icon: '💬', desc: '沟通协作能力，影响交流活动与社团效果。' },
  { key: 'health', name: '健康', icon: '❤️', desc: '身体与心理状态，过低会拖慢全部成长。' },
  { key: 'creativity', name: '创造力', icon: '💡', desc: '创新与项目能力，影响科技与比赛的上限。' },
]

/** 学生属性的增量（课程、建筑、事件都用它描述影响） */
export interface StudentDelta extends Partial<StudentAttributes> {
  stress?: number
  satisfaction?: number
}

/** 学生群体属性键（含压力与满意度） */
export type StudentStatKey = keyof StudentDelta

export interface Cohort {
  grade: 1 | 2 | 3
  count: number
  attrs: StudentAttributes
  stress: number
  satisfaction: number
}

export type TeacherSubject = 'chinese' | 'math' | 'english' | 'science' | 'humanities' | 'arts' | 'info' | 'psych'

export const TEACHER_SUBJECT_META: Record<TeacherSubject, { name: string; icon: string; desc: string }> = {
  chinese: { name: '语文组', icon: '📖', desc: '语文、写作与人文表达类课程。' },
  math: { name: '数学组', icon: '📐', desc: '数学、逻辑与竞赛训练类课程。' },
  english: { name: '外语组', icon: '🌐', desc: '英语与国际文化类课程。' },
  science: { name: '理科组', icon: '⚗️', desc: '物理、化学、生物与实验类课程。' },
  humanities: { name: '文科组', icon: '🏛️', desc: '历史、地理、政治与社会科学类课程。' },
  arts: { name: '艺体组', icon: '🎭', desc: '音乐、绘画、戏剧与体育专项课程。' },
  info: { name: '信息组', icon: '🖥️', desc: '编程、人工智能与信息技术类课程。' },
  psych: { name: '心理组', icon: '🫧', desc: '心理健康、生涯规划与学生辅导。' },
}

export const TEACHER_SUBJECTS = Object.keys(TEACHER_SUBJECT_META) as TeacherSubject[]

export interface TeacherGroup {
  subject: TeacherSubject
  count: number
  quality: number // 教学能力 0-100
  stress: number // 工作压力 0-100
  morale: number // 士气 0-100
}

export interface BuildingDef {
  id: string
  name: string
  icon: string
  desc: string
  category: '教学' | '生活' | '体育' | '文化' | '科研' | '交流' | '行政'
  baseCost: Partial<Record<ResourceKey, number>>
  costGrowth: number
  baseBuildMinutes: number
  buildTimeGrowth: number
  maxLevel: number
  studentCapacity?: number
  teacherCapacity?: number
  courseSlots?: number
  clubSlots?: number
  production?: Partial<Record<ResourceKey, number>>
  /** 每级提供的仓储上限（1 级的值） */
  storage?: Partial<Record<ResourceKey, number>>
  /** 仓储随等级的增长倍数（>1 为指数增长，默认 1 表示按等级线性累加） */
  storageGrowth?: number
  /** 每级都会叠加的效果 */
  perLevelEffects?: EffectDef[]
  /** 建成（等级 > 0）即生效的效果 */
  effects?: EffectDef[]
  requires?: Requirement
  tags?: string[]
}

export interface BuildingState {
  level: number
}

export interface BuildTask {
  id: string
  buildingId: string
  targetLevel: number
  startMinute: number
  endMinute: number
  durationMinutes: number
}

export interface CourseDef {
  id: string
  name: string
  icon: string
  desc: string
  category: '基础课程' | '能力课程' | '特色课程' | '实验课程'
  subject: TeacherSubject
  teacherRequired: number
  slotCost: number
  capacity: number
  /** 每名学生每分钟消耗的教学资源 */
  teachingCostPerStudentMinute: number
  /** 每天每名学生带来的属性变化 */
  growth: StudentDelta
  /** 每天（按 40 名学生为基准）产出的资源 */
  output?: Partial<Record<ResourceKey, number>>
  seasonBonus?: { season: Season; multiplier: number; label: string }[]
  tags?: string[]
  requires?: Requirement
}

export interface CourseState {
  active: boolean
  unlocked: boolean
  totalServedMinutes: number
}

export type TechBranch = '教学科技' | '科研科技' | '学生发展' | '校园管理' | '对外交流'

export interface TechDef {
  id: string
  name: string
  icon: string
  branch: TechBranch
  desc: string
  cost: Partial<Record<ResourceKey, number>>
  researchMinutes: number
  requires: string[]
  effects?: EffectDef[]
  unlocks?: { buildings?: string[]; courses?: string[]; policies?: string[] }
}

export interface TechState {
  unlocked: boolean
  researching: false | { startMinute: number; endMinute: number }
}

export interface PolicyDef {
  id: string
  name: string
  icon: string
  desc: string
  category: '教学' | '学生' | '管理' | '特色'
  effects: EffectDef[]
  requires?: Requirement
  tags?: string[]
}

export type EventCategory = '校园' | '学生' | '教师' | '比赛' | '季节' | '校友' | '外校' | '特殊'

export interface EventDef {
  id: string
  title: string
  icon: string
  text: string
  category: EventCategory
  weight: number
  once?: boolean
  cooldownDays?: number
  seasons?: Season[]
  minSchoolYear?: number
  requires?: Requirement
  choices: EventChoice[]
}

export interface EventChoice {
  label: string
  hint?: string
  /** 需要消耗的资源（会从当前资源中扣除） */
  cost?: Partial<Record<ResourceKey, number>>
  /** 直接获得的资源 */
  gain?: Partial<Record<ResourceKey, number>>
  /** 教师队伍变化 */
  teacherDelta?: { quality?: number; stress?: number; morale?: number }
  /** 只用于说明的结算文字（会写进事件日志） */
  notes?: string[]
  /** 校队状态变化（实力 / 士气） */
  teamDelta?: { teamId: string; strength?: number; morale?: number }
  effects?: EffectDef[]
  /** 事件结算逻辑，返回日志行 */
  apply?: (state: GameState) => string[]
  /** 延迟事件 */
  schedule?: { eventId: string; days: number }[]
  /** 直接发给玩家一次三选一卡片 */
  grantCards?: { pool: CardPool; count: number }
  studentDelta?: StudentDelta
}

export interface ActiveEvent {
  uid: string
  defId: string
  triggeredAtMinute: number
  /** 需要在多少游戏分钟后自动选择 fallback */
  expiresAtMinute: number
  /** 现实时间下限：即使游戏跑得很快，也不会早于这个时刻自动结束 */
  expiresAtEpoch?: number
  source: string
}

export type CardPool = 'academic' | 'sports' | 'arts' | 'research' | 'exchange' | 'campus' | 'any'

export interface CardDef {
  id: string
  name: string
  icon: string
  rarity: '普通' | '稀有' | '史诗' | '传奇'
  desc: string
  pools: CardPool[]
  effects: EffectDef[]
  durationMinutes?: number
  /** 有次数限制的卡片（例如“未来 5 次交流 +15%”） */
  uses?: number
  once?: boolean
}

export interface ActiveCard {
  uid: string
  cardId: string
  acquiredAtMinute: number
  expiresAtMinute: number | null
  usesLeft: number | null
}

export interface CardOffer {
  uid: string
  pool: CardPool
  cardIds: string[]
  createdAtMinute: number
  source: string
}

export type ActivityKind =
  | '体育比赛'
  | '学术比赛'
  | '艺术比赛'
  | '科研比赛'
  | '校园活动'
  | '校际交流'
  | '国际交流'

export interface ActivityDef {
  id: string
  name: string
  icon: string
  kind: ActivityKind
  desc: string
  /** 只在某些季节开放（留空表示全年可办），例如招生类活动只在春季 */
  seasons?: Season[]
  durationMinutes: number
  cost: Partial<Record<ResourceKey, number>>
  /** 需要占用的学生人数 */
  studentCost: number
  attribute: keyof StudentAttributes
  difficulty: number
  baseSuccess: number
  rewards: {
    reputation?: number
    resources?: Partial<Record<ResourceKey, number>>
    cardPool?: CardPool
    cardChance: number
    unlockTags?: string[]
    /** 招生加成：直接计入下一年新生人数（招生类活动专用） */
    recruitBonus?: number
  }
  requires?: Requirement
}

export interface ActiveActivity {
  uid: string
  defId: string
  startMinute: number
  endMinute: number
  teamStrength: number
}

export interface ActivityResult {
  uid: string
  defId: string
  name: string
  success: boolean
  big: boolean
  atMinute: number
  log: string[]
}

/* ------------------------------ 社团（部活） ------------------------------ */

export type ClubCategory = '文化' | '运动' | '学术' | '兴趣' | '特殊'

export interface ClubDef {
  id: string
  /** 中文名，例如 轻音乐社 */
  name: string
  /** 日式别名，例如 軽音部（界面会一并显示） */
  jpName?: string
  icon: string
  category: ClubCategory
  desc: string
  /** 1 级社员数 */
  baseMembers: number
  /** 每升一级增加的社员数 */
  memberPerLevel: number
  maxLevel: number
  /** 建立社团（1 级）所需资金 */
  baseCostMoney: number
  /** 建立社团（1 级）所需学生活跃度 */
  baseCostActivity?: number
  costGrowth: number
  /** 每级每天消耗的资金（社团运营成本） */
  upkeepPerLevelPerDay: number
  /** 每名成员每天的属性成长（按 40 名社员折算为 1 倍） */
  growth?: StudentDelta
  /** 每天产出的资源（按 40 名社员折算为 1 倍，可写负数表示额外开销） */
  output?: Partial<Record<ResourceKey, number>>
  effects?: EffectDef[]
  perLevelEffects?: EffectDef[]
  /** 每级对学园祭的贡献分 */
  festivalScore: number
  /** 提升哪些活动的成功率 */
  boostsActivities?: ActivityKind[]
  requires?: Requirement
  tags?: string[]
}

export interface ClubState {
  unlocked: boolean
  level: number
  members: number
  joinedAtMinute?: number
}

/* ------------------------------ 校队（队伍）与赛事 ------------------------------ */

export type TeamKind = '体育' | '学术' | '艺术' | '科研' | '文化'

/** 赛事层级：所有校队共用一条阶梯（邻校友谊赛 → 区 → 市 → 省 → 全国 → 国际） */
export interface TeamTierDef {
  id: string
  name: string
  icon: string
  desc: string
  /** 报名所需的最低实力 */
  minStrength: number
  /** 对手强度（用于判定胜负） */
  difficulty: number
  baseSuccess: number
  durationMinutes: number
  cost: Partial<Record<ResourceKey, number>>
  /** 需要的参赛人数 */
  memberCost: number
  rewardReputation: number
  rewardResources?: Partial<Record<ResourceKey, number>>
  cardPool?: CardPool
  cardChance: number
  /** 获胜后队伍实力的额外提升 */
  winStrength: number
  requires?: Requirement
}

export interface TeamDef {
  id: string
  /** 队名后缀，例如「火鸟」；显示时会拼上学校名 →「星丘火鸟队」 */
  nickname: string
  /** 供玩家挑选的备选后缀（会与学校名组合成推荐队名） */
  namePool: string[]
  /** 项目名，例如「篮球队」 */
  shortName: string
  icon: string
  kind: TeamKind
  desc: string
  /** 这支队伍靠什么属性打比赛 */
  attribute: keyof StudentAttributes
  /** 组建条件：某个社团要先发展到什么程度 */
  requiresClub?: { id: string; level?: number; members?: number }
  requires?: Requirement
  foundingCost: Partial<Record<ResourceKey, number>>
  foundingActivity?: number
  /** 需要多少在校学生才能组队 */
  minStudents: number
  /** 可参加的最高赛事层级下标（对应 TEAM_TIERS） */
  maxTierIndex: number
  baseStrength: number
  training: {
    minutes: number
    cost?: Partial<Record<ResourceKey, number>>
    baseGain: number
    studentDelta?: StudentDelta
  }
  effects?: EffectDef[]
  perLevelEffects?: EffectDef[]
  tags?: string[]
}

export interface TeamState {
  founded: boolean
  /** 玩家自定义的队名（留空则按学校名自动生成） */
  name?: string
  level: number
  strength: number
  morale: number
  matches: number
  wins: number
  losses: number
  bestTierIndex: number
  training: false | { startMinute: number; endMinute: number; gain: number }
  match: false | { tierId: string; startMinute: number; endMinute: number }
  foundedAtMinute?: number
}

export interface AchievementDef {
  id: string
  name: string
  /** 可选图标（emoji 或图片路径）；不写时用默认的 🏅 / 🔒 */
  icon?: string
  desc: string
  tier: '普通' | '隐藏' | '长期' | '极难'
  hidden?: boolean
  check: (state: GameState) => boolean
  reward?: {
    legacyPoints?: number
    resources?: Partial<Record<ResourceKey, number>>
    effects?: EffectDef[]
  }
}

export interface AchievementState {
  unlocked: boolean
  unlockedAtMinute?: number
}

export type LegacyBranch = '管理传承' | '教育传承' | '校友传承' | '体育传承' | '科研传承' | '国际传承' | '校史传承'

export interface LegacyNodeDef {
  id: string
  name: string
  icon: string
  branch: LegacyBranch
  desc: string
  maxLevel: number
  baseCost: number
  costGrowth: number
  requires: string[]
  perLevelEffects?: EffectDef[]
  effects?: EffectDef[]
  perk?: string
  perkDesc?: string
}

export interface StatisticState {
  totalMoneyEarned: number
  totalMoneySpent: number
  totalTeachingEarned: number
  studentsTaught: number
  graduates: number
  competitions: number
  competitionWins: number
  exchanges: number
  research: number
  eventsResolved: number
  cardsGained: number
  prestiges: number
  buildingsBuilt: number
  longestSessionSeconds: number
  peakStudents: number
  peakRating: number
  totalPlaySeconds: number
  negativeEventsInYear: number
  perfectYears: number
  distinctEventIds: string[]
  cardsPlayed: number
  usedPolicies: string[]
  /** 通用标记位：用于无法从数值推出的成就条件 */
  flags: Record<string, boolean>
  yearSnapshot: {
    moneyEarned: number
    moneySpent: number
    graduates: number
    wins: number
    competitions: number
    eventsResolved: number
  }
  activityLog: { minute: number; text: string; kind: string }[]
}

export interface GameTime {
  /** 本轮开始时为 0，单位为游戏分钟 */
  minutes: number
  speed: number
  paused: boolean
}

export interface StudentState {
  cohorts: Cohort[]
  graduates: number
  alumniActive: number
  alumniQuality: number
  /** 本学年内累积的招生加成（春季招生活动等） */
  recruitBonus: number
  /** 学生容量溢出提示 */
  capacityWarned: boolean
}

export interface TeacherState {
  groups: TeacherGroup[]
  hireQueue: { subject: TeacherSubject; endMinute: number; count: number }[]
}

export interface EventState {
  active: ActiveEvent[]
  /** 已排期但尚未到期的后续事件 */
  scheduled: ActiveEvent[]
  log: { uid: string; defId: string; title: string; lines: string[]; minute: number }[]
  cooldownUntil: Record<string, number>
  seenCount: Record<string, number>
  nextRollMinute: number
}

export interface CardState {
  active: ActiveCard[]
  offers: CardOffer[]
  history: { cardId: string; minute: number }[]
  pityCounter: number
}

export interface LegacyState {
  points: number
  lifetimePoints: number
  historyPoints: number // 校史点
  nodes: Record<string, number>
  perks: Record<string, boolean>
  prestigeCount: number
  lifetimeGraduates: number
  lifetimeStudents: number
  lifetimeCompetitionWins: number
  lifetimePrestigePoints: number
  bestRating: number
}

export interface SchoolState {
  name: string
  rating: number
  /** 已通过评定的等级下标（对应 RATING_TIERS） */
  ratingTier: number
  /** 正在等待考核的等级下标（null 表示没有待考核） */
  pendingRatingExam: number | null
  policySlots: number
  activePolicies: string[]
  lastAnnualReport: AnnualReport | null
  /** 由事件、成就等授予的永久加成 */
  permanentEffects: EffectDef[]
}

export interface AnnualReport {
  schoolYear: number
  rating: number
  academic: number
  sports: number
  arts: number
  research: number
  satisfaction: number
  teacherMorale: number
  reputation: number
  competitionWins: number
  competitionCount: number
  graduates: number
  moneyDelta: number
  enrollment: number
  gradeLabel: string
  notes: string[]
  awards: string[]
}

export interface SettingsState {
  autoSave: boolean
  autoSaveSeconds: number
  notifications: boolean
  speedPresets: number[]
  soundEnabled: boolean
  /** 是否显示剧情引导（关掉后系统照常解锁，只是不再弹窗） */
  tutorialsEnabled: boolean
  /** 界面缩放倍率（等价于浏览器 Ctrl+滚轮缩放，1.75 = 175%） */
  uiScale: number
}

export interface UiState {
  unlockedTabs: string[]
  tutorialsSeen: string[]
  activeTab: string
  /** 已播放到第几章剧情引导 */
  tutorialStep: number
  /** 当前等待玩家阅读的章节 id */
  pendingTutorial: string | null
  /** 玩家是否已收起「剧情结束」的寄语 */
  tutorialCompleteAcknowledged: boolean
}

/** 剧情引导章节：一步步把系统介绍给玩家 */
export interface TutorialStep {
  id: string
  chapter: string
  title: string
  icon: string
  paragraphs: string[]
  /** 播放到这一章时解锁的界面标签 */
  unlocks?: string[]
  /** 任务面板里显示的「该做什么」 */
  objective?: string
  /** 建议前往的标签 */
  tab?: string
  /**
   * 剧情事件：这一章成为当前章节时，直接派发一件剧本事件（浮窗弹出）。
   * 用于让玩家在「随机事件还没开放」的阶段也能体验事件系统。
   */
  demoEvent?: string
  trigger: (state: GameState) => boolean
}

/** 评级考核：每次升级都要过一道评估 */
export interface RatingExamDef {
  /** 通过后进入的等级下标 */
  tierIndex: number
  name: string
  title: string
  icon: string
  examiner: string
  paragraphs: string[]
  requirements: { label: string; check: (state: GameState) => boolean }[]
  reward: Partial<Record<ResourceKey, number>>
}

export interface SaveMeta {
  createdAt: number
  lastSavedAt: number
  sessionStartSeconds: number
  runIndex: number
  version: number
}

export interface GameState {
  saveVersion: number
  meta: SaveMeta
  time: GameTime
  school: SchoolState
  resources: Record<ResourceKey, number>
  students: StudentState
  teachers: TeacherState
  buildings: Record<string, BuildingState>
  buildQueue: BuildTask[]
  courses: Record<string, CourseState>
  technologies: Record<string, TechState>
  activeActivities: ActiveActivity[]
  activityResults: ActivityResult[]
  clubs: Record<string, ClubState>
  teams: Record<string, TeamState>
  events: EventState
  cards: CardState
  achievements: Record<string, AchievementState>
  legacy: LegacyState
  statistics: StatisticState
  settings: SettingsState
  ui: UiState
}

export interface CalendarInfo {
  totalDays: number
  day: number // 1-30
  month: number // 1-12
  monthIndex: number // 从开局（9 月）起算的月份序号
  schoolYear: number
  season: Season
  term: 1 | 2
  vacation: boolean
  label: string
}
