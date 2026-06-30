import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeExecutionId } from '@/types/nodeIdentification'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'

import type { MissingModelCandidate } from '@/platform/missingModel/types'

const mockNodeLocatorIdToNodeExecutionId = vi.hoisted(() =>
  vi.fn((nodeLocatorId: string) => nodeLocatorId)
)

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => `translated:${key}`),
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    nodeLocatorIdToNodeExecutionId: mockNodeLocatorIdToNodeExecutionId
  })
}))

import { useMissingModelStore } from './missingModelStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { app } from '@/scripts/app'
import { toNodeId } from '@/types/nodeId'

function makeModelCandidate(
  name: string,
  opts: {
    nodeId?: string | number
    sourceExecutionId?: NodeExecutionId
    nodeType?: string
    widgetName?: string
    isAssetSupported?: boolean
  } = {}
): MissingModelCandidate {
  return {
    name,
    nodeId: opts.nodeId ?? '1',
    ...(opts.sourceExecutionId !== undefined && {
      sourceExecutionId: opts.sourceExecutionId
    }),
    nodeType: opts.nodeType ?? 'CheckpointLoaderSimple',
    widgetName: opts.widgetName ?? 'ckpt_name',
    isAssetSupported: opts.isAssetSupported ?? false,
    isMissing: true
  }
}

