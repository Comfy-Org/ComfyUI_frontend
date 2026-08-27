import { useDebounceFn } from '@vueuse/core'
import _ from 'es-toolkit/compat'

import { assert } from '@/base/assert'
import { LAYER_EDITOR_DIALOG_KEY } from '@/renderer/extensions/layerEditor/composables/layerEditorDialog'
import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { useDialogStore } from '@/stores/dialogStore'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useQueueSettingsStore } from '@/stores/queueSettingsStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'
import { serializeNodeId } from '@/types/nodeId'
import type { SerializedNodeId } from '@/types/nodeId'
import { isModalOpen } from '@/utils/modalUtil'

import { api } from './api'
import type { ComfyApp } from './app'
import { app } from './app'

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function isActiveTracker(tracker: ChangeTracker): boolean {
  return useWorkflowStore().activeWorkflow?.changeTracker === tracker
}

function isAutoQueueOnChange(): boolean {
  return (
    useQueueSettingsStore().mode === 'change' ||
    (app.ui.autoQueueEnabled === true && app.ui.autoQueueMode === 'change')
  )
}

const nonExecutionGraphProperties = new Set([
  'id',
  'revision',
  'last_node_id',
  'last_link_id',
  'state',
  'groups',
  'config',
  'extra',
  'version',
  'models',
  'reroutes',
  'floatingLinks',
  'subgraphs',
  'definitions',
  'name',
  'description',
  'category',
  'essentials_category'
])

const nonExecutionNodeProperties = new Set([
  'pos',
  'size',
  // Node flags, including skip_repeated_outputs, only affect the editor.
  'flags',
  'order',
  'color',
  'bgcolor',
  'boxcolor',
  'shape',
  'showAdvanced',
  'title'
])

const nonExecutionSlotProperties = new Set([
  'localized_name',
  'label',
  'shape',
  'color_off',
  'color_on',
  'pos',
  'link',
  'links',
  'linkIds',
  'slot_index'
])

const nonExecutionBoundaryNodeProperties = new Set(['bounding', 'pinned'])

type IsLayoutOnlyNodeType = (nodeType: string) => boolean

interface SubgraphHostProjection {
  layoutOnlyInputNames: ReadonlySet<string>
  layoutOnlyInputIndices: ReadonlySet<number>
  layoutOnlyLegacyWidgetNames: ReadonlySet<string>
  layoutOnlyLegacyWidgetIndices: ReadonlySet<number>
}

interface LinkEndpoints {
  originId: SerializedNodeId | null
  originSlot: unknown
  targetId: SerializedNodeId | null
  targetSlot: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function omitProperties(
  record: Record<string, unknown>,
  properties: ReadonlySet<string>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !properties.has(key))
  )
}

function getExecutionSlotState(value: unknown): unknown {
  const slot = asRecord(value)
  return slot ? omitProperties(slot, nonExecutionSlotProperties) : value
}

function getExecutionNodeState(
  value: unknown,
  subgraphHostProjections: ReadonlyMap<string, SubgraphHostProjection>
): unknown {
  const node = asRecord(value)
  if (!node) return value

  const executionNode = omitProperties(node, nonExecutionNodeProperties)
  const projection =
    typeof node.type === 'string'
      ? subgraphHostProjections.get(node.type)
      : undefined
  if ('id' in node) {
    executionNode.id = normalizeNodeId(node.id)
  }
  if (Array.isArray(node.inputs)) {
    executionNode.inputs = node.inputs
      .filter((input, index) => {
        if (!projection) return true
        const name = asRecord(input)?.name
        return !(
          projection.layoutOnlyInputIndices.has(index) ||
          (typeof name === 'string' &&
            projection.layoutOnlyInputNames.has(name))
        )
      })
      .map(getExecutionSlotState)
  }
  if (Array.isArray(node.outputs)) {
    executionNode.outputs = node.outputs.map(getExecutionSlotState)
  }
  if (projection) {
    const promotedWidgetNames = Array.isArray(node.inputs)
      ? node.inputs.flatMap((value) => {
          const input = asRecord(value)
          if (!input || !asRecord(input.widget)) return []
          return typeof input.name === 'string' ? [input.name] : []
        })
      : []
    const layoutOnlyWidgetNames =
      promotedWidgetNames.length > 0
        ? projection.layoutOnlyInputNames
        : projection.layoutOnlyLegacyWidgetNames
    const namedValues = asRecord(node.widgets_values_named)
    if (namedValues) {
      const projectedNamedValues = Object.fromEntries(
        Object.entries(namedValues).filter(
          ([name]) => !layoutOnlyWidgetNames.has(name)
        )
      )
      if (Object.keys(projectedNamedValues).length > 0) {
        executionNode.widgets_values_named = projectedNamedValues
      } else {
        delete executionNode.widgets_values_named
      }
    }
    if (Array.isArray(node.widgets_values)) {
      const omittedIndices = new Set<number>()
      for (const [index, name] of promotedWidgetNames.entries()) {
        if (projection.layoutOnlyInputNames.has(name)) {
          omittedIndices.add(index)
        }
      }
      if (promotedWidgetNames.length === 0) {
        for (const index of projection.layoutOnlyLegacyWidgetIndices) {
          omittedIndices.add(index)
        }
      }
      const projectedWidgetValues = node.widgets_values.filter(
        (_value, index) => !omittedIndices.has(index)
      )
      if (projectedWidgetValues.length > 0) {
        executionNode.widgets_values = projectedWidgetValues
      } else {
        delete executionNode.widgets_values
      }
    }
  }
  return executionNode
}

