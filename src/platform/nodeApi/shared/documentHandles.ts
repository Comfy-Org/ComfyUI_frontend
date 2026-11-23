import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { FlattenableWorkflowGraph } from '@/platform/workflow/core/utils/workflowFlattening'
import {
  collectSubgraphDefinitions,
  parseFlattenableSubgraphDefinitions
} from '@/platform/workflow/core/utils/workflowFlattening'

/** Finds a handle's graph again, or nothing once its document or graph is gone. */
export type GraphResolver = () => LGraph | undefined

type Standing = 'live' | 'set aside' | 'retired'

interface Entry<THandle extends object, TLive> {
  readonly handle: THandle
  readonly resolveGraph: GraphResolver
  readonly resolveRoot: GraphResolver
  readonly locate: () => TLive | undefined
  stand(standing: Standing): void
}

interface HandleCache<THandle extends object, TLive> {
  /** The one handle for `key` in `graph`. `find` looks for the entity in a graph; `make` builds the handle from what finds it again. */
  handleFor(
    graph: LGraph,
    key: string,
    find: (graph: LGraph) => TLive | undefined,
    make: (
      locate: () => TLive | undefined,
      resolveGraph: GraphResolver
    ) => THandle
  ): THandle
  /** For a handle made here, what finds its entity in the handle's own graph and document; `undefined` for anything else. */
  locator(value: unknown): (() => TLive | undefined) | undefined
}

interface CacheOptions {
  /** Whether the graph could give `key` to a new entity; unless it says no, a restore retires a handle whose entity is gone. */
  readonly reissuable?: (graph: LGraph, key: string) => boolean
  /** The id of the node a handle by `key` names or belongs to. */
  readonly nodeOf?: (key: string) => string
}

/** The saved state an undo or redo configures. */
export type RestoredState = FlattenableWorkflowGraph & { readonly id?: string }

interface Retirable {
  clear(): void
  setAsideAbsent(nodesByGraph: ReadonlyMap<string, ReadonlySet<string>>): void
  retireGone(): void
}

export interface DocumentHandles {
  /** Retires every handle made so far. */
  beginDocument(): void
  /** Before an undo or redo configures `state`: no handle to a node `state` lacks resolves, or is given out, until {@link afterHistoryRestore}. */
  beforeHistoryRestore(state: RestoredState): void
  /** Retires each handle whose entity is gone, or was given to another entity during the restore, and whose key its graph, or the root whose ids a gone subgraph shared, could give to a new entity. */
  afterHistoryRestore(): void
  createCache<THandle extends object, TLive>(
    options?: CacheOptions
  ): HandleCache<THandle, TLive>
  /** True if `value` is a handle made here. */
  owns(value: unknown): boolean
}

export function createDocumentHandles(): DocumentHandles {
  let documentNumber = 0
  const handlesMade = new WeakSet<object>()
  const caches = new Set<Retirable>()

  function followGraph(graph: LGraph) {
    const madeInDocument = documentNumber
    const root = graph.rootGraph
    const { id } = graph
    let standing: Standing = 'live'
    const resolveRoot: GraphResolver = () =>
      standing === 'live' && documentNumber === madeInDocument
        ? root
        : undefined
    const resolveGraph: GraphResolver = () => {
      const current = resolveRoot()
      return current?.id === id ? current : current?.subgraphs.get(id)
    }
    return {
      resolveGraph,
      resolveRoot,
      stand(next: Standing) {
        standing = next
      }
    }
  }

  return {
    beginDocument() {
      documentNumber++
      for (const cache of caches) cache.clear()
    },
    beforeHistoryRestore(state) {
      const nodesByGraph = nodeIdsByGraph(state)
      for (const cache of caches) cache.setAsideAbsent(nodesByGraph)
    },
    afterHistoryRestore() {
      for (const cache of caches) cache.retireGone()
    },
    createCache<THandle extends object, TLive>({
      reissuable = () => true,
      nodeOf
    }: CacheOptions = {}): HandleCache<THandle, TLive> {
      type Entries = Map<string, Entry<THandle, TLive>>
      const entriesByGraph = new Map<string, Entries>()
      const locators = new WeakMap<object, () => TLive | undefined>()
      let setAside: {
        entries: Entries
        key: string
        entry: Entry<THandle, TLive>
      }[] = []

      function canReissue(entry: Entry<THandle, TLive>, key: string) {
        const graph = entry.resolveGraph() ?? entry.resolveRoot()
        return !graph || reissuable(graph, key)
      }

      function setAsideAbsent(
        nodesByGraph: ReadonlyMap<string, ReadonlySet<string>>
      ) {
        if (!nodeOf) return
        for (const [graphId, entries] of entriesByGraph) {
          const restored = nodesByGraph.get(graphId)
          for (const [key, entry] of entries) {
            if (restored?.has(nodeOf(key))) continue
            entry.stand('set aside')
            entries.delete(key)
            setAside.push({ entries, key, entry })
          }
        }
      }

      function retireGone() {
        for (const { entries, key, entry } of setAside) {
          entry.stand('live')
          const givenToAnother =
            entries.has(key) || entry.locate() !== undefined
          if (givenToAnother || canReissue(entry, key)) entry.stand('retired')
          else entries.set(key, entry)
        }
        setAside = []
        for (const entries of entriesByGraph.values()) {
          for (const [key, entry] of entries) {
            if (entry.locate() !== undefined || !canReissue(entry, key))
              continue
            entry.stand('retired')
            entries.delete(key)
          }
        }
      }

      caches.add({
        clear() {
          entriesByGraph.clear()
          setAside = []
        },
        setAsideAbsent,
        retireGone
      })
      return {
        handleFor(graph, key, find, make) {
          let entries = entriesByGraph.get(graph.id)
          if (!entries) {
            entries = new Map()
            entriesByGraph.set(graph.id, entries)
          }
          const existing = entries.get(key)
          if (existing) return existing.handle

          const { resolveGraph, resolveRoot, stand } = followGraph(graph)
          const locate = () => {
            const current = resolveGraph()
            return current && find(current)
          }
          const handle = make(locate, resolveGraph)
          handlesMade.add(handle)
          locators.set(handle, locate)
          entries.set(key, { handle, resolveGraph, resolveRoot, locate, stand })
          return handle
        },
        locator: (value) =>
          typeof value === 'object' && value !== null
            ? locators.get(value)
            : undefined
      }
    },
    owns: (value) =>
      typeof value === 'object' && value !== null && handlesMade.has(value)
  }
}

function nodeIdsByGraph(
  state: RestoredState
): Map<string, ReadonlySet<string>> {
  const subgraphs = collectSubgraphDefinitions(
    parseFlattenableSubgraphDefinitions(state.definitions?.subgraphs ?? [])
  )
  const graphs = [{ id: state.id, nodes: state.nodes ?? [] }, ...subgraphs]
  return new Map(
    graphs.flatMap(({ id, nodes }) =>
      id === undefined
        ? []
        : [[id, new Set(nodes.map((node) => String(node.id)))]]
    )
  )
}

/** True unless `id` is a counted id at or below `lastIssued`, which the graph's counter will not give out again. */
export function isReissuable(id: string, lastIssued: number): boolean {
  const counted = Number(id)
  return !(Number.isSafeInteger(counted) && counted <= lastIssued)
}
