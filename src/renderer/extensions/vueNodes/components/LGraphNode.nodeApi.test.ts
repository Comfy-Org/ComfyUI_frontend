import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'
import {
  hostNodeDef,
  registerHostType
} from '@/platform/nodeApi/v4/defs/__fixtures__/hostNodeTypes'
import type { NodeDefBuilder, NodeHandle } from '@/platform/nodeApi/v4/types'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import LGraphNode from '@/renderer/extensions/vueNodes/components/LGraphNode.vue'
import { app } from '@/scripts/app'
import { stubCanvasGetContext } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/scripts/app'))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

let types = 0

afterEach(() => {
  layoutStore.resetForTests()
})

interface VueNodeSetup {
  readonly hooks?: (builder: NodeDefBuilder) => void
  readonly build?: (node: NodeHandle) => void
}

async function vueNode({ hooks, build }: VueNodeSetup = {}) {
  stubCanvasGetContext()
  const type = `Pack/VueNode${++types}`
  const graph = app.rootGraph
  const canvasStore = useCanvasStore()
  const api = createComfyApi({ getGraph: () => graph })
  registerHostType(api.host.nodeTypeHooks, hostNodeDef(type))
  if (hooks) api.comfy.defs.extend(registerTestPack(api), type, hooks)
  const node = LiteGraph.createNode(type)
  if (!node) throw new Error(`${type} did not register`)
  graph.add(node)
  const handle = api.comfy.graph.node(String(node.id))
  if (!handle) throw new Error('the node has no handle')
  build?.(handle)
  canvasStore.canvas = new LGraphCanvas(
    document.createElement('canvas'),
    graph,
    { skip_render: true, skip_events: true }
  )
  canvasStore.currentGraph = graph
  render(LGraphNode, {
    props: {
      nodeData: {
        id: node.id,
        graphId: graph.id,
        title: type,
        type,
        mode: 0,
        flags: {},
        inputs: [],
        outputs: [],
        properties: {}
      }
    },
    attrs: { 'data-testid': 'vue-node' },
    global: { plugins: [getActivePinia()!, i18n] }
  })
  await nextTick()
  const root = screen.getByTestId('vue-node')
  return { api, graph, node, handle, root }
}

describe('the node API under Vue nodes, through LGraphNode.vue', () => {
  describe('pointer hooks', () => {
    it('tells onHover the pointer entered and left the node', async () => {
      const hovering: boolean[] = []
      const { root } = await vueNode({
        hooks: (builder) =>
          builder.onHover((_, isOver) => hovering.push(isOver))
      })

      const user = userEvent.setup()
      await user.hover(root)
      await user.unhover(root)

      expect(hovering).toEqual([true, false])
    })

    it('tells onDoubleClick the node was double-clicked', async () => {
      const onDoubleClick = vi.fn()
      const { node, root } = await vueNode({
        hooks: (builder) => builder.onDoubleClick(onDoubleClick)
      })

      await userEvent.setup().dblClick(root)

      expect(onDoubleClick).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ id: String(node.id) })
      )
    })

    it('asks onDragOver while a drag is over the node, and marks it the target when a hook accepts', async () => {
      const asked = vi.fn(() => true)
      const { root } = await vueNode({
        hooks: (builder) => builder.onDragOver(asked)
      })

      await fireEvent.dragOver(root)

      expect(asked).toHaveBeenCalledOnce()
      expect(
        within(root).getByTestId('node-inner-wrapper').className
      ).toContain('ring-primary')
    })

    it('makes the node dropped on the drop target even when no hook accepted the drag, so onDrop is asked', async () => {
      const onDrop = vi.fn(() => true)
      const { node, root } = await vueNode({
        hooks: (builder) => {
          builder.onDragOver(() => false)
          builder.onDrop(onDrop)
        }
      })

      await fireEvent.dragOver(root)
      await fireEvent.drop(root)
      const claimed = await app.dragOverNode?.onDragDrop?.(
        new DragEvent('drop')
      )

      expect(app.dragOverNode).toBe(node)
      expect(claimed).toBe(true)
      expect(onDrop).toHaveBeenCalledOnce()
    })
  })
})
