import { cloneDeep } from 'es-toolkit'
import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

import type { WidgetId } from '@/types/widgetId'

export const WIDGET_HISTORY_LIMIT = 10

const NODE_HISTORY_WIDGET_TYPES: ReadonlySet<string> = new Set([
  'boundingbox',
  'boundingboxes',
  'colors',
  'curve',
  'imagecrop',
  'lightinfo',
  'range',
  'videoedit'
])

export function ownsNodeHistory(widget: { type?: string }): boolean {
  return !!widget.type && NODE_HISTORY_WIDGET_TYPES.has(widget.type)
}

export interface WidgetHistoryScope {
  rootGraphId: string
  widgetId: WidgetId
}

interface WidgetHistory {
  readonly past: readonly unknown[]
  readonly future: readonly unknown[]
  readonly mergeKey?: string
  readonly baseline?: HistoryStep
}

interface HistoryStep {
  readonly value: unknown
}

const EMPTY_HISTORY: WidgetHistory = { past: [], future: [] }

function recordStep(
  history: WidgetHistory,
  previous: unknown,
  mergeKey: string | undefined
): WidgetHistory {
  if (
    mergeKey !== undefined &&
    mergeKey === history.mergeKey &&
    history.future.length === 0
  ) {
    return history
  }
  return {
    ...history,
    past: [...history.past, cloneDeep(previous)].slice(-WIDGET_HISTORY_LIMIT),
    future: [],
    mergeKey
  }
}

export const useWidgetHistoryStore = defineStore('widgetHistory', () => {
  const workflows = shallowReactive(
    new Map<string, Map<WidgetId, WidgetHistory>>()
  )

  function historyOf({ rootGraphId, widgetId }: WidgetHistoryScope) {
    return workflows.get(rootGraphId)?.get(widgetId) ?? EMPTY_HISTORY
  }

  function save(
    { rootGraphId, widgetId }: WidgetHistoryScope,
    history: WidgetHistory
  ) {
    const histories = new Map(workflows.get(rootGraphId))
    histories.set(widgetId, history)
    workflows.set(rootGraphId, histories)
  }

  function record(
    scope: WidgetHistoryScope,
    previous: unknown,
    mergeKey?: string
  ): void {
    save(scope, recordStep(historyOf(scope), previous, mergeKey))
  }

  function undo(
    scope: WidgetHistoryScope,
    current: unknown
  ): HistoryStep | undefined {
    const history = historyOf(scope)
    const { past, future } = history
    if (!past.length) return undefined
    const value = past.at(-1)
    save(scope, {
      ...history,
      mergeKey: undefined,
      past: past.slice(0, -1),
      future: [...future, cloneDeep(current)]
    })
    return { value: cloneDeep(value) }
  }

  function redo(
    scope: WidgetHistoryScope,
    current: unknown
  ): HistoryStep | undefined {
    const history = historyOf(scope)
    const { past, future } = history
    if (!future.length) return undefined
    const value = future.at(-1)
    save(scope, {
      ...history,
      mergeKey: undefined,
      past: [...past, cloneDeep(current)],
      future: future.slice(0, -1)
    })
    return { value: cloneDeep(value) }
  }

  function baselineOf(scope: WidgetHistoryScope): HistoryStep | undefined {
    return historyOf(scope).baseline
  }

  function setBaseline(scope: WidgetHistoryScope, value: unknown): void {
    save(scope, { ...historyOf(scope), baseline: { value: cloneDeep(value) } })
  }

  function canUndo(scope: WidgetHistoryScope): boolean {
    return historyOf(scope).past.length > 0
  }

  function canRedo(scope: WidgetHistoryScope): boolean {
    return historyOf(scope).future.length > 0
  }

  function retainLive(
    rootGraphId: string,
    liveWidgetIds: Pick<ReadonlySet<WidgetId>, 'has'>
  ): void {
    const histories = workflows.get(rootGraphId)
    if (!histories) return
    const kept = new Map(
      [...histories].filter(([widgetId]) => liveWidgetIds.has(widgetId))
    )
    if (kept.size === histories.size) return
    if (kept.size) workflows.set(rootGraphId, kept)
    else workflows.delete(rootGraphId)
  }

  function forget({ rootGraphId, widgetId }: WidgetHistoryScope): void {
    const histories = workflows.get(rootGraphId)
    if (!histories?.has(widgetId)) return
    const kept = new Map(histories)
    kept.delete(widgetId)
    if (kept.size) workflows.set(rootGraphId, kept)
    else workflows.delete(rootGraphId)
  }

  function clearWorkflow(rootGraphId: string): void {
    workflows.delete(rootGraphId)
  }

  return {
    record,
    undo,
    redo,
    baselineOf,
    setBaseline,
    canUndo,
    canRedo,
    retainLive,
    forget,
    clearWorkflow
  }
})
