import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'

import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import InputSlot from './InputSlot.vue'

vi.mock<unknown>(import('@/composables/useErrorHandling'), () => ({
  useErrorHandling: () => ({ toastErrorHandler: vi.fn() })
}))

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
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { inputTooltip: 'Translated input: {name}' } } }
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
    <K extends keyof Settings>(key: K): Settings[K] => {
      if (key === 'Comfy.EnableTooltips') return true as Settings[K]
      if (key === 'LiteGraph.Node.TooltipDelay') return 0 as Settings[K]
      return undefined as Settings[K]
    }
  )
  useNodeDefStore(pinia).addNodeDef(nodeDef)
  render(InputSlot, {
    props: { slotData, index: 0, nodeType, dotOnly, standalone },
    global: {
      plugins: [i18n, pinia],
      stubs: { SlotConnectionDot: SlotConnectionDotStub }
    }
  })

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

    expect(screen.getByLabelText('Localized Seed')).toBeInTheDocument()
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
      'Translated input: Localized Count'
    )
  })
})
