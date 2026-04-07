import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

const TEST_CUSTOM_COMBO_TYPE = 'test/CustomComboCopyPaste'

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

describe('CustomCombo copy/paste', () => {
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

  it('preserves combo options and selected value through clone and paste', () => {
    const graph = new LGraph()
    const appWithRootGraph = app as typeof app & { rootGraphInternal?: LGraph }
    const previousRootGraph = appWithRootGraph.rootGraphInternal
    appWithRootGraph.rootGraphInternal = graph

    try {
      const original = LiteGraph.createNode(TEST_CUSTOM_COMBO_TYPE)!
      graph.add(original)

      findWidget(original, 'option1')!.value = 'alpha'
      findWidget(original, 'option2')!.value = 'beta'
      findWidget(original, 'option3')!.value = 'gamma'
      findWidget(original, 'value')!.value = 'beta'

      const clonedSerialised = original.clone()?.serialize()

      expect(clonedSerialised).toBeDefined()

      const pasted = LiteGraph.createNode(TEST_CUSTOM_COMBO_TYPE)!
      pasted.configure(clonedSerialised!)
      graph.add(pasted)

      expect(findWidget(pasted, 'value')!.value).toBe('beta')
      expect(findWidget(pasted, 'option1')!.value).toBe('alpha')
      expect(findWidget(pasted, 'option2')!.value).toBe('beta')
      expect(findWidget(pasted, 'option3')!.value).toBe('gamma')
      expect(findWidget(pasted, 'value')!.options.values).toEqual([
        'alpha',
        'beta',
        'gamma'
      ])
    } finally {
      appWithRootGraph.rootGraphInternal = previousRootGraph
    }
  })
})