function getExecutionBoundaryNodeState(value: unknown): unknown {
  const node = asRecord(value)
  if (!node) return value

  const executionNode = omitProperties(node, nonExecutionBoundaryNodeProperties)
  if ('id' in node) {
    executionNode.id = normalizeNodeId(node.id)
  }
  return executionNode
}

function remapSlotIndex(
  value: unknown,
  omittedIndices?: ReadonlySet<number>
): unknown {
  const index = normalizeSlotIndex(value)
  if (typeof index !== 'number' || !omittedIndices) return index

  let removedBefore = 0
  for (const omittedIndex of omittedIndices) {
    if (omittedIndex < index) removedBefore += 1
  }
  return index - removedBefore
}

function getLinkEndpoints(value: unknown): LinkEndpoints {
  const link = asRecord(value)
  return {
    originId: asSerializedNodeId(
      Array.isArray(value) ? value[1] : link?.origin_id
    ),
    originSlot: Array.isArray(value) ? value[2] : link?.origin_slot,
    targetId: asSerializedNodeId(
      Array.isArray(value) ? value[3] : link?.target_id
    ),
    targetSlot: Array.isArray(value) ? value[4] : link?.target_slot
  }
}

function getExecutionLinkState(
  value: unknown,
  hostInputIndices: ReadonlyMap<SerializedNodeId, ReadonlySet<number>>,
  inputNodeId: SerializedNodeId | null,
  layoutOnlyInputIndices: ReadonlySet<number>
): unknown {
  const { originId, originSlot, targetId, targetSlot } = getLinkEndpoints(value)
  const projectedOriginSlot =
    originId !== null && originId === inputNodeId
      ? remapSlotIndex(originSlot, layoutOnlyInputIndices)
      : normalizeSlotIndex(originSlot)
  const projectedTargetSlot =
    targetId !== null
      ? remapSlotIndex(targetSlot, hostInputIndices.get(targetId))
      : normalizeSlotIndex(targetSlot)

  if (Array.isArray(value)) {
    return [
      normalizeNodeId(value[1]),
      projectedOriginSlot,
      normalizeNodeId(value[3]),
      projectedTargetSlot
    ]
  }

  const link = asRecord(value)
  if (!link) return value
  return [
    normalizeNodeId(link.origin_id),
    projectedOriginSlot,
    normalizeNodeId(link.target_id),
    projectedTargetSlot
  ]
}

function asSerializedNodeId(value: unknown): SerializedNodeId | null {
  return typeof value === 'number' || typeof value === 'string'
    ? serializeNodeId(value)
    : null
}

function normalizeNodeId(value: unknown): unknown {
  return asSerializedNodeId(value) ?? value
}

function normalizeSlotIndex(value: unknown): unknown {
  if (typeof value !== 'string') return value

  const index = parseInt(value)
  return Number.isNaN(index) ? value : index
}

function isExecutableNodeState(
  value: unknown,
  isLayoutOnlyNodeType: IsLayoutOnlyNodeType
): boolean {
  const node = asRecord(value)
  return (
    !node || typeof node.type !== 'string' || !isLayoutOnlyNodeType(node.type)
  )
}

function getLayoutOnlyNodeIds(
  nodes: unknown[],
  isLayoutOnlyNodeType: IsLayoutOnlyNodeType
): Set<SerializedNodeId> {
  const nodeIds = new Set<SerializedNodeId>()
  for (const value of nodes) {
    const node = asRecord(value)
    if (!node || typeof node.type !== 'string') continue
    if (!isLayoutOnlyNodeType(node.type)) continue
    const nodeId = asSerializedNodeId(node.id)
    if (nodeId !== null) nodeIds.add(nodeId)
  }
  return nodeIds
}

