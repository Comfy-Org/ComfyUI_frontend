import { computed } from 'vue'
import { describe, expect, it } from 'vitest'

import { toSelectableKey } from '@/core/selection/selectionState'
import { useSelectionStore } from '@/renderer/core/canvas/selectionStore'
import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { GraphScope } from '@/types/graphScopeId'

const root = toRootGraphId('root')
const rootScope: GraphScope = {
  rootGraphId: root,
  owningGraphId: toOwningGraphId('root')
}
const subgraphScope: GraphScope = {
  rootGraphId: root,
  owningGraphId: toOwningGraphId('sub')
}
const node = toSelectableKey('node', 1)
const group = toSelectableKey('group', 2)

describe('useSelectionStore', () => {
  it('keeps each graph scope independent', () => {
    const store = useSelectionStore()

    store.apply(rootScope, { type: 'selection.add', keys: [node] })
    store.apply(subgraphScope, { type: 'selection.add', keys: [group] })

    expect(store.selectedKeys(rootScope)).toEqual([node])
    expect(store.selectedKeys(subgraphScope)).toEqual([group])
    expect(store.isSelected(rootScope, group)).toBe(false)
  })

  it('reports the transition status and leaves no-ops unobservable', () => {
    const store = useSelectionStore()
    const keys = computed(() => store.selectedKeys(rootScope))
    const before = keys.value

    expect(store.apply(rootScope, { type: 'selection.clear' })).toBe('no-op')
    expect(keys.value).toBe(before)

    expect(
      store.apply(rootScope, { type: 'selection.add', keys: [node] })
    ).toBe('applied')
    expect(keys.value).toEqual([node])
  })
})
