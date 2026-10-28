import { isEqual } from 'es-toolkit'
import { defineStore, getActivePinia } from 'pinia'
import type { Pinia } from 'pinia'
import { reactive, ref } from 'vue'

import type {
  SelectableKey,
  SelectionCommand
} from '@/core/selection/selectionState'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'

type SelectionRoots = ReadonlyMap<
  RootGraphId,
  ReadonlyMap<OwningGraphId, ReadonlySet<SelectableKey>>
>

export const useSelectionStore = defineStore('selection', () => {
  const roots = reactive(
    new Map<RootGraphId, Map<OwningGraphId, Set<SelectableKey>>>()
  )
  const revision = ref(0)

  function setSelection(
    scope: GraphScope,
    selection: Set<SelectableKey>
  ): void {
    const owners = roots.get(scope.rootGraphId)
    if (owners) owners.set(scope.owningGraphId, selection)
    else
      roots.set(scope.rootGraphId, new Map([[scope.owningGraphId, selection]]))
  }

  function addSelection(
    scope: GraphScope,
    current: Set<SelectableKey> | undefined,
    key: SelectableKey
  ): boolean {
    if (current) {
      const size = current.size
      current.add(key)
      return current.size !== size
    }
    setSelection(scope, new Set([key]))
    return true
  }

  function clearSelection(current: Set<SelectableKey> | undefined): boolean {
    if (!current?.size) return false
    current.clear()
    return true
  }

  function replaceSelection(
    scope: GraphScope,
    current: Set<SelectableKey> | undefined,
    keys: readonly SelectableKey[]
  ): boolean {
    const next = new Set(keys)
    if (isEqual([...(current ?? [])], [...next])) return false
    setSelection(scope, next)
    return true
  }

  function applyCommand(scope: GraphScope, command: SelectionCommand): boolean {
    const current = roots.get(scope.rootGraphId)?.get(scope.owningGraphId)
    switch (command.type) {
      case 'selection.add':
        return addSelection(scope, current, command.key)
      case 'selection.remove':
        return current?.delete(command.key) ?? false
      case 'selection.clear':
        return clearSelection(current)
      case 'selection.replace':
        return replaceSelection(scope, current, command.keys)
    }
  }

  function apply(scope: GraphScope, command: SelectionCommand): void {
    if (applyCommand(scope, command)) revision.value++
  }

  function clearRoot(rootGraphId: RootGraphId): void {
    if (roots.delete(rootGraphId)) revision.value++
  }

  function getRevision(): number {
    return revision.value
  }

  function selectedKeys(scope: GraphScope): readonly SelectableKey[] {
    return [...(roots.get(scope.rootGraphId)?.get(scope.owningGraphId) ?? [])]
  }

  function isSelected(scope: GraphScope, key: SelectableKey): boolean {
    return (
      roots.get(scope.rootGraphId)?.get(scope.owningGraphId)?.has(key) ?? false
    )
  }

  const readonlyRoots: SelectionRoots = roots

  return {
    roots: readonlyRoots,
    apply,
    clearRoot,
    getRevision,
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

export function isSelectedIn(
  scope: GraphScope | undefined,
  key: SelectableKey
): boolean {
  return (
    scope !== undefined &&
    (selectionStore()
      .roots.get(scope.rootGraphId)
      ?.get(scope.owningGraphId)
      ?.has(key) ??
      false)
  )
}

export function setSelectedIn(
  scope: GraphScope | undefined,
  key: SelectableKey,
  selected: boolean
): void {
  if (!scope) return
  selectionStore().apply(scope, {
    type: selected ? 'selection.add' : 'selection.remove',
    key
  })
}
