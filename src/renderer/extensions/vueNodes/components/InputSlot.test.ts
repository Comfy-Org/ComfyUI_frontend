import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { DirectiveBinding } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import type { INodeSlot } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import InputSlot from './InputSlot.vue'

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ toastErrorHandler: vi.fn() })
}))

vi.mock('@/renderer/core/canvas/links/slotLinkDragUIState', () => ({
  useSlotLinkDragUIState: () => ({
    state: { active: false, compatible: new Map() }
  })
}))

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

function renderInputSlot(slotData: INodeSlot, nodeType = nodeDef.name) {
  const pinia = createTestingPinia({ stubActions: false })
  const settingStore = useSettingStore(pinia)
  vi.spyOn(settingStore, 'get').mockImplementation(
    <K extends keyof Settings>(key: K): Settings[K] => {
      if (key === 'Comfy.EnableTooltips') return true as Settings[K]
      if (key === 'LiteGraph.Node.TooltipDelay') return 500 as Settings[K]
      return undefined as Settings[K]
    }
  )
  useNodeDefStore(pinia).addNodeDef(nodeDef)
  const tooltipDirective = {
    mounted: vi.fn((_element: Element, _binding: DirectiveBinding) => {})
  }

  render(InputSlot, {
    props: { slotData, index: 0, nodeType },
    global: {
      plugins: [i18n, pinia],
      directives: { tooltip: tooltipDirective },
      stubs: { SlotConnectionDot: SlotConnectionDotStub }
    }
  })

  return tooltipDirective
}

describe('InputSlot', () => {
  it('resolves metadata tooltips by raw input name', () => {
    const tooltipDirective = renderInputSlot({
      name: 'raw_seed',
      localized_name: 'Localized Seed',
      type: 'INT'
    } as INodeSlot)

    expect(screen.getByText('Localized Seed')).toBeInTheDocument()
    expect(tooltipDirective.mounted.mock.calls[0]?.[1].value).toEqual(
      expect.objectContaining({ value: 'Metadata seed tooltip' })
    )
  })

  it('uses the localized display name in the translated fallback', () => {
    const tooltipDirective = renderInputSlot(
      {
        name: 'raw_count',
        localized_name: 'Localized Count',
        type: 'INT'
      } as INodeSlot,
      'UnknownNode'
    )

    expect(tooltipDirective.mounted.mock.calls[0]?.[1].value).toEqual(
      expect.objectContaining({
        value: 'Translated input: Localized Count'
      })
    )
  })
})
