import { describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useChartWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useChartWidget'
import type {
  ChartInputSpec,
  InputSpec
} from '@/schemas/nodeDef/nodeDefSchemaV2'

function createMockNode(): {
  node: LGraphNode
  addWidget: ReturnType<typeof vi.spyOn>
} {
  const node = new LGraphNode('TestChartNode')
  const addWidget = vi
    .spyOn(node, 'addWidget')
    .mockImplementation((type, name, value, _callback, options) => {
      const widget = {
        type,
        name,
        value,
        options: typeof options === 'string' ? { property: options } : options,
        y: 0
      } as IBaseWidget
      node.widgets ??= []
      node.widgets.push(widget)
      return widget
    })
  return { node, addWidget }
}

function createChartSpec(
  overrides: Partial<ChartInputSpec> = {}
): ChartInputSpec {
  return { type: 'CHART', name: 'chart', ...overrides }
}

describe('useChartWidget', () => {
  it('uses the declared chartType and data from the input spec', () => {
    const { node, addWidget } = createMockNode()
    const data = { series: [1, 2, 3] }

    const widget = useChartWidget()(
      node,
      createChartSpec({ chartType: 'bar', data })
    )

    expect(addWidget).toHaveBeenCalledWith(
      'chart',
      'chart',
      data,
      expect.any(Function),
      { serialize: true, type: 'bar' }
    )
    expect(widget.value).toBe(data)
  })

  it('defaults to a line chart with empty data', () => {
    const { node, addWidget } = createMockNode()

    const widget = useChartWidget()(node, createChartSpec())

    expect(addWidget).toHaveBeenCalledWith(
      'chart',
      'chart',
      {},
      expect.any(Function),
      { serialize: true, type: 'line' }
    )
    expect(widget.type).toBe('chart')
  })

  it('throws when the input spec is not a chart spec', () => {
    const { node } = createMockNode()
    const inputSpec = { type: 'STRING', name: 'chart' } as unknown as InputSpec

    expect(() => useChartWidget()(node, inputSpec)).toThrow(
      'Invalid input spec for chart widget'
    )
  })
})
