import { mount } from '@vue/test-utils'
import type { ComponentProps } from 'vue-component-type-helpers'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import NotificationPopup from './NotificationPopup.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { close: 'Close' } }
  }
})

function mountPopup(
  props: ComponentProps<typeof NotificationPopup> = {
    title: 'Test'
  },
  slots: Record<string, string> = {}
) {
  return mount(NotificationPopup, {
    global: { plugins: [i18n] },
    props,
    slots
  })
}

describe('NotificationPopup', () => {
  it('renders title', () => {
    const wrapper = mountPopup({ title: 'Hello World' })
    expect(wrapper.text()).toContain('Hello World')
  })

  it('has role="status" for accessibility', () => {
    const wrapper = mountPopup()
    expect(wrapper.find('[role="status"]').exists()).toBe(true)
  })

  it('renders subtitle when provided', () => {
    const wrapper = mountPopup({ title: 'T', subtitle: 'v1.2.3' })
    expect(wrapper.text()).toContain('v1.2.3')
  })

  it('renders icon when provided', () => {
    const wrapper = mountPopup({
      title: 'T',
      icon: 'icon-[lucide--rocket]'
    })
    expect(wrapper.find('i.icon-\\[lucide--rocket\\]').exists()).toBe(true)
  })

  it('emits close when close button clicked', async () => {
    const wrapper = mountPopup({ title: 'T', showClose: true })
    await wrapper.find('[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('renders default slot content', () => {
    const wrapper = mountPopup({ title: 'T' }, { default: 'Body text here' })
    expect(wrapper.text()).toContain('Body text here')
  })

  it('renders footer slots', () => {
    const wrapper = mountPopup(
      { title: 'T' },
      { 'footer-start': 'Left side', 'footer-end': 'Right side' }
    )
    expect(wrapper.text()).toContain('Left side')
    expect(wrapper.text()).toContain('Right side')
  })

  it('positions bottom-right when specified', () => {
    const wrapper = mountPopup({ title: 'T', position: 'bottom-right' })
    const root = wrapper.find('[role="status"]')
    expect(root.classes()).toContain('right-4')
    expect(root.classes()).toContain('bottom-4')
  })
})
