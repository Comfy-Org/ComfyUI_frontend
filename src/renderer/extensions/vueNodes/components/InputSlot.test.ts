import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import { i18n } from '@/i18n'
import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@comfyorg/settings-core/types'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'

import InputSlot from './InputSlot.vue'
import SharedNodeTooltip from './SharedNodeTooltip.vue'

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useSlotLinkReveal'),
  () => ({
    useSlotLinkReveal: () => ({ revealLinks: vi.fn(), unrevealLinks: vi.fn() })
  })
)

vi.mock(import('@/composables/useErrorHandling'))

vi.mock<unknown>(
  import('@/renderer/core/canvas/links/slotLinkDragUIState'),
  () => ({
    useSlotLinkDragUIState: () => ({
      state: { active: false, compatible: new Map() }
    })
  })
)

vi.mock(
  import('@/renderer/extensions/vueNodes/composables/useSlotLinkInteraction'),
  () => ({
    useSlotLinkInteraction: () => ({
      onClick: vi.fn(),
      onDoubleClick: vi.fn(),
      onPointerDown: vi.fn()
    })
  })
)

vi.mock<unknown>(import('@/renderer/core/layout/slots/slotIdentifier'), () => ({
  getSlotKey: () => 'mock-key'
}))

const SlotConnectionDotStub = defineComponent({
  name: 'SlotConnectionDot',
  template: '<div />'
})

const nodeDef: ComfyNodeDef = {
  name: 'TestInputSlot',
  display_name: 'Test Input Slot',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      raw_seed: ['INT', { tooltip: 'Metadata seed tooltip' }]
    }
  },
  output: [],
  output_node: false
}

function renderInputSlot(
  slotData: INodeSlot,
  nodeType = nodeDef.name,
  dotOnly = false,
  standalone = dotOnly
) {
  const pinia = getActivePinia()!
  const settingStore = useSettingStore(pinia)
  vi.spyOn(settingStore, 'get').mockImplementation(
    <K extends keyof Settings>(key: K): Settings[K] =>
      (key === 'Comfy.EnableTooltips' ? true : undefined) as Settings[K]
  )
  useNodeDefStore(pinia).addNodeDef(nodeDef)
  render(
    () =>
      h(TooltipProvider, { delayDuration: 0 }, () => [
        h(InputSlot, { slotData, index: 0, nodeType, dotOnly, standalone }),
        h(SharedNodeTooltip)
      ]),
    {
      global: {
        plugins: [i18n, pinia],
        stubs: { SlotConnectionDot: SlotConnectionDotStub }
      }
    }
  )

  return userEvent.setup()
}

describe('InputSlot', () => {
  it('exposes the slot name when rendering only the connection dot', () => {
    renderInputSlot(
      {
        name: 'raw_seed',
        localized_name: 'Localized Seed',
        type: 'INT'
      } as INodeSlot,
      nodeDef.name,
      true
    )

    expect(screen.getByLabelText('Localized Seed')).toHaveAttribute(
      'data-slot-type',
      'INT'
    )
  })

  it('leaves the dot unlabeled when a widget control renders alongside it', () => {
    renderInputSlot(
      {
        name: 'raw_seed',
        localized_name: 'Localized Seed',
        type: 'INT'
      } as INodeSlot,
      nodeDef.name,
      true,
      false
    )

    expect(screen.queryByLabelText('Localized Seed')).not.toBeInTheDocument()
  })

  it('resolves metadata tooltips by raw input name', async () => {
    const user = renderInputSlot({
      name: 'raw_seed',
      localized_name: 'Localized Seed',
      type: 'INT'
    } as INodeSlot)

    await user.hover(screen.getByText('Localized Seed'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Metadata seed tooltip'
    )
    expect(screen.getByTestId('tooltip-content')).toHaveAttribute(
      'data-side',
      'left'
    )
  })

  it('uses the localized display name in the translated fallback', async () => {
    const user = renderInputSlot(
      {
        name: 'raw_count',
        localized_name: 'Localized Count',
        type: 'INT'
      } as INodeSlot,
      'UnknownNode'
    )

    await user.hover(screen.getByText('Localized Count'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Input: Localized Count'
    )
  })

  it.for([
    { connected: true, fill: '#f00' },
    { connected: false, fill: '#0f0' }
  ])(
    'fills the dot with the slot color when connected is $connected, as the canvas does',
    ({ connected, fill }) => {
      render(InputSlot, {
        props: {
          slotData: {
            name: 'raw_seed',
            type: 'INT',
            color_on: '#f00',
            color_off: '#0f0',
            boundingRect: [0, 0, 0, 0]
          },
          index: 0,
          connected
        },
        global: { plugins: [i18n, getActivePinia()!] }
      })

      expect(screen.getByTestId('slot-dot')).toHaveStyle({
        backgroundColor: fill
      })
    }
  )
})
