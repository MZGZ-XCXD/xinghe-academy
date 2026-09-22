import type {
  Cohort,
  GameState,
  ResourceKey,
  Season,
  StudentAttributes,
  TeacherGroup,
  TeacherSubject,
} from '../types'
import { TEACHER_SUBJECTS } from '../types'
import {
  BASE_POLICY_SLOTS,
  BUILDING_DEFS,
  COURSE_DEFS,
  STARTING_BUILDINGS,
  TECH_DEFS,
  ACHIEVEMENT_DEFS,
  CLUB_DEFS,
  TEAM_DEFS,
  EVENT_DEFS,
  CARD_DEFS,
  ACTIVITY_DEFS,
  LEGACY_NODES,
  RESOURCE_DEFS,
} from '../../data'
import { ALL_RESOURCES } from '../../data/resources'
import { clamp, freshAttributes, safeNumber, sanitizeResource } from '../formulas'
import { EVENT_MIN_REAL_SECONDS } from './EventEngine'

export const CURRENT_SAVE_VERSION = 3

export interface NewGameOptions {
  schoolName?: string
  seed?: number
  keepLegacy?: Partial<GameState['legacy']>
  keepAchievements?: GameState['achievements']
  keepSettings?: GameState['settings']
  keepStatistics?: GameState['statistics']
  keepCardsHistory?: GameState['cards']['history']
  applyLegacyPerks?: {
    buildings?: Record<string, number>
    technologies?: string[]
    money?: number
    satisfaction?: number
  }
}

const BASE_TEACHERS: Partial<Record<TeacherSubject, number>> = {
  chinese: 2,
  math: 2,
  english: 2,
  science: 3,
  humanities: 2,
  arts: 2,
  info: 1,
  psych: 1,
}

function makeCohort(grade: 1 | 2 | 3, count: number, bonus: number): Cohort {
  const attrs: StudentAttributes = freshAttributes(grade * 3)
  for (const key of Object.keys(attrs) as (keyof StudentAttributes)[]) {
    attrs[key] = clamp(attrs[key] + bonus, 0, 100)
  }
  return {
    grade,
    count,
    attrs,
    stress: clamp(35 + grade * 2, 0, 100),
    // 高三略低于高一：压力更大，新鲜感更少
    satisfaction: clamp(64 - grade * 3, 0, 100),
  }
}

function makeTeachers(): TeacherGroup[] {
  return TEACHER_SUBJECTS.map((subject, index) => ({
    subject,
    count: BASE_TEACHERS[subject] ?? 0,
    quality: 42 + ((index * 7) % 9),
    stress: 24 + ((index * 5) % 8),
    morale: 68 + ((index * 3) % 10),
  }))
}