function isIncidentToNode(
  value: unknown,
  nodeIds: ReadonlySet<SerializedNodeId>
): boolean {
  const link = asRecord(value)
  const originId = asSerializedNodeId(
    Array.isArray(value) ? value[1] : link?.origin_id
  )
  const targetId = asSerializedNodeId(
    Array.isArray(value) ? value[3] : link?.target_id
  )
  return (
    (originId !== null && nodeIds.has(originId)) ||
    (targetId !== null && nodeIds.has(targetId))
  )
}

function getNodeById(
  nodes: unknown[]
): Map<SerializedNodeId, Record<string, unknown>> {
  const nodesById = new Map<SerializedNodeId, Record<string, unknown>>()
  for (const value of nodes) {
    const node = asRecord(value)
    const nodeId = asSerializedNodeId(node?.id)
    if (node && nodeId !== null) nodesById.set(nodeId, node)
  }
  return nodesById
}

function isProjectedLayoutOnlyTarget(
  targetId: SerializedNodeId,
  targetSlot: unknown,
  layoutOnlyNodeIds: ReadonlySet<SerializedNodeId>,
  nodesById: ReadonlyMap<SerializedNodeId, Record<string, unknown>>,
  subgraphHostProjections: ReadonlyMap<string, SubgraphHostProjection>
): boolean {
  if (layoutOnlyNodeIds.has(targetId)) return true

  const targetNode = nodesById.get(targetId)
  if (!targetNode || typeof targetNode.type !== 'string') return false
  const projection = subgraphHostProjections.get(targetNode.type)
  const slotIndex = normalizeSlotIndex(targetSlot)
  if (!projection || typeof slotIndex !== 'number') return false
  const input = Array.isArray(targetNode.inputs)
    ? asRecord(targetNode.inputs[slotIndex])
    : null
  return (
    projection.layoutOnlyInputIndices.has(slotIndex) ||
    (typeof input?.name === 'string' &&
      projection.layoutOnlyInputNames.has(input.name))
  )
}

function getSubgraphHostProjection(
  value: unknown,
  isLayoutOnlyNodeType: IsLayoutOnlyNodeType,
  subgraphHostProjections: ReadonlyMap<string, SubgraphHostProjection>
): SubgraphHostProjection | null {
  const subgraph = asRecord(value)
  if (!subgraph || !Array.isArray(subgraph.nodes)) return null

  const nodesById = getNodeById(subgraph.nodes)
  const layoutOnlyNodeIds = getLayoutOnlyNodeIds(
    subgraph.nodes,
    isLayoutOnlyNodeType
  )

  const layoutOnlyInputNames = new Set<string>()
  const layoutOnlyInputIndices = new Set<number>()
  const layoutOnlyLegacyWidgetNames = new Set<string>()
  const layoutOnlyLegacyWidgetIndices = new Set<number>()
  if (Array.isArray(subgraph.widgets)) {
    for (const [index, value] of subgraph.widgets.entries()) {
      const widget = asRecord(value)
      const nodeId = asSerializedNodeId(widget?.id)
      if (
        nodeId === null ||
        !layoutOnlyNodeIds.has(nodeId) ||
        typeof widget?.name !== 'string'
      ) {
        continue
      }
      layoutOnlyLegacyWidgetNames.add(widget.name)
      layoutOnlyLegacyWidgetIndices.add(index)
    }
  }

  const inputNodeId = asSerializedNodeId(asRecord(subgraph.inputNode)?.id)
  if (
    inputNodeId !== null &&
    Array.isArray(subgraph.inputs) &&
    Array.isArray(subgraph.links)
  ) {
    for (const [inputIndex, value] of subgraph.inputs.entries()) {
      const input = asRecord(value)
      if (!input || typeof input.name !== 'string') continue
      const targets = subgraph.links.flatMap((value) => {
        const { originId, originSlot, targetId, targetSlot } =
          getLinkEndpoints(value)
        if (
          originId !== inputNodeId ||
          normalizeSlotIndex(originSlot) !== inputIndex
        ) {
          return []
        }
        return targetId === null ? [] : [{ targetId, targetSlot }]
      })
      if (
        targets.every(({ targetId, targetSlot }) =>
          isProjectedLayoutOnlyTarget(
            targetId,
            targetSlot,
            layoutOnlyNodeIds,
            nodesById,
            subgraphHostProjections
          )
        )
      ) {
        layoutOnlyInputNames.add(input.name)
        layoutOnlyInputIndices.add(inputIndex)
      }
    }
  }

  return layoutOnlyInputNames.size > 0 || layoutOnlyLegacyWidgetNames.size > 0
    ? {
        layoutOnlyInputNames,
        layoutOnlyInputIndices,
        layoutOnlyLegacyWidgetNames,
        layoutOnlyLegacyWidgetIndices
      }
    : null
}

