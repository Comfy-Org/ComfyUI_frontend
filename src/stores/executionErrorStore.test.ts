import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingNodeType } from '@/types/comfy'
import type { MissingModelCandidate } from '@/platform/missingModel/types'

// Mock dependencies
vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/stores/settingStore', () => ({
  useSettingStore: vi.fn(() => ({
    get: vi.fn(() => false)
  }))
}))

import { useExecutionErrorStore } from './executionErrorStore'

describe('executionErrorStore — missing node operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('setMissingNodeTypes', () => {
    it('sets missingNodesError with provided types', () => {
      const store = useExecutionErrorStore()
      const types: MissingNodeType[] = [
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ]
      store.setMissingNodeTypes(types)

      expect(store.missingNodesError).not.toBeNull()
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      expect(store.hasMissingNodes).toBe(true)
    })

    it('clears missingNodesError when given empty array', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])
      expect(store.missingNodesError).not.toBeNull()

      store.setMissingNodeTypes([])
      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('deduplicates string entries by value', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        'NodeA',
        'NodeA',
        'NodeB'
      ] as MissingNodeType[])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by nodeId when present', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false }
      ])

      // Same nodeId='1' deduplicated, nodeId='2' kept
      expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    })

    it('deduplicates object entries by type when nodeId is absent', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', isReplaceable: false },
        { type: 'NodeA', isReplaceable: true }
      ] as MissingNodeType[])

      // Same type, no nodeId → deduplicated
      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('keeps distinct nodeIds even when type is the same', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeA', nodeId: '2', isReplaceable: false },
        { type: 'NodeA', nodeId: '3', isReplaceable: false }
      ])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(3)
    })
  })

  describe('removeMissingNodesByType', () => {
    it('removes matching types from the missing nodes list', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false },
        { type: 'NodeB', nodeId: '2', isReplaceable: false },
        { type: 'NodeC', nodeId: '3', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NodeA', 'NodeC'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
      const remaining = store.missingNodesError?.nodeTypes[0]
      expect(typeof remaining !== 'string' && remaining?.type).toBe('NodeB')
    })

    it('clears missingNodesError when all types are removed', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NodeA'])

      expect(store.missingNodesError).toBeNull()
      expect(store.hasMissingNodes).toBe(false)
    })

    it('does nothing when missingNodesError is null', () => {
      const store = useExecutionErrorStore()
      expect(store.missingNodesError).toBeNull()

      // Should not throw
      store.removeMissingNodesByType(['NodeA'])
      expect(store.missingNodesError).toBeNull()
    })

    it('does nothing when removing non-existent types', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        { type: 'NodeA', nodeId: '1', isReplaceable: false }
      ])

      store.removeMissingNodesByType(['NonExistent'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })

    it('handles removing from string entries', () => {
      const store = useExecutionErrorStore()
      store.setMissingNodeTypes([
        'StringNodeA',
        'StringNodeB'
      ] as MissingNodeType[])

      store.removeMissingNodesByType(['StringNodeA'])

      expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
    })
  })
})

function makeModelCandidate(
  name: string,
  opts: {
    nodeId?: string | number
    nodeType?: string
    widgetName?: string
    isAssetSupported?: boolean
  } = {}
): MissingModelCandidate {
  return {
    name,
    nodeId: opts.nodeId ?? '1',
    nodeType: opts.nodeType ?? 'CheckpointLoaderSimple',
    widgetName: opts.widgetName ?? 'ckpt_name',
    isAssetSupported: opts.isAssetSupported ?? false,
    isMissing: true
  }
}