export function createInitialState(options: NewGameOptions = {}): GameState {
  const state: GameState = {
    saveVersion: CURRENT_SAVE_VERSION,
    meta: {
      createdAt: Date.now(),
      lastSavedAt: Date.now(),
      sessionStartSeconds: 0,
      runIndex: 1,
      version: CURRENT_SAVE_VERSION,
    },
    time: { minutes: 0, speed: 1, paused: false },
    school: {
      name: options.schoolName ?? '星河实验学园',
      rating: 0,
      ratingTier: 0,
      pendingRatingExam: null,
      policySlots: BASE_POLICY_SLOTS,
      activePolicies: [],
      lastAnnualReport: null,
      permanentEffects: [],
    },
    resources: createEmptyResources(),
    students: {
      cohorts: [makeCohort(1, 60, 0), makeCohort(2, 40, 6), makeCohort(3, 20, 12)],
      graduates: 0,
      alumniActive: 0,
      alumniQuality: 0,
      recruitBonus: 0,
      capacityWarned: false,
    },
    teachers: { groups: makeTeachers(), hireQueue: [] },
    buildings: Object.fromEntries(
      Object.entries(STARTING_BUILDINGS).map(([id, level]) => [id, { level }]),
    ),
    buildQueue: [],
    courses: {},
    technologies: {},
    activeActivities: [],
    activityResults: [],
    clubs: {},
    teams: {},
    events: { active: [], scheduled: [], log: [], cooldownUntil: {}, seenCount: {}, nextRollMinute: 3600 },
    cards: { active: [], offers: [], history: [], pityCounter: 0 },
    achievements: {},
    legacy: {
      points: 0,
      lifetimePoints: 0,
      historyPoints: 0,
      nodes: {},
      perks: {},
      prestigeCount: 0,
      lifetimeGraduates: 0,
      lifetimeStudents: 0,
      lifetimeCompetitionWins: 0,
      lifetimePrestigePoints: 0,
      bestRating: 0,
    },
    statistics: createEmptyStatistics(),
    settings: {
      autoSave: true,
      autoSaveSeconds: 30,
      notifications: true,
      speedPresets: [1, 2, 5],
      soundEnabled: false,
      tutorialsEnabled: true,
      // 4K / 高分屏默认放大：等价于浏览器 175% 缩放，可在【选项】里调
      uiScale: 1.75,
    },
    ui: {
      // 开局只给「总览 + 建筑 + 选项」，其余系统由剧情引导一章一章开放
      unlockedTabs: ['campus', 'buildings', 'options'],
      tutorialsSeen: [],
      activeTab: 'campus',
      tutorialStep: 0,
      pendingTutorial: null,
      tutorialCompleteAcknowledged: false,
    },
  }

  state.resources.money = 500
  state.resources.teaching = 60
  state.resources.reputation = 5

  for (const b of BUILDING_DEFS) {
    if (!(b.id in state.buildings)) state.buildings[b.id] = { level: 0 }
  }
  for (const c of COURSE_DEFS) {
    state.courses[c.id] = { active: false, unlocked: !c.requires, totalServedMinutes: 0 }
  }
  for (const t of TECH_DEFS) state.technologies[t.id] = { unlocked: false, researching: false }
  for (const a of ACHIEVEMENT_DEFS) state.achievements[a.id] = { unlocked: false }
  for (const club of CLUB_DEFS) state.clubs[club.id] = { unlocked: !club.requires, level: 0, members: 0 }
  for (const team of TEAM_DEFS) {
    state.teams[team.id] = {
      founded: false,
      level: 0,
      strength: 0,
      morale: 70,
      matches: 0,
      wins: 0,
      losses: 0,
      bestTierIndex: -1,
      training: false,
      match: false,
    }
  }
  for (const node of LEGACY_NODES) state.legacy.nodes[node.id] = state.legacy.nodes[node.id] ?? 0

  // 继承存档数据
  if (options.keepLegacy) Object.assign(state.legacy, options.keepLegacy)
  if (options.keepAchievements) state.achievements = options.keepAchievements
  if (options.keepSettings) state.settings = { ...state.settings, ...options.keepSettings }
  if (options.keepStatistics) state.statistics = options.keepStatistics
  if (options.keepCardsHistory) state.cards.history = options.keepCardsHistory
  if (options.applyLegacyPerks) {
    for (const [id, level] of Object.entries(options.applyLegacyPerks.buildings ?? {})) {
      if (state.buildings[id]) state.buildings[id].level = level
    }
    for (const id of options.applyLegacyPerks.technologies ?? []) {
      if (state.technologies[id]) state.technologies[id].unlocked = true
    }
    state.resources.money += options.applyLegacyPerks.money ?? 0
  }

  state.meta.runIndex = state.legacy.prestigeCount + 1
  return state
}

export function createEmptyResources(): Record<ResourceKey, number> {
  const out = {} as Record<ResourceKey, number>
  for (const key of ALL_RESOURCES) out[key] = 0
  return out
}

export function createEmptyStatistics(): GameState['statistics'] {
  return {
    totalMoneyEarned: 0,
    totalMoneySpent: 0,
    totalTeachingEarned: 0,
    studentsTaught: 0,
    graduates: 0,
    competitions: 0,
    competitionWins: 0,
    exchanges: 0,
    research: 0,
    eventsResolved: 0,
    cardsGained: 0,
    prestiges: 0,
    buildingsBuilt: 0,
    longestSessionSeconds: 0,
    peakStudents: 0,
    peakRating: 0,
    totalPlaySeconds: 0,
    negativeEventsInYear: 0,
    perfectYears: 0,
    distinctEventIds: [],
    cardsPlayed: 0,
    usedPolicies: [],
    flags: {},
    yearSnapshot: { moneyEarned: 0, moneySpent: 0, graduates: 0, wins: 0, competitions: 0, eventsResolved: 0 },
    activityLog: [],
  }
}

