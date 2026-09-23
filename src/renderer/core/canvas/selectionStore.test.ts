import { describe, expect, it } from 'vitest'
import { computed } from 'vue'

import { toSelectableKey } from '@/core/selection/selectionState'
import type {
  SelectableKey,
  SelectionCommand
} from '@/core/selection/selectionState'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'
import { toGroupId } from '@/types/groupId'
import { toNodeId } from '@/types/nodeId'

const root = toRootGraphId('root')
const rootScope: GraphScope = {
  rootGraphId: root,
  owningGraphId: toOwningGraphId('root')
}
const subgraphScope: GraphScope = {
  rootGraphId: root,
  owningGraphId: toOwningGraphId('sub')
}
const otherRootScope: GraphScope = {
  rootGraphId: toRootGraphId('other'),
  owningGraphId: toOwningGraphId('other')
}
const node = toSelectableKey('node', toNodeId(1))
const group = toSelectableKey('group', toGroupId(2))
const otherNode = toSelectableKey('node', toNodeId(3))

describe('useSelectionStore', () => {
  it.for<{
    name: string
    initial: SelectableKey[]
    command: SelectionCommand
    expected: SelectableKey[]
  }>([
    {
      name: 'add appends',
      initial: [node, group],
      command: { type: 'selection.add', key: otherNode },
      expected: [node, group, otherNode]
    },
    {
      name: 'add preserves existing order',
      initial: [node, group],
      command: { type: 'selection.add', key: node },
      expected: [node, group]
    },
    {
      name: 'remove preserves remaining order',
      initial: [node, group, otherNode],
      command: { type: 'selection.remove', key: group },
      expected: [node, otherNode]
    },
    {
      name: 'remove ignores absent keys',
      initial: [node],
      command: { type: 'selection.remove', key: group },
      expected: [node]
    },
    {
      name: 'replace deduplicates in first-occurrence order',
      initial: [node, group],
      command: {
        type: 'selection.replace',
        keys: [otherNode, group, otherNode]
      },
      expected: [otherNode, group]
    },
    {
      name: 'replace can reorder the same members',
      initial: [node, group],
      command: { type: 'selection.replace', keys: [group, node] },
      expected: [group, node]
    },
    {
      name: 'empty replace clears',
      initial: [node, group],
      command: { type: 'selection.replace', keys: [] },
      expected: []
    },
    {
      name: 'clear empties selection',
      initial: [node, group],
      command: { type: 'selection.clear' },
      expected: []
    },
    {
      name: 'clear ignores empty selection',
      initial: [],
      command: { type: 'selection.clear' },
      expected: []
    }
  ])('$name and replay is unobservable', ({ initial, command, expected }) => {
    const store = useSelectionStore()
    store.apply(rootScope, { type: 'selection.replace', keys: initial })
    const keys = computed(() => store.selectedKeys(rootScope))
    const before = keys.value

    store.apply(rootScope, command)

    expect(keys.value).toEqual(expected)
    expect(before).toEqual(initial)
    const once = keys.value
    store.apply(rootScope, command)
    expect(keys.value).toBe(once)
  })

  it('keeps each graph scope independent', () => {
    const store = useSelectionStore()

    store.apply(rootScope, { type: 'selection.add', key: node })
    store.apply(subgraphScope, { type: 'selection.add', key: group })

    expect(store.selectedKeys(rootScope)).toEqual([node])
    expect(store.selectedKeys(subgraphScope)).toEqual([group])
    expect(store.isSelected(rootScope, group)).toBe(false)
  })

  it('removing a key in one root leaves the same local id selected in another root', () => {
    const store = useSelectionStore()
    store.apply(rootScope, { type: 'selection.add', key: node })
    store.apply(otherRootScope, { type: 'selection.add', key: node })

    store.apply(rootScope, { type: 'selection.remove', key: node })

    expect(store.selectedKeys(rootScope)).toEqual([])
    expect(store.selectedKeys(otherRootScope)).toEqual([node])
  })

  it('clearRoot evicts every scope of that root only', () => {
    const store = useSelectionStore()
    store.apply(rootScope, { type: 'selection.add', key: node })
    store.apply(subgraphScope, { type: 'selection.add', key: group })
    store.apply(otherRootScope, { type: 'selection.add', key: node })

    store.clearRoot(root)

    expect(store.selectedKeys(rootScope)).toEqual([])
    expect(store.selectedKeys(subgraphScope)).toEqual([])
    expect(store.selectedKeys(otherRootScope)).toEqual([node])
  })

  it('leaves an identical replacement unobservable', () => {
    const store = useSelectionStore()
    store.apply(rootScope, { type: 'selection.replace', keys: [node, group] })
    const keys = computed(() => store.selectedKeys(rootScope))
    const before = keys.value

    store.apply(rootScope, {
      type: 'selection.replace',
      keys: [node, group, node]
    })

    expect(keys.value).toBe(before)
  })
})
