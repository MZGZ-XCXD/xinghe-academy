// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../src/App.vue'
import { gameEngine, gameState, stopGame } from '../src/ui/game'
import { MINUTES_PER_DAY } from '../src/game/formulas'

afterEach(() => {
  stopGame()
})

describe('界面运行时', () => {
  it('主界面可以挂载，且包含校园信息、资源与导航', () => {
    const wrapper = mount(App)
    const text = wrapper.text()
    expect(text).toContain('校园信息')
    expect(text).toContain('学校资源')
    expect(text).toContain('校园主视图')
    expect(text).toContain('建筑')
    wrapper.unmount()
  })

  it('可以在各已解锁标签之间切换而不抛出异常', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    engine.debugUnlockAll()
    const tabs = ['buildings', 'courses', 'students', 'clubs', 'teams', 'tech', 'policies', 'competitions', 'exchange', 'events', 'legacy', 'achievements', 'statistics', 'options', 'campus']
    for (const tab of tabs) {
      engine.setTab(tab)
      await wrapper.vm.$nextTick()
      expect(wrapper.text().length).toBeGreaterThan(50)
    }
    wrapper.unmount()
  })

  it('时间推进后界面依旧正常渲染（含建造队列与事件）', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    engine.build('canteen')
    engine.debugTriggerEvent('clubConflict')
    engine.advanceMinutes(MINUTES_PER_DAY * 3)
    await wrapper.vm.$nextTick()
    const state = gameState()
    expect(state.time.minutes).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('校园')
    wrapper.unmount()
  })

  it('效果卡弹窗会在获得卡片时出现', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.giveCardOffer('any', '测试')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('效果卡三选一')
    wrapper.unmount()
  })

  it('事件会以页面中间的浮窗出现，选择后关闭并结算', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.debugTriggerEvent('clubConflict')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.event-modal').exists()).toBe(true)
    expect(wrapper.find('.event-modal').text()).toContain('学生社团冲突')
    expect(wrapper.find('.event-modal').text()).toContain('支持学生自治')
    // 每个选项都列出代价与后果
    expect(wrapper.find('.event-modal').text()).toContain('学生：')
    expect(wrapper.find('.event-modal').text()).toContain('获得：')
    // 选择第一个方案后浮窗关闭、事件进入日志
    const choices = wrapper.findAll('.event-modal .choice')
    expect(choices.length).toBeGreaterThan(0)
    await choices[0].trigger('click')
    await wrapper.vm.$nextTick()
    expect(engine.state.events.active.length).toBe(0)
    expect(wrapper.find('.event-modal').exists()).toBe(false)
    expect(engine.state.events.log.length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('浮窗可以稍后处理，事件仍保留在待处理列表里', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.debugTriggerEvent('canteenComplaint')
    await wrapper.vm.$nextTick()
    await wrapper.find('.event-modal .btn.ghost').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.event-modal').exists()).toBe(false)
    expect(engine.state.events.active.length).toBe(1)
    wrapper.unmount()
  })

  it('有卡片待选时事件浮窗让位，避免两层弹窗叠加', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.debugTriggerEvent('clubConflict')
    engine.giveCardOffer('any', '测试')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.event-modal').exists()).toBe(false)
    expect(wrapper.text()).toContain('效果卡三选一')
    engine.discardOffer(engine.state.cards.offers[0].uid)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.event-modal').exists()).toBe(true)
    wrapper.unmount()
  })

  it('选项面板可以清空全部存档（含传承、成就与统计）', async () => {
    localStorage.clear()
    const wrapper = mount(App)
    const engine = gameEngine()
    // 造出一份有进度的存档
    engine.debugUncapStorage()
    engine.debugAddAll(100000)
    engine.debugUnlockAll()
    engine.state.legacy.points = 88
    engine.state.legacy.nodes.eduGrowth = 3
    engine.state.legacy.prestigeCount = 2
    engine.state.statistics.graduates = 500
    engine.state.achievements.firstBuilding.unlocked = true
    engine.state.buildings.library.level = 4
    engine.setTab('options')
    await wrapper.vm.$nextTick()
    expect(engine.save()).toBe(true)
    expect(localStorage.getItem('xinghe-academy-save')).not.toBeNull()

    // 点两次「清空全部存档」按钮（第一次展开确认，第二次执行）
    await wrapper.findAll('button').find((b) => b.text().includes('清空全部存档'))!.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.findAll('button').find((b) => b.text().includes('确认清空'))!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(localStorage.getItem('xinghe-academy-save')).toBeNull()
    expect(localStorage.getItem('xinghe-academy-save-backup')).toBeNull()
    expect(engine.state.legacy.points).toBe(0)
    expect(engine.state.legacy.prestigeCount).toBe(0)
    expect(engine.state.statistics.graduates).toBe(0)
    expect(engine.state.achievements.firstBuilding.unlocked).toBe(false)
    expect(engine.state.buildings.library.level).toBe(0)
    expect(engine.state.time.minutes).toBe(0)
    wrapper.unmount()
  })

  it('活动页面把「暂时无法开展」的活动折叠起来', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.setTab('competitions')
    await wrapper.vm.$nextTick()

    const collapsed = wrapper.text()
    expect(collapsed).toContain('可以开展')
    expect(collapsed).toContain('暂时无法开展')
    // 默认折叠：需要科技 / 建筑的活动不列在页面上
    expect(collapsed).not.toContain('全国实验校锦标赛')

    const toggle = wrapper.findAll('button').find((b) => b.text().trim() === '展开')!
    expect(toggle).toBeTruthy()
    await toggle.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('全国实验校锦标赛')
    expect(wrapper.findAll('.blocked-activities .info-card').length).toBeGreaterThan(0)

    // 再点一次收起
    const close = wrapper.findAll('button').find((b) => b.text().trim() === '收起')!
    await close.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('全国实验校锦标赛')
    wrapper.unmount()
  })

  it('校队页面走简洁模式：列表只留状态与按钮，细节放进悬浮提示', async () => {
    const wrapper = mount(App)
    const engine = gameEngine()
    engine.debugUncapStorage()
    engine.debugAddAll(500000)
    engine.debugUnlockAll()
    // 造出「可以组建」的场景：球技社 + 操场 Lv.2（足球队的前置）
    engine.state.buildings.playground.level = 2
    expect(engine.upgradeClub('ballGame')).toBe(true)
    engine.setTab('teams')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('校队')
    // 还没成立队伍时：可以组建 → 暂时不能成立
    let text = wrapper.text()
    const availableAt = text.indexOf('可以组建（')
    const lockedAt = text.indexOf('暂时不能成立（')
    expect(availableAt).toBeGreaterThanOrEqual(0)
    expect(lockedAt).toBeGreaterThan(availableAt)
    expect(text).not.toContain('已成立（')

    // 每支队伍：图标 + 完整队名 + 项目标签 + 最多两个按钮 + 一行状态
    const cards = wrapper.findAll('.info-card')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards.slice(0, 6)) {
      const buttons = card.findAll('button')
      expect(buttons.length).toBeLessThanOrEqual(2)
      expect(card.find('.ic-name').exists()).toBe(true)
      expect(card.find('.team-status').exists()).toBe(true)
      expect(card.find('.ic-name').text().length).toBeGreaterThan(2)
    }

    // 成立一支队伍后，它会排到最上面的「已成立」组
    expect(engine.foundTeam('football', '测试疾风队')).toBe(true)
    await wrapper.vm.$nextTick()
    text = wrapper.text()
    expect(text).toContain('已成立（1）')
    expect(text).toContain('测试疾风队')
    const foundedIdx = text.indexOf('已成立（1）')
    const stillAvailable = text.indexOf('可以组建（')
    const stillLocked = text.indexOf('暂时不能成立（')
    expect(foundedIdx).toBeLessThan(stillLocked)
    if (stillAvailable >= 0) expect(foundedIdx).toBeLessThan(stillAvailable)

    // 界面大小可以在【选项】里调
    engine.setTab('options')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('界面大小')
    expect(wrapper.text()).toContain('175%')
    wrapper.unmount()
  })

  it('手机 / 窄屏会自动切到移动版：不套用桌面缩放、单栏布局、标记 data-mobile', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    const wrapper = mount(App)
    const engine = gameEngine()
    // 桌面端玩家可能把倍率设成 175%，手机上不应该跟着放大
    engine.state.settings.uiScale = 1.75
    window.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()

    const app = wrapper.find('.app')
    expect(app.attributes('data-mobile')).toBe('1')
    expect(app.attributes('data-narrow')).toBe('1')
    expect(app.attributes('data-tight')).toBe('1')
    expect(String(app.attributes('style'))).toContain('--ui-scale: 1')
    // 悬浮提示在移动端靠 body 上的 mobile-ui 类适配（Teleport 到 body）
    expect(document.body.classList.contains('mobile-ui')).toBe(true)

    wrapper.unmount()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  })
})
