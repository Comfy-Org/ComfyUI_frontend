import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { createDocumentHandles } from '@/platform/nodeApi/shared/documentHandles'
import type { VersionHost } from '@/platform/nodeApi/shared/versionHost'

import { API_VERSION, isApiVersionAtLeast } from './apiVersion'
import { createAppLifecycle } from './appLifecycle'
import type { CanvasSource } from './canvasSource'
import { createEditRunner } from './edit/editRunner'
import type { EditHistory } from './edit/editRunner'
import { createEdits } from './edit/edits'
import type { EditCore } from './edit/edits'
import { graphHandleMembers } from './edit/graphHandleMembers'
import { createGroupHandles } from './edit/groupHandles'
import { nodeHandleMembers } from './edit/nodeHandleMembers'
import { createSlotHandles } from './edit/slotHandles'
import { createExecutingNode } from './events/executingNode'
import { isInteracting } from './events/interaction'
import { createNodeChanges } from './events/nodeChanges'
import { createNodeMoves } from './events/nodeMoves'
import { createSelectionEvents } from './events/selection'
import { createViewportEvents } from './events/viewport'
import { createDefRegistry } from './defs/defRegistry'
import type { NodeTypeHooks } from './defs/defRegistry'
import { createGraphHandle } from './graphHandle'
import { createGraphScopes } from './graphScopeHandle'
import { createNodeHandles } from './nodeHandle'
import { createPacks } from './packs'
import type { Comfy } from './types'
import { createWidgetCollections } from './widgets/widgetCollection'

export interface ComfyApiServices {
  /** The graph on screen: the root graph, or the subgraph the user is in. */
  getGraph(): LGraph | null
  /** The open document's undo history; without it an edit is no undo step. */
  history?(): EditHistory | undefined
  /** The canvas, once the renderer has supplied it. */
  canvas?(): CanvasSource | undefined
  isLoading?(): boolean
  /** The root graph of the document on screen; a handle made in another graph is retired as it is made. */
  shownRoot?(): LGraph | undefined
  /** The URL extension folders are served under, base path included; `/extensions/` of the page by default. */
  extensionsUrl?(): string
}

export interface ComfyApiHost extends Omit<VersionHost, 'publish'> {
  /** The extension through which the host tells the API about node types. */
  readonly nodeTypeHooks: NodeTypeHooks
  /** A startup of the canvas begins: `onReady` waits for its {@link VersionHost.markReady}. */
  markStarting(): void
}

export interface ComfyApi {
  comfy: Comfy
  host: ComfyApiHost
  edit: EditCore
}

export function createComfyApi(services: ComfyApiServices): ComfyApi {
  const lifecycle = createAppLifecycle()
  const handles = createDocumentHandles(() => services.shownRoot?.())
  const widgets = createWidgetCollections(
    handles,
    createEditRunner(() => services.history?.())
  )
  const nodes = createNodeHandles(handles, (handle) => ({
    ...nodeHandleMembers(handle, edit, nodes, slots),
    widgets: widgets.widgetsOf(() => nodes.locator(handle)?.())
  }))
  const slots = createSlotHandles(handles, nodes, () => edit)
  const groups = createGroupHandles(handles, nodes, (handle) => ({
    setBounds: (bounds) => edit.updateGroup(handle, { bounds }, 'setBounds')
  }))
  const { groupsOf } = groups
  const scopes = createGraphScopes(handles, nodes, (resolveGraph) => ({
    groups: () => {
      const graph = resolveGraph()
      return graph && groupsOf(graph)
    }
  }))
  const edit = createEdits(nodes, scopes, slots, groups, () =>
    services.history?.()
  )
  const packs = createPacks(
    () =>
      services.extensionsUrl?.() ??
      new URL('/extensions/', window.location.href).href
  )
  const definitions = createDefRegistry(nodes, widgets.widgetTypes, packs)
  const canvas = () => services.canvas?.()
  const visibleGraph = () => canvas()?.visibleGraph() ?? null
  const moves = createNodeMoves(nodes, canvas)
  const executing = createExecutingNode(nodes, services.getGraph)

  const comfy = Object.freeze({
    getApiVersion: () => API_VERSION,
    isApiVersionAtLeast,
    registerPack: packs.registerPack,
    onReady: lifecycle.onReady,
    onNodeChanged: createNodeChanges(nodes, visibleGraph),
    onNodeMoved: moves.onNodeMoved,
    onNodeDragEnd: moves.onNodeDragEnd,
    isInteracting: () => isInteracting(canvas()),
    onViewportChanged: createViewportEvents(canvas),
    onSelectionChanged: createSelectionEvents(nodes, canvas),
    executingNode: executing.executingNode,
    executionNode: executing.executionNode,
    onExecutingNodeChanged: executing.onExecutingNodeChanged,
    defs: definitions.defs,

    graph: createGraphHandle(
      nodes,
      scopes.scopeFor,
      services.getGraph,
      handles.rebuilds,
      (visible) => graphHandleMembers(visible, scopes.scopeFor, edit, groupsOf)
    ),
    sameEntity: (a: unknown, b: unknown) => a === b && handles.owns(a)
  } satisfies Comfy)

  return {
    comfy,
    edit,
    host: {
      nodeTypeHooks: definitions.nodeTypeHooks,
      reapplyTypeColors: definitions.reapplyTypeColors,
      markStarting: lifecycle.markStarting,
      markReady: lifecycle.markReady,
      providePacks: packs.provide,
      endDocument: handles.endDocument,
      loadEnded: handles.endLoad,
      beginDocument: handles.beginDocument,
      beforeHistoryRestore: handles.beforeHistoryRestore,
      afterHistoryRestore: handles.afterHistoryRestore
    }
  }
}
