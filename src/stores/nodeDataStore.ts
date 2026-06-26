import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type {
  NodeDataPatch,
  NodeDataState,
  NodeDataStateInit,
  SafeWidgetData
} from '@/types/nodeData'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

function copyWidgets(
  widgets: SafeWidgetData[] | undefined
): SafeWidgetData[] | undefined {
  return widgets?.map((widget) => ({
    ...widget,
    options: widget.options ? { ...widget.options } : undefined,
    slotMetadata: widget.slotMetadata ? { ...widget.slotMetadata } : undefined
  }))
}

function copyNodeData(nodeId: NodeId, data: NodeDataStateInit): NodeDataState {
  return {
    ...data,
    id: nodeId,
    badges: data.badges ? [...data.badges] : undefined,
    flags: data.flags ? { ...data.flags } : undefined,
    inputs: data.inputs ? [...data.inputs] : undefined,
    outputs: data.outputs ? [...data.outputs] : undefined,
    widgets: copyWidgets(data.widgets)
  }
}

function copyNodeDataPatch(patch: NodeDataPatch): NodeDataPatch {
  const copied = { ...patch }
  if ('badges' in patch)
    copied.badges = patch.badges ? [...patch.badges] : undefined
  if ('flags' in patch)
    copied.flags = patch.flags ? { ...patch.flags } : undefined
  if ('inputs' in patch)
    copied.inputs = patch.inputs ? [...patch.inputs] : undefined
  if ('outputs' in patch)
    copied.outputs = patch.outputs ? [...patch.outputs] : undefined
  if ('widgets' in patch) copied.widgets = copyWidgets(patch.widgets)
  return copied
}

export const useNodeDataStore = defineStore('nodeData', () => {
  const graphNodeData = ref(new Map<UUID, Map<NodeId, NodeDataState>>())

  function getGraphNodeDataMap(graphId: UUID): Map<NodeId, NodeDataState> {
    const nodeData = graphNodeData.value.get(graphId)
    if (nodeData) return nodeData

    const nextNodeData = reactive(new Map<NodeId, NodeDataState>())
    graphNodeData.value.set(graphId, nextNodeData)
    return nextNodeData
  }

  function registerNodeData(
    graphId: UUID,
    nodeId: NodeId,
    init: NodeDataStateInit
  ): NodeDataState {
    const nodeData = getGraphNodeDataMap(graphId)
    const existing = nodeData.get(nodeId)
    if (existing) return existing

    nodeData.set(nodeId, copyNodeData(nodeId, init))
    return nodeData.get(nodeId) as NodeDataState
  }

  function getNodeData(
    graphId: UUID,
    nodeId: NodeId
  ): NodeDataState | undefined {
    return getGraphNodeDataMap(graphId).get(nodeId)
  }

  function patchNodeData(
    graphId: UUID,
    nodeId: NodeId,
    patch: NodeDataPatch
  ): boolean {
    const state = getNodeData(graphId, nodeId)
    if (!state) return false

    Object.assign(state, copyNodeDataPatch(patch))
    return true
  }

  function deleteNodeData(graphId: UUID, nodeId: NodeId): boolean {
    return getGraphNodeDataMap(graphId).delete(nodeId)
  }

  function clearGraph(graphId: UUID): void {
    graphNodeData.value.delete(graphId)
  }

  return {
    registerNodeData,
    getNodeData,
    patchNodeData,
    deleteNodeData,
    getGraphNodeDataMap,
    clearGraph
  }
})
