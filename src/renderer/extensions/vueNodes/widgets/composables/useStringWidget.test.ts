import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl } from '@/scripts/domWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { useStringWidget } from './useStringWidget'

describe('useStringWidget', () => {
  it('creates an ECS-backed component for multiline input', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test')
    graph.add(node)
    const inputSpec: InputSpec = {
      type: 'STRING',
      name: 'prompt',
      default: 'initial',
      multiline: true,
      placeholder: 'Describe the image'
    }

    const widget = useStringWidget()(
      node,
      inputSpec
    ) as ComponentWidgetImpl<string>

    expect(widget).toBeInstanceOf(ComponentWidgetImpl)
    expect(widget.type).toBe('customtext')
    expect(widget.props).toEqual({ placeholder: 'Describe the image' })
    expect(widget.value).toBe('initial')

    widget.value = 'edited'

    expect(
      useWidgetValueStore().getWidget(
        widgetId(graph.rootGraph.id, node.id, 'prompt')
      )?.value
    ).toBe('edited')
  })
})