function projectionsEqual(
  first: SubgraphHostProjection | undefined,
  second: SubgraphHostProjection | null
): boolean {
  if (!first || !second) return first === undefined && second === null
  const setsEqual = <T>(a: ReadonlySet<T>, b: ReadonlySet<T>) =>
    a.size === b.size && [...a].every((value) => b.has(value))
  return (
    setsEqual(first.layoutOnlyInputNames, second.layoutOnlyInputNames) &&
    setsEqual(first.layoutOnlyInputIndices, second.layoutOnlyInputIndices) &&
    setsEqual(
      first.layoutOnlyLegacyWidgetNames,
      second.layoutOnlyLegacyWidgetNames
    ) &&
    setsEqual(
      first.layoutOnlyLegacyWidgetIndices,
      second.layoutOnlyLegacyWidgetIndices
    )
  )
}

function collectSubgraphDefinitions(
  value: unknown,
  definitionsById: Map<string, Record<string, unknown>>
) {
  const definitions = asRecord(value)
  if (!definitions || !Array.isArray(definitions.subgraphs)) return
  for (const value of definitions.subgraphs) {
    const subgraph = asRecord(value)
    if (!subgraph || typeof subgraph.id !== 'string') continue
    definitionsById.set(subgraph.id, subgraph)
    collectSubgraphDefinitions(subgraph.definitions, definitionsById)
  }
}

function getSubgraphHostProjections(
  value: unknown,
  isLayoutOnlyNodeType: IsLayoutOnlyNodeType
): Map<string, SubgraphHostProjection> {
  const definitionsById = new Map<string, Record<string, unknown>>()
  collectSubgraphDefinitions(value, definitionsById)
  const projections = new Map<string, SubgraphHostProjection>()
  for (let pass = 0; pass < definitionsById.size; pass++) {
    let changed = false
    for (const [subgraphId, subgraph] of definitionsById) {
      const projection = getSubgraphHostProjection(
        subgraph,
        isLayoutOnlyNodeType,
        projections
      )
      const previous = projections.get(subgraphId)
      if (projectionsEqual(previous, projection)) continue
      changed = true
      if (projection) projections.set(subgraphId, projection)
      else projections.delete(subgraphId)
    }
    if (!changed) break
  }
  return projections
}

function getExecutionDefinitionsState(
  value: unknown,
  isLayoutOnlyNodeType: IsLayoutOnlyNodeType,
  subgraphHostProjections: ReadonlyMap<string, SubgraphHostProjection>
): unknown {
  const definitions = asRecord(value)
  if (!definitions || !Array.isArray(definitions.subgraphs)) return value

  return {
    ...definitions,
    subgraphs: _.sortBy(
      definitions.subgraphs,
      (subgraph) => asRecord(subgraph)?.id
    ).map((subgraph) => {
      const subgraphId = asRecord(subgraph)?.id
      return getExecutionGraphState(
        subgraph,
        isLayoutOnlyNodeType,
        subgraphHostProjections,
        typeof subgraphId === 'string'
          ? subgraphHostProjections.get(subgraphId)
          : undefined
      )
    })
  }
}

function getHostInputIndices(
  nodes: unknown[],
  subgraphHostProjections: ReadonlyMap<string, SubgraphHostProjection>
): Map<SerializedNodeId, ReadonlySet<number>> {
  const hostInputIndices = new Map<SerializedNodeId, ReadonlySet<number>>()
  for (const value of nodes) {
    const node = asRecord(value)
    const nodeId = asSerializedNodeId(node?.id)
    if (
      !node ||
      nodeId === null ||
      typeof node.type !== 'string' ||
      !Array.isArray(node.inputs)
    ) {
      continue
    }
    const projection = subgraphHostProjections.get(node.type)
    if (!projection) continue
    const omittedIndices = new Set<number>()
    for (const [index, value] of node.inputs.entries()) {
      const name = asRecord(value)?.name
      if (
        projection.layoutOnlyInputIndices.has(index) ||
        (typeof name === 'string' && projection.layoutOnlyInputNames.has(name))
      ) {
        omittedIndices.add(index)
      }
    }
    if (omittedIndices.size > 0) {
      hostInputIndices.set(nodeId, omittedIndices)
    }
  }
  return hostInputIndices
}

function isProjectedLink(
  value: unknown,
  hostInputIndices: ReadonlyMap<SerializedNodeId, ReadonlySet<number>>,
  inputNodeId: SerializedNodeId | null,
  layoutOnlyInputIndices: ReadonlySet<number>
): boolean {
  const { originId, originSlot, targetId, targetSlot } = getLinkEndpoints(value)
  const normalizedOriginSlot = normalizeSlotIndex(originSlot)
  const normalizedTargetSlot = normalizeSlotIndex(targetSlot)
  return (
    (originId !== null &&
      originId === inputNodeId &&
      typeof normalizedOriginSlot === 'number' &&
      layoutOnlyInputIndices.has(normalizedOriginSlot)) ||
    (targetId !== null &&
      typeof normalizedTargetSlot === 'number' &&
      hostInputIndices.get(targetId)?.has(normalizedTargetSlot) === true)
  )
}

