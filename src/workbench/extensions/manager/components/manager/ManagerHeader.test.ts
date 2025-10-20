import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
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
        plugins: [createPinia(), PrimeVue, i18n]
      }
    })
  }

  it('renders the component title', () => {
    const wrapper = createWrapper()

    expect(wrapper.find('h2').text()).toBe(
      enMessages.manager.discoverCommunityContent
    )
  })

  it('has proper structure with flex container', () => {
    const wrapper = createWrapper()

    const flexContainer = wrapper.find('.flex.items-center')
    expect(flexContainer.exists()).toBe(true)

    const title = flexContainer.find('h2')
    expect(title.exists()).toBe(true)
  })
})
