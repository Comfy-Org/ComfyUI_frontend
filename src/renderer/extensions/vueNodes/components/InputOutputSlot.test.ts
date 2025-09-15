import { type ComponentMountingOptions, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useSlotElementTracking } from '@/renderer/extensions/vueNodes/composables/useSlotElementTracking'

import InputSlot from './InputSlot.vue'
import OutputSlot from './OutputSlot.vue'

// Mock composable used by InputSlot/OutputSlot so we can assert call params
vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotElementTracking',
  () => ({
    useSlotElementTracking: vi.fn(() => ({ stop: vi.fn() }))
  })
)

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
    vi.mocked(useSlotElementTracking).mockClear()
  })

  it('InputSlot registers with correct options', () => {
    mountInputSlot({
      nodeId: 'node-1',
      index: 3,
      slotData: { name: 'A', type: 'any', boundingRect: [0, 0, 0, 0] }
    })

    expect(useSlotElementTracking).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodeId: 'node-1',
        index: 3,
        type: 'input'
      })
    )
  })

  it('OutputSlot registers with correct options', () => {
    mountOutputSlot({
      nodeId: 'node-2',
      index: 1,
      slotData: { name: 'B', type: 'any', boundingRect: [0, 0, 0, 0] }
    })

    expect(useSlotElementTracking).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodeId: 'node-2',
        index: 1,
        type: 'output'
      })
    )
  })
})
