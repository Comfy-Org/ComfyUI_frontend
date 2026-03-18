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
    replacement?: { new_node_id: string }
  } = {}
): MissingNodeType {
  return {
    type,
    nodeId: opts.nodeId ?? '1',
    isReplaceable: opts.isReplaceable ?? false,
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

describe('swapNodeGroups computed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  function getSwapNodeGroups(nodeTypes: MissingNodeType[]) {
    const store = useExecutionErrorStore()
    store.surfaceMissingNodes(nodeTypes)

    const searchQuery = ref('')
    const t = (key: string) => key
    const { swapNodeGroups } = useErrorGroups(searchQuery, t)
    return swapNodeGroups
  }

  it('returns empty array when no missing nodes', () => {
    const swap = getSwapNodeGroups([])
    expect(swap.value).toEqual([])
  })

  it('returns empty array when no nodes are replaceable', () => {
    const swap = getSwapNodeGroups([
      makeMissingNodeType('NodeA', { isReplaceable: false }),
      makeMissingNodeType('NodeB', { isReplaceable: false })
    ])
    expect(swap.value).toEqual([])
  })

  it('groups replaceable nodes by type', async () => {
    const swap = getSwapNodeGroups([
      makeMissingNodeType('OldNode', {
        nodeId: '1',
        isReplaceable: true,
        replacement: { new_node_id: 'NewNode' }
      }),
      makeMissingNodeType('OldNode', {
        nodeId: '2',
        isReplaceable: true,
        replacement: { new_node_id: 'NewNode' }
      })
    ])
    await nextTick()
    expect(swap.value).toHaveLength(1)
    expect(swap.value[0].type).toBe('OldNode')
    expect(swap.value[0].newNodeId).toBe('NewNode')
    expect(swap.value[0].nodeTypes).toHaveLength(2)
  })

  it('creates separate groups for different types', async () => {
    const swap = getSwapNodeGroups([
      makeMissingNodeType('TypeA', {
        nodeId: '1',
        isReplaceable: true,
        replacement: { new_node_id: 'NewA' }
      }),
      makeMissingNodeType('TypeB', {
        nodeId: '2',
        isReplaceable: true,
        replacement: { new_node_id: 'NewB' }
      })
    ])
    await nextTick()
    expect(swap.value).toHaveLength(2)
    expect(swap.value.map((g) => g.type)).toEqual(['TypeA', 'TypeB'])
  })

  it('sorts groups alphabetically by type', async () => {
    const swap = getSwapNodeGroups([
      makeMissingNodeType('Zebra', {
        nodeId: '1',
        isReplaceable: true,
        replacement: { new_node_id: 'NewZ' }
      }),
      makeMissingNodeType('Alpha', {
        nodeId: '2',
        isReplaceable: true,
        replacement: { new_node_id: 'NewA' }
      })
    ])
    await nextTick()
    expect(swap.value[0].type).toBe('Alpha')
    expect(swap.value[1].type).toBe('Zebra')
  })

  it('excludes string nodeType entries', async () => {
    const swap = getSwapNodeGroups([
      'StringGroupNode' as unknown as MissingNodeType,
      makeMissingNodeType('OldNode', {
        nodeId: '1',
        isReplaceable: true,
        replacement: { new_node_id: 'NewNode' }
      })
    ])
    await nextTick()
    expect(swap.value).toHaveLength(1)
    expect(swap.value[0].type).toBe('OldNode')
  })

  it('sets newNodeId to undefined when replacement is missing', async () => {
    const swap = getSwapNodeGroups([
      makeMissingNodeType('OldNode', {
        nodeId: '1',
        isReplaceable: true
        // no replacement
      })
    ])
    await nextTick()
    expect(swap.value).toHaveLength(1)
    expect(swap.value[0].newNodeId).toBeUndefined()
  })
})
