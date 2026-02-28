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

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
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

import { useExecutionErrorStore } from '@/stores/executionErrorStore'
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
        makeMissingNodeType('UnknownNode', { nodeId: '1' }),
        makeMissingNodeType('AnotherUnknown', { nodeId: '2' })
      ])
      await nextTick()

      expect(groups.missingPackGroups.value).toHaveLength(1)
      expect(groups.missingPackGroups.value[0].packId).toBeNull()
      expect(groups.missingPackGroups.value[0].nodeTypes).toHaveLength(2)
    })

    it('sorts groups alphabetically with null packId last', async () => {
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'zebra-pack' }),
        makeMissingNodeType('NodeB', { nodeId: '2' }),
        makeMissingNodeType('NodeC', { cnrId: 'alpha-pack', nodeId: '3' })
      ])
      await nextTick()

      const packIds = groups.missingPackGroups.value.map((g) => g.packId)
      expect(packIds).toEqual(['alpha-pack', 'zebra-pack', null])
    })

    it('sorts nodeTypes within each group alphabetically by type then nodeId', async () => {
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
        'StringGroupNode' as unknown as MissingNodeType
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' })
      ])
      await nextTick()

      const missingGroup = groups.allErrorGroups.value.find(
        (g) => g.type === 'missing_node'
      )
      expect(missingGroup).toBeDefined()
    })

    it('includes swap_nodes group when replaceable nodes exist', async () => {
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
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
      const { store, groups } = createErrorGroups()
      store.setMissingNodeTypes([
        makeMissingNodeType('NodeA', { cnrId: 'pack-1' })
      ])
      await nextTick()

      expect(groups.groupedErrorMessages.value.length).toBeGreaterThan(0)
    })
  })

  describe('collapseState', () => {
    it('returns a reactive object', () => {
      const { groups } = createErrorGroups()
      expect(groups.collapseState).toBeDefined()
      expect(typeof groups.collapseState).toBe('object')
    })
  })
})
