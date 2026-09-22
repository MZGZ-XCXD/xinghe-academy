// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GameIcon from '../src/components/GameIcon.vue'
import { CLUB_DEFS, COURSE_DEFS } from '../src/data'

describe('图标渲染', () => {
  it('emoji 与普通文字按文本渲染', () => {
    const emoji = mount(GameIcon, { props: { value: '🍵', size: 20 } })
    expect(emoji.find('img').exists()).toBe(false)
    expect(emoji.text()).toContain('🍵')
    expect(emoji.find('.game-icon').attributes('style')).toContain('font-size: 20px')

    const text = mount(GameIcon, { props: { value: '茶' } })
    expect(text.find('img').exists()).toBe(false)
    expect(text.text()).toContain('茶')
  })

  it('图片路径 / data URI / http 会渲染成 img', () => {
    const cases = ['./icons/tea.png', 'icons/tea.svg', '../icons/tea.webp', 'data:image/png;base64,AAAA', 'https://example.com/a.png']
    for (const value of cases) {
      const wrapper = mount(GameIcon, { props: { value, size: 18 } })
      const img = wrapper.find('img')
      expect(img.exists(), `${value} 应该渲染成 img`).toBe(true)
      expect(img.attributes('src')).toBe(value)
      expect(img.attributes('style')).toContain('width: 18px')
    }
  })

  it('图片加载失败时退回占位符，不会破坏布局', async () => {
    const wrapper = mount(GameIcon, { props: { value: './icons/missing.png' } })
    expect(wrapper.find('img').exists()).toBe(true)
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('❔')
  })

  it('切换 icon 时会重试加载图片', async () => {
    const wrapper = mount(GameIcon, { props: { value: './icons/missing.png' } })
    await wrapper.find('img').trigger('error')
    expect(wrapper.text()).toContain('❔')
    await wrapper.setProps({ value: './icons/tea.png' })
    expect(wrapper.find('img').exists()).toBe(true)
  })

  it('没有 icon 时显示占位符', () => {
    const wrapper = mount(GameIcon, { props: {} })
    expect(wrapper.text()).toContain('❔')
  })

  it('内置内容里的 icon 都是可直接渲染的字符串', () => {
    for (const def of [...COURSE_DEFS, ...CLUB_DEFS]) {
      expect(typeof def.icon).toBe('string')
      expect(def.icon.length).toBeGreaterThan(0)
      const wrapper = mount(GameIcon, { props: { value: def.icon } })
      expect(wrapper.text().length + (wrapper.find('img').exists() ? 1 : 0)).toBeGreaterThan(0)
    }
  })
})
