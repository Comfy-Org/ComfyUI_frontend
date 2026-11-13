import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { FrontendExecution } from '@/utils/executionUtil'

import { createDocumentHandles } from '@/platform/nodeApi/shared/documentHandles'
import type { GraphResolver } from '@/platform/nodeApi/shared/documentHandles'

import { API_VERSION, isApiVersionAtLeast } from './apiVersion'
import { createAppLifecycle } from './appLifecycle'
import type { CanvasSource } from './canvasSource'
import { createEditRunner } from './edit/editRunner'
import type { EditHistory } from './edit/editRunner'
import { createEdits } from './edit/edits'
import type { EditCore } from './edit/edits'
import { graphHandleMembers } from './edit/graphHandleMembers'
import { groupHandleMembers } from './edit/groupHandleMembers'
import { createGroupHandles } from './edit/groupHandles'
import { nodeHandleMembers } from './edit/nodeHandleMembers'
import { createSlotHandles } from './edit/slotHandles'
import { createDocuments } from './events/documents/documents'
import { createWorkflowExtra } from './events/documents/workflowExtra'
import { createWorkflowHandle } from './events/documents/workflowHandle'
import { createWorkflowImporters } from './events/documents/workflowImporters'
import type { WorkflowImporters } from './events/documents/workflowImporters'
import { createExecutingNode } from './events/executingNode'
import { createQueue } from './events/queue/queueHandle'
import type { QueueHost } from './events/queue/queueHandle'
import { isInteracting } from './events/interaction'
import { createNodeChanges } from './events/nodeChanges'
import { createNodeMoves } from './events/nodeMoves'
import { createSelectionEvents, selectedGroups } from './events/selection'
import { createViewportEvents } from './events/viewport'
import { centerOnArea, createGraphView } from './events/view/graphView'
import { nodeViewMembers } from './events/view/nodeView'
import { createDefRegistry } from './defs/defRegistry'
import type { NodeTypeHooks } from './defs/defRegistry'
import { createFrontendExecution } from './execution/frontendExecution'
import { createGraphHandle } from './graphHandle'
import { createGraphScopes } from './graphScopeHandle'
import { createNodeHandles } from './nodeHandle'
import type { Comfy } from './types'
import { createBackendHandle } from './utilities/backendHandle'
import { createCommandsHandle } from './utilities/commandsHandle'
import { createModelsHandle } from './utilities/modelsHandle'
import { createSettingsHandle } from './utilities/settingsHandle'
import { createStorageHandle } from './utilities/storageHandle'
import { createWidgetCollections } from './widgets/widgetCollection'

/** What the host supplies. */
export interface ComfyApiServices {
  /** The graph on screen: the root graph, or the subgraph the user is in. */
  getGraph(): LGraph | null
  /** The open document's undo history; without it an edit is no undo step. */
  history?(): EditHistory | undefined
  /** The canvas, once the renderer has supplied it. */
  canvas?(): CanvasSource | undefined
  /** True while the host loads or restores a graph, when a widget's commit is part of the load. */
  isLoading?(): boolean
}

/** What the host drives. A pack never sees this. */
export interface ComfyApiHost {
  /** Tells packs the app is set up. */
  markReady(): void
  /**
   * Retires every handle, just before the graph is configured from a saved
   * document. Not for undo or redo, which rebuild the document that is open.
   */
  beginDocument(): void
  /** Retires each handle whose entity an undo or redo removed. */
  afterHistoryRestore(): void
  /** The extension through which the host tells the API about node types. */
  readonly nodeTypeHooks: NodeTypeHooks
  /** Puts back the colors packs gave their types, after a palette cleared them. */
  reapplyTypeColors(): void
  /** Tells packs a workflow finished loading, or an undo or redo restored one. */
  workflowLoaded(): void
  /** What `queuePrompt` tells the queue. */
  readonly queue: QueueHost
  /** `found` if it holds a workflow; otherwise what a pack's importer reads from `file`. */
  importWorkflowFile: WorkflowImporters['importUnreadFile']
  /** What the prompt builder asks of the API. */
  readonly frontendExecution: FrontendExecution
  /** Gives a preview the server sent for the node with `executionId` to packs. */
  deliverPreview(rootGraph: LGraph, executionId: string, blob: Blob): void
}

/** The published API, the host's side of it, and the edit core every node, slot, link, group and graph edit runs through. */
export interface ComfyApi {
  comfy: Comfy
  host: ComfyApiHost
  /** Not published (ADR-EXTENSIONS-NODE-API-0073 decision 1); the core's own tests drive it. */
  edit: EditCore
}

