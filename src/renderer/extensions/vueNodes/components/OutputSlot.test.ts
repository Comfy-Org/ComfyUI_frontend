import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

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
    tooltipsEnabled: computed(() => false),
    tooltipDelay: computed(() => 0)
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

const BaseTooltipStub = defineComponent({
  name: 'BaseTooltip',
  template: '<slot />'
})

function renderOutputSlot(slotData: Partial<INodeSlot>, index = 0) {
  return render(OutputSlot, {
    props: {
      slotData: { type: '*', ...slotData } as INodeSlot,
      index,
      nodeId: 'test-node'
    },
    global: {
      plugins: [i18n],
      stubs: {
        SlotConnectionDot: SlotConnectionDotStub,
        BaseTooltip: BaseTooltipStub
      }
    }
  })
}

describe('OutputSlot', () => {
  it('renders label when present on slotData', () => {
    renderOutputSlot({
      name: 'internal_name',
      localized_name: 'Localized Name',
      label: 'My Custom Label'
    })

    expect(screen.getByText('My Custom Label')).toBeInTheDocument()
    expect(screen.queryByText('internal_name')).not.toBeInTheDocument()
    expect(screen.queryByText('Localized Name')).not.toBeInTheDocument()
  })

  it('falls back to localized_name when label is absent', () => {
    renderOutputSlot({
      name: 'internal_name',
      localized_name: 'Localized Name'
    })

    expect(screen.getByText('Localized Name')).toBeInTheDocument()
    expect(screen.queryByText('internal_name')).not.toBeInTheDocument()
  })

  it('falls back to name when label and localized_name are absent', () => {
    renderOutputSlot({ name: 'internal_name' })

    expect(screen.getByText('internal_name')).toBeInTheDocument()
  })

  it('falls back to "Output N" when all names are absent', () => {
    renderOutputSlot({ name: undefined }, 2)

    expect(screen.getByText('Output 2')).toBeInTheDocument()
  })
})
