import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'

import type { NodeProgressState } from '@comfyorg/api-client/executionTypes'
import type { LGraphEventMap } from '@comfyorg/graph-model/LGraphEventMap'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { CustomEventTarget } from '@comfyorg/litegraph/infrastructure/CustomEventTarget'
import type { LGraph, LGraphCanvas } from '@comfyorg/litegraph/litegraph'
import { createMockLGraphNode } from '@comfyorg/litegraph/__fixtures__/litegraphTestUtils'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useLinkStore } from '@comfyorg/graph-state/linkStore'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvasElement
} from '@comfyorg/litegraph/__fixtures__/canvasTestUtils'

import { useMinimap } from './useMinimap'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

async function createWorkload(graphSize = 245, edgeCount = 100) {
  const nodes = Array.from({ length: graphSize }, (_, index) =>
    createMockLGraphNode({
      id: toNodeId(String(index + 1)),
      pos: [index * 20, index * 10],
      renderingSize: [100, 50],
      mode: 0
    })
  )
  const graph = fromPartial<LGraph>({
    id: 'progress-root',
    rootGraph: { id: 'progress-root' },
    isRootGraph: true,
    _nodes: nodes,
    _groups: [],
    events: new CustomEventTarget<LGraphEventMap>(),
    getNodeById: (id) => nodes.find((node) => node.id === id) ?? null
  })
  const graphScope = graphScopeOf(graph)
  Array.from({ length: edgeCount }, (_, index) =>
    useLinkStore().registerLink(graphScope, {
      id: toLinkId(index),
      graphId: graphScope.owningGraphId,
      originNodeId: toNodeId('1'),
      targetNodeId: toNodeId(String((index % graphSize) + 1)),
      originSlot: index,
      targetSlot: index,
      type: '*'
    })
  )
  const host = fromPartial<LGraphCanvas>({
    graph,
    canvas: createTestCanvasElement({ width: 1000, height: 800 }),
    ds: { scale: 1, offset: [0, 0] },
    dpr: 1,
    setDirty: vi.fn()
  })
  useCanvasStore().canvas = host
  await nextTick()
  useCanvasStore().currentGraph = graph
  const execution = useExecutionStore()
  execution.nodeProgressStates['1'] = {
    state: 'running',
    value: 1,
    max: 10,
    node_id: '1',
    display_node_id: '1',
    prompt_id: 'prompt'
  }
  const context = createMockCanvasRenderingContext2D()
  const element = createTestCanvasElement({
    width: 250,
    height: 200,
    ctx: context
  })
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  scope.run(() =>
    useMinimap({
      canvasRef: shallowRef(element),
      containerRef: shallowRef(document.createElement('div'))
    })
  )
  await nextTick()
  await vi.advanceTimersByTimeAsync(100)
  vi.mocked(context.clearRect).mockClear()
  vi.mocked(context.strokeRect).mockClear()
  return { context, nodes, execution, host, scope }
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  useSettingStore().settingValues['Comfy.Minimap.ShowLinks'] = true
  useSettingStore().settingValues['Comfy.Minimap.RenderErrorState'] = true
})

describe('minimap execution cadence', () => {
  it.for([
    { graphSize: 1, edgeCount: 0 },
    { graphSize: 245, edgeCount: 100 },
    { graphSize: 1000, edgeCount: 10 }
  ])(
    'does not repaint equal progress or percentage updates for $graphSize nodes/$edgeCount links',
    async ({ graphSize, edgeCount }) => {
      const { context, execution, host } = await createWorkload(
        graphSize,
        edgeCount
      )
      const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
      execution.nodeProgressStates['1'] = {
        ...execution.nodeProgressStates['1']
      }
      await vi.advanceTimersByTimeAsync(100)
      execution.nodeProgressStates['1'].value = 8
      await vi.advanceTimersByTimeAsync(500)

      expect(context.clearRect).not.toHaveBeenCalled()
      expect(bounds).not.toHaveBeenCalled()
      expect(host.setDirty).not.toHaveBeenCalled()
    }
  )

  it.for<NodeProgressState['state']>(['finished', 'error'])(
    'paints a discrete running-to-%s transition at the bounded poll without bounds work',
    async (state) => {
      const { context, execution } = await createWorkload()
      const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
      execution.nodeProgressStates['1'] = {
        ...execution.nodeProgressStates['1'],
        state
      }

      await vi.advanceTimersByTimeAsync(99)
      expect(context.clearRect).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(context.clearRect).toHaveBeenCalledTimes(1)
      expect(context.strokeRect).toHaveBeenCalled()
      expect(bounds).not.toHaveBeenCalled()
      vi.mocked(context.clearRect).mockClear()
      await vi.advanceTimersByTimeAsync(500)
      expect(context.clearRect).not.toHaveBeenCalled()
    }
  )

  it('refreshes bounds for geometry rather than execution progress', async () => {
    const { nodes, context } = await createWorkload()
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    nodes[0].pos[0] = 10001

    await vi.advanceTimersByTimeAsync(100)

    expect(context.clearRect).toHaveBeenCalledTimes(1)
    expect(bounds).toHaveBeenCalledTimes(1)
  })

  it('does no initial or subsequent paint or bounds work in a hidden document', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    const { context, execution, nodes } = await createWorkload()
    expect(bounds).not.toHaveBeenCalled()
    execution.nodeProgressStates['1'] = {
      ...execution.nodeProgressStates['1'],
      state: 'finished'
    }
    nodes[0].pos[0] = 10001
    await vi.advanceTimersByTimeAsync(500)

    expect(context.clearRect).not.toHaveBeenCalled()
    expect(bounds).not.toHaveBeenCalled()
  })

  it('does not subscribe to raw progress events or continue work after disposal', async () => {
    const { context, execution, scope } = await createWorkload()
    expect(api.addEventListener).not.toHaveBeenCalledWith(
      'progress',
      expect.any(Function)
    )
    expect(api.addEventListener).not.toHaveBeenCalledWith(
      'progress_state',
      expect.any(Function)
    )
    scope.stop()
    const bounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
    execution.nodeProgressStates['1'] = {
      ...execution.nodeProgressStates['1'],
      state: 'finished'
    }

    await vi.advanceTimersByTimeAsync(500)

    expect(context.clearRect).not.toHaveBeenCalled()
    expect(bounds).not.toHaveBeenCalled()
  })
})
