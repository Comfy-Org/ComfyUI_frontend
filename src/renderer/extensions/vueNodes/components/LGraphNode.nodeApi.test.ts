import { fireEvent, render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { LGraph, LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
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
  if (hooks)
    onTestFinished(api.comfy.defs.extend(registerTestPack(api), type, hooks))
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

  describe('addBadge', () => {
    function recomputeBadges(graph: LGraph) {
      const canvasStore = useCanvasStore()
      canvasStore.currentGraph = new LGraph()
      canvasStore.currentGraph = graph
      return nextTick()
    }

    it('shows a badge added before the node is first drawn', async () => {
      const { root } = await vueNode({
        build: (node) => node.addBadge({ text: 'Early' })
      })

      expect(within(root).getByText('Early')).toBeInTheDocument()
    })

    it('shows a badge added after the node is first drawn once its badges are recomputed (#24163)', async () => {
      const { graph, handle, root } = await vueNode()

      handle.addBadge({ text: 'Late' })
      await recomputeBadges(graph)

      expect(within(root).getByText('Late')).toBeInTheDocument()
    })

    it('drops a badge removed after the node is first drawn once its badges are recomputed (#24163)', async () => {
      let remove = () => {}
      const { graph, root } = await vueNode({
        build: (node) => {
          remove = node.addBadge({ text: 'Gone' })
        }
      })

      expect(within(root).getByText('Gone')).toBeInTheDocument()

      remove()
      await recomputeBadges(graph)

      expect(within(root).queryByText('Gone')).toBeNull()
    })
  })
})
