import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { INodeSlot } from '@comfyorg/litegraph/litegraph'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import { useSettingStore } from '@/platform/settings/settingStore'

import OutputSlot from './OutputSlot.vue'
import SharedNodeTooltip from './SharedNodeTooltip.vue'

vi.mock(import('@/composables/useErrorHandling'))

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useSlotLinkReveal'),
  () => ({
    useSlotLinkReveal: () => ({ revealLinks: vi.fn(), unrevealLinks: vi.fn() })
  })
)

vi.mock<unknown>(
  import('@/renderer/core/canvas/links/slotLinkDragUIState'),
  () => ({
    useSlotLinkDragUIState: () => ({
      state: { active: false, compatible: new Map() }
    })
  })
)

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'),
  () => ({
    useSlotLinkInteraction: () => ({ onPointerDown: vi.fn() })
  })
)

vi.mock<unknown>(import('@/renderer/core/layout/slots/slotIdentifier'), () => ({
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

function renderOutputSlot(slotData: Partial<INodeSlot>, index = 0) {
  return render(OutputSlot, {
    props: {
      slotData: { type: '*', ...slotData } as INodeSlot,
      index,
      nodeId: toNodeId('test-node')
    },
    global: {
      plugins: [i18n],
      stubs: { SlotConnectionDot: SlotConnectionDotStub }
    }
  })
}

describe('OutputSlot', () => {
  it('shows the output description to the right on hover', async () => {
    useSettingStore().settingValues['Comfy.EnableTooltips'] = true
    const user = userEvent.setup()
    render(
      () =>
        h(TooltipProvider, { delayDuration: 0 }, () => [
          h(OutputSlot, {
            slotData: {
              name: 'samples',
              type: 'LATENT',
              boundingRect: [0, 0, 0, 0]
            },
            index: 0,
            nodeId: toNodeId('test-node')
          }),
          h(SharedNodeTooltip)
        ]),
      {
        global: {
          plugins: [i18n],
          stubs: { SlotConnectionDot: SlotConnectionDotStub }
        }
      }
    )

    await user.hover(screen.getByText('samples'))

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Output: samples'
    )
    expect(screen.getByTestId('tooltip-content')).toHaveAttribute(
      'data-side',
      'right'
    )
  })

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

  it('renders label when the name is empty', () => {
    renderOutputSlot({ name: '', label: 'BOOLEAN' })

    expect(screen.getByText('BOOLEAN')).toBeInTheDocument()
  })

  it('falls back to "Output N" when all names are absent', () => {
    renderOutputSlot({ name: undefined }, 2)

    expect(screen.getByText('Output 2')).toBeInTheDocument()
  })
})
