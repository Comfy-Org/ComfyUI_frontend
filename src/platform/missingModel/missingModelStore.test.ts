import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingModelCandidate } from '@/platform/missingModel/types'

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

import { useMissingModelStore } from './missingModelStore'

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

describe('missingModelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
        makeModelCandidate('model_b.safetensors', { nodeId: '2' })
      ])

      expect(store.missingModelCount).toBe(2)
    })
  })

  describe('hasMissingModelOnNode', () => {
    it('returns true when node has missing model', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: '5' })
      ])

      expect(store.hasMissingModelOnNode('5')).toBe(true)
    })

    it('returns false when node has no missing model', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', { nodeId: '5' })
      ])

      expect(store.hasMissingModelOnNode('99')).toBe(false)
    })

    it('returns false when no models are missing', () => {
      const store = useMissingModelStore()
      expect(store.hasMissingModelOnNode('1')).toBe(false)
    })
  })

  describe('removeMissingModelByNameOnNodes', () => {
    it('removes only the named model from specified nodes', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: '1',
          widgetName: 'ckpt_name'
        }),
        makeModelCandidate('model_b.safetensors', {
          nodeId: '1',
          widgetName: 'vae_name'
        }),
        makeModelCandidate('model_a.safetensors', {
          nodeId: '2',
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
        makeModelCandidate('model_a.safetensors', { nodeId: '1' })
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
        makeModelCandidate('model_a.safetensors', { nodeId: '1' })
      ])
      store.urlInputs['test-key'] = 'https://example.com'
      store.selectedLibraryModel['test-key'] = 'some-model'
      expect(store.missingModelCandidates).not.toBeNull()

      store.clearMissingModels()

      expect(store.missingModelCandidates).toBeNull()
      expect(store.hasMissingModels).toBe(false)
      expect(store.urlInputs).toEqual({})
      expect(store.selectedLibraryModel).toEqual({})
    })
  })

  describe('isWidgetMissingModel', () => {
    it('returns true when specific widget has missing model', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: '5',
          widgetName: 'ckpt_name'
        })
      ])

      expect(store.isWidgetMissingModel('5', 'ckpt_name')).toBe(true)
    })

    it('returns false for different widget on same node', () => {
      const store = useMissingModelStore()
      store.setMissingModels([
        makeModelCandidate('model_a.safetensors', {
          nodeId: '5',
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
          nodeId: '5',
          widgetName: 'ckpt_name'
        }),
        makeModelCandidate('model_b.safetensors', {
          nodeId: '8',
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
          nodeId: '5',
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
          nodeId: '5',
          widgetName: 'ckpt_name'
        })
      ])

      store.removeMissingModelByWidget('5', 'lora_name')
      expect(store.missingModelCandidates).toHaveLength(1)

      store.removeMissingModelByWidget('99', 'ckpt_name')
      expect(store.missingModelCandidates).toHaveLength(1)
    })
  })
})
