import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tag from 'primevue/tag'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import ManagerHeader from './ManagerHeader.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: enMessages
  }
})

describe('ManagerHeader', () => {
  const createWrapper = () => {
    return mount(ManagerHeader, {
      global: {
        plugins: [createPinia(), PrimeVue, i18n],
        directives: {
          tooltip: Tooltip
        },
        components: {
          Tag
        }
      }
    })
  }

  it('renders the component title', () => {
    const wrapper = createWrapper()

    expect(wrapper.find('h2').text()).toBe(
      enMessages.manager.discoverCommunityContent
    )
  })

  it('displays the legacy manager UI tag', () => {
    const wrapper = createWrapper()

    const tag = wrapper.find('[data-pc-name="tag"]')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toContain(enMessages.manager.legacyManagerUI)
  })

  it('applies info severity to the tag', () => {
    const wrapper = createWrapper()

    const tag = wrapper.find('[data-pc-name="tag"]')
    expect(tag.classes()).toContain('p-tag-info')
  })

  it('displays info icon in the tag', () => {
    const wrapper = createWrapper()

    const icon = wrapper.find('.pi-info-circle')
    expect(icon.exists()).toBe(true)
  })

  it('has cursor-help class on the tag', () => {
    const wrapper = createWrapper()

    const tag = wrapper.find('[data-pc-name="tag"]')
    expect(tag.classes()).toContain('cursor-help')
  })

  it('has proper structure with flex container', () => {
    const wrapper = createWrapper()

    const flexContainer = wrapper.find('.flex.justify-end.ml-auto.pr-4')
    expect(flexContainer.exists()).toBe(true)

    const tag = flexContainer.find('[data-pc-name="tag"]')
    expect(tag.exists()).toBe(true)
  })
})
