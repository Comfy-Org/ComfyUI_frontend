import { cloneDeep, isEqual } from 'es-toolkit'
import { computed } from 'vue'

import { useWidgetHistoryStore } from '@/stores/widgetHistoryStore'
import type { WidgetHistoryScope } from '@/stores/widgetHistoryStore'

interface UseWidgetValueHistoryOptions {
  scope: () => WidgetHistoryScope | null
  read: () => unknown
  apply: (value: unknown) => void
}

export function useWidgetValueHistory({
  scope,
  read,
  apply
}: UseWidgetValueHistoryOptions) {
  const store = useWidgetHistoryStore()
  let committed = cloneDeep(read())

  function syncBaseline() {
    committed = cloneDeep(read())
  }

  function discardHistory() {
    syncBaseline()
    const target = scope()
    if (target) store.forget(target)
  }

  function commit(mergeKey?: string) {
    const current = read()
    if (isEqual(current, committed)) return
    const target = scope()
    if (target) store.record(target, committed, mergeKey)
    committed = cloneDeep(current)
  }

  function travel(take: typeof store.undo) {
    const target = scope()
    const step = target ? take(target, read()) : undefined
    if (!step) return
    apply(step.value)
    committed = cloneDeep(step.value)
  }

  function undo() {
    travel(store.undo)
  }

  function redo() {
    travel(store.redo)
  }

  const canUndo = computed(() => {
    const target = scope()
    return !!target && store.canUndo(target)
  })
  const canRedo = computed(() => {
    const target = scope()
    return !!target && store.canRedo(target)
  })

  return {
    canUndo,
    canRedo,
    commit,
    syncBaseline,
    discardHistory,
    undo,
    redo
  }
}
