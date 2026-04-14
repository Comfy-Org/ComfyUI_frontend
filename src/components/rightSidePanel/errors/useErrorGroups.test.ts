import { fromAny } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MissingNodeType } from '@/types/comfy'

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      serialize: vi.fn(() => ({})),
      getNodeById: vi.fn()
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  getNodeByExecutionId: vi.fn(),
  getExecutionIdByNode: vi.fn(),
  getRootParentNode: vi.fn(() => null),
  forEachNode: vi.fn(),
  mapAllNodes: vi.fn(() => [])
}))

const mockIsCloud = vi.hoisted(() => ({ value: false }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@/i18n', () => ({
  st: vi.fn((_key: string, fallback: string) => fallback)
}))

vi.mock('@/stores/comfyRegistryStore', () => ({
  useComfyRegistryStore: () => ({
    inferPackFromNodeName: vi.fn()
  })
}))

vi.mock('@/utils/nodeTitleUtil', () => ({
  resolveNodeDisplayName: vi.fn(() => '')
}))

vi.mock('@/utils/litegraphUtil', () => ({
  isLGraphNode: vi.fn(() => false)
}))

vi.mock('@/utils/executableGroupNodeDto', () => ({
  isGroupNode: vi.fn(() => false)
}))

vi.mock(
  '@/platform/missingModel/composables/useMissingModelInteractions',
  () => ({
    clearMissingModelState: vi.fn()
  })
)

import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { useErrorGroups } from './useErrorGroups'

function makeMissingNodeType(
  type: string,
  opts: {
    nodeId?: string
    isReplaceable?: boolean
    cnrId?: string
    replacement?: { new_node_id: string }
  } = {}
): MissingNodeType {
  return {
    type,
    nodeId: opts.nodeId ?? '1',
    isReplaceable: opts.isReplaceable ?? false,
    cnrId: opts.cnrId,
    replacement: opts.replacement
      ? {
          old_node_id: type,
          new_node_id: opts.replacement.new_node_id,
          old_widget_ids: null,
          input_mapping: null,
          output_mapping: null
        }
      : undefined
  }
}

function makeModel(
  name: string,
  opts: {
    nodeId?: string | number
    widgetName?: string
    directory?: string
    isAssetSupported?: boolean
  } = {}
) {
  return {
    name,
    nodeId: opts.nodeId ?? '1',
    nodeType: 'CheckpointLoaderSimple',
    widgetName: opts.widgetName ?? 'ckpt_name',
    isAssetSupported: opts.isAssetSupported ?? false,
    isMissing: true as const,
    directory: opts.directory
  }
}

function createErrorGroups() {
  const store = useExecutionErrorStore()
  const searchQuery = ref('')
  const t = (key: string) => key
  const groups = useErrorGroups(searchQuery, t)
  return { store, searchQuery, groups }
}

