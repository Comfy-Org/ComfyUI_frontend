import { computed, toValue } from 'vue'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { resolveWidgetView } from '@/renderer/extensions/vueNodes/widgets/resolveWidgetView'
import type { ResolvedWidgetView } from '@/renderer/extensions/vueNodes/widgets/resolveWidgetView'
import { buildSlotMetadata } from '@/renderer/extensions/vueNodes/widgets/widgetSlotMetadata'
import { useApp } from '@/scripts/appInstance'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import { executionIdFromState } from '@/utils/graphTraversalUtil'
import { mapLiveWidgetsById, resolveNode } from '@/utils/litegraphUtil'
import { parseWidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

function liveRootGraph(): LGraph | null {
  const app = useApp()
  return app.isGraphReady ? app.rootGraph : null
}

function hostSubgraphId(rootGraph: LGraph, hostNode: LGraphNode) {
  const graph = hostNode.graph
  return graph && graph !== rootGraph ? graph.id : null
}

function readSiblingWidgetValuesForUnreactiveOptionWrites(
  id: WidgetId,
  bareNodeId: NodeId
) {
  const { graphId } = parseWidgetId(id)
  useWidgetValueStore()
    .getNodeWidgets(graphId, bareNodeId)
    .forEach((sibling) => sibling.value)
}

/** Resolves a widget's view from its {@link WidgetId} alone, finding its host node in the live graph. */
export function resolveWidgetViewById(
  id: WidgetId
): ResolvedWidgetView | undefined {
  const state = useWidgetValueStore().getWidget(id)
  if (!state) return undefined
  const bareNodeId = stripGraphPrefix(state.nodeId)
  if (bareNodeId)
    readSiblingWidgetValuesForUnreactiveOptionWrites(id, bareNodeId)
  const rootGraph = liveRootGraph()
  const hostNode =
    (rootGraph && bareNodeId && resolveNode(bareNodeId, rootGraph)) || null
  if (!rootGraph || !hostNode)
    return resolveWidgetView(id, {
      rootGraph,
      hostNode: null,
      hostSubgraphId: null,
      liveWidget: undefined,
      slotInfo: undefined,
      nodeExecId: null
    })

  const subgraphId = hostSubgraphId(rootGraph, hostNode)
  return resolveWidgetView(id, {
    rootGraph,
    hostNode,
    hostSubgraphId: subgraphId,
    liveWidget: mapLiveWidgetsById(hostNode).get(id),
    slotInfo: buildSlotMetadata(
      hostNode.inputs,
      hostNode.graph,
      hostNode.id
    ).get(state.name),
    nodeExecId: executionIdFromState(rootGraph, {
      id: hostNode.id,
      graphId: subgraphId ?? rootGraph.id
    })
  })
}

function unregisteredWidgetView(id: WidgetId): ResolvedWidgetView {
  const { nodeId, name } = parseWidgetId(id)
  return {
    widgetId: id,
    state: { nodeId, name, type: '', value: undefined, options: {}, y: 0 },
    name,
    type: '',
    value: undefined,
    options: {},
    advanced: false,
    visibility: undefined,
    setValue: () => {}
  }
}

/**
 * The reactive view a widget component renders for its {@link WidgetId}.
 * Keeps the last resolved view while the widget is being removed.
 */
export function useWidgetView(
  widgetId: MaybeRefOrGetter<WidgetId>
): ComputedRef<ResolvedWidgetView> {
  return computed<ResolvedWidgetView>((previous) => {
    const id = toValue(widgetId)
    const resolved = resolveWidgetViewById(id)
    if (resolved) return resolved
    return previous?.widgetId === id ? previous : unregisteredWidgetView(id)
  })
}
