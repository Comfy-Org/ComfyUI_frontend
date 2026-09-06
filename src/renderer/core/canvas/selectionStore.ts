import { defineStore, getActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { shallowReactive } from 'vue'

import {
  EMPTY_SELECTION,
  reduceSelection
} from '@/core/selection/selectionState'
import type {
  SelectableKey,
  SelectionCommand,
  SelectionState,
  SelectionTransition
} from '@/core/selection/selectionState'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'

type SelectionRoots = ReadonlyMap<
  RootGraphId,
  ReadonlyMap<OwningGraphId, SelectionState>
>

function stateIn(roots: SelectionRoots, scope: GraphScope): SelectionState {
  return (
    roots.get(scope.rootGraphId)?.get(scope.owningGraphId) ?? EMPTY_SELECTION
  )
}

/**
 * Canvas selection, one insertion-ordered key list per graph scope. All
 * mutation goes through {@link apply}; everything else is derived.
 * See ADR-CANVAS-SELECTION-0028.
 */
export const useSelectionStore = defineStore('selection', () => {
  const roots = shallowReactive(
    new Map<RootGraphId, Map<OwningGraphId, SelectionState>>()
  )

  function stateOf(scope: GraphScope): SelectionState {
    return stateIn(roots, scope)
  }

  function apply(
    scope: GraphScope,
    command: SelectionCommand
  ): SelectionTransition['status'] {
    const transition = reduceSelection(stateOf(scope), command)
    if (transition.status === 'applied') {
      ownersOf(scope.rootGraphId).set(scope.owningGraphId, transition.state)
    }
    return transition.status
  }

  function ownersOf(
    rootGraphId: RootGraphId
  ): Map<OwningGraphId, SelectionState> {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created = shallowReactive(new Map<OwningGraphId, SelectionState>())
    roots.set(rootGraphId, created)
    return created
  }

  function clearRoot(rootGraphId: RootGraphId): void {
    roots.delete(rootGraphId)
  }

  function selectedKeys(scope: GraphScope): readonly SelectableKey[] {
    return stateOf(scope).order
  }

  function isSelected(scope: GraphScope, key: SelectableKey): boolean {
    return stateOf(scope).members.has(key)
  }

  const readonlyRoots: SelectionRoots = roots

  return {
    roots: readonlyRoots,
    apply,
    clearRoot,
    selectedKeys,
    isSelected
  }
})

/**
 * Item `selected` accessors run once per item per frame, so they skip
 * pinia's store lookup and action wrapper: the store instance is memoized per
 * active pinia and membership is read straight from its state.
 */
type SelectionStore = ReturnType<typeof useSelectionStore>

let memoized: { pinia: Pinia | undefined; store: SelectionStore } | undefined

function selectionStore(): SelectionStore {
  const pinia = getActivePinia()
  if (memoized && memoized.pinia === pinia) return memoized.store
  memoized = { pinia, store: useSelectionStore() }
  return memoized.store
}

/** Backs an item's `selected` accessor. An item outside any graph is never selected. */
export function isSelectedIn(
  scope: GraphScope | undefined,
  key: SelectableKey
): boolean {
  return (
    scope !== undefined &&
    stateIn(selectionStore().roots, scope).members.has(key)
  )
}

/** Backs an item's `selected` setter. Writes for an item outside any graph are dropped. */
export function setSelectedIn(
  scope: GraphScope | undefined,
  key: SelectableKey,
  selected: boolean
): void {
  if (!scope) return
  selectionStore().apply(scope, {
    type: selected ? 'selection.add' : 'selection.remove',
    keys: [key]
  })
}
