import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useDomSlotRegistration } from '@/renderer/core/layout/slots/useDomSlotRegistration'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

// Mock composable used by InputSlot/OutputSlot so we can assert call params
vi.mock('@/renderer/core/layout/slots/useDomSlotRegistration', () => ({
  useDomSlotRegistration: vi.fn(() => ({ remeasure: vi.fn() }))
}))

type InputSlotProps = ComponentMountingOptions<typeof InputSlot>['props']
type OutputSlotProps = ComponentMountingOptions<typeof OutputSlot>['props']

const mountInputSlot = (props: InputSlotProps) =>
  mount(InputSlot, {
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

const mountOutputSlot = (props: OutputSlotProps) =>
  mount(OutputSlot, {
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
  beforeEach(() => {
    vi.mocked(useDomSlotRegistration).mockClear()
  })

  it('InputSlot registers with correct options', () => {

    mountInputSlot({
      nodeId: 'node-1',
      index: 3,
      slotData: { name: 'A', type: 'any', boundingRect: [0, 0, 0, 0] }
    })

    expect(useDomSlotRegistration).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodeId: 'node-1',
        slotIndex: 3,
        isInput: true
      })
    )
  })

  it('OutputSlot registers with correct options', () => {

    mountOutputSlot({
      nodeId: 'node-2',
      index: 1,
      slotData: { name: 'B', type: 'any', boundingRect: [0, 0, 0, 0] }
    })

    expect(useDomSlotRegistration).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodeId: 'node-2',
        slotIndex: 1,
        isInput: false
      })
    )
  })
})
