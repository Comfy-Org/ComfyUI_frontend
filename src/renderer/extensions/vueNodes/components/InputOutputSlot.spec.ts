import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useDomSlotRegistration } from '@/renderer/core/layout/slots/useDomSlotRegistration'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

// Mock composable used by InputSlot/OutputSlot so we can assert call params
vi.mock('@/renderer/core/layout/slots/useDomSlotRegistration', () => ({
  useDomSlotRegistration: vi.fn(() => ({ remeasure: vi.fn() }))
}))

interface TestSlotProps {
  nodeId: string
  index: number  
  slotData: INodeSlot
  connected?: boolean
  compatible?: boolean
  readonly?: boolean
  dotOnly?: boolean
}

const mountInputSlot = (props: TestSlotProps) =>
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

const mountOutputSlot = (props: TestSlotProps) =>
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
  it('InputSlot registers with correct options', () => {
    vi.mocked(useDomSlotRegistration).mockClear()

    mountInputSlot({
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

    mountOutputSlot({
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
