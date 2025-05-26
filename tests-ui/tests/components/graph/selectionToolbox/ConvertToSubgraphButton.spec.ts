import { mount } from '@vue/test-utils'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it, vi } from 'vitest'

import ConvertToSubgraphButton from '@/components/graph/selectionToolbox/ConvertToSubgraphButton.vue'

// Mock the command store
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: vi.fn(() => ({
    execute: vi.fn()
  }))
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: vi.fn((key) => key)
  }))
}))

describe('ConvertToSubgraphButton', () => {
  const mountComponent = () => {
    return mount(ConvertToSubgraphButton, {
      global: {
        plugins: [PrimeVue],
        directives: { tooltip: Tooltip },
        components: { Button }
      }
    })
  }

  it('renders correctly', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.find('.pi-box').exists()).toBe(true)
  })

  it('has the correct tooltip', () => {
    const wrapper = mountComponent()
    const buttonElement = wrapper.find('button')

    // Check that the tooltip directive is applied
    expect(buttonElement.attributes('data-pd-tooltip')).toBe('true')
  })
})
