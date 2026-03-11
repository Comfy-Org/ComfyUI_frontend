import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick, watch } from 'vue'

import type { UUID } from '@/lib/litegraph/src/utils/uuid'

import { useNodeDisplayStore } from '@/stores/nodeDisplayStore'
import type { NodeDisplayState } from '@/stores/nodeDisplayStore'

const GRAPH_ID = 'test-graph-id' as UUID
const GRAPH_ID_2 = 'test-graph-id-2' as UUID

function createTestState(
  id: string,
  overrides?: Partial<NodeDisplayState>
): NodeDisplayState {
  return {
    id,
    title: `Node ${id}`,
    mode: 0,
    flags: {},
    ...overrides
  }
}

describe('useNodeDisplayStore', () => {
  let store: ReturnType<typeof useNodeDisplayStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useNodeDisplayStore()
  })

  it('registerNode creates state retrievable by getNode', () => {
    const state = createTestState('n1')
    store.registerNode(GRAPH_ID, 'n1', state)

    const result = store.getNode(GRAPH_ID, 'n1')
    expect(result).toMatchObject({
      id: 'n1',
      title: 'Node n1',
      mode: 0
    })
  })

  it('updateNode merges partial updates', () => {
    store.registerNode(GRAPH_ID, 'n2', createTestState('n2'))

    store.updateNode(GRAPH_ID, 'n2', { title: 'Renamed', mode: 2 })

    expect(store.getNode(GRAPH_ID, 'n2')?.title).toBe('Renamed')
    expect(store.getNode(GRAPH_ID, 'n2')?.mode).toBe(2)
  })

  it('updateNode deduplicates when value is unchanged', () => {
    store.registerNode(GRAPH_ID, 'n3', createTestState('n3'))

    const before = store.getNode(GRAPH_ID, 'n3')
    store.updateNode(GRAPH_ID, 'n3', { title: 'Node n3', mode: 0 })
    const after = store.getNode(GRAPH_ID, 'n3')

    expect(before).toBe(after)
  })

  it('updateNode merges flags shallowly', () => {
    store.registerNode(
      GRAPH_ID,
      'n4',
      createTestState('n4', { flags: { collapsed: true, pinned: false } })
    )

    store.updateNode(GRAPH_ID, 'n4', { flags: { pinned: true } })

    const node = store.getNode(GRAPH_ID, 'n4')
    expect(node?.flags.collapsed).toBe(true)
    expect(node?.flags.pinned).toBe(true)
  })

  it('updateNode on non-existent node is a no-op', () => {
    store.updateNode(GRAPH_ID, 'ghost', { title: 'nope' })

    expect(store.getNode(GRAPH_ID, 'ghost')).toBeUndefined()
  })

  it('removeNode deletes state', () => {
    store.registerNode(GRAPH_ID, 'n5', createTestState('n5'))
    store.removeNode(GRAPH_ID, 'n5')

    expect(store.getNode(GRAPH_ID, 'n5')).toBeUndefined()
  })

  it('getNode returns undefined for non-existent nodes', () => {
    expect(store.getNode(GRAPH_ID, 'nonexistent')).toBeUndefined()
  })

  it('clearGraph removes all nodes for that graph only', () => {
    store.registerNode(GRAPH_ID, 'a', createTestState('a'))
    store.registerNode(GRAPH_ID, 'b', createTestState('b'))
    store.registerNode(GRAPH_ID_2, 'c', createTestState('c'))

    store.clearGraph(GRAPH_ID)

    expect(store.getNode(GRAPH_ID, 'a')).toBeUndefined()
    expect(store.getNode(GRAPH_ID, 'b')).toBeUndefined()
    expect(store.getNode(GRAPH_ID_2, 'c')).toBeDefined()
  })

  it('getDisplayMap returns a reactive map', async () => {
    const displayMap = store.getDisplayMap(GRAPH_ID)

    const onChange = vi.fn()
    watch(displayMap, onChange, { deep: true })

    store.registerNode(GRAPH_ID, 'r1', createTestState('r1'))
    await nextTick()

    expect(onChange).toHaveBeenCalled()
  })

  it('graph isolation: nodes in different graphs do not interfere', () => {
    store.registerNode(GRAPH_ID, 'n1', createTestState('n1'))
    store.registerNode(
      GRAPH_ID_2,
      'n1',
      createTestState('n1', { title: 'Other' })
    )

    expect(store.getNode(GRAPH_ID, 'n1')?.title).toBe('Node n1')
    expect(store.getNode(GRAPH_ID_2, 'n1')?.title).toBe('Other')

    store.removeNode(GRAPH_ID, 'n1')

    expect(store.getNode(GRAPH_ID, 'n1')).toBeUndefined()
    expect(store.getNode(GRAPH_ID_2, 'n1')?.title).toBe('Other')
  })
})
