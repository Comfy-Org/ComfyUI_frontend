import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { DOMWidgetImpl } from '@/scripts/domWidget'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

describe('DOMWidgetImpl store integration', () => {
  let graph: LGraph
  let node: LGraphNode
  let store: ReturnType<typeof useWidgetValueStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useWidgetValueStore()
    graph = new LGraph()
    node = new LGraphNode('TestNode')
    node.id = 1
    graph.add(node)
  })

  it('registers DOM-resolved value in store via setNodeId', () => {
    const defaultValue = 'You are an expert image-generation engine.'
    const element = document.createElement('textarea')
    element.value = defaultValue

    const widget = new DOMWidgetImpl({
      node,
      name: 'system_prompt',
      type: 'customtext',
      element,
      options: {
        getValue: () => element.value as string,
        setValue: (v: string) => {
          element.value = v
          const state = store.getWidget(graph.id, node.id, 'system_prompt')
          if (state) state.value = v
        }
      }
    })

    widget.setNodeId(node.id)

    const state = store.getWidget(graph.id, node.id, 'system_prompt')
    expect(state?.value).toBe(defaultValue)
  })
})
