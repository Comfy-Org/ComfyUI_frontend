import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'
import { uniq } from 'es-toolkit'

import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphEventMode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { isRecord } from '@/renderer/extensions/superComfy/router/routerJson'
import { useSubgraphService } from '@/services/subgraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { installGraphConfigureCallbacks } from '@/utils/graphConfigureCallbacks'

type JsonRecord = Record<string, unknown>

export interface DetachedAppGraph {
  graph: LGraph
  dispose(): void
}

type DetachedAppGraphOpening =
  | { ok: true; detached: DetachedAppGraph }
  | { ok: false; cause: unknown }

type DetachedAppGraphUse<T> =
  | { ok: true; value: T }
  | { ok: false; cause: unknown }

const INACTIVE_MODES: ReadonlySet<number> = new Set([
  LGraphEventMode.NEVER,
  LGraphEventMode.BYPASS
])

function recordsIn(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function definitionsIn(graph: JsonRecord): JsonRecord[] {
  const definitions = isRecord(graph.definitions)
    ? recordsIn(graph.definitions.subgraphs)
    : []
  return definitions.flatMap((definition) => [
    definition,
    ...definitionsIn(definition)
  ])
}

function nodesIn(root: JsonRecord): JsonRecord[] {
  return [root, ...definitionsIn(root)].flatMap((graph) =>
    recordsIn(graph.nodes)
  )
}

function stringsAt(records: readonly JsonRecord[], key: string): string[] {
  return records
    .map((record) => record[key])
    .filter((value): value is string => typeof value === 'string')
}

function renameAt(
  record: JsonRecord,
  key: string,
  renamed: ReadonlyMap<string, string>
) {
  const value = record[key]
  if (typeof value === 'string') record[key] = renamed.get(value) ?? value
}

function isActive(node: JsonRecord): boolean {
  return typeof node.mode !== 'number' || !INACTIVE_MODES.has(node.mode)
}

/** A copy of `json` with fresh root and subgraph definition ids. */
export function isolateWorkflowIds(json: ComfyWorkflowJSON): ComfyWorkflowJSON {
  const isolated = structuredClone(json)
  const definitions = definitionsIn(isolated)
  const renamed = new Map(
    stringsAt(definitions, 'id').map((id) => [id, crypto.randomUUID()])
  )
  for (const definition of definitions) renameAt(definition, 'id', renamed)
  for (const node of nodesIn(isolated)) renameAt(node, 'type', renamed)
  return { ...isolated, id: crypto.randomUUID() }
}

export function findMissingNodeTypes(
  json: ComfyWorkflowJSON,
  isRegistered: (type: string) => boolean
): string[] {
  const definitionIds = new Set(stringsAt(definitionsIn(json), 'id'))
  const types = stringsAt(nodesIn(json).filter(isActive), 'type').filter(
    (type) => !definitionIds.has(type) && !isRegistered(type)
  )
  return uniq(types)
}

function clearDetachedGraph(graph: LGraph) {
  try {
    graph.clear()
  } catch (cause) {
    reportError(cause, {
      errorType: 'error_disposing_supercomfy_app_graph',
      surface: 'graph'
    })
  }
}

function releaseSubgraphTypes(ids: readonly string[]) {
  const nodeDefStore = useNodeDefStore()
  for (const id of ids) {
    if (Object.hasOwn(LiteGraph.registered_node_types, id)) {
      LiteGraph.unregisterNodeType(id)
    }
    nodeDefStore.removeNodeDef(id)
  }
}

export function openDetachedAppGraph(
  json: ComfyWorkflowJSON
): DetachedAppGraphOpening {
  const graph = new LGraph()
  const subgraphTypes: string[] = []
  graph.events.addEventListener('subgraph-created', (event) => {
    const { subgraph, data } = event.detail
    subgraphTypes.push(data.id)
    useSubgraphService().registerNewSubgraph(subgraph, data)
  })
  installGraphConfigureCallbacks(graph)
  const dispose = () => {
    clearDetachedGraph(graph)
    releaseSubgraphTypes(subgraphTypes)
  }
  try {
    graph.configure(isolateWorkflowIds(json) as ISerialisedGraph)
  } catch (cause) {
    dispose()
    return { ok: false, cause }
  }
  return { ok: true, detached: { graph, dispose } }
}

export async function withDetachedAppGraph<T>(
  json: ComfyWorkflowJSON,
  use: (graph: LGraph) => T | Promise<T>
): Promise<DetachedAppGraphUse<T>> {
  const opening = openDetachedAppGraph(json)
  if (!opening.ok) return opening
  try {
    return { ok: true, value: await use(opening.detached.graph) }
  } finally {
    opening.detached.dispose()
  }
}
