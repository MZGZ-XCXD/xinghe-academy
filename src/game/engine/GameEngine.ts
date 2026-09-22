import { reactive, ref, type UnwrapNestedRefs } from 'vue'
import type {
  CardPool,
  GameState,
  ResourceKey,
  Season,
  TeacherSubject,
} from '../types'
import { ALL_RESOURCES } from '../../data/resources'
import { RESOURCE_MAP } from '../../data/resources'
import {
  ACTIVITY_DEFS,
  ACHIEVEMENT_DEFS,
  BUILDING_MAP,
  CARD_MAP,
  CLUB_MAP,
  COURSE_MAP,
  EVENT_MAP,
  POLICY_MAP,
  TECH_MAP,
  TEAM_DEFS,
  TEAM_MAP,
  TUTORIAL_STEPS,
  RATING_TIERS,
  TUTORIAL_MAP,
  validateContent,
} from '../../data'
import { applyCustomContent } from '../../data/custom'
import { externalContentStatus } from '../../data/custom/external'
import {
  BASE_GAME_MINUTES_PER_REAL_SECOND,
  calendarFromMinutes,
  clamp,
  MINUTES_PER_DAY,
  ratingGrade,
  safeNumber,
  schoolRating,
  storageBreakdown,
  STORAGE_KEYS,
  studentCapacity,
  totalStudents,
  totalTeachers,
} from '../formulas'
import { ModifierIndex } from './ModifierIndex'
import type { EngineHooks, Notice, NoticeKind } from './hooks'
import { createInitialState } from './state'
import { collectModifiers } from './ModifierEngine'
import {
  capacityOf,
  clampToCapacity,
  computeRates,
  grantResources,
  refreshStorageCaps,
  tickResources,
  type ResourceRates,
} from './ResourceEngine'
import { cancelBuild, startBuild, tickBuildQueue } from './BuildingEngine'
import { tickCourses, toggleCourse, usedCourseSlots, totalCourseSlots } from './CourseEngine'
import { clubOverview, tickClubs, upgradeClub } from './ClubEngine'
import { foundTeam, renameTeam, startTeamMatch, startTeamTraining, teamOverview, tickTeams, upgradeTeam } from './TeamEngine'
import {
  applyRatingCap,
  checkRatingExam,
  ratingExamProgress,
  ratingExamStatus,
  rawRating,
  submitRatingExam,
} from './RatingEngine'
import { tickStudentDrift, winterExamSettlement, annualSettlement } from './StudentEngine'
import { startHire, tickHireQueue, tickTeachers } from './TeacherEngine'
import { startResearch, tickResearch } from './TechEngine'
import { togglePolicy, totalPolicySlots } from './PolicyEngine'
import { startActivity, tickActivities } from './ActivityEngine'
import { chooseCard, discardOffer, drawOffer, tickCards } from './CardEngine'
import { activeEventList, resolveEvent, rollRandomEvent, triggerEvent, tickEvents } from './EventEngine'
import { checkAchievements } from './AchievementEngine'
import { buyLegacyNode, collectPerkBonuses, doPrestige, prestigePreview } from './LegacyEngine'
import { computeOffline, type OfflineResult } from './OfflineEngine'
import { clearAllStorage, exportSave, importSave, loadFromStorage, saveToStorage } from './SaveEngine'
import {
  buildUnlockNotice,
  courseSlotItem,
  diffUnlocks,
  snapshotUnlocks,
  type UnlockCause,
  type UnlockItem,
  type UnlockNotice,
} from './UnlockEngine'

export type GameStateRef = UnwrapNestedRefs<GameState>

function isActivityVisible(state: GameState, id: string): boolean {
  const def = ACTIVITY_DEFS.find((a) => a.id === id)
  if (!def) return false
  const req = def.requires
  if (!req) return true
  for (const techId of req.tech ?? []) if (!state.technologies[techId]?.unlocked) return false
  for (const [bid, level] of Object.entries(req.buildings ?? {})) {
    if ((state.buildings[bid]?.level ?? 0) < level) return false
  }
  return true
}

export class GameEngine implements EngineHooks {
  state: GameStateRef
  mods = new ModifierIndex()
  /** 使用 ref 以便 UI 响应式地展示通知（Vue 之外的纯数据层不受影响） */
  notices = ref<Notice[]>([])
  /** 新解锁弹窗队列（居中显示，一次一个） */
  unlockNotices = ref<UnlockNotice[]>([])
  debugEnabled = false
  contentProblems: string[] = []
  offlineReport: OfflineResult | null = null