function getExecutionGraphState(
  value: unknown,
  isLayoutOnlyNodeType: IsLayoutOnlyNodeType,
  inheritedSubgraphHostProjections?: ReadonlyMap<
    string,
    SubgraphHostProjection
  >,
  selfProjection?: SubgraphHostProjection
): unknown {
  const graph = asRecord(value)
  if (!graph) return value

  const executionGraph = omitProperties(graph, nonExecutionGraphProperties)
  const subgraphHostProjections =
    inheritedSubgraphHostProjections ??
    getSubgraphHostProjections(graph.definitions, isLayoutOnlyNodeType)
  const layoutOnlyInputIndices =
    selfProjection?.layoutOnlyInputIndices ?? new Set<number>()
  const inputNodeId = asSerializedNodeId(asRecord(graph.inputNode)?.id)
  const layoutOnlyNodeIds = Array.isArray(graph.nodes)
    ? getLayoutOnlyNodeIds(graph.nodes, isLayoutOnlyNodeType)
    : new Set<SerializedNodeId>()
  const hostInputIndices = Array.isArray(graph.nodes)
    ? getHostInputIndices(graph.nodes, subgraphHostProjections)
    : new Map<SerializedNodeId, ReadonlySet<number>>()
  if (Array.isArray(graph.nodes)) {
    executionGraph.nodes = _.sortBy(
      graph.nodes
        .filter((node) => isExecutableNodeState(node, isLayoutOnlyNodeType))
        .map((node) => getExecutionNodeState(node, subgraphHostProjections)),
      (node) => asRecord(node)?.id
    )
  }
  if (Array.isArray(graph.links)) {
    executionGraph.links = _.sortBy(
      graph.links
        .filter(
          (link) =>
            !isIncidentToNode(link, layoutOnlyNodeIds) &&
            !isProjectedLink(
              link,
              hostInputIndices,
              inputNodeId,
              layoutOnlyInputIndices
            )
        )
        .map((link) =>
          getExecutionLinkState(
            link,
            hostInputIndices,
            inputNodeId,
            layoutOnlyInputIndices
          )
        ),
      (link) => JSON.stringify(link)
    )
  } else if (!('links' in graph)) {
    executionGraph.links = []
  }
  if (Array.isArray(graph.inputs)) {
    executionGraph.inputs = graph.inputs
      .filter((_input, index) => !layoutOnlyInputIndices.has(index))
      .map(getExecutionSlotState)
  }
  if (Array.isArray(graph.outputs)) {
    executionGraph.outputs = graph.outputs.map(getExecutionSlotState)
  }
  if ('inputNode' in graph) {
    executionGraph.inputNode = getExecutionBoundaryNodeState(graph.inputNode)
  }
  if ('outputNode' in graph) {
    executionGraph.outputNode = getExecutionBoundaryNodeState(graph.outputNode)
  }
  if ('definitions' in graph) {
    executionGraph.definitions = getExecutionDefinitionsState(
      graph.definitions,
      isLayoutOnlyNodeType,
      subgraphHostProjections
    )
  }
  if (Array.isArray(graph.widgets)) {
    const nodesById = Array.isArray(graph.nodes)
      ? getNodeById(graph.nodes)
      : new Map<SerializedNodeId, Record<string, unknown>>()
    executionGraph.widgets = graph.widgets.filter((value) => {
      const widget = asRecord(value)
      const targetId = asSerializedNodeId(widget?.id)
      if (targetId === null || typeof widget?.name !== 'string') return true
      if (layoutOnlyNodeIds.has(targetId)) return false
      const targetNode = nodesById.get(targetId)
      if (!targetNode || typeof targetNode.type !== 'string') return true
      return !subgraphHostProjections
        .get(targetNode.type)
        ?.layoutOnlyInputNames.has(widget.name)
    })
  }
  return executionGraph
}

function executionStateChanged(
  previousState: ComfyWorkflowJSON,
  currentState: ComfyWorkflowJSON
): boolean {
  const { isLayoutOnlyNodeType } = useNodeDefStore()
  const previousExecutionState = getExecutionGraphState(
    previousState,
    isLayoutOnlyNodeType
  )
  const currentExecutionState = getExecutionGraphState(
    currentState,
    isLayoutOnlyNodeType
  )
  return !_.isEqual(previousExecutionState, currentExecutionState)
}

const reportedInactiveCalls = new Set<string>()

/**
 * Report a ChangeTracker method being called on an inactive tracker.
 * Deduplicates per method+workflow per session to avoid signal noise on hot paths.
 */
