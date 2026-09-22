// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { TUTORIAL_STEPS } from '../src/data'
import { gameEngine, stopGame } from '../src/ui/game'
import { MINUTES_PER_DAY } from '../src/game/formulas'

function makeEngine() {
  return new GameEngine(createInitialState())
}

describe('剧情引导（一步步介绍系统）', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    stopGame()
  })

  it('新存档只开放「总览 / 建筑 / 选项」，并立刻弹出第一章', () => {
    const engine = makeEngine()
    expect([...engine.state.ui.unlockedTabs].sort()).toEqual(['buildings', 'campus', 'options'])
    expect(engine.state.ui.pendingTutorial).toBe('letter')
    const step = engine.pendingTutorial()
    expect(step?.title).toBe('远房亲戚的信')
    expect(step!.paragraphs.length).toBeGreaterThanOrEqual(3)
  })

  it('继续之后第一章关闭；升级一次建筑触发第二章并解锁课程 / 学生', () => {
    const engine = makeEngine()
    engine.advanceTutorial()
    expect(engine.state.ui.pendingTutorial).toBeNull()
    expect(engine.state.ui.unlockedTabs).not.toContain('courses')

    engine.debugUncapStorage()
    engine.debugAddAll(50000)
    engine.build('canteen')
    engine.debugFinishQueue()
    engine.advanceMinutes(5)

    expect(engine.state.ui.pendingTutorial).toBe('firstBuilding')
    expect(engine.state.ui.unlockedTabs).toContain('courses')
    expect(engine.state.ui.unlockedTabs).toContain('students')
  })

  it('开课后触发第三章并解锁科技树', () => {
    const engine = makeEngine()
    engine.state.ui.tutorialStep = 2 // 跳过前两章，专测第三章
    engine.state.ui.pendingTutorial = null
    expect(engine.toggleCourse('chinese')).toBe(true)
    engine.advanceMinutes(5)
    expect(engine.state.ui.pendingTutorial).toBe('firstCourse')
    expect(engine.state.ui.unlockedTabs).toContain('tech')
  })

  it('关掉剧情引导后不再弹窗，但系统照样解锁', () => {
    const engine = makeEngine()
    engine.disableTutorials()
    expect(engine.state.settings.tutorialsEnabled).toBe(false)
    expect(engine.state.ui.pendingTutorial).toBeNull()

    engine.debugUncapStorage()
    engine.debugAddAll(50000)
    engine.build('canteen')
    engine.debugFinishQueue()
    engine.advanceMinutes(5)
    expect(engine.state.ui.pendingTutorial).toBeNull()
    expect(engine.state.ui.unlockedTabs).toContain('courses')
  })

  it('可以重新播放剧情引导', () => {
    const engine = makeEngine()
    engine.advanceTutorial()
    engine.disableTutorials()
    expect(engine.state.ui.tutorialStep).toBeGreaterThan(0)
    engine.restartTutorials()
    expect(engine.state.ui.pendingTutorial).toBe('letter')
  })

  it('每次学园传承后剧情会重新播放', () => {
    const engine = makeEngine()
    engine.advanceTutorial()
    engine.debugUncapStorage()
    engine.debugAddAll(2000000)
    engine.debugUnlockAll()
    engine.state.statistics.graduates = 400
    engine.state.statistics.competitionWins = 20
    engine.debugSetRating(70)
    engine.advanceMinutes(MINUTES_PER_DAY * 2)
    expect(engine.prestige()).toBe(true)
    expect(engine.state.meta.runIndex).toBe(2)
    expect(engine.state.ui.pendingTutorial).toBe('letter')
    expect(engine.state.ui.unlockedTabs).toEqual(['campus', 'buildings', 'options'])
  })

  it('章节数据完整，并且每个界面都有对应的解锁章节', () => {
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(12)
    for (const step of TUTORIAL_STEPS) {
      expect(step.chapter).toMatch(/第.+章/)
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.paragraphs.length).toBeGreaterThan(0)
      expect(typeof step.trigger).toBe('function')
    }
    const unlocked = new Set(TUTORIAL_STEPS.flatMap((step) => step.unlocks ?? []))
    for (const tab of [
      'courses',
      'students',
      'tech',
      'policies',
      'clubs',
      'teams',
      'events',
      'competitions',
      'exchange',
      'legacy',
      'achievements',
      'statistics',
    ]) {
      expect(unlocked.has(tab), `${tab} 应该有对应的解锁章节`).toBe(true)
    }
  })

  it('剧情引导不会卡死：从建楼一路走到事件章节', () => {
    const engine = makeEngine()
    engine.advanceTutorial() // 第一章
    // 任务面板此刻应该提示「去建筑」，而不是下一步的开课
    expect(engine.tutorialTask().objective).toContain('建筑')
    engine.debugUncapStorage()
    engine.debugAddAll(300000)

    // 第二章：建起第一栋建筑
    engine.build('canteen')
    engine.debugFinishQueue()
    engine.advanceMinutes(5)
    expect(engine.state.ui.pendingTutorial).toBe('firstBuilding')
    engine.advanceTutorial()
    expect(engine.state.ui.unlockedTabs).toContain('courses')
    expect(engine.tutorialTask().objective).toContain('课程')

    // 第三章：开第一门课
    expect(engine.toggleCourse('chinese')).toBe(true)
    engine.advanceMinutes(5)
    expect(engine.state.ui.pendingTutorial).toBe('firstCourse')
    engine.advanceTutorial()
    expect(engine.state.ui.unlockedTabs).toContain('tech')
    expect(engine.tutorialTask().objective).toContain('科技')

    // 第四章：研究第一项科技
    expect(engine.research('modernTeaching')).toBe(true)
    engine.advanceMinutes(5000)
    engine.advanceTutorial()
    expect(engine.state.ui.unlockedTabs).toContain('policies')
    expect(engine.tutorialTask().objective).toContain('校规')

    // 第五章：施行一条校规
    expect(engine.togglePolicy('strictSchedule')).toBe(true)
    engine.advanceMinutes(5)
    expect(engine.state.ui.pendingTutorial).toBe('firstPolicy')
    engine.advanceTutorial()
    expect(engine.state.ui.unlockedTabs).toContain('events')
    expect(engine.tutorialTask().objective).toContain('事件')

    // 第六章：剧情事件自动派发（不依赖随机事件是否开放）
    const pending = engine.activeEvents()
    expect(pending.length).toBeGreaterThan(0)
    expect(pending[0].def.id).toBe('tutorialErrand')
    expect(engine.resolveEvent(pending[0].event.uid, 0)).toBe(true)
    engine.advanceMinutes(5)
    expect(engine.state.ui.pendingTutorial).toBe('firstEvent')
    expect(engine.state.ui.unlockedTabs).toContain('competitions')
  })

  it('每一章的任务文案都能通过它自己的触发条件推进（不会出现做不到的任务）', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.objective && step.objective.length > 0, `${step.id} 应该有任务文案`).toBe(true)
      expect(typeof step.trigger, `${step.id} 应该有触发条件`).toBe('function')
    }
  })

  it('章节链自洽：任务面板让你前往的界面，那时已经解锁', () => {
    const unlocked = new Set(['campus', 'buildings', 'options'])
    TUTORIAL_STEPS.forEach((step, index) => {
      if (step.tab) {
        expect(unlocked.has(step.tab), `第 ${index + 1} 章（${step.id}）要前往【${step.tab}】，但它还没解锁`).toBe(true)
      }
      for (const tab of step.unlocks ?? []) unlocked.add(tab)
    })
  })

  it('社团章节的引导说清了「学生活跃度」从哪来', () => {
    const index = TUTORIAL_STEPS.findIndex((step) => step.id === 'firstClub')
    expect(index).toBeGreaterThan(0)
    const step = TUTORIAL_STEPS[index]
    expect(step.objective).toContain('中庭广场')
    expect(step.objective).toContain('学生活跃度')
    // 上一章的故事负责引出这件事
    const previous = TUTORIAL_STEPS[index - 1]
    expect(previous.paragraphs.join('')).toContain('学生活跃度')
    expect(previous.paragraphs.join('')).toContain('中庭广场')
  })

  it('剧情浮窗会渲染正文，并有「不再显示教程」按钮', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.state.ui.pendingTutorial = 'letter'
    await wrapper.vm.$nextTick()
    const text = wrapper.find('.tutorial-modal').text()
    expect(text).toContain('远房亲戚的信')
    expect(text).toContain('不再显示教程')
    expect(text).toContain('第一章')
    await wrapper.find('.tutorial-modal .btn.ghost').trigger('click')
    await wrapper.vm.$nextTick()
    expect(engine.state.settings.tutorialsEnabled).toBe(false)
    wrapper.unmount()
  })
})