  private noticeId = 1
  private unlockNoticeId = 1
  /** 上一次「已开放内容」的快照，用来算出刚解锁了什么 */
  private unlockSnapshot: Map<string, UnlockItem> = new Map()
  /** 上一次的课程槽位总数（槽位变多也要提醒） */
  private lastCourseSlots = 0
  private achievementTimer = 0
  private autoSaveTimer = 0
  private sessionSeconds = 0
  /** debugSetRating 设定的评级下限：让调试工具不被评级重算覆盖 */
  private debugRatingFloor = 0
  private ratesCache: { minute: number; rates: ResourceRates } | null = null

  constructor(initial?: GameState) {
    // 自定义内容必须在建立初始状态之前注册，否则新条目不会进入存档与界面
    const customProblems = applyCustomContent()
    this.state = reactive<GameState>(initial ?? createInitialState()) as GameStateRef
    this.contentProblems = customProblems.length > 0 ? customProblems : validateContent()
    collectModifiers(this.state as GameState, this.mods)
    refreshStorageCaps(this.state as GameState, this.mods)
    // 启动（含读档）时先把超出仓储上限的旧数据裁掉
    this.trimToStorageCaps(true)
    this.refreshRating()
    // 开局先记一份快照，避免把初始内容当成「刚解锁」
    this.unlockSnapshot = snapshotUnlocks(this.state as GameState)
    this.lastCourseSlots = totalCourseSlots(this.state as GameState)
    // 开场剧情：新存档（含每次学园传承后）会从这里开始
    this.refreshTutorial()
    this.notify(
      '欢迎就任：先在【课程】中开设语文与数学，学生才会真正开始成长；【建筑】中可以先扩建教学楼与宿舍。',
      'unlock',
    )
  }

  /* ------------------------------ 通知 ------------------------------ */
  notify(text: string, kind: NoticeKind = 'info'): void {
    this.notices.value.unshift({ id: this.noticeId++, text, kind, minute: this.state.time.minutes })
    if (this.notices.value.length > 40) this.notices.value.length = 40
  }

  log(text: string, kind = 'generic'): void {
    this.state.statistics.activityLog.unshift({ minute: this.state.time.minutes, text, kind })
    if (this.state.statistics.activityLog.length > 50) this.state.statistics.activityLog.length = 50
  }

  dismissNotice(id: number): void {
    this.notices.value = this.notices.value.filter((n) => n.id !== id)
  }

  /* ------------------------------ 新解锁提醒 ------------------------------ */
  /**
   * 对比「已开放内容」快照，把新解锁的东西做成一个居中弹窗：
   * 「由于建成了 XX / 研究了 XX，于是解锁了 YY」。
   */
  private reportUnlocks(cause: UnlockCause): void {
    const state = this.state as GameState
    const after = snapshotUnlocks(state)
    const items = diffUnlocks(this.unlockSnapshot, after)
    this.unlockSnapshot = after
    // 课程槽位变多也算「新解锁」：课表能多排一门课，值得单独提一句
    const slots = totalCourseSlots(state)
    if (slots > this.lastCourseSlots) items.push(courseSlotItem(slots, slots - this.lastCourseSlots))
    this.lastCourseSlots = slots
    if (items.length === 0) return
    this.unlockNotices.value.push(buildUnlockNotice(cause, items, this.unlockNoticeId++))
    if (this.unlockNotices.value.length > 8) {
      this.unlockNotices.value.splice(0, this.unlockNotices.value.length - 8)
    }
  }

  /** 不做提示地刷新快照（读档、传承、调试工具用） */
  private resetUnlockSnapshot(): void {
    this.unlockSnapshot = snapshotUnlocks(this.state as GameState)
    this.lastCourseSlots = totalCourseSlots(this.state as GameState)
  }

  currentUnlockNotice(): UnlockNotice | null {
    return this.unlockNotices.value[0] ?? null
  }

  dismissUnlockNotice(id?: number): void {
    const target = id ?? this.unlockNotices.value[0]?.id
    if (target == null) return
    this.unlockNotices.value = this.unlockNotices.value.filter((n) => n.id !== target)
  }

  clearNotices(): void {
    this.notices.value = []
  }

