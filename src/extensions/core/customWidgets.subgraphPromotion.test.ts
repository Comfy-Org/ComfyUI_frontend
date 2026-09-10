import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphToPrompt } from '@/utils/executionUtil'

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
// Regression coverage for https://github.com/Comfy-Org/ComfyUI/issues/15060
// (FE-1456): once a Custom Combo node's `choice` widget is promoted through
// a subgraph boundary (ADR-SUBGRAPH-PROMOTION-0009 link-only promotion), the hidden `index`
// widget must resolve the current *host* value, not the frozen interior
// widget value.
const TEST_CUSTOM_COMBO_TYPE = 'test/CustomComboSubgraphPromotion'
const TEST_CUSTOM_COMBO_UNCONVERTED_TYPE =
  'test/CustomComboUnconvertedSubgraphPromotion'

class TestCustomComboNode extends LGraphNode {
  static override title = 'CustomCombo'

  constructor() {
    super('CustomCombo')
    this.comfyClass = 'CustomCombo'
    this.serialize_widgets = true
    this.addOutput('STRING', 'STRING')
    this.addOutput('INDEX', 'INT')

    const input = this.addInput('choice', 'COMBO')
    this.addWidget('combo', 'choice', '', () => {}, {
      values: [] as string[]
    })
    input.widget = { name: 'choice' }
  }
}

// Unlike `TestCustomComboNode`, `choice` here has no backing input -- the
// widget-to-input conversion this extension relies on to resolve a
// promoted value never happened, matching a fresh, never-promoted node.
class TestCustomComboNodeWithoutInput extends LGraphNode {
  static override title = 'CustomCombo'

  constructor() {
    super('CustomCombo')
    this.comfyClass = 'CustomCombo'
    this.serialize_widgets = true
    this.addOutput('STRING', 'STRING')
    this.addOutput('INDEX', 'INT')

    this.addWidget('combo', 'choice', '', () => {}, {
      values: [] as string[]
    })
  }
}

function findWidget(node: LGraphNode, name: string) {
  return node.widgets?.find((widget) => widget.name === name)
}

describe('CustomCombo index widget after subgraph promotion', () => {
  beforeAll(async () => {
    await extension.beforeRegisterNodeDef?.(
      TestCustomComboNode,
      { name: 'CustomCombo' } as ComfyNodeDef,
      app
    )
    await extension.beforeRegisterNodeDef?.(
      TestCustomComboNodeWithoutInput,
      { name: 'CustomCombo' } as ComfyNodeDef,
      app
    )
  })

  beforeEach(() => {
    LiteGraph.registerNodeType(TEST_CUSTOM_COMBO_TYPE, TestCustomComboNode)
    LiteGraph.registerNodeType(
      TEST_CUSTOM_COMBO_UNCONVERTED_TYPE,
      TestCustomComboNodeWithoutInput
    )
    resetSubgraphFixtureState()
  })

  it('resolves INDEX from the promoted host choice, not the frozen interior value', async () => {
    const rootGraph = new LGraph()
    type AppWithRootGraph = { rootGraphInternal?: LGraph }
    const appWithRootGraph = app as unknown as AppWithRootGraph
    const previousRootGraph = appWithRootGraph.rootGraphInternal
    appWithRootGraph.rootGraphInternal = rootGraph

    try {
      const subgraph = createTestSubgraph({ rootGraph })
      const comboNode = LiteGraph.createNode(TEST_CUSTOM_COMBO_TYPE)!
      subgraph.add(comboNode)

      findWidget(comboNode, 'option1')!.value = 'one'
      findWidget(comboNode, 'option2')!.value = 'two'
      findWidget(comboNode, 'option3')!.value = 'three'
      findWidget(comboNode, 'option4')!.value = 'four'
      findWidget(comboNode, 'choice')!.value = 'one'

      const host = createTestSubgraphNode(subgraph)
      host.comfyClass = 'Subgraph'
      host.graph?.add(host)

      const choiceWidget = findWidget(comboNode, 'choice')!
      const result = promoteValueWidgetViaSubgraphInput(
        host,
        comboNode,
        choiceWidget
      )
      expect(result.ok).toBe(true)

      const hostInput = host.inputs.find(
        (input) => input._subgraphSlot?.name === 'choice'
      )
      if (!hostInput?.widgetId) throw new Error('Missing promoted host input')

      // Change the value via the promoted host widget only -- the
      // interior `choice` widget's own value is intentionally left
      // untouched, mirroring how a SubgraphNode's promoted widget is
      // edited from outside the subgraph.
      useWidgetValueStore().setValue(hostInput.widgetId, 'four')

      const { output } = await graphToPrompt(rootGraph)
      const promptInputs = output[`${host.id}:${comboNode.id}`].inputs

      // "four" is index 3 of ["one", "two", "three", "four"].
      expect(promptInputs.index).toBe(3)
    } finally {
      appWithRootGraph.rootGraphInternal = previousRootGraph
    }
  })

  it('resolves INDEX from the interior widget when choice was never promoted', async () => {
    const rootGraph = new LGraph()
    type AppWithRootGraph = { rootGraphInternal?: LGraph }
    const appWithRootGraph = app as unknown as AppWithRootGraph
    const previousRootGraph = appWithRootGraph.rootGraphInternal
    appWithRootGraph.rootGraphInternal = rootGraph

    try {
      const comboNode = LiteGraph.createNode(
        TEST_CUSTOM_COMBO_UNCONVERTED_TYPE
      )!
      rootGraph.add(comboNode)

      findWidget(comboNode, 'option1')!.value = 'one'
      findWidget(comboNode, 'option2')!.value = 'two'
      findWidget(comboNode, 'option3')!.value = 'three'
      findWidget(comboNode, 'choice')!.value = 'two'

      const { output } = await graphToPrompt(rootGraph)
      const promptInputs = output[`${comboNode.id}`].inputs

      // "two" is index 1 of ["one", "two", "three"].
      expect(promptInputs.index).toBe(1)
    } finally {
      appWithRootGraph.rootGraphInternal = previousRootGraph
    }
  })
})