function reportInactiveTrackerCall(method: string, workflowPath: string) {
  const key = `${method}:${workflowPath}`
  if (reportedInactiveCalls.has(key)) return
  reportedInactiveCalls.add(key)
  assert(
    false,
    `ChangeTracker.${method}() called on inactive tracker for: ${workflowPath}`
  )
}

export class ChangeTracker {
  static MAX_HISTORY = 50
  /**
   * Guard flag to prevent captureCanvasState from running during loadGraphData.
   * Between rootGraph.configure() and afterLoadNewGraph(), the rootGraph
   * contains the NEW workflow's data while activeWorkflow still points to
   * the OLD workflow. Any captureCanvasState call in that window would
   * serialize the wrong graph into the old workflow's activeState, corrupting it.
   */
  static isLoadingGraph = false
  /**
   * The active state of the workflow.
   */
  activeState: ComfyWorkflowJSON
  undoQueue: ComfyWorkflowJSON[] = []
  redoQueue: ComfyWorkflowJSON[] = []
  changeCount: number = 0
  /**
   * Whether the redo/undo restoring is in progress.
   */
  _restoringState: boolean = false

  ds?: { scale: number; offset: [number, number] }
  nodeOutputs?: Record<string, ExecutedWsMessage['output']>

  private subgraphState?: {
    navigation: string[]
  }

  constructor(
    /**
     * The workflow that this change tracker is tracking
     */
    public workflow: ComfyWorkflow,
    /**
     * The initial state of the workflow
     */
    public initialState: ComfyWorkflowJSON
  ) {
    this.activeState = initialState
  }

  /**
   * Save the current state as the initial state.
   */
  reset(state?: ComfyWorkflowJSON) {
    // Do not reset the state if we are restoring.
    if (this._restoringState) return

    if (state) this.activeState = clone(state)
    this.initialState = clone(this.activeState)
  }

  store() {
    this.ds = {
      scale: app.canvas.ds.scale,
      offset: [app.canvas.ds.offset[0], app.canvas.ds.offset[1]]
    }
    this.nodeOutputs = useNodeOutputStore().snapshotOutputs()
    const navigation = useSubgraphNavigationStore().exportState()
    // Always store the navigation state, even if empty (root level)
    this.subgraphState = { navigation }
  }

  /**
   * Freeze this tracker's state before the workflow goes inactive.
   * Always calls store() to preserve viewport/outputs. Calls
   * captureCanvasState() only when not in undo/redo (to avoid
   * corrupting undo history with intermediate graph state).
   *
   * PRECONDITION: must be called while this workflow is still the active one
   * (before the activeWorkflow pointer is moved). If called after the pointer
   * has already moved, this is a no-op to avoid freezing wrong viewport data.
   *
   * @internal Not part of the public extension API.
   */
  deactivate() {
    if (!isActiveTracker(this)) {
      reportInactiveTrackerCall('deactivate', this.workflow.path)
      return
    }
    if (!this._restoringState) this.captureCanvasState()
    this.store()
  }

  /**
   * Ensure activeState is up-to-date for persistence.
   * Active workflow: flushes canvas → activeState.
   * Inactive workflow: no-op (activeState was frozen by deactivate()).
   *
   * @internal Not part of the public extension API.
   */
  prepareForSave() {
    if (isActiveTracker(this)) this.captureCanvasState()
  }

  restore() {
    if (this.ds) {
      app.canvas.ds.scale = this.ds.scale
      app.canvas.ds.offset = this.ds.offset
    }
    if (this.nodeOutputs) {
      useNodeOutputStore().restoreOutputs(this.nodeOutputs)
    }
    if (this.subgraphState) {
      const { navigation } = this.subgraphState
      const firstInvalidIndex = navigation.findIndex(
        (id) => !app.rootGraph.subgraphs.has(id)
      )
      if (firstInvalidIndex !== -1) navigation.splice(firstInvalidIndex)
      useSubgraphNavigationStore().restoreState(navigation)

      const activeId = navigation.at(-1)
      if (activeId) {
        // Navigate to the saved subgraph
        const subgraph = app.rootGraph.subgraphs.get(activeId)
        if (subgraph) {
          app.canvas.setGraph(subgraph)
        }
      } else {
        // Empty navigation array means root level
        app.canvas.setGraph(app.rootGraph)
      }
    }
  }

  updateModified(previousState?: ComfyWorkflowJSON) {
    // Get the workflow from the store as ChangeTracker is raw object, i.e.
    // `this.workflow` is not reactive.
    const workflow = useWorkflowStore().getWorkflowByPath(this.workflow.path)
    if (workflow) {
      workflow.isModified = !ChangeTracker.graphEqual(
        this.initialState,
        this.activeState
      )
    }

    const autoQueueGraphChanged =
      !!previousState &&
      isAutoQueueOnChange() &&
      executionStateChanged(previousState, this.activeState)

    api.dispatchCustomEvent('graphChanged', this.activeState)
    if (autoQueueGraphChanged) {
      api.dispatchCustomEvent('autoQueueGraphChanged')
    }
  }

