import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
// eslint-disable-next-line import-x/no-restricted-paths -- same exception as useWorkflowPacks.ts
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import type { components } from '@/types/comfyRegistryTypes'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { useWorkflowPacks as useSharedWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'

type NodePack = components['schemas']['Node']

vi.mock(import('@/scripts/app'))

vi.mock(import('@/services/comfyRegistryService'), () => ({
  useComfyRegistryService: vi.fn()
}))

const mockUseComfyRegistryService = vi.mocked(useComfyRegistryService)
const mockListAllPacks =
  vi.fn<(params: { node_id: string[] }) => Promise<{ nodes: NodePack[] }>>()
const mockInferPackFromNodeName = vi.fn()

function useWorkflowPacks() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  return scope.run(useSharedWorkflowPacks)!
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const makePackedNode = (cnrId: string): LGraphNode =>
  createMockLGraphNode({
    type: 'SomeNode',
    properties: { cnr_id: cnrId }
  })

describe('useWorkflowPacks', () => {
  beforeEach(() => {
    mockListAllPacks.mockReset().mockResolvedValue({ nodes: [] })
    mockInferPackFromNodeName.mockReset()
    mockUseComfyRegistryService.mockReturnValue(
      fromPartial({
        listAllPacks: mockListAllPacks,
        inferPackFromNodeName: mockInferPackFromNodeName
      })
    )

    vi.mocked(app).rootGraphOrUndefined = undefined
    useCanvasStore().canvas = null
  })

  it('resolves packs immediately when the root graph is already ready', async () => {
    vi.mocked(app).rootGraph = fromPartial<LGraph>({
      nodes: [makePackedNode('pack-1')]
    })
    mockListAllPacks.mockResolvedValue({
      nodes: [fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })]
    })

    const { startFetchWorkflowPacks, isReady, workflowPacks } =
      useWorkflowPacks()
    await startFetchWorkflowPacks()

    expect(isReady.value).toBe(true)
    expect(workflowPacks.value).toEqual([
      fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })
    ])
    expect(mockListAllPacks).toHaveBeenCalledWith(
      { node_id: ['pack-1'] },
      expect.anything()
    )
  })

  it('skips the registry fetch and stays unready when the root graph is not ready yet', async () => {
    const { startFetchWorkflowPacks, isReady, isLoading } = useWorkflowPacks()
    await startFetchWorkflowPacks()

    expect(isReady.value).toBe(false)
    expect(isLoading.value).toBe(false)
    expect(mockListAllPacks).not.toHaveBeenCalled()
  })

  it('retries and resolves packs once the root graph becomes ready, instead of staying stuck unready', async () => {
    const { startFetchWorkflowPacks, isReady, workflowPacks } =
      useWorkflowPacks()

    // Mirrors the production race: a caller (e.g. useMissingNodes' watch on
    // activeWorkflow) requests a fetch before the canvas has finished setup.
    await startFetchWorkflowPacks()
    expect(isReady.value).toBe(false)

    mockListAllPacks.mockResolvedValue({
      nodes: [fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })]
    })
    vi.mocked(app).rootGraph = fromPartial<LGraph>({
      nodes: [makePackedNode('pack-1')]
    })
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({})

    await nextTick()
    await flushPromises()
    await flushPromises()

    expect(isReady.value).toBe(true)
    expect(workflowPacks.value).toEqual([
      fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })
    ])
    expect(mockListAllPacks).toHaveBeenCalledWith(
      { node_id: ['pack-1'] },
      expect.anything()
    )
  })
})