/**
 * 存档规范化：任何缺失字段、非法数字、未知 id 都会被修正，
 * 保证导入旧版本或被篡改的存档不会让游戏白屏。
 */
export function normalizeState(raw: unknown): { state: GameState; warnings: string[] } {
  const warnings: string[] = []
  const base = createInitialState()
  if (!raw || typeof raw !== 'object') {
    warnings.push('存档内容为空或格式非法，已创建新学园。')
    return { state: base, warnings }
  }
  const input = raw as Partial<GameState>

  const version = safeNumber((input as { saveVersion?: number }).saveVersion, 0)
  if (version > CURRENT_SAVE_VERSION) {
    warnings.push(`存档版本 ${version} 高于当前游戏版本 ${CURRENT_SAVE_VERSION}，已尝试兼容读取。`)
  } else if (version < CURRENT_SAVE_VERSION) {
    warnings.push(`检测到旧版本存档（v${version}），已自动迁移到 v${CURRENT_SAVE_VERSION}。`)
  }

  // 时间
  base.time.minutes = Math.max(0, safeNumber(input.time?.minutes, 0))
  base.time.speed = [1, 2, 5, 10, 100].includes(safeNumber(input.time?.speed, 1)) ? safeNumber(input.time?.speed, 1) : 1
  base.time.paused = input.time?.paused === true

  // 元数据
  base.meta.createdAt = safeNumber(input.meta?.createdAt, Date.now())
  base.meta.lastSavedAt = safeNumber(input.meta?.lastSavedAt, Date.now())
  base.meta.sessionStartSeconds = Math.max(0, safeNumber(input.meta?.sessionStartSeconds, 0))
  base.meta.runIndex = Math.max(1, Math.floor(safeNumber(input.meta?.runIndex, 1)))

  // 学校
  if (typeof input.school?.name === 'string' && input.school.name.trim()) base.school.name = input.school.name.slice(0, 40)
  base.school.rating = clamp(safeNumber(input.school?.rating, 0), 0, 100)
  base.school.ratingTier = clamp(Math.floor(safeNumber(input.school?.ratingTier, 0)), 0, 7)
  base.school.pendingRatingExam =
    input.school?.pendingRatingExam == null
      ? null
      : clamp(Math.floor(safeNumber(input.school.pendingRatingExam, 0)), 0, 7)
  base.school.policySlots = clamp(Math.floor(safeNumber(input.school?.policySlots, BASE_POLICY_SLOTS)), 0, 12)
  base.school.activePolicies = (input.school?.activePolicies ?? []).filter((id) => typeof id === 'string')
  base.school.permanentEffects = (input.school?.permanentEffects ?? []).filter(
    (e) => e && typeof e.target === 'string' && (e.op === 'add' || e.op === 'mul') && Number.isFinite(e.value),
  )
  base.school.lastAnnualReport = input.school?.lastAnnualReport ?? null

  // 资源
  for (const key of RESOURCE_DEFS.map((r) => r.key)) {
    base.resources[key] = sanitizeResource(safeNumber(input.resources?.[key], base.resources[key] ?? 0))
  }

  // 建筑
  for (const def of BUILDING_DEFS) {
    const level = Math.floor(safeNumber(input.buildings?.[def.id]?.level, STARTING_BUILDINGS[def.id] ?? 0))
    base.buildings[def.id] = { level: clamp(level, 0, def.maxLevel) }
  }
  const rawQueue = Array.isArray(input.buildQueue) ? input.buildQueue : []
  base.buildQueue = rawQueue
    .filter((t) => t && typeof t.buildingId === 'string' && BUILDING_DEFS.some((b) => b.id === t.buildingId))
    .map((t, index) => ({
      id: typeof t.id === 'string' ? t.id : `q${index}`,
      buildingId: t.buildingId,
      targetLevel: clamp(Math.floor(safeNumber(t.targetLevel, 1)), 1, 99),
      startMinute: Math.max(0, safeNumber(t.startMinute, 0)),
      endMinute: Math.max(0, safeNumber(t.endMinute, 0)),
      durationMinutes: Math.max(1, safeNumber(t.durationMinutes, 1)),
    }))

  // 课程
  for (const def of COURSE_DEFS) {
    const rawCourse = input.courses?.[def.id]
    base.courses[def.id] = {
      active: rawCourse?.active === true,
      unlocked: rawCourse?.unlocked === true || !def.requires,
      totalServedMinutes: Math.max(0, safeNumber(rawCourse?.totalServedMinutes, 0)),
    }
  }

  // 科技
  for (const def of TECH_DEFS) {
    const rawTech = input.technologies?.[def.id]
    base.technologies[def.id] = {
      unlocked: rawTech?.unlocked === true,
      researching:
        rawTech && typeof rawTech.researching === 'object' && rawTech.researching
          ? {
              startMinute: Math.max(0, safeNumber(rawTech.researching.startMinute, 0)),
              endMinute: Math.max(0, safeNumber(rawTech.researching.endMinute, 0)),
            }
          : false,
    }
  }

  // 学生
  const cohorts = Array.isArray(input.students?.cohorts) ? input.students!.cohorts! : []
  const normalizedCohorts: Cohort[] = [1, 2, 3].map((grade) => {
    const found = cohorts.find((c) => c && Number(c.grade) === grade)
    const fallback = base.students.cohorts.find((c) => c.grade === grade)!
    if (!found) return fallback
    const attrs = { ...fallback.attrs }
    for (const key of Object.keys(attrs) as (keyof StudentAttributes)[]) {
      attrs[key] = clamp(safeNumber(found.attrs?.[key], fallback.attrs[key]), 0, 100)
    }
    return {
      grade: grade as 1 | 2 | 3,
      count: clamp(Math.floor(safeNumber(found.count, 0)), 0, 200000),
      attrs,
      stress: clamp(safeNumber(found.stress, fallback.stress), 0, 100),
      satisfaction: clamp(safeNumber(found.satisfaction, fallback.satisfaction), 0, 100),
    }
  })
  base.students.cohorts = normalizedCohorts
  base.students.graduates = Math.max(0, Math.floor(safeNumber(input.students?.graduates, 0)))
  base.students.alumniActive = Math.max(0, Math.floor(safeNumber(input.students?.alumniActive, 0)))
  base.students.alumniQuality = clamp(safeNumber(input.students?.alumniQuality, 0), 0, 5)
  base.students.recruitBonus = clamp(safeNumber(input.students?.recruitBonus, 0), 0, 100000)
  base.students.capacityWarned = input.students?.capacityWarned === true

  // 教师
  const groups = Array.isArray(input.teachers?.groups) ? input.teachers!.groups! : []
  base.teachers.groups = TEACHER_SUBJECTS.map((subject) => {
    const found = groups.find((g) => g && g.subject === subject)
    const fallback = base.teachers.groups.find((g) => g.subject === subject)!
    if (!found) return fallback
    return {
      subject,
      count: clamp(Math.floor(safeNumber(found.count, fallback.count)), 0, 10000),
      quality: clamp(safeNumber(found.quality, fallback.quality), 0, 100),
      stress: clamp(safeNumber(found.stress, fallback.stress), 0, 100),
      morale: clamp(safeNumber(found.morale, fallback.morale), 0, 100),
    }
  })
  base.teachers.hireQueue = (Array.isArray(input.teachers?.hireQueue) ? input.teachers!.hireQueue! : [])
    .filter((h) => h && TEACHER_SUBJECTS.includes(h.subject))
    .map((h) => ({
      subject: h.subject,
      count: clamp(Math.floor(safeNumber(h.count, 1)), 1, 100),
      endMinute: Math.max(0, safeNumber(h.endMinute, 0)),
    }))

  // 事件
  base.events.active = (Array.isArray(input.events?.active) ? input.events!.active! : []).filter(
    (e) => e && typeof e.defId === 'string' && EVENT_DEFS.some((d) => d.id === e.defId),
  ).map((event) => ({
    ...event,
    expiresAtMinute: Math.max(0, safeNumber(event.expiresAtMinute, 0)),
    // 旧存档没有现实时间下限：读档后重新给玩家 5 分钟
    expiresAtEpoch: safeNumber(
      event.expiresAtEpoch,
      Date.now() + EVENT_MIN_REAL_SECONDS * 1000,
    ),
  }))
  base.events.scheduled = (Array.isArray(input.events?.scheduled) ? input.events!.scheduled! : []).filter(
    (e) => e && typeof e.defId === 'string' && EVENT_DEFS.some((d) => d.id === e.defId),
  )
  base.events.log = (Array.isArray(input.events?.log) ? input.events!.log! : []).slice(-60)
  base.events.cooldownUntil = sanitizeNumberMap(input.events?.cooldownUntil)
  base.events.seenCount = sanitizeNumberMap(input.events?.seenCount)
  base.events.nextRollMinute = Math.max(0, safeNumber(input.events?.nextRollMinute, base.events.nextRollMinute))

  // 卡片
  base.cards.active = (Array.isArray(input.cards?.active) ? input.cards!.active! : []).filter(
    (c) => c && CARD_DEFS.some((d) => d.id === c.cardId),
  )
  base.cards.offers = (Array.isArray(input.cards?.offers) ? input.cards!.offers! : []).filter(
    (o) => o && Array.isArray(o.cardIds),
  )
  base.cards.history = (Array.isArray(input.cards?.history) ? input.cards!.history! : [])
    .filter((h) => h && CARD_DEFS.some((d) => d.id === h.cardId))
    .slice(-200)
  base.cards.pityCounter = Math.max(0, Math.floor(safeNumber(input.cards?.pityCounter, 0)))

  // 活动
  base.activeActivities = (Array.isArray(input.activeActivities) ? input.activeActivities : []).filter(
    (a) => a && ACTIVITY_DEFS.some((d) => d.id === a.defId),
  )
  base.activityResults = (Array.isArray(input.activityResults) ? input.activityResults : []).slice(-40)

  // 社团
  for (const def of CLUB_DEFS) {
    const rawClub = input.clubs?.[def.id]
    base.clubs[def.id] = {
      unlocked: rawClub?.unlocked === true || !def.requires,
      level: clamp(Math.floor(safeNumber(rawClub?.level, 0)), 0, def.maxLevel),
      members: Math.max(0, Math.floor(safeNumber(rawClub?.members, 0))),
      joinedAtMinute: rawClub?.joinedAtMinute,
    }
  }

  // 校队
  for (const def of TEAM_DEFS) {
    const rawTeam = input.teams?.[def.id]
    base.teams[def.id] = {
      founded: rawTeam?.founded === true,
      level: clamp(Math.floor(safeNumber(rawTeam?.level, 0)), 0, 5),
      strength: clamp(safeNumber(rawTeam?.strength, 0), 0, 100000),
      morale: clamp(safeNumber(rawTeam?.morale, 70), 0, 100),
      matches: Math.max(0, Math.floor(safeNumber(rawTeam?.matches, 0))),
      wins: Math.max(0, Math.floor(safeNumber(rawTeam?.wins, 0))),
      losses: Math.max(0, Math.floor(safeNumber(rawTeam?.losses, 0))),
      bestTierIndex: clamp(Math.floor(safeNumber(rawTeam?.bestTierIndex, -1)), -1, 20),
      training: rawTeam?.training && typeof rawTeam.training === 'object'
        ? {
            startMinute: Math.max(0, safeNumber(rawTeam.training.startMinute, 0)),
            endMinute: Math.max(0, safeNumber(rawTeam.training.endMinute, 0)),
            gain: safeNumber(rawTeam.training.gain, 0),
          }
        : false,
      match: rawTeam?.match && typeof rawTeam.match === 'object'
        ? {
            tierId: typeof rawTeam.match.tierId === 'string' ? rawTeam.match.tierId : 'friendly',
            startMinute: Math.max(0, safeNumber(rawTeam.match.startMinute, 0)),
            endMinute: Math.max(0, safeNumber(rawTeam.match.endMinute, 0)),
          }
        : false,
      foundedAtMinute: rawTeam?.foundedAtMinute,
    }
  }

  // 成就
  for (const def of ACHIEVEMENT_DEFS) {
    const raw2 = input.achievements?.[def.id]
    base.achievements[def.id] = { unlocked: raw2?.unlocked === true, unlockedAtMinute: raw2?.unlockedAtMinute }
  }

  // 传承
  const legacy = input.legacy ?? ({} as GameState['legacy'])
  base.legacy.points = Math.max(0, safeNumber(legacy.points, 0))
  base.legacy.lifetimePoints = Math.max(0, safeNumber(legacy.lifetimePoints, 0))
  base.legacy.historyPoints = Math.max(0, safeNumber(legacy.historyPoints, 0))
  base.legacy.prestigeCount = Math.max(0, Math.floor(safeNumber(legacy.prestigeCount, 0)))
  base.legacy.lifetimeGraduates = Math.max(0, safeNumber(legacy.lifetimeGraduates, 0))
  base.legacy.lifetimeStudents = Math.max(0, safeNumber(legacy.lifetimeStudents, 0))
  base.legacy.lifetimeCompetitionWins = Math.max(0, safeNumber(legacy.lifetimeCompetitionWins, 0))
  base.legacy.lifetimePrestigePoints = Math.max(0, safeNumber(legacy.lifetimePrestigePoints, 0))
  base.legacy.bestRating = clamp(safeNumber(legacy.bestRating, 0), 0, 100)
  base.legacy.nodes = {}
  for (const node of LEGACY_NODES) {
    const level = Math.floor(safeNumber(legacy.nodes?.[node.id], 0))
    base.legacy.nodes[node.id] = clamp(level, 0, node.maxLevel)
  }
  base.legacy.perks = {}
  for (const node of LEGACY_NODES) {
    if (node.perk && (base.legacy.nodes[node.id] ?? 0) > 0) base.legacy.perks[node.perk] = true
  }

  // 统计
  const stats = input.statistics ?? ({} as GameState['statistics'])
  const emptyStats = createEmptyStatistics()
  const statsRecord = base.statistics as unknown as Record<string, unknown>
  for (const key of Object.keys(emptyStats) as (keyof GameState['statistics'])[]) {
    const fallback = emptyStats[key]
    const value = (stats as unknown as Record<string, unknown>)[key as string]
    if (typeof fallback === 'number') {
      statsRecord[key as string] = Math.max(0, safeNumber(value, fallback))
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) statsRecord[key as string] = value
    }
  }
  base.statistics.flags = sanitizeBoolMap(stats.flags)
  base.statistics.yearSnapshot = {
    moneyEarned: Math.max(0, safeNumber(stats.yearSnapshot?.moneyEarned, 0)),
    moneySpent: Math.max(0, safeNumber(stats.yearSnapshot?.moneySpent, 0)),
    graduates: Math.max(0, safeNumber(stats.yearSnapshot?.graduates, 0)),
    wins: Math.max(0, safeNumber(stats.yearSnapshot?.wins, 0)),
    competitions: Math.max(0, safeNumber(stats.yearSnapshot?.competitions, 0)),
    eventsResolved: Math.max(0, safeNumber(stats.yearSnapshot?.eventsResolved, 0)),
  }
  base.statistics.activityLog = (Array.isArray(stats.activityLog) ? stats.activityLog : []).slice(-50)

  // 设置
  base.settings = {
    autoSave: input.settings?.autoSave !== false,
    autoSaveSeconds: clamp(safeNumber(input.settings?.autoSaveSeconds, 30), 5, 300),
    notifications: input.settings?.notifications !== false,
    speedPresets: [1, 2, 5],
    soundEnabled: input.settings?.soundEnabled === true,
    tutorialsEnabled: input.settings?.tutorialsEnabled !== false,
    // 旧存档没有这一项：默认给 1.75（高分屏更大），非法值一律回落到 1.75
    uiScale: clamp(safeNumber(input.settings?.uiScale, 1.75), 0.75, 3),
  }

  // UI
  base.ui.unlockedTabs = Array.isArray(input.ui?.unlockedTabs)
    ? input.ui!.unlockedTabs!.filter((t) => typeof t === 'string')
    : base.ui.unlockedTabs
  base.ui.tutorialsSeen = Array.isArray(input.ui?.tutorialsSeen) ? input.ui!.tutorialsSeen! : []
  base.ui.activeTab = typeof input.ui?.activeTab === 'string' ? input.ui.activeTab : 'campus'
  base.ui.tutorialStep = Math.max(0, Math.floor(safeNumber(input.ui?.tutorialStep, 0)))
  base.ui.pendingTutorial = typeof input.ui?.pendingTutorial === 'string' ? input.ui.pendingTutorial : null
  base.ui.tutorialCompleteAcknowledged = input.ui?.tutorialCompleteAcknowledged === true

  return { state: base, warnings }
}

function sanitizeNumberMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = safeNumber(value, NaN)
    if (Number.isFinite(n)) out[key] = n
  }
  return out
}

function sanitizeBoolMap(raw: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = value === true
  }
  return out
}
