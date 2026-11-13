import { cloneDeep, maxBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'

import { parseWidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

export const WIDGET_HISTORY_LIMIT = 10

const NODE_HISTORY_WIDGET_TYPES: ReadonlySet<string> = new Set([
  'boundingbox',
  'boundingboxes',
  'colors',
  'curve',
  'imagecrop',
  'lightinfo',
  'painter',
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

export type HistoryDirection = 'undo' | 'redo'

interface HistoryNode {
  rootGraphId: string
  graphId: string
  nodeId: string
}

function isOnNode(scope: WidgetHistoryScope | null, node: HistoryNode) {
  if (scope?.rootGraphId !== node.rootGraphId) return false
  const { graphId, nodeId } = parseWidgetId(scope.widgetId)
  return graphId === node.graphId && String(nodeId) === node.nodeId
}

interface WidgetHistoryTraveler {
  scope: () => WidgetHistoryScope | null
  canTravel: (direction: HistoryDirection) => boolean
  travel: (direction: HistoryDirection) => void | Promise<void>
}

interface WidgetHistory {
  readonly past: readonly StoredStep[]
  readonly future: readonly StoredStep[]
  readonly mergeKey?: string
  readonly baseline?: HistoryStep
}

interface HistoryStep {
  readonly value: unknown
}

interface StoredStep extends HistoryStep {
  readonly order: number
}

let lastHistoryOrder = 0

function nextHistoryOrder(): number {
  return ++lastHistoryOrder
}

const storedByReference = new WeakSet<object>()

/** Marks a value that widget history keeps by reference instead of copying. */
export function asHistoryReference<T extends object>(value: T): T {
  storedByReference.add(value)
  return value
}

function snapshot<T>(value: T): T {
  return typeof value === 'object' &&
    value !== null &&
    storedByReference.has(value)
    ? value
    : cloneDeep(value)
}

function storedStep(value: unknown): StoredStep {
  return { value: snapshot(value), order: nextHistoryOrder() }
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
    const merged = history.past.at(-1)
    return merged
      ? {
          ...history,
          past: [
            ...history.past.slice(0, -1),
            { ...merged, order: nextHistoryOrder() }
          ]
        }
      : history
  }
  return {
    ...history,
    past: [...history.past, storedStep(previous)].slice(-WIDGET_HISTORY_LIMIT),
    future: [],
    mergeKey
  }
}

export const useWidgetHistoryStore = defineStore('widgetHistory', () => {
  const workflows = shallowReactive(
    new Map<string, Map<WidgetId, WidgetHistory>>()
  )

  const travelers = new Set<WidgetHistoryTraveler>()

  function historyOf({ rootGraphId, widgetId }: WidgetHistoryScope) {
    return workflows.get(rootGraphId)?.get(widgetId) ?? EMPTY_HISTORY
  }

  function nextStep(scope: WidgetHistoryScope, direction: HistoryDirection) {
    const { past, future } = historyOf(scope)
    return (direction === 'undo' ? past : future).at(-1)
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
    const step = past.at(-1)
    if (!step) return undefined
    save(scope, {
      ...history,
      mergeKey: undefined,
      past: past.slice(0, -1),
      future: [...future, storedStep(current)]
    })
    return { value: snapshot(step.value) }
  }

  function redo(
    scope: WidgetHistoryScope,
    current: unknown
  ): HistoryStep | undefined {
    const history = historyOf(scope)
    const { past, future } = history
    const step = future.at(-1)
    if (!step) return undefined
    save(scope, {
      ...history,
      mergeKey: undefined,
      past: [...past, storedStep(current)],
      future: future.slice(0, -1)
    })
    return { value: snapshot(step.value) }
  }

  function baselineOf(scope: WidgetHistoryScope): HistoryStep | undefined {
    return historyOf(scope).baseline
  }

  function setBaseline(scope: WidgetHistoryScope, value: unknown): void {
    save(scope, { ...historyOf(scope), baseline: { value: snapshot(value) } })
  }

  function peek(
    scope: WidgetHistoryScope,
    direction: HistoryDirection
  ): HistoryStep | undefined {
    const step = nextStep(scope, direction)
    return step ? { value: snapshot(step.value) } : undefined
  }

  function registerTraveler(traveler: WidgetHistoryTraveler): () => void {
    travelers.add(traveler)
    return () => {
      travelers.delete(traveler)
    }
  }

  function latestTraveler(node: HistoryNode, direction: HistoryDirection) {
    return maxBy(
      [...travelers].flatMap((traveler) => {
        const scope = traveler.scope()
        const step =
          scope && isOnNode(scope, node) && traveler.canTravel(direction)
            ? nextStep(scope, direction)
            : undefined
        return step
          ? [{ order: step.order, travel: () => traveler.travel(direction) }]
          : []
      }),
      ({ order }) => order
    )
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

  function storedSteps(): { scope: WidgetHistoryScope; value: unknown }[] {
    return [...workflows].flatMap(([rootGraphId, histories]) =>
      [...histories].flatMap(([widgetId, { past, future }]) =>
        [...past, ...future].map(({ value }) => ({
          scope: { rootGraphId, widgetId },
          value
        }))
      )
    )
  }

  function dropStep(scope: WidgetHistoryScope, value: unknown): void {
    const history = historyOf(scope)
    save(scope, {
      ...history,
      past: history.past.filter((step) => step.value !== value),
      future: history.future.filter((step) => step.value !== value)
    })
  }

  return {
    record,
    undo,
    redo,
    baselineOf,
    setBaseline,
    peek,
    registerTraveler,
    latestTraveler,
    canUndo,
    canRedo,
    retainLive,
    forget,
    clearWorkflow,
    storedSteps,
    dropStep
  }
})
