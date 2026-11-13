import type { LGraph } from '@/lib/litegraph/src/LGraph'

import { createDocumentHandles } from '@/platform/nodeApi/shared/documentHandles'

import { API_VERSION, isApiVersionAtLeast } from './apiVersion'
import { createAppLifecycle } from './appLifecycle'
import type { EditHistory } from './edit/editRunner'
import { createEdits } from './edit/edits'
import { graphHandleMembers } from './edit/graphHandleMembers'
import { nodeHandleMembers } from './edit/nodeHandleMembers'
import { createSlotHandles } from './edit/slotHandles'
import { createGraphHandle } from './graphHandle'
import { createGraphScopes } from './graphScopeHandle'
import { createNodeHandles } from './nodeHandle'
import type { Comfy } from './types'

/** What the host supplies. */
export interface ComfyApiServices {
  /** The graph on screen: the root graph, or the subgraph the user is in. */
  getGraph(): LGraph | null
  /** The open document's undo history; without it an edit is no undo step. */
  history?(): EditHistory | undefined
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
}

export function createComfyApi(services: ComfyApiServices): {
  comfy: Comfy
  host: ComfyApiHost
} {
  const lifecycle = createAppLifecycle()
  const handles = createDocumentHandles()
  const nodes = createNodeHandles(handles, (handle) =>
    nodeHandleMembers(handle, edit, nodes, slots)
  )
  const slots = createSlotHandles(handles, nodes, () => edit)
  const scopes = createGraphScopes(handles, nodes)
  const edit = createEdits(nodes, scopes, slots, () => services.history?.())

  const comfy: Comfy = Object.freeze({
    getApiVersion: () => API_VERSION,
    isApiVersionAtLeast,
    onReady: lifecycle.onReady,

    graph: createGraphHandle(
      nodes,
      scopes.scopeFor,
      services.getGraph,
      (visible) => graphHandleMembers(visible, scopes.scopeFor, edit)
    ),
    sameEntity: (a: unknown, b: unknown) => a === b && handles.owns(a),
    edit
  })

  return {
    comfy,
    host: {
      markReady: lifecycle.markReady,
      beginDocument: handles.beginDocument,
      afterHistoryRestore: handles.afterHistoryRestore
    }
  }
}
