import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import LGraphNodePreview from '@/renderer/extensions/vueNodes/components/LGraphNodePreview.vue'
import { fromPartial } from '@total-typescript/shoehorn'

vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => ({ inputIsWidget: () => true })
}))

// Serializes the nodeData prop so tests can assert on the data contract
// LGraphNodePreview hands to NodeWidgets. How that data renders is covered
// by NodeWidgets.test.ts and browser_tests/tests/sidebar/modelLibrary.spec.ts.
const NodeWidgetsProbe = {
  props: ['nodeData'],
  template: '<div data-testid="node-data">{{ JSON.stringify(nodeData) }}</div>'
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
      stubs: {
        NodeHeader: true,
        NodeSlots: true,
        NodeWidgets: NodeWidgetsProbe
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
  it('keeps only the provided combo value for the preview', () => {
    const widget = renderedComboWidget({
      widgetValues: { ckpt_name: 'sd_xl_base_1.0.safetensors' }
    })

    expect(widget?.options?.values).toEqual(['sd_xl_base_1.0.safetensors'])
  })

  it('keeps only the first combo value when no value is provided', () => {
    const widget = renderedComboWidget()

    expect(widget?.options?.values).toEqual(['a.safetensors'])
  })

  it('does not retain a large combo option list in the preview', () => {
    const options = Array.from(
      { length: 10_000 },
      (_, index) => `input/image-${index}.png`
    )
    const widget = renderedWidgets(
      fromPartial<ComfyNodeDefV2>({
        name: 'LoadImage',
        inputs: { image: { type: 'COMBO', options } },
        outputs: []
      })
    ).find((item) => item.name === 'image')

    expect(widget?.options?.values).toEqual([options[0]])
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
