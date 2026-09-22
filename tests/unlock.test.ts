// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'
import { GameEngine } from '../src/game/engine/GameEngine'
import { createInitialState } from '../src/game/engine/state'
import { gameEngine, stopGame } from '../src/ui/game'
import { MINUTES_PER_DAY } from '../src/game/formulas'

function makeEngine() {
  return new GameEngine(createInitialState())
}

afterEach(() => {
  vi.restoreAllMocks()
  stopGame()
})

describe('新解锁提示与仓储提醒', () => {
  it('开局不会把初始内容当成「刚解锁」', () => {
    const engine = makeEngine()
    expect(engine.unlockNotices.value.length).toBe(0)
  })

  it('教学楼升到 Lv.2 后会弹出「由于……于是解锁了图书馆」的提示', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    expect(engine.build('teachingBuilding')).toBe(true)
    engine.advanceMinutes(5000) // 等工程完工（教学楼 Lv.2 工期约 3400 游戏分钟）

    expect(engine.unlockNotices.value.length).toBeGreaterThan(0)
    const notice = engine.unlockNotices.value[0]
    expect(notice.causeKind).toBe('build')
    expect(notice.headline).toContain('教学楼')
    expect(notice.story.length).toBeGreaterThan(0)
    expect(notice.items.some((item) => item.name === '图书馆')).toBe(true)
    // 每一条都写清「这是什么」，方便玩家判断值不值得做
    for (const item of notice.items) expect(item.desc.length).toBeGreaterThan(0)
  })

  it('研究科技也会带来解锁提示，并且可以逐条关掉', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    engine.research('modernTeaching')
    engine.advanceMinutes(5000)
    const notices = engine.unlockNotices.value
    expect(notices.some((n) => n.causeKind === 'tech')).toBe(true)
    const first = notices[0]
    engine.dismissUnlockNotice(first.id)
    expect(engine.unlockNotices.value.some((n) => n.id === first.id)).toBe(false)
  })

  it('课程槽位变多也会进解锁弹窗（哪怕没有别的新内容）', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    const before = engine.courseSlotInfo().total
    // 音乐教室开局就能建，本身不会解锁别的条目，只加一格课表槽位
    expect(engine.build('musicRoom')).toBe(true)
    engine.advanceMinutes(6000)
    expect(engine.courseSlotInfo().total).toBe(before + 1)

    const notice = engine.unlockNotices.value[0]
    expect(notice, '槽位增加应该产生一次解锁提醒').toBeTruthy()
    const slotItem = notice.items.find((item) => item.kind === 'slot')
    expect(slotItem).toBeTruthy()
    expect(slotItem!.name).toContain('课程槽位 +1')
    expect(slotItem!.desc).toContain('教学楼')
    expect(notice.headline).toContain('音乐教室')
  })

  it('资源顶到仓储上限时不再刷提醒', () => {
    const engine = makeEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(1_000_000)
    engine.clearNotices()
    engine.advanceMinutes(MINUTES_PER_DAY * 10)
    const texts = engine.notices.value.map((n) => n.text).join(' ')
    expect(texts).not.toContain('已达仓储上限')
    expect(texts).not.toContain('超出部分不再计入')
  })

  it('解读锁弹窗会渲染剧情文案与解锁清单', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.advanceTutorial()
    engine.disableTutorials()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    engine.build('teachingBuilding')
    engine.advanceMinutes(5000)
    await wrapper.vm.$nextTick()

    const modal = wrapper.find('.unlock-modal')
    expect(modal.exists()).toBe(true)
    const text = modal.text()
    expect(text).toContain('新解锁')
    expect(text).toContain('图书馆')
    // 教学楼升级同时会多出一格课表槽位，这条也要在弹窗里
    expect(text).toContain('课程槽位 +1')
    expect(text).toContain('课表')
    expect(text).toContain('于是学校多出了这些可能')
    await wrapper.find('.unlock-modal .btn.primary').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.unlock-modal').exists()).toBe(false)
    wrapper.unmount()
  })
})