describe('missingModelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    mockNodeLocatorIdToNodeExecutionId.mockImplementation(
      (nodeLocatorId: string) => nodeLocatorId
    )
  })

  describe('setMissingModels', () => {
    it('sets missingModelCandidates with provided models', () => {
      const store = useMissingModelStore()
      store.setMissingModels([makeModelCandidate('model_a.safetensors')])

      expect(store.missingModelCandidates).not.toBeNull()
      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.hasMissingModels).toBe(true)
    })

    it('clears missingModelCandidates when given empty array', () => {
      const store = useMissingModelStore()
      store.setMissingModels([makeModelCandidate('model_a.safetensors')])
      expect(store.missingModelCandidates).not.toBeNull()

      store.setMissingModels([])
      expect(store.missingModelCandidates).toBeNull()
      expect(store.hasMissingModels).toBe(false)
    })

    it('includes model count in missingModelCount', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors'),
        makeModelCandidate('model_b.safetensors', { nodeId: toNodeId('2') })
      ])

      expect(store.missingModelCount).toBe(2)
    })
  })

  describe('refreshMissingModels', () => {
    it('delegates to the app missing model refresh pipeline', async () => {
      const store = useMissingModelStore()
      const refreshSpy = vi
        .spyOn(app, 'refreshMissingModels')
        .mockResolvedValue({
          missingModels: [],
          confirmedCandidates: []
        })

      await store.refreshMissingModels()

      expect(refreshSpy).toHaveBeenCalledWith({ silent: true })
      expect(store.isRefreshingMissingModels).toBe(false)
    })

    it('ignores overlapping refresh requests', async () => {
      const store = useMissingModelStore()
      let resolveRefresh: () => void = () => {}
      const refreshSpy = vi.spyOn(app, 'refreshMissingModels').mockReturnValue(
        new Promise((resolve) => {
          resolveRefresh = () =>
            resolve({ missingModels: [], confirmedCandidates: [] })
        })
      )

      const firstRefresh = store.refreshMissingModels()
      const secondRefresh = store.refreshMissingModels()
      resolveRefresh()
      await Promise.all([firstRefresh, secondRefresh])

      expect(refreshSpy).toHaveBeenCalledTimes(1)
      expect(store.isRefreshingMissingModels).toBe(false)
    })

    it('shows a toast when the refresh pipeline fails', async () => {
      const store = useMissingModelStore()
      vi.spyOn(app, 'refreshMissingModels').mockRejectedValue(
        new Error('object_info failed')
      )
      const toastStore = useToastStore()
      const addSpy = vi.spyOn(toastStore, 'add')

      await store.refreshMissingModels()

      expect(addSpy).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'translated:g.error',
        detail: 'translated:rightSidePanel.missingModels.refreshFailed'
      })
      expect(store.isRefreshingMissingModels).toBe(false)
    })

    it('does not show a toast when the refresh is aborted', async () => {
      const store = useMissingModelStore()
      const abortError = new DOMException('Refresh aborted', 'AbortError')
      vi.spyOn(app, 'refreshMissingModels').mockRejectedValue(abortError)
      const toastStore = useToastStore()
      const addSpy = vi.spyOn(toastStore, 'add')

      await store.refreshMissingModels()

      expect(addSpy).not.toHaveBeenCalled()
      expect(store.isRefreshingMissingModels).toBe(false)
    })
  })

  describe('hasMissingModelOnNode', () => {
    it('returns true when node has missing model', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('5') })
      ])

      expect(
        store.hasMissingModelOnNode(createNodeLocatorId(null, toNodeId(5)))
      ).toBe(true)
    })

    it('returns false when node has no missing model', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('5') })
      ])

      expect(
        store.hasMissingModelOnNode(createNodeLocatorId(null, toNodeId(99)))
      ).toBe(false)
    })

    it('returns false when no models are missing', () => {
      const store = useMissingModelStore()
      expect(
        store.hasMissingModelOnNode(createNodeLocatorId(null, toNodeId(1)))
      ).toBe(false)
    })

    it('compares subgraph locators against missing model execution IDs', () => {
      const store = useMissingModelStore()
      const locatorId = createNodeLocatorId(
        '11111111-1111-1111-1111-111111111111',
        toNodeId(63)
      )
      mockNodeLocatorIdToNodeExecutionId.mockReturnValueOnce('65:70:63')
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('65:70:63')
        })
      ])

      expect(store.hasMissingModelOnNode(locatorId)).toBe(true)
    })
  })

  describe('removeMissingModelByNameOnNodes', () => {
    it('removes only the named model from specified nodes', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('1'),
          widgetName: 'ckpt_name'
        }),
        makeModelCandidate('model_b.safetensors', {
          nodeId: toNodeId('1'),
          widgetName: 'vae_name'
        }),
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('2'),
          widgetName: 'ckpt_name'
        })
      ])

      store.removeMissingModelByNameOnNodes(
        'model_a.safetensors',
        new Set(['1'])
      )

      expect(store.missingModelCandidates).toHaveLength(2)
      expect(store.missingModelCandidates![0].name).toBe('model_b.safetensors')
      expect(store.missingModelCandidates![1].name).toBe('model_a.safetensors')
      expect(String(store.missingModelCandidates![1].nodeId)).toBe('2')
    })

    it('sets missingModelCandidates to null when all removed', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('1') })
      ])

      store.removeMissingModelByNameOnNodes(
        'model_a.safetensors',
        new Set(['1'])
      )

      expect(store.missingModelCandidates).toBeNull()
    })
  })

  describe('clearMissingModels', () => {
    it('clears missingModelCandidates and interaction state', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('1') })
      ])
      store.modelExpandState['test-key'] = true
      store.selectedLibraryModel['test-key'] = 'some-model'
      expect(store.missingModelCandidates).not.toBeNull()

      store.clearMissingModels()

      expect(store.missingModelCandidates).toBeNull()
      expect(store.hasMissingModels).toBe(false)
      expect(store.modelExpandState).toEqual({})
      expect(store.selectedLibraryModel).toEqual({})
    })
  })

  describe('isWidgetMissingModel', () => {
    it('returns true when specific widget has missing model', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('5'),
          widgetName: 'ckpt_name'
        })
      ])

      expect(store.isWidgetMissingModel('5', 'ckpt_name')).toBe(true)
    })

    it('returns false for different widget on same node', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('5'),
          widgetName: 'ckpt_name'
        })
      ])

      expect(store.isWidgetMissingModel('5', 'lora_name')).toBe(false)
    })

    it('returns false when no models are missing', () => {
      const store = useMissingModelStore()
      expect(store.isWidgetMissingModel('1', 'ckpt_name')).toBe(false)
    })
  })

  describe('removeMissingModelByWidget', () => {
    it('removes the matching model entry by nodeId and widgetName', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('5'),
          widgetName: 'ckpt_name'
        }),
        makeModelCandidate('model_b.safetensors', {
          nodeId: toNodeId('8'),
          widgetName: 'lora_name'
        })
      ])

      store.removeMissingModelByWidget('5', 'ckpt_name')

      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.missingModelCandidates![0].name).toBe('model_b.safetensors')
    })

    it('sets candidates to null when last entry is removed', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('5'),
          widgetName: 'ckpt_name'
        })
      ])

      store.removeMissingModelByWidget('5', 'ckpt_name')

      expect(store.missingModelCandidates).toBeNull()
      expect(store.hasMissingModels).toBe(false)
    })

    it('does nothing when no candidates exist', () => {
      const store = useMissingModelStore()
      store.removeMissingModelByWidget('5', 'ckpt_name')
      expect(store.missingModelCandidates).toBeNull()
    })

    it('does nothing when nodeId or widgetName does not match', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('5'),
          widgetName: 'ckpt_name'
        })
      ])

      store.removeMissingModelByWidget('5', 'lora_name')
      expect(store.missingModelCandidates).toHaveLength(1)

      store.removeMissingModelByWidget('99', 'ckpt_name')
      expect(store.missingModelCandidates).toHaveLength(1)
    })
  })

  describe('addMissingModels', () => {
    it('appends to existing candidates', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('1') })
      ])

      store.addMissingModels([
        makeModelCandidate('model_b.safetensors', { nodeId: toNodeId('2') })
      ])

      expect(store.missingModelCandidates).toHaveLength(2)
      expect(store.missingModelCandidates![0].name).toBe('model_a.safetensors')
      expect(store.missingModelCandidates![1].name).toBe('model_b.safetensors')
    })

    it('works when store is empty (candidates are null)', () => {
      const store = useMissingModelStore()
      expect(store.missingModelCandidates).toBeNull()

      store.addMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('1') })
      ])

      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.hasMissingModels).toBe(true)
    })

    it('does nothing when given empty array', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('1') })
      ])

      store.addMissingModels([])

      expect(store.missingModelCandidates).toHaveLength(1)
    })
  })

  describe('removeMissingModelsByNodeId', () => {
    it('removes all candidates matching the nodeId', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: toNodeId('1'),
          widgetName: 'ckpt_name'
        }),
        makeModelCandidate('model_b.safetensors', {
          nodeId: toNodeId('1'),
          widgetName: 'vae_name'
        }),
        makeModelCandidate('model_c.safetensors', { nodeId: toNodeId('2') })
      ])

      store.removeMissingModelsByNodeId('1')

      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.missingModelCandidates![0].name).toBe('model_c.safetensors')
    })

    it('keeps candidates with non-matching nodeId', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('1') }),
        makeModelCandidate('model_b.safetensors', { nodeId: toNodeId('2') })
      ])

      store.removeMissingModelsByNodeId('99')

      expect(store.missingModelCandidates).toHaveLength(2)
    })

    it('sets candidates to null when all are removed', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: toNodeId('1') }),
        makeModelCandidate('model_b.safetensors', { nodeId: toNodeId('1') })
      ])

      store.removeMissingModelsByNodeId('1')

      expect(store.missingModelCandidates).toBeNull()
      expect(store.hasMissingModels).toBe(false)
    })

    it('does nothing when candidates are null', () => {
      const store = useMissingModelStore()
      store.removeMissingModelsByNodeId('1')
      expect(store.missingModelCandidates).toBeNull()
    })
  })

  describe('removeMissingModelsByPrefix', () => {
    it('removes all candidates whose nodeId starts with the prefix', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('a.safetensors', { nodeId: toNodeId('65:70:63') }),
        makeModelCandidate('b.safetensors', { nodeId: toNodeId('65:70:64') }),
        makeModelCandidate('c.safetensors', { nodeId: toNodeId('65:80:5') })
      ])

      store.removeMissingModelsByPrefix('65:70:')

      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.missingModelCandidates![0].nodeId).toBe('65:80:5')
    })

    it('removes deeply nested interior nodes under the container', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('a.safetensors', { nodeId: toNodeId('65:70:63') }),
        makeModelCandidate('b.safetensors', { nodeId: toNodeId('65:70:80:5') }),
        makeModelCandidate('c.safetensors', { nodeId: toNodeId('65:71:63') })
      ])

      store.removeMissingModelsByPrefix('65:70:')

      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.missingModelCandidates![0].nodeId).toBe('65:71:63')
    })

    it('does not match siblings that share a numeric prefix (trailing colon)', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('a.safetensors', { nodeId: toNodeId('65:70:1') }),
        makeModelCandidate('b.safetensors', { nodeId: toNodeId('65:705:1') }),
        makeModelCandidate('c.safetensors', { nodeId: toNodeId('65:70') })
      ])

      store.removeMissingModelsByPrefix('65:70:')

      expect(store.missingModelCandidates).toHaveLength(2)
      const remainingIds = store.missingModelCandidates!.map((m) =>
        String(m.nodeId)
      )
      expect(remainingIds).toContain('65:705:1')
      expect(remainingIds).toContain('65:70')
    })

    it('sets candidates to null when all are removed', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('a.safetensors', { nodeId: toNodeId('65:70:63') }),
        makeModelCandidate('b.safetensors', { nodeId: toNodeId('65:70:64') })
      ])

      store.removeMissingModelsByPrefix('65:70:')

      expect(store.missingModelCandidates).toBeNull()
      expect(store.hasMissingModels).toBe(false)
    })

    it('does nothing when no candidates match', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('a.safetensors', { nodeId: toNodeId('65:71:1') })
      ])

      store.removeMissingModelsByPrefix('65:70:')

      expect(store.missingModelCandidates).toHaveLength(1)
    })

    it('does nothing when candidates are null', () => {
      const store = useMissingModelStore()
      store.removeMissingModelsByPrefix('65:70:')
      expect(store.missingModelCandidates).toBeNull()
    })

    it('preserves workflow-level candidates without a nodeId', () => {
      const store = useMissingModelStore()
      const workflowLevel: MissingModelCandidate = {
        name: 'workflow-level.safetensors',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        isMissing: true
      }
      store.setMissingModels([
        makeModelCandidate('a.safetensors', { nodeId: toNodeId('65:70:63') }),
        workflowLevel
      ])

      store.removeMissingModelsByPrefix('65:70:')

      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.missingModelCandidates![0].name).toBe(
        'workflow-level.safetensors'
      )
    })

    it('clears interaction state for removed names not used elsewhere', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('shared.safetensors', {
          nodeId: toNodeId('65:70:63')
        }),
        makeModelCandidate('shared.safetensors', {
          nodeId: toNodeId('65:80:5')
        }),
        makeModelCandidate('only-interior.safetensors', {
          nodeId: toNodeId('65:70:64')
        })
      ])
      store.selectedLibraryModel['shared.safetensors'] = 'shared-replacement'
      store.selectedLibraryModel['only-interior.safetensors'] =
        'interior-replacement'

      store.removeMissingModelsByPrefix('65:70:')

      // 'only-interior' fully removed → interaction state cleared.
      // 'shared' still referenced by 65:80:5 → interaction state preserved.
      expect(
        store.selectedLibraryModel['only-interior.safetensors']
      ).toBeUndefined()
      expect(store.selectedLibraryModel['shared.safetensors']).toBe(
        'shared-replacement'
      )
    })
  })

  describe('removeMissingModelsBySourceScope', () => {
    it('removes host-keyed candidates whose source path is in the scope', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('a.safetensors', {
          nodeId: '65',
          sourceExecutionId: createNodeExecutionId([65, 77, 42])
        }),
        makeModelCandidate('b.safetensors', {
          nodeId: '80',
          sourceExecutionId: createNodeExecutionId([80, 77, 42])
        })
      ])

      store.removeMissingModelsBySourceScope('65:77')

      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.missingModelCandidates![0].name).toBe('b.safetensors')
    })

    it('does not remove candidates by host nodeId alone', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('a.safetensors', { nodeId: '65' })
      ])

      store.removeMissingModelsBySourceScope('65')

      expect(store.missingModelCandidates).toHaveLength(1)
    })
  })
})