  /* ------------------------------ 主循环 ------------------------------ */
  /** 真实时间推进（由 GameLoop 调用） */
  tickReal(dtSeconds: number): void {
    this.sessionSeconds += dtSeconds
    this.state.statistics.totalPlaySeconds += dtSeconds
    this.state.meta.sessionStartSeconds = this.sessionSeconds
    this.state.statistics.longestSessionSeconds = Math.max(this.state.statistics.longestSessionSeconds, this.sessionSeconds)
    if (this.state.time.paused) return
    const gameMinutes = dtSeconds * BASE_GAME_MINUTES_PER_REAL_SECOND * this.state.time.speed
    this.advanceMinutes(gameMinutes)
    this.handleAutoSave(dtSeconds)
  }

  /** 推进游戏分钟（含自适应分片，防止大步长导致数值跳变） */
  advanceMinutes(gameMinutes: number): void {
    const total = Math.max(0, safeNumber(gameMinutes, 0))
    if (total <= 0) return
    const maxSteps = 400
    const chunk = Math.max(30, Math.ceil(total / maxSteps))
    let remaining = total
    let guard = 0
    while (remaining > 1e-6 && guard < maxSteps + 10) {
      const step = Math.min(chunk, remaining)
      this.step(step)
      remaining -= step
      guard += 1
    }
  }

  private step(dtMinutes: number): void {
    const state = this.state as GameState
    const prevMinutes = state.time.minutes
    state.time.minutes = prevMinutes + dtMinutes
    const dtDays = dtMinutes / MINUTES_PER_DAY

    collectModifiers(state, this.mods)
    refreshStorageCaps(state, this.mods)
    this.refreshRating()

    // 1. 资源与课程
    tickResources(state, this.mods, dtMinutes)
    const courseSummary = tickCourses(state, this.mods, dtDays, dtMinutes, this)
    tickClubs(state, this.mods, dtDays)
    tickTeams(state, this.mods, dtDays, this)

    // 2. 学生与教师
    tickStudentDrift(state, this.mods, dtDays)
    tickTeachers(state, this.mods, dtDays, courseSummary.activeCount, courseSummary.teachingShortage)

    // 3. 队列类系统
    const finishedBuilds = tickBuildQueue(state, this)
    tickHireQueue(state, this)
    const unlockedTechs = tickResearch(state, this)
    tickActivities(state, this.mods, this)
    tickCards(state, this)
    // 建筑落成 / 科技研究完成往往正是解锁新内容的那一刻
    if (finishedBuilds.length > 0) {
      this.reportUnlocks({
        kind: 'build',
        name: finishedBuilds.map((id) => BUILDING_MAP[id]?.name ?? id).join('、'),
      })
    }
    if (unlockedTechs.length > 0) {
      this.reportUnlocks({
        kind: 'tech',
        name: unlockedTechs.map((id) => TECH_MAP[id]?.name ?? id).join('、'),
      })
    }

    // 4. 事件
    tickEvents(state, this.mods, this)
    rollRandomEvent(state, this.mods, this)

    // 5. 成就（每小时检查一次）
    this.achievementTimer += dtMinutes
    if (this.achievementTimer >= 60) {
      this.achievementTimer = 0
      checkAchievements(state, this)
    }

    // 6. 日历边界
    this.handleCalendarBoundaries(prevMinutes, state.time.minutes)

    // 8. 统计峰值与解锁
    state.statistics.peakStudents = Math.max(state.statistics.peakStudents, totalStudents(state))
    state.statistics.peakRating = Math.max(state.statistics.peakRating, state.school.rating)
    this.refreshTutorial()
    this.ratesCache = null
  }

  private refreshRating(): void {
    const state = this.state as GameState
    // 未经考核时评级被锁在当前等级之下——想升级就必须过一次评估
    const computed = Math.max(rawRating(state, this.mods), this.debugRatingFloor)
    state.school.rating = applyRatingCap(state, computed)
    state.legacy.bestRating = Math.max(state.legacy.bestRating, state.school.rating)
    checkRatingExam(state, this.mods, this)
  }

  ratingExam() {
    return ratingExamStatus(this.state as GameState)
  }

  ratingExamProgress() {
    return ratingExamProgress(this.state as GameState)
  }

