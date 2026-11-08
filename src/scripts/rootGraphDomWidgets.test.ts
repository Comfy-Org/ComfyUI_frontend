import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas, Subgraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  ComfyWorkflow,
  useWorkflowStore
} from '@/platform/workflow/management/stores/workflowStore'
import { ComfyApp } from '@/scripts/app'
import {
  registerDomWidgets,
  unregisterDomWidgets
} from '@/scripts/rootGraphDomWidgets'
import { useDomWidgetStore } from '@/stores/domWidgetStore'

describe('root graph DOM widget registration', () => {
  function domWidgetOn(graph: LGraph | Subgraph) {
    const node = new LGraphNode('test-node')
    graph.add(node)
    return node.addDOMWidget('text', 'custom', document.createElement('div'))
  }

  function registeredIds() {
    return [...useDomWidgetStore().widgetStates.keys()].sort()
  }

  it('swaps the widgets of a whole graph tree when the root graph changes', () => {
    const shown = new LGraph()
    const shownWidget = domWidgetOn(shown)
    const subgraph = createTestSubgraph({ rootGraph: shown })
    shown.add(createTestSubgraphNode(subgraph))
    const nestedWidget = domWidgetOn(subgraph)
    const hidden = new LGraph()
    const hiddenWidget = domWidgetOn(hidden)
    const shownIds = [shownWidget.id, nestedWidget.id].sort()

    unregisterDomWidgets(shown)
    expect(registeredIds()).toEqual([hiddenWidget.id])

    unregisterDomWidgets(hidden)
    registerDomWidgets(shown)
    expect(registeredIds()).toEqual(shownIds)
  })

  it('registers only the DOM widgets of the root graph on screen across a tab round trip', () => {
    function ownedGraphWithDomWidget(path: string) {
      const graph = new LGraph()
      const widget = domWidgetOn(graph)
      const owner = new ComfyWorkflow({ path, modified: 0, size: 0 })
      owner.adoptGraph(graph)
      useWorkflowStore().attachWorkflow(owner)
      return { graph, widgetId: widget.id }
    }
    const app = new ComfyApp()
    app.canvas = fromPartial<LGraphCanvas>({ setGraph: vi.fn() })
    const store = useDomWidgetStore()
    const first = ownedGraphWithDomWidget('workflows/first.json')
    const second = ownedGraphWithDomWidget('workflows/second.json')
    store.unregisterWidget(second.widgetId)
    Reflect.set(app, 'rootGraphInternal', first.graph)

    app.activateRootGraph(second.graph)
    expect([...store.widgetStates.keys()]).toEqual([second.widgetId])

    app.activateRootGraph(first.graph)
    expect([...store.widgetStates.keys()]).toEqual([first.widgetId])
  })
})
