import { isEqual } from 'es-toolkit'
import { defineStore } from 'pinia'
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

export const useSelectionStore = defineStore('selection', () => {
  const roots = reactive(
    new Map<RootGraphId, Map<OwningGraphId, Set<SelectableKey>>>()
  )
  const revision = ref(0)

  function apply(scope: GraphScope, command: SelectionCommand): void {
    const owners = roots.get(scope.rootGraphId)
    const current = owners?.get(scope.owningGraphId)
    let next: Set<SelectableKey>
    switch (command.type) {
      case 'selection.add':
        if (current) {
          if (current.has(command.key)) return
          current.add(command.key)
          revision.value++
          return
        }
        next = new Set([command.key])
        break
      case 'selection.remove':
        if (current?.delete(command.key)) revision.value++
        return
      case 'selection.clear':
        if (!current?.size) return
        current.clear()
        revision.value++
        return
      case 'selection.replace':
        next = new Set(command.keys)
        if (isEqual([...(current ?? [])], [...next])) return
        break
    }

    if (owners) owners.set(scope.owningGraphId, next)
    else roots.set(scope.rootGraphId, new Map([[scope.owningGraphId, next]]))
    revision.value++
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

  return { apply, clearRoot, getRevision, selectedKeys, isSelected }
})