describe('executionErrorStore — missing model operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('surfaceMissingModels', () => {
    it('sets missingModelsError with provided models', () => {
      const store = useExecutionErrorStore()
      const models = [makeModelCandidate('model_a.safetensors')]
      store.surfaceMissingModels(models)

      expect(store.missingModelsError).not.toBeNull()
      expect(store.missingModelsError).toHaveLength(1)
      expect(store.hasMissingModels).toBe(true)
    })

    it('clears missingModelsError when given empty array', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([makeModelCandidate('model_a.safetensors')])
      expect(store.missingModelsError).not.toBeNull()

      store.surfaceMissingModels([])
      expect(store.missingModelsError).toBeNull()
      expect(store.hasMissingModels).toBe(false)
    })

    it('includes model count in totalErrorCount', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors'),
        makeModelCandidate('model_b.safetensors', { nodeId: '2' })
      ])

      expect(store.totalErrorCount).toBe(2)
    })
  })

  describe('removeMissingModelByName', () => {
    it('removes matching model by name', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors'),
        makeModelCandidate('model_b.safetensors', { nodeId: '2' })
      ])

      store.removeMissingModelByName('model_a.safetensors')

      expect(store.missingModelsError).toHaveLength(1)
      expect(store.missingModelsError![0].name).toBe('model_b.safetensors')
    })

    it('clears missingModelsError when last model is removed', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([makeModelCandidate('model_a.safetensors')])

      store.removeMissingModelByName('model_a.safetensors')

      expect(store.missingModelsError).toBeNull()
      expect(store.hasMissingModels).toBe(false)
    })

    it('does nothing when missingModelsError is null', () => {
      const store = useExecutionErrorStore()
      expect(store.missingModelsError).toBeNull()

      store.removeMissingModelByName('model_a.safetensors')
      expect(store.missingModelsError).toBeNull()
    })

    it('does nothing when name does not match', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([makeModelCandidate('model_a.safetensors')])

      store.removeMissingModelByName('nonexistent.safetensors')

      expect(store.missingModelsError).toHaveLength(1)
    })
  })

  describe('removeMissingModelsByNodeIds', () => {
    it('removes models matching provided nodeIds', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: '1' }),
        makeModelCandidate('model_b.safetensors', { nodeId: '2' }),
        makeModelCandidate('model_c.safetensors', { nodeId: '3' })
      ])

      store.removeMissingModelsByNodeIds(new Set(['1', '3']))

      expect(store.missingModelsError).toHaveLength(1)
      expect(store.missingModelsError![0].name).toBe('model_b.safetensors')
    })

    it('clears missingModelsError when all models are removed', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: '1' })
      ])

      store.removeMissingModelsByNodeIds(new Set(['1']))

      expect(store.missingModelsError).toBeNull()
    })

    it('does nothing when missingModelsError is null', () => {
      const store = useExecutionErrorStore()
      store.removeMissingModelsByNodeIds(new Set(['1']))
      expect(store.missingModelsError).toBeNull()
    })
  })

  describe('hasMissingModelOnNode', () => {
    it('returns true when node has missing model', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: '5' })
      ])

      expect(store.hasMissingModelOnNode('5')).toBe(true)
    })

    it('returns false when node has no missing model', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: '5' })
      ])

      expect(store.hasMissingModelOnNode('99')).toBe(false)
    })

    it('returns false when no models are missing', () => {
      const store = useExecutionErrorStore()
      expect(store.hasMissingModelOnNode('1')).toBe(false)
    })
  })

  describe('isWidgetMissingModel', () => {
    it('returns true when specific widget has missing model', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: '5',
          widgetName: 'ckpt_name'
        })
      ])

      expect(store.isWidgetMissingModel('5', 'ckpt_name')).toBe(true)
    })

    it('returns false for different widget on same node', () => {
      const store = useExecutionErrorStore()
      store.surfaceMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: '5',
          widgetName: 'ckpt_name'
        })
      ])

      expect(store.isWidgetMissingModel('5', 'lora_name')).toBe(false)
    })

    it('returns false when no models are missing', () => {
      const store = useExecutionErrorStore()
      expect(store.isWidgetMissingModel('1', 'ckpt_name')).toBe(false)
    })
  })
})
