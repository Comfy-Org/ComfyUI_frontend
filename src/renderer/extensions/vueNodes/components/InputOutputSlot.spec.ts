import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useDomSlotRegistration } from '@/renderer/core/layout/slots/useDomSlotRegistration'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

// Mock composable used by InputSlot/OutputSlot so we can assert call params
vi.mock('@/renderer/core/layout/slots/useDomSlotRegistration', () => ({
  useDomSlotRegistration: vi.fn(() => ({ remeasure: vi.fn() }))
}))

const mountWithProviders = (component: any, props: Record<string, unknown>) =>
  mount(component, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        }),
        createPinia()
      ]
    },
    props
  })

describe('InputSlot/OutputSlot', () => {
  it('InputSlot registers with correct options', () => {
    vi.mocked(useDomSlotRegistration).mockClear()

    mountWithProviders(InputSlot, {
      nodeId: 'node-1',
      index: 3,
      slotData: { name: 'A', type: 'any', boundingRect: [0, 0, 0, 0] }
    })

    const call = vi.mocked(useDomSlotRegistration).mock.calls.at(-1)![0]
    expect(call).toMatchObject({
      nodeId: 'node-1',
      slotIndex: 3,
      isInput: true
    })
  })

  it('OutputSlot registers with correct options', () => {
    vi.mocked(useDomSlotRegistration).mockClear()

    mountWithProviders(OutputSlot, {
      nodeId: 'node-2',
      index: 1,
      slotData: { name: 'B', type: 'any', boundingRect: [0, 0, 0, 0] }
    })

    const call = vi.mocked(useDomSlotRegistration).mock.calls.at(-1)![0]
    expect(call).toMatchObject({
      nodeId: 'node-2',
      slotIndex: 1,
      isInput: false
    })
  })
})