export function createComfyApi(services: ComfyApiServices): ComfyApi {
  const lifecycle = createAppLifecycle()
  const handles = createDocumentHandles()
  const canvas = () => services.canvas?.()
  const widgets = createWidgetCollections(
    handles,
    createEditRunner(() => services.history?.()),
    () => services.isLoading?.() ?? false
  )
  const nodes = createNodeHandles(handles, (handle) => ({
    ...nodeHandleMembers(handle, edit, nodes, slots),
    ...nodeViewMembers(handle, nodes, canvas),
    widgets: widgets.widgetsOf(() => nodes.locator(handle)?.())
  }))
  const slots = createSlotHandles(handles, nodes, () => edit)
  const groups = createGroupHandles(
    handles,
    nodes,
    (handle) => groupHandleMembers(handle, edit),
    (graph, area) => centerOnArea(canvas, graph, area)
  )
  const { groupsOf } = groups
  const scopes = createGraphScopes(handles, nodes, (resolveGraph) => ({
    groups: () => {
      const graph = resolveGraph()
      return graph && groupsOf(graph)
    },
    resolvedSupplies: () => suppliesIn(resolveGraph)
  }))
  const edit = createEdits(nodes, scopes, slots, groups, () =>
    services.history?.()
  )
  const definitions = createDefRegistry(nodes, widgets.widgetTypes)
  const visibleGraph = () => canvas()?.visibleGraph() ?? null
  const moves = createNodeMoves(nodes, canvas)
  const executing = createExecutingNode(nodes, services.getGraph)
  const documents = createDocuments()
  const importers = createWorkflowImporters()
  const queue = createQueue(nodes)
  const execution = createFrontendExecution(
    definitions.resolvers,
    definitions.nodeHooks
  )
  const suppliesIn = (resolveGraph: GraphResolver) => {
    const graph = resolveGraph()
    return graph && execution.resolvedSupplies(graph)
  }

  const comfy = Object.freeze({
    getApiVersion: () => API_VERSION,
    isApiVersionAtLeast,
    onReady: lifecycle.onReady,
    onNodeChanged: createNodeChanges(nodes, visibleGraph),
    onNodeMoved: moves.onNodeMoved,
    onNodeDragEnd: moves.onNodeDragEnd,
    isInteracting: () => isInteracting(canvas()),
    onViewportChanged: createViewportEvents(canvas),
    onSelectionChanged: createSelectionEvents(nodes, visibleGraph),
    executingNode: executing.executingNode,
    executionNode: executing.executionNode,
    onExecutingNodeChanged: executing.onExecutingNodeChanged,
    onWorkflowLoaded: documents.onWorkflowLoaded,
    onDocumentActivated: documents.onDocumentActivated,
    onDocumentClosed: documents.onDocumentClosed,
    workflow: createWorkflowHandle(
      documents.current,
      importers,
      services.getGraph,
      createWorkflowExtra(
        documents.changeTrackerOf,
        services.getGraph,
        edit.batch
      )
    ),
    queue: queue.queue,
    defs: definitions.defs,

    graph: createGraphHandle(
      nodes,
      scopes.scopeFor,
      services.getGraph,
      (visible) => ({
        ...graphHandleMembers(visible, scopes.scopeFor, edit, groupsOf),
        ...createGraphView(nodes, visible, canvas),
        groupSelection: () => selectedGroups(groupsOf, visible()),
        resolvedSupplies: () => suppliesIn(visible) ?? Object.freeze([])
      })
    ),
    settings: createSettingsHandle(),
    storage: createStorageHandle(),
    commands: createCommandsHandle(),
    backend: createBackendHandle(),
    models: createModelsHandle(),
    sameEntity: (a: unknown, b: unknown) => a === b && handles.owns(a)
  } satisfies Comfy)

  return {
    comfy,
    edit,
    host: {
      nodeTypeHooks: definitions.nodeTypeHooks,
      reapplyTypeColors: definitions.reapplyTypeColors,
      frontendExecution: execution.prompt,
      deliverPreview: execution.deliverPreview,
      markReady: lifecycle.markReady,
      workflowLoaded: documents.workflowLoaded,
      queue: queue.host,
      importWorkflowFile: importers.importUnreadFile,
      beginDocument: handles.beginDocument,
      afterHistoryRestore: handles.afterHistoryRestore
    }
  }
}
