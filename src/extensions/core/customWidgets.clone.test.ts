import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'

const extensions = await vi.hoisted(async () => {
  const { createExtensionCapture } =
    await import('@/utils/__tests__/extensionTestUtils')
  return createExtensionCapture()
})
vi.mock(import('@/scripts/app'), async (importOriginal) => {
  const original = await importOriginal()
  original.app.registerExtension = extensions.registerExtension
  return original
})
await import('./customWidgets')
const extension = extensions.getExtension('Comfy.CustomWidgets')
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

describe('CustomCombo copy/paste', () => {
  beforeAll(async () => {
    await extension.beforeRegisterNodeDef?.(
      TestCustomComboNode,
      { name: 'CustomCombo' } as ComfyNodeDef,
      app
    )
  })

  beforeEach(() => {
    LiteGraph.registerNodeType(TEST_CUSTOM_COMBO_TYPE, TestCustomComboNode)
  })

  it('preserves combo options and selected value through clone and paste', () => {
    const graph = new LGraph()
    type AppWithRootGraph = { rootGraphInternal?: LGraph }
    const appWithRootGraph = app as unknown as AppWithRootGraph
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