describe('useErrorGroups', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('missingPackGroups', () => {
    it('returns empty array when no missing nodes', () => {
      const { groups } = createErrorGroups()
      expect(groups.missingPackGroups.value).toEqual([])
    })

    it('groups non-replaceable nodes by cnrId', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' }),
        makeMissingNodeType('NodeB', { cnrId: 'pack-1', nodeId: '2' }),
        makeMissingNodeType('NodeC', { cnrId: 'pack-2', nodeId: '3' })
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(2)
      const pack1 = groups.missingPackGroups.value.find(
        (g) => g.packId === 'pack-1'
      )
      expect(pack1?.nodeTypes).toHaveLength(2)
      const pack2 = groups.missingPackGroups.value.find(
        (g) => g.packId === 'pack-2'
      )
      expect(pack2?.nodeTypes).toHaveLength(1)
    })

    it('excludes replaceable nodes from missingPackGroups', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        }),
        makeMissingNodeType('MissingNode', {
          nodeId: '2',
          cnrId: 'some-pack'
        })
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(1)
      expect(groups.missingPackGroups.value[0].packId).toBe('some-pack')
    })

    it('groups nodes without cnrId under null packId', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('UnknownNode', { nodeId: '1' }),
        makeMissingNodeType('AnotherUnknown', { nodeId: '2' })
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(1)
      expect(groups.missingPackGroups.value[0].packId).toBeNull()
      expect(groups.missingPackGroups.value[0].nodeTypes).toHaveLength(2)
    })

    it('sorts groups alphabetically with null packId last', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'zebra-pack' }),
        makeMissingNodeType('NodeB', { nodeId: '2' }),
        makeMissingNodeType('NodeC', { cnrId: 'alpha-pack', nodeId: '3' })
      ])
      await nextTick()

      const packIds = groups.missingPackGroups.value.map((g) => g.packId)
      expect(packIds).toEqual(['alpha-pack', 'zebra-pack', null])
    })

    it('sorts nodeTypes within each group alphabetically by type then nodeId', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeB', { cnrId: 'pack-1', nodeId: '2' }),
        makeMissingNodeType('NodeA', { cnrId: 'pack-1', nodeId: '3' }),
        makeMissingNodeType('NodeA', { cnrId: 'pack-1', nodeId: '1' })
      ])
      await nextTick()

      const group = groups.missingPackGroups.value[0]
      const types = group.nodeTypes.map((n) =>
        typeof n === 'string' ? n : `${n.type}:${n.nodeId}`
      )
      expect(types).toEqual(['NodeA:1', 'NodeA:3', 'NodeB:2'])
    })

    it('handles string nodeType entries', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        fromAny<MissingNodeType, unknown>('StringGroupNode')
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(1)
      expect(groups.missingPackGroups.value[0].packId).toBeNull()
    })
  })

  describe('allErrorGroups', () => {
    it('returns empty array when no errors', () => {
      const { groups } = createErrorGroups()
      expect(groups.allErrorGroups.value).toEqual([])
    })

    it('includes missing_node group when missing nodes exist', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' })
      ])
      await nextTick()

      const missingGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'missing_node'
      )
      expect(missingGroup).toBeDefined()
    })

    it('includes swap_nodes group when replaceable nodes exist', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        })
      ])
      await nextTick()

      const swapGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'swap_nodes'
      )
      expect(swapGroup).toBeDefined()
    })

    it('includes both swap_nodes and missing_node when both exist', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        }),
        makeMissingNodeType('MissingNode', {
          nodeId: '2',
          cnrId: 'some-pack'
        })
      ])
      await nextTick()

      const types = groups.allErrorGroups.value.map((g) => g.type)
      expect(types).toContain('swap_nodes')
      expect(types).toContain('missing_node')
    })

    it('swap_nodes has lower priority than missing_node', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('OldNode', {
          isReplaceable: true,
          replacement: { new_node_id: 'NewNode' }
        }),
        makeMissingNodeType('MissingNode', {
          nodeId: '2',
          cnrId: 'some-pack'
        })
      ])
      await nextTick()

      const swapIdx = groups.allErrorGroups.value.findIndex(
        (g) => g.type === 'swap_nodes'
      )
      const missingIdx = groups.allErrorGroups.value.findIndex(
        (g) => g.type === 'missing_node'
      )
      expect(swapIdx).toBeLessThan(missingIdx)
    })

    it('includes execution error groups from node errors', async () => {
      const { store, groups } = createErrorGroups()
      store.lastNodeErrors = {
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            {
              type: 'value_not_valid',
              message: 'Value not valid',
              details: 'some detail'
            }
          ]
        }
      }
      await nextTick()

      const execGroups = groups.allErrorGroups.value.filter(
        (g) => g.type === 'execution'
      )
      expect(execGroups.length).toBeGreaterThan(0)
    })

    it('includes execution error from runtime errors', async () => {
      const { store, groups } = createErrorGroups()
      store.lastExecutionError = {
        prompt_id: 'test-prompt',
        timestamp: Date.now(),
        node_id: 5,
        node_type: 'KSampler',
        executed: [],
        exception_type: 'RuntimeError',
        exception_message: 'CUDA out of memory',
        traceback: ['line 1', 'line 2'],
        current_inputs: {},
        current_outputs: {}
      }
      await nextTick()

      const execGroups = groups.allErrorGroups.value.filter(
        (g) => g.type === 'execution'
      )
      expect(execGroups.length).toBeGreaterThan(0)
    })

    it('includes prompt error when present', async () => {
      const { store, groups } = createErrorGroups()
      store.lastPromptError = {
        type: 'prompt_no_outputs',
        message: 'No outputs',
        details: ''
      }
      await nextTick()

      const promptGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution' && g.title === 'No outputs'
      )
      expect(promptGroup).toBeDefined()
    })

    it('sorts cards within an execution group by nodeId numerically', async () => {
      const { store, groups } = createErrorGroups()
      store.lastNodeErrors = {
        '10': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '2': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        }
      }
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      const nodeIds = execGroup?.cards.map((c) => c.nodeId)
      expect(nodeIds).toEqual(['1', '2', '10'])
    })

    it('sorts cards with subpath nodeIds before higher root IDs', async () => {
      const { store, groups } = createErrorGroups()
      store.lastNodeErrors = {
        '2': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '1:20': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        }
      }
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      const nodeIds = execGroup?.cards.map((c) => c.nodeId)
      expect(nodeIds).toEqual(['1', '1:20', '2'])
    })

    it('sorts deeply nested nodeIds by each segment numerically', async () => {
      const { store, groups } = createErrorGroups()
      store.lastNodeErrors = {
        '10:11:99': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '10:11:12': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        },
        '10:2': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'err', message: 'Error', details: '' }]
        }
      }
      await nextTick()

      const execGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'execution'
      )
      const nodeIds = execGroup?.cards.map((c) => c.nodeId)
      expect(nodeIds).toEqual(['10:2', '10:11:12', '10:11:99'])
    })
  })

  describe('filteredGroups', () => {
    it('returns all groups when search query is empty', async () => {
      const { store, groups } = createErrorGroups()
      store.lastNodeErrors = {
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [{ type: 'value_error', message: 'Bad value', details: '' }]
        }
      }
      await nextTick()

      expect(groups.filteredGroups.value.length).toBeGreaterThan(0)
    })

    it('filters groups based on search query', async () => {
      const { store, groups, searchQuery } = createErrorGroups()
      store.lastNodeErrors = {
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            {
              type: 'value_error',
              message: 'Value error in sampler',
              details: ''
            }
          ]
        },
        '2': {
          class_type: 'CLIPLoader',
          dependent_outputs: [],
          errors: [
            {
              type: 'file_not_found',
              message: 'File not found',
              details: ''
            }
          ]
        }
      }
      await nextTick()

      searchQuery.value = 'sampler'
      await nextTick()

      const executionGroups = groups.filteredGroups.value.filter(
        (g) => g.type === 'execution'
      )
      for (const group of executionGroups) {
        if (group.type !== 'execution') continue
        const hasMatch = group.cards.some(
          (c) =>
            c.title.toLowerCase().includes('sampler') ||
            c.errors.some((e) => e.message.toLowerCase().includes('sampler'))
        )
        expect(hasMatch).toBe(true)
      }
    })
  })

  describe('groupedErrorMessages', () => {
    it('returns empty array when no errors', () => {
      const { groups } = createErrorGroups()
      expect(groups.groupedErrorMessages.value).toEqual([])
    })

    it('collects unique error messages from node errors', async () => {
      const { store, groups } = createErrorGroups()
      store.lastNodeErrors = {
        '1': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            { type: 'err_a', message: 'Error A', details: '' },
            { type: 'err_b', message: 'Error B', details: '' }
          ]
        },
        '2': {
          class_type: 'CLIPLoader',
          dependent_outputs: [],
          errors: [{ type: 'err_a', message: 'Error A', details: '' }]
        }
      }
      await nextTick()

      const messages = groups.groupedErrorMessages.value
      expect(messages).toContain('Error A')
      expect(messages).toContain('Error B')
      // Deduplication: Error A appears twice but should only be listed once
      expect(messages.filter((m) => m === 'Error A')).toHaveLength(1)
    })

    it('includes missing node group title as message', async () => {
      const { groups } = createErrorGroups()
      const missingNodesStore = useMissingNodesErrorStore()
      missingNodesStore.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' })
      ])
      await nextTick()

      const missingGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'missing_node'
      )
      expect(missingGroup).toBeDefined()
      expect(groups.groupedErrorMessages.value).toContain(missingGroup!.title)
    })
  })

  describe('missingModelGroups', () => {
    it('returns empty array when no missing models', () => {
      const { groups } = createErrorGroups()
      expect(groups.missingModelGroups.value).toEqual([])
    })

    it('groups asset-supported models by directory', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('lora_a.safetensors', {
          nodeId: '3',
          directory: 'loras',
          isAssetSupported: true
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      const ckptGroup = groups.missingModelGroups.value.find(
        (g) => g.directory === 'checkpoints'
      )
      expect(ckptGroup?.models).toHaveLength(2)
      expect(ckptGroup?.isAssetSupported).toBe(true)
    })

    it('puts unsupported models in a separate group', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('custom_model.safetensors', {
          nodeId: '2',
          isAssetSupported: false
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      const unsupported = groups.missingModelGroups.value.find(
        (g) => !g.isAssetSupported
      )
      expect(unsupported?.models).toHaveLength(1)
    })

    it('merges same-named models into one view model with multiple referencingNodes', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('shared_model.safetensors', {
          nodeId: '1',
          widgetName: 'ckpt_name',
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('shared_model.safetensors', {
          nodeId: '2',
          widgetName: 'ckpt_name',
          directory: 'checkpoints',
          isAssetSupported: true
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(1)
      const model = groups.missingModelGroups.value[0].models[0]
      expect(model.name).toBe('shared_model.safetensors')
      expect(model.referencingNodes).toHaveLength(2)
    })

    it('groups non-asset-supported models by directory in OSS', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('lora_a.safetensors', {
          nodeId: '3',
          directory: 'loras',
          isAssetSupported: false
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      const ckptGroup = groups.missingModelGroups.value.find(
        (g) => g.directory === 'checkpoints'
      )
      expect(ckptGroup?.models).toHaveLength(2)
      expect(ckptGroup?.isAssetSupported).toBe(false)
      const loraGroup = groups.missingModelGroups.value.find(
        (g) => g.directory === 'loras'
      )
      expect(loraGroup?.models).toHaveLength(1)
    })

    it('does not lump non-asset-supported models into UNSUPPORTED group in OSS', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('lora_a.safetensors', {
          nodeId: '2',
          directory: 'loras',
          isAssetSupported: false
        })
      ])
      await nextTick()

      const unsupported = groups.missingModelGroups.value.find(
        (g) => g.directory === null && !g.isAssetSupported
      )
      expect(unsupported).toBeUndefined()
    })

    it('includes missing_model group in allErrorGroups', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([makeModel('model_a.safetensors')])
      await nextTick()

      const modelGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'missing_model'
      )
      expect(modelGroup).toBeDefined()
    })
  })

  describe('missingModelGroups (Cloud)', () => {
    beforeEach(() => {
      mockIsCloud.value = true
    })

    afterEach(() => {
      mockIsCloud.value = false
    })

    it('puts unsupported models into UNSUPPORTED group in Cloud', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: false
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'loras',
          isAssetSupported: false
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(1)
      expect(groups.missingModelGroups.value[0].isAssetSupported).toBe(false)
      expect(groups.missingModelGroups.value[0].directory).toBeNull()
    })

    it('groups asset-supported models by directory in Cloud', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('model_a.safetensors', {
          directory: 'checkpoints',
          isAssetSupported: true
        }),
        makeModel('model_b.safetensors', {
          nodeId: '2',
          directory: 'loras',
          isAssetSupported: true
        })
      ])
      await nextTick()

      expect(groups.missingModelGroups.value).toHaveLength(2)
      expect(
        groups.missingModelGroups.value.every((g) => g.isAssetSupported)
      ).toBe(true)
    })
  })

  describe('unfiltered vs selection-filtered model/media groups', () => {
    it('exposes both unfiltered (missingModelGroups) and filtered (filteredMissingModelGroups)', () => {
      const { groups } = createErrorGroups()
      expect(groups.missingModelGroups).toBeDefined()
      expect(groups.filteredMissingModelGroups).toBeDefined()
      expect(groups.missingMediaGroups).toBeDefined()
      expect(groups.filteredMissingMediaGroups).toBeDefined()
    })

    it('missingModelGroups returns total candidates regardless of selection (ErrorOverlay contract)', async () => {
      const { store, groups } = createErrorGroups()
      store.surfaceMissingModels([
        makeModel('a.safetensors', { nodeId: '1', directory: 'checkpoints' }),
        makeModel('b.safetensors', { nodeId: '2', directory: 'checkpoints' })
      ])
      await nextTick()

      // Regardless of any selection state, missingModelGroups must remain
      // the full set — ErrorOverlay reads it for the total error count
      // label and should not reflect tab-level node selection filtering.
      expect(groups.missingModelGroups.value).toHaveLength(1)
      expect(groups.missingModelGroups.value[0].models).toHaveLength(2)
    })
  })
})