  submitRatingExam(): boolean {
    const ok = submitRatingExam(this.state as GameState, this.mods, this)
    if (ok) {
      const tier = RATING_TIERS[this.state.school.ratingTier]
      this.reportUnlocks({ kind: 'rating', name: tier ? '「' + tier.label + '」评定' : '评级考核' })
    }
    return ok
  }

  private handleCalendarBoundaries(prevMinutes: number, nextMinutes: number): void {
    const state = this.state as GameState
    const before = calendarFromMinutes(prevMinutes)
    const after = calendarFromMinutes(nextMinutes)

    if (after.monthIndex !== before.monthIndex) {
      const month = after.month
      if (month === 1) {
        winterExamSettlement(state, this.mods, this)
      }
      if (month === 3) {
        this.notify('春季学期开始：招生活动、社团招新与校园建设效果提升。', 'unlock')
        state.students.recruitBonus += 20
      }
      if (month === 6) {
        this.notify('夏季学期开始：体育产出与竞赛机会增加，暑期课程效果提升。', 'unlock')
      }
      if (month === 9) {
        this.notify('秋季学期开始：科研与文化活动进入黄金期，学年评价从此时开始累积。', 'unlock')
      }
      if (month === 12) {
        this.notify('冬季学期开始：期末考临近，考试成绩加成、压力显著上升。', 'unlock')
      }
      if (after.monthIndex % 12 === 0 && after.monthIndex > before.monthIndex) {
        // 9 月 1 日：学年结算 → 升学 → 毕业 → 新生入学
        const { report } = annualSettlement(state, this.mods, this)
        this.notify(`第 ${report.schoolYear} 学年开始：欢迎 ${report.enrollment} 名新生。`, 'unlock')
        if (state.legacy.perks.oldTradition && !state.events.active.some((e) => e.defId === 'alumniSpeech')) {
          triggerEvent(state, 'alumniSpeech', this, '老校传统')
        }
        if (!state.ui.unlockedTabs.includes('statistics')) {
          state.ui.unlockedTabs.push('statistics')
          this.notify('学校档案已解锁：查看完整的学年报告。', 'unlock')
        }
      }
    }
  }

  /**
   * 剧情引导：按顺序检查章节条件。
   * · 条件满足 → 解锁该章对应的界面标签，并在需要时弹出剧情（关掉教程则只解锁）
   * · 每次只推进一章，避免一口气弹出多个窗口
   */
  private refreshTutorial(): void {
    const state = this.state as GameState
    const step = TUTORIAL_STEPS[state.ui.tutorialStep]
    if (!step) return
    let ready = false
    try {
      ready = step.trigger(state) === true
    } catch {
      ready = false
    }
    if (!ready) return

    state.ui.tutorialStep += 1
    for (const tab of step.unlocks ?? []) {
      if (!state.ui.unlockedTabs.includes(tab)) state.ui.unlockedTabs.push(tab)
    }
    // 新的当前章节如果自带剧本事件，就立刻派发（随机事件此时还没开放）
    const next = TUTORIAL_STEPS[state.ui.tutorialStep]
    if (next?.demoEvent && (state.events.seenCount[next.demoEvent] ?? 0) === 0) {
      triggerEvent(state, next.demoEvent, this, '剧情事件')
    }
    // 剧情走完后事件系统才开始计时
    if (state.ui.tutorialStep >= TUTORIAL_STEPS.length) {
      state.events.nextRollMinute = Math.max(state.events.nextRollMinute, state.time.minutes + 1440)
      this.notify('剧情引导结束：接下来没有剧本了，按自己的路线经营这所学校吧。', 'unlock')
    }
    if (!state.settings.tutorialsEnabled) return
    if (state.ui.pendingTutorial) return
    state.ui.pendingTutorial = step.id
    if (!state.ui.tutorialsSeen.includes(step.id)) state.ui.tutorialsSeen.push(step.id)
  }

  /** 当前等待阅读的剧情章节 */
  pendingTutorial() {
    const id = this.state.ui.pendingTutorial
    return id ? TUTORIAL_MAP[id] ?? null : null
  }

  tutorialProgress() {
    return { current: this.state.ui.tutorialStep, total: TUTORIAL_STEPS.length }
  }

