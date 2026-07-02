import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'
import { fromPartial } from '@total-typescript/shoehorn'

vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => ({ inputIsWidget: () => true })
}))

const WidgetGridProbe = {
  props: ['processedWidgets'],
  setup(props: { processedWidgets?: WidgetGridItem[] }) {
    const widgets = computed(() =>
      (props.processedWidgets ?? []).map((widget) => ({
        name: widget.simplified.name,
        value: widget.simplified.value,
        options: { values: widget.simplified.options?.values }
      }))
    )
    return { widgets }
  },
  template:
    '<div data-testid="node-data">{{ JSON.stringify({ widgets }) }}</div>'
}

interface ProbedWidget {
  name: string
  value?: unknown
  options?: { values?: string[] }
}

const nodeDef = fromPartial<ComfyNodeDefV2>({
  name: 'CheckpointLoaderSimple',
  display_name: 'Load Checkpoint',
  inputs: {
    ckpt_name: { type: 'COMBO', options: ['a.safetensors', 'b.safetensors'] }
  },
  outputs: []
})

function renderedWidgets(
  def: ComfyNodeDefV2,
  props: { widgetValues?: Record<string, string> } = {}
) {
  render(LGraphNodePreview, {
    props: { nodeDef: def, ...props },
    global: {
      plugins: [createTestingPinia({ stubActions: false })],
      stubs: {
        NodeHeader: true,
        NodeSlots: true,
        WidgetGrid: WidgetGridProbe
      }
    }
  })
  const nodeData: { widgets?: ProbedWidget[] } = JSON.parse(
    screen.getByTestId('node-data').textContent ?? ''
  )
  return nodeData.widgets ?? []
}

function renderedComboWidget(
  props: { widgetValues?: Record<string, string> } = {}
) {
  return renderedWidgets(nodeDef, props).find((w) => w.name === 'ckpt_name')
}

describe('LGraphNodePreview', () => {
  it('leads the combo options with the provided widget value', () => {
    const widget = renderedComboWidget({
      widgetValues: { ckpt_name: 'sd_xl_base_1.0.safetensors' }
    })

    expect(widget?.options?.values).toEqual([
      'sd_xl_base_1.0.safetensors',
      'a.safetensors',
      'b.safetensors'
    ])
  })

  it('keeps the combo options untouched when no value is provided', () => {
    const widget = renderedComboWidget()

    expect(widget?.options?.values).toEqual(['a.safetensors', 'b.safetensors'])
  })

  it('leads with an explicitly empty provided value', () => {
    const widget = renderedComboWidget({ widgetValues: { ckpt_name: '' } })

    expect(widget?.value).toBe('')
    expect(widget?.options?.values).toEqual([
      '',
      'a.safetensors',
      'b.safetensors'
    ])
  })

  it('uses the input default when defined and empty string otherwise', () => {
    const widgets = renderedWidgets(
      fromPartial<ComfyNodeDefV2>({
        name: 'TestNode',
        inputs: {
          steps: { type: 'INT', default: 20 },
          text: { type: 'STRING' }
        },
        outputs: []
      })
    )

    expect(widgets.find((w) => w.name === 'steps')?.value).toBe(20)
    expect(widgets.find((w) => w.name === 'text')?.value).toBe('')
  })
})