  /**
   * Snapshot the current canvas state into activeState and push undo.
   * INVARIANT: only the active workflow's tracker may read from the canvas.
   * Calling this on an inactive tracker would capture the wrong graph.
   */
  captureCanvasState() {
    const isUndoRedoing = this._restoringState
    const isInsideChangeTransaction = this.changeCount > 0
    if (
      !app.graph ||
      isInsideChangeTransaction ||
      isUndoRedoing ||
      ChangeTracker.isLoadingGraph
    )
      return

    if (!isActiveTracker(this)) {
      reportInactiveTrackerCall('captureCanvasState', this.workflow.path)
      return
    }

    const currentState = clone(app.rootGraph.serialize()) as ComfyWorkflowJSON
    if (!this.activeState) {
      this.activeState = currentState
      return
    }
    if (!ChangeTracker.graphEqual(this.activeState, currentState)) {
      const previousState = this.activeState
      this.undoQueue.push(previousState)
      if (this.undoQueue.length > ChangeTracker.MAX_HISTORY) {
        this.undoQueue.shift()
      }

      this.activeState = currentState
      this.redoQueue.length = 0
      this.updateModified(previousState)
      this.squashState()
    }
  }
  squashState = useDebounceFn(() => {
    if (
      this !== useWorkflowStore().activeWorkflow?.changeTracker ||
      ChangeTracker.isLoadingGraph
    )
      return

    const currentState = clone(app.rootGraph.serialize()) as ComfyWorkflowJSON
    if (ChangeTracker.graphEqual(this.activeState, currentState)) return

    const previousState = this.activeState
    this.activeState = currentState
    this.updateModified(previousState)
  }, 50)

  /** @deprecated Use {@link captureCanvasState} instead. */
  checkState() {
    if (!ChangeTracker._checkStateWarned) {
      ChangeTracker._checkStateWarned = true
      console.warn(
        'checkState() is deprecated — use captureCanvasState() instead.'
      )
    }
    this.captureCanvasState()
  }

  private static _checkStateWarned = false

  static resetCheckStateWarningForTest() {
    ChangeTracker._checkStateWarned = false
  }

  async updateState(source: ComfyWorkflowJSON[], target: ComfyWorkflowJSON[]) {
    const prevState = source.pop()
    if (prevState) {
      const previousState = this.activeState
      target.push(previousState)
      this._restoringState = true
      try {
        await app.loadGraphData(prevState, false, false, this.workflow, {
          checkForRerouteMigration: false,
          silentAssetErrors: true
        })
        this.activeState = prevState
        this.updateModified(previousState)
      } finally {
        this._restoringState = false
      }
    }
  }

  async undo() {
    await this.updateState(this.undoQueue, this.redoQueue)
  }

  async redo() {
    await this.updateState(this.redoQueue, this.undoQueue)
  }