  /** 任务面板数据：现在到哪一章、这一章要做什么、建议去哪个标签 */
  tutorialTask() {
    const state = this.state as GameState
    const done = state.ui.tutorialStep >= TUTORIAL_STEPS.length
    const step = done ? null : TUTORIAL_STEPS[state.ui.tutorialStep]
    return {
      done,
      step,
      current: state.ui.tutorialStep,
      total: TUTORIAL_STEPS.length,
      objective: step?.objective ?? '',
      tab: step?.tab ?? null,
      acknowledged: state.ui.tutorialCompleteAcknowledged,
      hasPendingModal: state.ui.pendingTutorial != null,
      closing: '老校长在信末写：「学校交给你了。别怕慢，怕的是停。」',
    }
  }

  /** 收起剧情结束寄语 */
  acknowledgeTutorialComplete(): void {
    this.state.ui.tutorialCompleteAcknowledged = true
  }

  /** 继续：关掉当前剧情窗口 */
  advanceTutorial(): void {
    this.state.ui.pendingTutorial = null
    this.refreshTutorial()
  }

  /** 不再显示教程（系统仍会照常解锁） */
  disableTutorials(): void {
    this.state.settings.tutorialsEnabled = false
    this.state.ui.pendingTutorial = null
    this.notify('已关闭剧情引导；需要时可在【选项】里重新打开或重看。', 'info')
  }

  /** 重新播放剧情引导（从第一章开始，按当前进度逐章触发） */
  restartTutorials(): void {
    this.state.settings.tutorialsEnabled = true
    this.state.ui.tutorialStep = 0
    this.state.ui.pendingTutorial = null
    this.notify('已重新开始剧情引导。', 'info')
    this.refreshTutorial()
  }

  /** 用于 UI 的每分钟产出（带缓存，避免每帧重算） */
  rates(): ResourceRates {
    if (!this.ratesCache || this.ratesCache.minute !== this.state.time.minutes) {
      this.ratesCache = { minute: this.state.time.minutes, rates: computeRates(this.state as GameState, this.mods) }
    }
    return this.ratesCache.rates
  }

  /* ------------------------------ 存档 ------------------------------ */
  private handleAutoSave(dtSeconds: number): void {
    if (!this.state.settings.autoSave) return
    this.autoSaveTimer += dtSeconds
    if (this.autoSaveTimer >= this.state.settings.autoSaveSeconds) {
      this.autoSaveTimer = 0
      this.save()
    }
  }

  save(): boolean {
    return saveToStorage(this.state as GameState)
  }

  exportSave(asBase64 = false): string {
    this.state.statistics.flags.exportedSave = true
    return exportSave(this.state as GameState, asBase64)
  }

  importSave(text: string): { ok: boolean; warnings: string[] } {
    const result = importSave(text)
    if (!result) return { ok: false, warnings: ['存档解析失败：内容不是有效的学园存档。'] }
    this.adoptState(result.state)
    return { ok: true, warnings: result.warnings }
  }

  adoptState(state: GameState, announce = true): void {
    Object.assign(this.state, state)
    // 换档后清空调试用的评级下限，避免新一轮开局继承上一轮被抬高的评级
    this.debugRatingFloor = 0
    collectModifiers(this.state as GameState, this.mods)
    refreshStorageCaps(this.state as GameState, this.mods)
    // 存档可能来自「没有仓储上限」的旧版本：读档时裁剪一次并提示
    this.trimToStorageCaps(announce)
    this.refreshRating()
    this.ratesCache = null
    // 传承 / 换档后，剧情引导按当前进度继续（新存档会从第一章开始）
    this.refreshTutorial()
    // 换档不弹解锁提醒，只把快照对齐
    this.resetUnlockSnapshot()
    if (announce) this.notify('存档已载入。', 'good')
  }

  /** 把超出仓储上限的资源裁掉（启动 / 读档时调用），返回被裁剪的资源名 */
  trimToStorageCaps(announce = false): string[] {
    const state = this.state as GameState
    const trimmed: string[] = []
    for (const key of STORAGE_KEYS) {
      const cap = capacityOf(state, key)
      if (safeNumber(state.resources[key], 0) > cap + 0.5) {
        state.resources[key] = clampToCapacity(state, key, state.resources[key])
        trimmed.push(`${RESOURCE_MAP[key]?.name ?? key} → ${Math.round(cap)}`)
      }
    }
    if (announce && trimmed.length > 0) {
      this.notify(`资源超过仓储上限，已按上限收纳：${trimmed.join('、')}`, 'bad')
    }
    return trimmed
  }

