import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { nodePresentationStore } from '@/renderer/core/nodePresentation/store/nodePresentationStore'
import { PresentationSource } from '@/renderer/core/nodePresentation/types'
import type {
  NodePresentationState,
  PresentationChange
} from '@/renderer/core/nodePresentation/types'

function createTestState(
  id: string,
  overrides?: Partial<NodePresentationState>
): NodePresentationState {
  return {
    id,
    title: `Node ${id}`,
    mode: 0,
    flags: {},
    ...overrides
  }
}

describe('NodePresentationStore', () => {
  beforeEach(() => {
    nodePresentationStore.clear()
    nodePresentationStore.setSource(PresentationSource.Canvas)
  })

  it('initializeNode creates state and emits create change', () => {
    const changes: PresentationChange[] = []
    const unsub = nodePresentationStore.onChange((c) => changes.push(c))

    const state = createTestState('n1')
    nodePresentationStore.initializeNode('n1', state)

    expect(nodePresentationStore.getNode('n1')).toMatchObject({
      id: 'n1',
      title: 'Node n1',
      mode: 0
    })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ type: 'create', nodeId: 'n1' })

    unsub()
  })

  it('updateNode merges partial updates and emits update changes', () => {
    nodePresentationStore.initializeNode('n2', createTestState('n2'))

    const changes: PresentationChange[] = []
    const unsub = nodePresentationStore.onChange((c) => changes.push(c))

    nodePresentationStore.updateNode('n2', {
      title: 'Renamed',
      mode: 2
    })

    expect(nodePresentationStore.getNode('n2')?.title).toBe('Renamed')
    expect(nodePresentationStore.getNode('n2')?.mode).toBe(2)
    expect(changes).toHaveLength(2)
    expect(changes[0]).toMatchObject({
      type: 'update',
      property: 'title',
      oldValue: 'Node n2',
      newValue: 'Renamed'
    })
    expect(changes[1]).toMatchObject({
      type: 'update',
      property: 'mode',
      oldValue: 0,
      newValue: 2
    })

    unsub()
  })

  it('updateNode deduplicates when value is unchanged', () => {
    nodePresentationStore.initializeNode('n3', createTestState('n3'))

    const changes: PresentationChange[] = []
    const unsub = nodePresentationStore.onChange((c) => changes.push(c))

    const versionBefore = nodePresentationStore.getVersion()
    nodePresentationStore.updateNode('n3', { title: 'Node n3', mode: 0 })

    expect(changes).toHaveLength(0)
    expect(nodePresentationStore.getVersion()).toBe(versionBefore)

    unsub()
  })

  it('removeNode deletes state and emits delete change', () => {
    nodePresentationStore.initializeNode('n4', createTestState('n4'))

    const changes: PresentationChange[] = []
    const unsub = nodePresentationStore.onChange((c) => changes.push(c))

    nodePresentationStore.removeNode('n4')

    expect(nodePresentationStore.getNode('n4')).toBeNull()
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ type: 'delete', nodeId: 'n4' })

    unsub()
  })

  it('getNode returns null for non-existent nodes', () => {
    expect(nodePresentationStore.getNode('nonexistent')).toBeNull()
  })

  it('getNodeRef returns reactive ref that updates on state changes', async () => {
    nodePresentationStore.initializeNode('n6', createTestState('n6'))

    const nodeRef = nodePresentationStore.getNodeRef('n6')
    expect(nodeRef.value?.title).toBe('Node n6')

    nodePresentationStore.updateNode('n6', { title: 'Updated' })
    await nextTick()

    expect(nodeRef.value?.title).toBe('Updated')
  })

  it('getNodeRef returns null after node removal', async () => {
    nodePresentationStore.initializeNode('n6b', createTestState('n6b'))
    const nodeRef = nodePresentationStore.getNodeRef('n6b')
    expect(nodeRef.value).not.toBeNull()

    nodePresentationStore.removeNode('n6b')
    await nextTick()

    expect(nodeRef.value).toBeNull()
  })

  it('clear removes all state', () => {
    nodePresentationStore.initializeNode('a', createTestState('a'))
    nodePresentationStore.initializeNode('b', createTestState('b'))

    nodePresentationStore.clear()

    expect(nodePresentationStore.getNode('a')).toBeNull()
    expect(nodePresentationStore.getNode('b')).toBeNull()
  })

  it('updateNode merges flags shallowly', () => {
    nodePresentationStore.initializeNode(
      'n8',
      createTestState('n8', { flags: { collapsed: true, pinned: false } })
    )

    nodePresentationStore.updateNode('n8', { flags: { pinned: true } })

    const node = nodePresentationStore.getNode('n8')
    expect(node?.flags.collapsed).toBe(true)
    expect(node?.flags.pinned).toBe(true)
  })

  it('onChange returns working unsubscribe function', () => {
    const changes: PresentationChange[] = []
    const unsub = nodePresentationStore.onChange((c) => changes.push(c))

    nodePresentationStore.initializeNode('n9', createTestState('n9'))
    expect(changes).toHaveLength(1)

    unsub()

    nodePresentationStore.initializeNode('n10', createTestState('n10'))
    expect(changes).toHaveLength(1)
  })

  it('setSource and getCurrentSource round-trip', () => {
    nodePresentationStore.setSource(PresentationSource.Vue)
    expect(nodePresentationStore.getCurrentSource()).toBe(
      PresentationSource.Vue
    )

    nodePresentationStore.setSource(PresentationSource.External)
    expect(nodePresentationStore.getCurrentSource()).toBe(
      PresentationSource.External
    )
  })

  it('updateNode respects explicit source parameter', () => {
    nodePresentationStore.initializeNode('n11', createTestState('n11'))

    const changes: PresentationChange[] = []
    const unsub = nodePresentationStore.onChange((c) => changes.push(c))

    nodePresentationStore.setSource(PresentationSource.Canvas)
    nodePresentationStore.updateNode(
      'n11',
      { title: 'External Update' },
      PresentationSource.External
    )

    expect(changes[0].source).toBe(PresentationSource.External)

    unsub()
  })

  it('updateNode on non-existent node is a no-op', () => {
    const changes: PresentationChange[] = []
    const unsub = nodePresentationStore.onChange((c) => changes.push(c))

    const versionBefore = nodePresentationStore.getVersion()
    nodePresentationStore.updateNode('ghost', { title: 'nope' })

    expect(changes).toHaveLength(0)
    expect(nodePresentationStore.getVersion()).toBe(versionBefore)

    unsub()
  })
})
