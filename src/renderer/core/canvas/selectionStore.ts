import { isEqual } from 'es-toolkit'
import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type {
  SelectableKey,
  SelectionCommand
} from '@/core/selection/selectionState'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'

export const useSelectionStore = defineStore('selection', () => {
  const roots = reactive(
    new Map<RootGraphId, Map<OwningGraphId, Set<SelectableKey>>>()
  )

  function apply(scope: GraphScope, command: SelectionCommand): void {
    const owners = roots.get(scope.rootGraphId)
    const current = owners?.get(scope.owningGraphId)
    let next: Set<SelectableKey>
    switch (command.type) {
      case 'selection.add':
        if (current) {
          current.add(command.key)
          return
        }
        next = new Set([command.key])
        break
      case 'selection.remove':
        current?.delete(command.key)
        return
      case 'selection.clear':
        current?.clear()
        return
      case 'selection.replace':
        next = new Set(command.keys)
        if (isEqual([...(current ?? [])], [...next])) return
        break
    }

    if (owners) owners.set(scope.owningGraphId, next)
    else roots.set(scope.rootGraphId, new Map([[scope.owningGraphId, next]]))
  }

  function clearRoot(rootGraphId: RootGraphId): void {
    roots.delete(rootGraphId)
  }

  function selectedKeys(scope: GraphScope): readonly SelectableKey[] {
    return [...(roots.get(scope.rootGraphId)?.get(scope.owningGraphId) ?? [])]
  }

  function isSelected(scope: GraphScope, key: SelectableKey): boolean {
    return (
      roots.get(scope.rootGraphId)?.get(scope.owningGraphId)?.has(key) ?? false
    )
  }

  return { apply, clearRoot, selectedKeys, isSelected }
})
