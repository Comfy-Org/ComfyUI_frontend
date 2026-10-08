import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { ComfyExtension } from '@/types/comfy'
import { widgetId } from '@/types/widgetId'

const TEST_CUSTOM_COMBO_TYPE = 'test/CustomComboTrailingOption'

class TestCustomComboNode extends LGraphNode {
  static override title = 'CustomCombo'

  constructor() {
    super('CustomCombo')
    this.serialize_widgets = true
    this.addOutput('value', '*')
    this.addWidget('combo', 'value', '', () => {}, {
      values: [] as string[]
    })
  }
}

function findWidget(node: LGraphNode, name: string) {
  return node.widgets?.find((widget) => widget.name === name)
}

function getCustomWidgetsExtension(): ComfyExtension {
  const extension = useExtensionStore().extensions.find(
    (candidate) => candidate.name === 'Comfy.CustomWidgets'
  )

  if (!extension) {
    throw new Error('Comfy.CustomWidgets extension was not registered')
  }

  return extension
}

describe('CustomCombo trailing option removal', () => {
  beforeAll(async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    await import('./customWidgets')

    const extension = getCustomWidgetsExtension()
    await extension.beforeRegisterNodeDef?.(
      TestCustomComboNode,
      { name: 'CustomCombo' } as ComfyNodeDef,
      app
    )

    if (LiteGraph.registered_node_types[TEST_CUSTOM_COMBO_TYPE]) {
      LiteGraph.unregisterNodeType(TEST_CUSTOM_COMBO_TYPE)
    }
    LiteGraph.registerNodeType(TEST_CUSTOM_COMBO_TYPE, TestCustomComboNode)
  })

  afterAll(() => {
    if (LiteGraph.registered_node_types[TEST_CUSTOM_COMBO_TYPE]) {
      LiteGraph.unregisterNodeType(TEST_CUSTOM_COMBO_TYPE)
    }
  })

  it('deletes the popped trailing option widget state from WidgetValueStore', () => {
    const graph = new LGraph()
    type AppWithRootGraph = { rootGraphInternal?: LGraph }
    const appWithRootGraph = app as unknown as AppWithRootGraph
    const previousRootGraph = appWithRootGraph.rootGraphInternal
    appWithRootGraph.rootGraphInternal = graph

    try {
      const node = LiteGraph.createNode(TEST_CUSTOM_COMBO_TYPE)!
      graph.add(node)

      findWidget(node, 'option1')!.value = 'alpha'

      const store = useWidgetValueStore()
      const option2Id = widgetId(graph.id, node.id, 'option2')
      expect(findWidget(node, 'option2')).toBeDefined()
      expect(store.getWidget(option2Id)).toBeDefined()

      findWidget(node, 'option1')!.value = ''

      expect(findWidget(node, 'option2')).toBeUndefined()
      expect(store.getWidget(option2Id)).toBeUndefined()
      expect(store.getNodeWidgetIds(graph.id, node.id)).not.toContain(option2Id)
    } finally {
      appWithRootGraph.rootGraphInternal = previousRootGraph
    }
  })
})
