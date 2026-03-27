import { createTestingPinia } from '@pinia/testing'
import { shallowMount } from '@vue/test-utils'
import { setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import OutputHistoryActiveQueueItem from './OutputHistoryActiveQueueItem.vue'

const i18n = createI18n({ legacy: false, locale: 'en' })
setActivePinia(createTestingPinia({ stubActions: false }))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

function mountComponent(queueCount: number) {
  return shallowMount(OutputHistoryActiveQueueItem, {
    props: { queueCount },
    global: { plugins: [i18n] }
  })
}

describe('OutputHistoryActiveQueueItem', () => {
  it('hides badge when queueCount is 1', () => {
    const wrapper = mountComponent(1)
    const badge = wrapper.find('[aria-hidden="true"]')
    expect(badge.exists()).toBe(false)
  })

  it('shows badge with correct count when queueCount is 3', () => {
    const wrapper = mountComponent(3)
    const badge = wrapper.find('[aria-hidden="true"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('3')
  })

  it('hides badge when queueCount is 0', () => {
    const wrapper = mountComponent(0)
    const badge = wrapper.find('[aria-hidden="true"]')
    expect(badge.exists()).toBe(false)
  })
})
