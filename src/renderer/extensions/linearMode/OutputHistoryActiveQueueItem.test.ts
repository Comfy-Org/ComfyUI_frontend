import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import OutputHistoryActiveQueueItem from './OutputHistoryActiveQueueItem.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: vi.fn()
  })
}))

function mountComponent(queueCount: number) {
  return shallowMount(OutputHistoryActiveQueueItem, {
    props: { queueCount }
  })
}

describe('OutputHistoryActiveQueueItem', () => {
  it('shows badge when queueCount is 1', () => {
    const wrapper = mountComponent(1)
    const badge = wrapper.find('[aria-hidden="true"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('1')
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