  /** 供界面显示：某个资源的仓储上限与拆解 */
  storageInfo(key: ResourceKey) {
    return storageBreakdown(this.state as GameState, BUILDING_MAP, key, this.mods)
  }

  /**
   * 清空全部存档：删除主存档与备份，并把整局游戏重置为「第一次打开」的状态。
   * 与「重新开始本轮」不同，这里连传承树、成就与历史统计一起清空。
   */
  wipeSave(): string[] {
    const removed = clearAllStorage()
    this.notify(`已删除本地存档（${removed.length} 项）。`, 'bad')
    this.adoptState(createInitialState(), false)
    this.sessionSeconds = 0
    this.autoSaveTimer = 0
    this.achievementTimer = 0
    this.offlineReport = null
    this.clearNotices()
    this.notify('全部存档已清空：传承、成就、统计与学园进度都已重置。', 'bad')
    return removed
  }

  resetRun(): void {
    const fresh = createInitialState({
      schoolName: this.state.school.name,
      keepLegacy: this.state.legacy,
      keepAchievements: this.state.achievements,
      keepSettings: this.state.settings,
      keepStatistics: this.state.statistics,
      keepCardsHistory: this.state.cards.history,
      applyLegacyPerks: collectPerkBonuses(this.state.legacy),
    })
    this.adoptState(fresh)
    this.notify('已重新开始新一轮学园建设。', 'info')
  }

  /* ------------------------------ 玩家操作 ------------------------------ */
  build(id: string): boolean {
    return startBuild(this.state as GameState, id, this.mods, this)
  }

  cancelBuild(taskId: string): void {
    cancelBuild(this.state as GameState, taskId, this)
  }

  toggleCourse(id: string): boolean {
    return toggleCourse(this.state as GameState, id, this.mods, this)
  }

  upgradeClub(id: string): boolean {
    const ok = upgradeClub(this.state as GameState, id, this.mods, this)
    if (ok) this.reportUnlocks({ kind: 'club', name: CLUB_MAP[id]?.name ?? id })
    return ok
  }

  foundTeam(id: string, name?: string): boolean {
    const ok = foundTeam(this.state as GameState, id, this.mods, this, name)
    if (ok) this.reportUnlocks({ kind: 'team', name: TEAM_MAP[id]?.shortName ?? id })
    return ok
  }

  renameTeam(id: string, name: string): boolean {
    return renameTeam(this.state as GameState, id, name, this)
  }

  upgradeTeam(id: string): boolean {
    return upgradeTeam(this.state as GameState, id, this.mods, this)
  }

  trainTeam(id: string): boolean {
    return startTeamTraining(this.state as GameState, id, this.mods, this)
  }

  teamMatch(id: string, tierId: string): boolean {
    return startTeamMatch(this.state as GameState, id, tierId, this.mods, this)
  }

  teamInfo() {
    return teamOverview(this.state as GameState, this.mods)
  }

  clubInfo() {
    return clubOverview(this.state as GameState, this.mods)
  }

  research(id: string): boolean {
    return startResearch(this.state as GameState, id, this.mods, this)
  }

  togglePolicy(id: string): boolean {
    const ok = togglePolicy(this.state as GameState, id, this.mods, this)
    if (ok) this.reportUnlocks({ kind: 'policy', name: POLICY_MAP[id]?.name ?? id })
    return ok
  }

  hire(subject: TeacherSubject, count: number): boolean {
    return startHire(this.state as GameState, subject, count, this)
  }

  startActivity(id: string): boolean {
    return startActivity(this.state as GameState, id, this.mods, this)
  }

  resolveEvent(uid: string, choiceIndex: number): boolean {
    const title = this.state.events.active.find((e) => e.uid === uid)?.defId ?? ''
    const ok = resolveEvent(this.state as GameState, uid, choiceIndex, this.mods, this)
    if (ok) this.reportUnlocks({ kind: 'event', name: EVENT_MAP[title]?.title ?? '校园事件' })
    return ok
  }

  chooseCard(offerUid: string, index: number): boolean {
    return chooseCard(this.state as GameState, offerUid, index, this.mods, this)
  }

  discardOffer(offerUid: string): void {
    discardOffer(this.state as GameState, offerUid)
  }

  giveCardOffer(pool: CardPool, source = '测试'): void {
    drawOffer(this.state as GameState, pool, 3, source, this.mods, this)
  }

