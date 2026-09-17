import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { reportError } from '@/platform/telemetry/reportError'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { GraphScope } from '@/types/graphScopeId'
import type { RemoteMutationContext } from '@/types/graphMutationContext'
import type { NodeId } from '@/types/nodeId'
import type { WidgetValue } from '@/types/simplifiedWidget'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'

import { runMintPortsBuffered } from './mintPortWiring'

function isScalarValue(value: WidgetValue): boolean {
  return (
    value === null || ['boolean', 'number', 'string'].includes(typeof value)
  )
}

function owningGraph(rootGraph: LGraph, scope: GraphScope): LGraph | null {
  if (rootGraph.id !== scope.rootGraphId) return null
  return String(scope.owningGraphId) === String(scope.rootGraphId)
    ? rootGraph
    : (rootGraph.subgraphs.get(scope.owningGraphId) ?? null)
}

export type LiveWidgetProjectionResult =
  | { status: 'skipped' }
  | { status: 'applied'; resolvedValue: WidgetValue }
  | { status: 'rolledBack'; resolvedValue: WidgetValue }

interface LiveWidgetProjectionDeps {
  getRootGraph(): LGraph | undefined
  markDirty(): void
}

export function rebindLiveWidgetState(
  rootGraph: LGraph | undefined,
  scope: GraphScope,
  nodeId: NodeId,
  name: string
): void {
  if (!rootGraph) return
  const widget = owningGraph(rootGraph, scope)
    ?.getNodeById(nodeId)
    ?.widgets?.find((candidate) => candidate.name === name)
  const state = useWidgetValueStore().getWidget(
    widgetId(scope.rootGraphId, nodeId, name)
  )
  if (
    widget &&
    state &&
    'bindRegisteredState' in widget &&
    typeof widget.bindRegisteredState === 'function'
  ) {
    widget.type = state.type
    widget.bindRegisteredState(nodeId)
  }
}

function skipped(): LiveWidgetProjectionResult {
  return { status: 'skipped' }
}

function setBackingProperty(
  node: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue
): void {
  const property = widget.options.property
  if (!property || Object.is(node.properties[property], value)) return
  const previousValue = node.properties[property]
  node.properties[property] = value
  if (node.onPropertyChanged?.(property, value, previousValue) === false) {
    node.properties[property] = previousValue
  }
}

interface WidgetSnapshot {
  widget: IBaseWidget
  value: WidgetValue
  property?: {
    name: string
    existed: boolean
    value: WidgetValue
  }
}

function snapshotWidgets(node: LGraphNode): WidgetSnapshot[] {
  return (node.widgets ?? []).map((widget) => {
    const property = widget.options.property
    return {
      widget,
      value: widget.value,
      ...(property && {
        property: {
          name: property,
          existed: Object.hasOwn(node.properties, property),
          value: node.properties[property]
        }
      })
    }
  })
}

function setWidgetValue(
  widgetStore: ReturnType<typeof useWidgetValueStore>,
  node: LGraphNode,
  widget: IBaseWidget,
  value: WidgetValue,
  context: RemoteMutationContext
): void {
  const id = widget.widgetId
  const updatedStore = id ? widgetStore.setValue(id, value, context) : false
  if (!updatedStore || !Object.is(widget.value, value)) {
    widget.value = value
  }
  setBackingProperty(node, widget, value)
}

function restoreWidgets(
  widgetStore: ReturnType<typeof useWidgetValueStore>,
  node: LGraphNode,
  snapshots: readonly WidgetSnapshot[],
  context: RemoteMutationContext
): unknown {
  let rollbackError: unknown
  for (const snapshot of snapshots) {
    try {
      setWidgetValue(
        widgetStore,
        node,
        snapshot.widget,
        snapshot.value,
        context
      )
      if (!snapshot.property) continue
      if (snapshot.property.existed) {
        node.properties[snapshot.property.name] = snapshot.property.value
      } else {
        delete node.properties[snapshot.property.name]
      }
    } catch (error) {
      rollbackError ??= error
    }
  }
  return rollbackError
}

function recordWidgetChanges(
  widgetStore: ReturnType<typeof useWidgetValueStore>
) {
  const previousValues = new Map<WidgetId, WidgetValue>()
  const stop = widgetStore.onValueChange(({ widgetId, oldValue }) => {
    if (!previousValues.has(widgetId)) previousValues.set(widgetId, oldValue)
  })
  return { previousValues, stop }
}

function restoreRecordedWidgets(
  widgetStore: ReturnType<typeof useWidgetValueStore>,
  previousValues: ReadonlyMap<WidgetId, WidgetValue>,
  context: RemoteMutationContext
): unknown {
  let rollbackError: unknown
  for (const [id, value] of previousValues) {
    try {
      widgetStore.setValue(id, value, context)
    } catch (error) {
      rollbackError ??= error
    }
  }
  return rollbackError
}

export function applyLiveWidgetValue(
  rootGraph: LGraph | undefined,
  scope: GraphScope,
  nodeId: NodeId,
  name: string,
  value: WidgetValue,
  context: RemoteMutationContext
): LiveWidgetProjectionResult {
  if (!rootGraph) return skipped()
  const graph = owningGraph(rootGraph, scope)
  if (!graph) return skipped()
  const node = graph.getNodeById(nodeId)
  if (!node) return skipped()
  const widget = node.widgets?.find((candidate) => candidate.name === name)
  if (!widget) return skipped()
  if (
    widget.serialize === false ||
    widget.type === 'button' ||
    !isScalarValue(value)
  ) {
    return skipped()
  }

  const previousValue = widget.value
  const widgetStore = useWidgetValueStore()
  const snapshots = snapshotWidgets(node)
  const recorded = recordWidgetChanges(widgetStore)
  try {
    runMintPortsBuffered(() => {
      try {
        setWidgetValue(widgetStore, node, widget, value, context)
        widget.callback?.(value)
        node.onWidgetChanged?.(name, value, previousValue, widget)
        setBackingProperty(node, widget, widget.value)
      } catch (error) {
        const rollbackError = restoreWidgets(
          widgetStore,
          node,
          snapshots,
          context
        )
        const recordedRollbackError = restoreRecordedWidgets(
          widgetStore,
          recorded.previousValues,
          context
        )
        const cause = rollbackError ?? recordedRollbackError
        if (cause) {
          reportError(cause, {
            errorType: 'agent_live_widget_projection_rollback_failed',
            context: { nodeId, name, scope }
          })
        }
        throw error
      }
    })
  } catch (error) {
    reportError(error, {
      errorType: 'agent_live_widget_projection_failed',
      context: { nodeId, name, scope }
    })
    return { status: 'rolledBack', resolvedValue: previousValue }
  } finally {
    recorded.stop()
  }
  const resolvedValue = widget.value
  return { status: 'applied', resolvedValue }
}

export function createLiveWidgetProjection(deps: LiveWidgetProjectionDeps) {
  return {
    rebind(scope: GraphScope, nodeId: NodeId, name: string): void {
      rebindLiveWidgetState(deps.getRootGraph(), scope, nodeId, name)
    },
    setValue(
      scope: GraphScope,
      nodeId: NodeId,
      name: string,
      value: WidgetValue,
      context: RemoteMutationContext
    ): LiveWidgetProjectionResult {
      const result = applyLiveWidgetValue(
        deps.getRootGraph(),
        scope,
        nodeId,
        name,
        value,
        context
      )
      if (result.status === 'applied') deps.markDirty()
      return result
    }
  }
}
