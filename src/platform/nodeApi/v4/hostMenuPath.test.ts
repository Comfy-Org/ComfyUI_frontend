import { assert, describe, expect, it, onTestFinished } from 'vitest'

import { useContextMenuTranslation } from '@/composables/useContextMenuTranslation'
import { LGraph, LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { hostNodeDef } from '@/platform/nodeApi/v4/defs/__fixtures__/hostNodeTypes'
import { useLitegraphService } from '@/services/litegraphService'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

import { publishedApi } from './__tests__/publishedApi'
import { registerPublishedTestPack } from './__tests__/testPack'

describe('pack menu entries on the host menu path', () => {
  it('reach the menu the canvas builds for a node, which both renderers open', async () => {
    const comfy = publishedApi()
    const packId = registerPublishedTestPack(comfy)
    comfy.defs.extend(packId, 'MenuHost', (builder) =>
      builder.addMenuItem({ label: 'From a pack', run: () => {} })
    )
    await useLitegraphService().registerNodeDef(
      'MenuHost',
      hostNodeDef('MenuHost')
    )
    const patched = ['getCanvasMenuOptions', 'getNodeMenuOptions'] as const
    const descriptors = patched.map((name) =>
      Object.getOwnPropertyDescriptor(LGraphCanvas.prototype, name)
    )
    const contextMenu = LiteGraph.ContextMenu
    onTestFinished(() => {
      patched.forEach((name, index) => {
        const descriptor = descriptors[index]
        if (descriptor)
          Object.defineProperty(LGraphCanvas.prototype, name, descriptor)
      })
      LiteGraph.ContextMenu = contextMenu
    })
    useContextMenuTranslation()
    const graph = new LGraph()
    const node = LiteGraph.createNode('MenuHost')
    assert(node)
    graph.add(node)
    stubCanvasGetContext()
    const element = document.createElement('canvas')
    const canvas = new LGraphCanvas(element, graph, {
      skip_render: true,
      skip_events: true
    })

    const options = canvas.getNodeMenuOptions(node)

    expect(options.map((option) => option?.content)).toContain('From a pack')
  })
})
