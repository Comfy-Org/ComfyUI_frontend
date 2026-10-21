import { cloneDeep, isEqual } from 'es-toolkit'
import { computed, nextTick } from 'vue'

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

  function baseline(target: WidgetHistoryScope | null) {
    const shared = target ? store.baselineOf(target) : undefined
    return shared ? shared.value : committed
  }

  function adopt(target: WidgetHistoryScope | null, value: unknown) {
    committed = cloneDeep(value)
    if (target) store.setBaseline(target, value)
  }

  function syncBaseline() {
    adopt(scope(), read())
  }

  function discardHistory() {
    const target = scope()
    if (target) store.forget(target)
    adopt(target, read())
  }

  function commit(mergeKey?: string) {
    const target = scope()
    const current = read()
    const previous = baseline(target)
    if (isEqual(current, previous)) return
    if (target) store.record(target, previous, mergeKey)
    adopt(target, current)
  }

  function travel(take: typeof store.undo) {
    const target = scope()
    const step = target ? take(target, read()) : undefined
    if (!step) return
    apply(step.value)
    adopt(target, step.value)
    void nextTick(syncBaseline)
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