  prestigePreview() {
    return prestigePreview(this.state as GameState, this.mods)
  }

  prestige(): boolean {
    const preview = this.prestigePreview()
    if (!preview.can) {
      this.notify(`暂时无法传承：${preview.reasons.join('；')}`, 'bad')
      return false
    }
    const next = doPrestige(this.state as GameState, this.mods)
    this.adoptState(next)
    this.notify(`学园传承完成：获得 ${preview.gain} 传承点，第 ${this.state.meta.runIndex} 轮开始。`, 'unlock')
    return true
  }

  buyLegacyNode(id: string): boolean {
    return buyLegacyNode(this.state as GameState, id, this.mods, this)
  }

  setSpeed(speed: number): void {
    const allowed = this.debugEnabled ? [1, 2, 5, 10, 100] : this.state.settings.speedPresets
    if (allowed.includes(speed)) this.state.time.speed = speed
  }

  togglePause(): void {
    this.state.time.paused = !this.state.time.paused
  }

  setTab(tab: string): void {
    this.state.ui.activeTab = tab
  }

  /** 改校名：立即生效并写入存档（校名保存在 state.school.name 中） */
  renameSchool(name: string): boolean {
    const trimmed = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 24)
    if (!trimmed) {
      this.notify('校名不能为空。', 'bad')
      return false
    }
    const previous = this.state.school.name
    if (previous === trimmed) {
      this.notify('校名没有变化。', 'info')
      return false
    }
    this.state.school.name = trimmed
    this.log(`学园更名：${previous} → ${trimmed}`, 'meta')
    this.notify(`学园更名：${previous} → ${trimmed}`, 'good')
    const saved = this.save()
    if (!saved) {
      this.notify('当前环境无法自动保存，请到【选项】里用导出存档备份。', 'bad')
    }
    return true
  }

  markTutorial(id: string): void {
    if (!this.state.ui.tutorialsSeen.includes(id)) this.state.ui.tutorialsSeen.push(id)
  }

  /* ------------------------------ 离线 ------------------------------ */
  applyOffline(elapsedSeconds: number): OfflineResult | null {
    const result = computeOffline(this.state as GameState, elapsedSeconds, this.mods)
    this.offlineReport = result
    if (result.countedSeconds > 60) {
      this.notify(
        `离线 ${(result.countedSeconds / 3600).toFixed(1)} 小时，学园继续运转（等效 ${result.gameDays.toFixed(1)} 个游戏日）。`,
        'good',
      )
    }
    return result
  }

  /* ------------------------------ 工具 ------------------------------ */
  calendar() {
    return calendarFromMinutes(this.state.time.minutes)
  }

  get season(): Season {
    return this.calendar().season
  }

  get grade(): string {
    return ratingGrade(this.state.school.rating)
  }

  capacity(): number {
    return studentCapacity(this.state as GameState, BUILDING_MAP, this.mods)
  }

  courseSlotInfo() {
    return { used: usedCourseSlots(this.state as GameState), total: totalCourseSlots(this.state as GameState) }
  }

  policySlotInfo() {
    return { used: this.state.school.activePolicies.length, total: totalPolicySlots(this.state as GameState, this.mods) }
  }

  activeEvents() {
    return activeEventList(this.state as GameState)
  }

  totals() {
    return { students: totalStudents(this.state as GameState), teachers: totalTeachers(this.state as GameState) }
  }

  /* ------------------------------ Debug ------------------------------ */
  debugUnlockAll(): void {
    for (const tech of Object.values(TECH_MAP)) {
      const entry = this.state.technologies[tech.id]
      if (entry) {
        entry.unlocked = true
        entry.researching = false
      }
    }
    for (const course of Object.values(this.state.courses)) course.unlocked = true
    // 调试解锁不弹「新解锁」提醒，只把快照对齐
    this.resetUnlockSnapshot()
    this.notify('[Debug] 全部科技与课程已解锁。', 'info')
  }

  debugAddResource(key: ResourceKey, amount: number): void {
    grantResources(this.state as GameState, { [key]: amount } as Partial<Record<ResourceKey, number>>)
    this.notify(`[Debug] ${key} +${amount}`, 'info')
  }

  debugAddAll(amount = 1000000): void {
    const gain: Partial<Record<ResourceKey, number>> = {}
    for (const key of ALL_RESOURCES) gain[key] = amount
    grantResources(this.state as GameState, gain)
    this.state.legacy.points += 500
    this.notify('[Debug] 全部资源与传承点已注入。', 'info')
  }

  /** [Debug] 把五座仓储建筑直接升到指定等级，用于测试「资源足够」的场景 */
  debugUncapStorage(level = 15): void {
    for (const id of ['financeOffice', 'textbookStore', 'instrumentStore', 'equipmentStore', 'propStore']) {
      const def = BUILDING_MAP[id]
      if (!def) continue
      this.state.buildings[id] = { level: Math.min(def.maxLevel, level) }
    }
    collectModifiers(this.state as GameState, this.mods)
    refreshStorageCaps(this.state as GameState, this.mods)
    this.ratesCache = null
    this.notify(`[Debug] 仓储建筑已提升到 Lv.${level}`, 'info')
  }

  debugBuild(id: string): void {
    const def = BUILDING_MAP[id]
    if (!def) return
    const current = this.state.buildings[id]?.level ?? 0
    this.state.buildings[id] = { level: Math.min(def.maxLevel, current + 1) }
    this.state.statistics.buildingsBuilt += 1
    this.notify(`[Debug] ${def.name} → Lv.${this.state.buildings[id].level}`, 'info')
  }

  debugFinishQueue(): void {
    for (const task of this.state.buildQueue) {
      const def = BUILDING_MAP[task.buildingId]
      if (!def) continue
      this.state.buildings[task.buildingId] = { level: Math.min(def.maxLevel, task.targetLevel) }
      this.state.statistics.buildingsBuilt += 1
    }
    this.state.buildQueue = []
    this.notify('[Debug] 建造队列已全部完成。', 'info')
  }

  debugAdvanceDay(days = 1): void {
    this.advanceMinutes(days * MINUTES_PER_DAY)
    this.notify(`[Debug] 时间推进 ${days} 天。`, 'info')
  }

  debugAdvanceMonth(): void {
    this.advanceMinutes(MINUTES_PER_DAY * 30)
    this.notify('[Debug] 时间推进 1 个月。', 'info')
  }

  debugAdvanceYear(): void {
    this.advanceMinutes(MINUTES_PER_DAY * 360)
    this.notify('[Debug] 时间推进 1 学年。', 'info')
  }

  debugTriggerEvent(id?: string): void {
    const target = id ?? 'clubConflict'
    if (!EVENT_MAP[target]) return
    triggerEvent(this.state as GameState, target, this, 'Debug')
  }

  debugGiveCard(cardId?: string): void {
    if (cardId && CARD_MAP[cardId]) {
      this.state.cards.offers.push({
        uid: `debug_${Date.now()}`,
        pool: 'any',
        cardIds: [cardId],
        createdAtMinute: this.state.time.minutes,
        source: 'Debug',
      })
      return
    }
    drawOffer(this.state as GameState, 'any', 3, 'Debug 卡池', this.mods, this)
  }

  debugGiveAchievement(id: string): void {
    const def = ACHIEVEMENT_DEFS.find((a) => a.id === id)
    const entry = this.state.achievements[id]
    if (!def || !entry) return
    entry.unlocked = true
    entry.unlockedAtMinute = this.state.time.minutes
    this.notify(`[Debug] 成就解锁：${def.name}`, 'info')
  }

  debugPrestige(): void {
    const next = doPrestige(this.state as GameState, this.mods)
    this.adoptState(next)
    this.notify('[Debug] 已执行一次学园传承。', 'info')
  }

  debugSetRating(value: number): void {
    // 调试直接设定评级：同时把「已通过考核的等级」提到对应档位，免得被评级上限卡回去
    const target = clamp(value, 0, 100)
    const tier = RATING_TIERS.filter((entry) => entry.min <= target + 0.001).length - 1
    this.state.school.ratingTier = clamp(tier, 0, RATING_TIERS.length - 1)
    this.state.school.pendingRatingExam = null
    this.debugRatingFloor = target
    this.state.school.rating = target
  }

  contentCheck(): string[] {
    return this.contentProblems
  }

  /** 桌面「校园内容.js」的加载情况（供选项面板显示） */
  externalContent() {
    return externalContentStatus()
  }
}

export function policyName(id: string): string {
  return POLICY_MAP[id]?.name ?? id
}

export function courseName(id: string): string {
  return COURSE_MAP[id]?.name ?? id
}
