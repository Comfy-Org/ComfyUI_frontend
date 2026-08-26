import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl } from '@/scripts/domWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { useMarkdownWidget } from './useMarkdownWidget'

describe('useMarkdownWidget', () => {
  it('creates an ECS-backed markdown component', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Test')
    graph.add(node)
    const inputSpec: InputSpec = {
      type: 'MARKDOWN',
      name: 'note',
      default: '# Initial'
    }

    const widget = useMarkdownWidget()(
      node,
      inputSpec
    ) as ComponentWidgetImpl<string>

    expect(widget).toBeInstanceOf(ComponentWidgetImpl)
    expect(widget.type).toBe('MARKDOWN')
    expect(widget.value).toBe('# Initial')

    widget.value = '# Edited'

    expect(
      useWidgetValueStore().getWidget(
        widgetId(graph.rootGraph.id, node.id, 'note')
      )?.value
    ).toBe('# Edited')
  })
})
