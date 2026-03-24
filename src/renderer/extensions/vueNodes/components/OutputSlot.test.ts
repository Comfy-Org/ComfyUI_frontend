import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

import OutputSlot from './OutputSlot.vue'

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
    getOutputSlotTooltip: () => '',
    createTooltipConfig: (text: string) => ({ value: text })
  })
}))

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotElementTracking',
  () => ({ useSlotElementTracking: vi.fn() })
)

vi.mock(
  '@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction',
  () => ({
    useSlotLinkInteraction: () => ({ onPointerDown: vi.fn() })
  })
)

vi.mock('@/renderer/core/layout/slots/slotIdentifier', () => ({
  getSlotKey: () => 'mock-key'
}))

const SlotConnectionDotStub = defineComponent({
  name: 'SlotConnectionDot',
  template: '<div class="stub-dot" />'
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function mountOutputSlot(slotData: Partial<INodeSlot>, index = 0) {
  return mount(OutputSlot, {
    props: {
      slotData: { type: '*', ...slotData } as INodeSlot,
      index,
      nodeId: 'test-node'
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: { SlotConnectionDot: SlotConnectionDotStub }
    }
  })
}

describe('OutputSlot', () => {
  it('renders label when present on slotData', () => {
    const wrapper = mountOutputSlot({
      name: 'internal_name',
      localized_name: 'Localized Name',
      label: 'My Custom Label'
    })

    expect(wrapper.text()).toContain('My Custom Label')
    expect(wrapper.text()).not.toContain('internal_name')
    expect(wrapper.text()).not.toContain('Localized Name')
  })

  it('falls back to localized_name when label is absent', () => {
    const wrapper = mountOutputSlot({
      name: 'internal_name',
      localized_name: 'Localized Name'
    })

    expect(wrapper.text()).toContain('Localized Name')
  })

  it('falls back to name when label and localized_name are absent', () => {
    const wrapper = mountOutputSlot({ name: 'internal_name' })

    expect(wrapper.text()).toContain('internal_name')
  })

  it('falls back to "Output N" when all names are absent', () => {
    const wrapper = mountOutputSlot({ name: undefined }, 2)

    expect(wrapper.text()).toContain('Output 2')
  })
})
