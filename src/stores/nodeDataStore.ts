import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type {
  Badges,
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

function flagPatch(
  state: NodeDataState,
  flag: keyof NonNullable<NodeDataState['flags']>,
  value: unknown
): NodeDataPatch {
  return {
    flags: {
      ...state.flags,
      [flag]: Boolean(value)
    }
  }
}

function isBadges(value: unknown): value is Badges {
  return Array.isArray(value)
}

function nodePropertyPatch(
  state: NodeDataState,
  property: string,
  newValue: unknown
): NodeDataPatch | undefined {
  switch (property) {
    case 'title':
      return { title: String(newValue) }
    case 'has_errors':
      return { hasErrors: Boolean(newValue) }
    case 'flags.collapsed':
      return flagPatch(state, 'collapsed', newValue)
    case 'flags.ghost':
      return flagPatch(state, 'ghost', newValue)
    case 'flags.pinned':
      return flagPatch(state, 'pinned', newValue)
    case 'mode':
      return { mode: typeof newValue === 'number' ? newValue : 0 }
    case 'color':
      return { color: typeof newValue === 'string' ? newValue : undefined }
    case 'bgcolor':
      return { bgcolor: typeof newValue === 'string' ? newValue : undefined }
    case 'shape':
      return { shape: typeof newValue === 'number' ? newValue : undefined }
    case 'showAdvanced':
      return { showAdvanced: Boolean(newValue) }
    case 'badges':
      return {
        badges: isBadges(newValue) ? newValue : undefined
      }
  }
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
    return graphNodeData.value.get(graphId)?.get(nodeId)
  }

  function getGraphNodes(graphId: UUID): NodeDataState[] {
    return Array.from(graphNodeData.value.get(graphId)?.values() ?? [])
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

  function patchNodeProperty(
    graphId: UUID,
    nodeId: NodeId,
    property: string,
    newValue: unknown
  ): boolean {
    const state = getNodeData(graphId, nodeId)
    if (!state) return false

    const patch = nodePropertyPatch(state, property, newValue)
    if (!patch) return false

    Object.assign(state, copyNodeDataPatch(patch))
    return true
  }

  function deleteNodeData(graphId: UUID, nodeId: NodeId): boolean {
    return graphNodeData.value.get(graphId)?.delete(nodeId) ?? false
  }

  function clearGraph(graphId: UUID): void {
    graphNodeData.value.delete(graphId)
  }

  return {
    registerNodeData,
    getNodeData,
    getGraphNodes,
    patchNodeData,
    patchNodeProperty,
    deleteNodeData,
    clearGraph
  }
})
