import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import type { INodeSlot } from '@/lib/litegraph/src/litegraph'

import InputSlot from './InputSlot.vue'

const getInputSlotTooltip = vi.hoisted(() => vi.fn(() => ''))
const createTooltipConfig = vi.hoisted(() =>
  vi.fn((text: string) => ({ value: text }))
)

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ toastErrorHandler: vi.fn() })
}))

vi.mock('@/renderer/core/canvas/links/slotLinkDragUIState', () => ({
  useSlotLinkDragUIState: () => ({
    state: { active: false, compatible: new Map() }
  })
}))

vi.mock('@/renderer/extensions/vueNodes/composables/useNodeTooltips', () => ({
  useNodeTooltips: () => ({
    getInputSlotTooltip,
    createTooltipConfig
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotElementTracking',
  () => ({ useSlotElementTracking: vi.fn() })
)

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction',
  () => ({
    useSlotLinkInteraction: () => ({
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onPointerDown: vi.fn()
    })
  })
)

vi.mock('@/renderer/core/layout/slots/slotIdentifier', () => ({
  getSlotKey: () => 'mock-key'
}))

const SlotConnectionDotStub = defineComponent({
  name: 'SlotConnectionDot',
  template: '<div />'
})
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { inputTooltip: 'Translated input: {name}' } } }
})

describe('InputSlot', () => {
  it('uses the raw input name to resolve the tooltip', () => {
    render(InputSlot, {
      props: {
        slotData: {
          name: 'seed',
          localized_name: 'Localized Seed',
          type: 'INT'
        } as INodeSlot,
        index: 0,
        nodeType: 'KSampler'
      },
      global: {
        plugins: [i18n],
        directives: { tooltip: {} },
        stubs: { SlotConnectionDot: SlotConnectionDotStub }
      }
    })

    expect(screen.getByText('Localized Seed')).toBeInTheDocument()
    expect(getInputSlotTooltip).toHaveBeenCalledWith('seed')
    expect(createTooltipConfig).toHaveBeenCalledWith(
      'Translated input: Localized Seed'
    )
  })
})
