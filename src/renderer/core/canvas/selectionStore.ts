import { defineStore } from 'pinia'
import { reactive } from 'vue'

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

/**
 * Canvas selection, one insertion-ordered key list per graph scope. All
 * mutation goes through {@link apply}; everything else is derived.
 * See ADR-CANVAS-SELECTION-0028.
 */
export const useSelectionStore = defineStore('selection', () => {
  const roots = reactive(
    new Map<RootGraphId, Map<OwningGraphId, SelectionState>>()
  )

  function stateOf(scope: GraphScope): SelectionState {
    return (
      roots.get(scope.rootGraphId)?.get(scope.owningGraphId) ?? EMPTY_SELECTION
    )
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
    const created = reactive(new Map<OwningGraphId, SelectionState>())
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
    return stateOf(scope).order.includes(key)
  }

  return { apply, clearRoot, selectedKeys, isSelected }
})