  async undoRedo(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toUpperCase()
      // Redo: Ctrl + Y, or Ctrl + Shift + Z
      if ((key === 'Y' && !e.shiftKey) || (key == 'Z' && e.shiftKey)) {
        await this.redo()
        return true
      } else if (key === 'Z' && !e.shiftKey) {
        await this.undo()
        return true
      }
    }
  }

  beforeChange() {
    this.changeCount++
  }

  afterChange() {
    if (!--this.changeCount) {
      this.captureCanvasState()
    }
  }

  static init() {
    const getCurrentChangeTracker = () =>
      useWorkflowStore().activeWorkflow?.changeTracker
    const captureState = () => getCurrentChangeTracker()?.captureCanvasState()
    const dialogStore = useDialogStore()

    let keyIgnored = false
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        // Do not trigger on repeat events (Holding down a key)
        // This can happen when user is holding down "Space" to pan the canvas.
        if (e.repeat) return

        // If the mask editor is opened, we don't want to trigger on key events
        const comfyApp = app.constructor as typeof ComfyApp
        if (comfyApp.maskeditor_is_opended?.()) return
        if (isModalOpen(dialogStore.dialogStack.length)) return

        // The layer editor has its own session-local undo history
        if (useDialogStore().isDialogOpen(LAYER_EDITOR_DIALOG_KEY)) return

        const activeEl = document.activeElement
        requestAnimationFrame(async () => {
          let bindInputEl: Element | null = null
          // If we are auto queue in change mode then we do want to trigger on inputs
          if (!app.ui.autoQueueEnabled || app.ui.autoQueueMode === 'instant') {
            if (
              activeEl?.tagName === 'INPUT' ||
              (activeEl && 'type' in activeEl && activeEl.type === 'textarea')
            ) {
              // Ignore events on inputs, they have their native history
              return
            }
            bindInputEl = activeEl
          }

          keyIgnored =
            e.key === 'Control' ||
            e.key === 'Shift' ||
            e.key === 'Alt' ||
            e.key === 'Meta'
          if (keyIgnored) return

          const changeTracker = getCurrentChangeTracker()
          if (!changeTracker) return

          // Check if this is a ctrl+z ctrl+y
          if (await changeTracker.undoRedo(e)) return

          // If our active element is some type of input then handle changes after they're done
          if (ChangeTracker.bindInput(bindInputEl)) return
          changeTracker.captureCanvasState()
        })
      },
      true
    )

    window.addEventListener('keyup', () => {
      if (keyIgnored) {
        keyIgnored = false
        captureState()
      }
    })

    // Handle clicking DOM elements (e.g. widgets)
    window.addEventListener('mouseup', () => {
      captureState()
    })

    // Handle prompt queue event for dynamic widget changes
    api.addEventListener('promptQueued', () => {
      captureState()
    })

    api.addEventListener('graphCleared', () => {
      captureState()
    })

    // Handle litegraph clicks
    const processMouseUp = LGraphCanvas.prototype.processMouseUp
    LGraphCanvas.prototype.processMouseUp = function (e) {
      const v = processMouseUp.apply(this, [e])
      captureState()
      return v
    }

    // Handle litegraph dialog popup for number/string widgets
    const prompt = LGraphCanvas.prototype.prompt
    LGraphCanvas.prototype.prompt = function (
      title: string,
      value: string | number,
      callback: (v: string) => void,
      event: CanvasPointerEvent
    ) {
      const extendedCallback = (v: string) => {
        callback(v)
        captureState()
      }
      return prompt.apply(this, [title, value, extendedCallback, event])
    }

    // Handle litegraph context menu for COMBO widgets
    const close = LiteGraph.ContextMenu.prototype.close
    LiteGraph.ContextMenu.prototype.close = function (e: MouseEvent) {
      const v = close.apply(this, [e])
      captureState()
      return v
    }

    // Handle multiple commands as a single transaction
    document.addEventListener('litegraph:canvas', (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.subType === 'before-change') {
        getCurrentChangeTracker()?.beforeChange()
      } else if (detail.subType === 'after-change') {
        getCurrentChangeTracker()?.afterChange()
      }
    })

    // Store node outputs
    api.addEventListener('executed', (e: CustomEvent<ExecutedWsMessage>) => {
      const detail = e.detail
      const workflow =
        useExecutionStore().queuedJobs[detail.prompt_id]?.workflow
      const changeTracker = workflow?.changeTracker
      if (!changeTracker) return
      changeTracker.nodeOutputs ??= {}
      const nodeOutputs = changeTracker.nodeOutputs
      const output = nodeOutputs[detail.node]
      if (detail.merge && output) {
        for (const k in detail.output ?? {}) {
          const v = output[k]
          if (v instanceof Array) {
            output[k] = v.concat(detail.output[k])
          } else {
            output[k] = detail.output[k]
          }
        }
      } else {
        nodeOutputs[detail.node] = detail.output
      }
    })
  }

  static bindInput(activeEl: Element | null): boolean {
    if (
      !activeEl ||
      activeEl.tagName === 'CANVAS' ||
      activeEl.tagName === 'BODY'
    ) {
      return false
    }

    for (const evt of ['change', 'input', 'blur']) {
      const htmlElement = activeEl as HTMLElement
      if (`on${evt}` in htmlElement) {
        const listener = () => {
          useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState?.()
          htmlElement.removeEventListener(evt, listener)
        }
        htmlElement.addEventListener(evt, listener)
        return true
      }
    }
    return false
  }

  static graphEqual(a: ComfyWorkflowJSON, b: ComfyWorkflowJSON) {
    if (a === b) return true

    if (typeof a == 'object' && a && typeof b == 'object' && b) {
      // Compare nodes ignoring order
      if (
        !_.isEqualWith(a.nodes, b.nodes, (arrA, arrB) => {
          if (Array.isArray(arrA) && Array.isArray(arrB)) {
            return _.isEqual(new Set(arrA), new Set(arrB))
          }
        })
      ) {
        return false
      }

      // Compare extra properties ignoring ds
      if (
        !_.isEqual(_.omit(a.extra ?? {}, ['ds']), _.omit(b.extra ?? {}, ['ds']))
      )
        return false

      // Compare other properties normally
      for (const key of [
        'links',
        'floatingLinks',
        'reroutes',
        'groups',
        'definitions',
        'subgraphs'
      ]) {
        if (!_.isEqual(a[key], b[key])) {
          return false
        }
      }

      return true
    }

    return false
  }
}
