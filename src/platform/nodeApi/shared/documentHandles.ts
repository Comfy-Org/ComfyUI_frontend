import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { FlattenableWorkflowGraph } from '@/platform/workflow/core/utils/workflowFlattening'
import {
  collectSubgraphDefinitions,
  parseFlattenableSubgraphDefinitions
} from '@/platform/workflow/core/utils/workflowFlattening'

/** Finds a handle's graph again, or nothing once its document or graph is gone. */
export type GraphResolver = () => LGraph | undefined

type Standing = 'live' | 'retired'

interface Entry<THandle extends object, TLive> {
  readonly handle: THandle
  readonly resolveGraph: GraphResolver
  readonly resolveRoot: GraphResolver
  readonly locate: () => TLive | undefined
  stand(standing: Standing): void
  /** While set aside, the handle reads only `entity`, the one it named before the restore; `undefined` ends that. */
  setAside(entity: object | undefined): void
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

interface CacheOptions<TLive> {
  /** Whether the graph could give `key` to a new entity; unless it says no, a restore retires a handle whose entity is gone. */
  readonly reissuable?: (graph: LGraph, key: string) => boolean
  /** The id of the node a handle by `key` names or belongs to, and the entity object a live read names. */
  readonly nodeOf?: (key: string) => string
  readonly entityOf?: (live: TLive) => object
}

/** The saved state an undo or redo configures. */
export type RestoredState = FlattenableWorkflowGraph & { readonly id?: string }

interface Retirable {
  clear(): void
  setAsideAbsent(nodesByGraph: ReadonlyMap<string, ReadonlySet<string>>): void
  retireGone(): void
}

export interface DocumentHandles {
  /** Retires every handle made so far; until the load that ends `graph`'s document finishes, a handle made in it is retired as soon as it is made. */
  endDocument(graph: LGraph): void
  /** Retires every handle made so far. */
  beginDocument(): void
  /** Before an undo or redo configures `state`: until {@link afterHistoryRestore}, a handle to a node `state` lacks reads only that node, and is not given out for another. */
  beforeHistoryRestore(state: RestoredState): void
  /** Retires each handle whose entity is gone, or was given to another entity during the restore, and whose key its graph, or the root whose ids a gone subgraph shared, could give to a new entity. */
  afterHistoryRestore(): void
  createCache<THandle extends object, TLive>(
    options?: CacheOptions<TLive>
  ): HandleCache<THandle, TLive>
  /** True if `value` is a handle made here. */
  owns(value: unknown): boolean
}

/** `isLoading` says whether a load is running; the document a load ends stays ended until it finishes. */
export function createDocumentHandles(
  isLoading: () => boolean = () => false
): DocumentHandles {
  let documentNumber = 0
  let endedGraphState: LGraph['state'] | undefined
  const handlesMade = new WeakSet<object>()
  const caches = new Set<Retirable>()

  function stateOfEndedDocument(): LGraph['state'] | undefined {
    if (!isLoading()) endedGraphState = undefined
    return endedGraphState
  }

  function followGraph(graph: LGraph, standingAtBirth: Standing) {
    const madeInDocument = documentNumber
    const root = graph.rootGraph
    const { id } = graph
    let standing = standingAtBirth
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

  function retireAllHandles() {
    documentNumber++
    for (const cache of caches) cache.clear()
  }

  return {
    endDocument(graph) {
      retireAllHandles()
      endedGraphState = graph.state
    },
    beginDocument: retireAllHandles,
    beforeHistoryRestore(state) {
      const nodesByGraph = nodeIdsByGraph(state)
      for (const cache of caches) cache.setAsideAbsent(nodesByGraph)
    },
    afterHistoryRestore() {
      for (const cache of caches) cache.retireGone()
    },
    createCache<THandle extends object, TLive>({
      reissuable = () => true,
      nodeOf,
      entityOf = (live) => Object(live)
    }: CacheOptions<TLive> = {}): HandleCache<THandle, TLive> {
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
            const live = entry.locate()
            entry.setAside(live === undefined ? {} : entityOf(live))
            entries.delete(key)
            setAside.push({ entries, key, entry })
          }
        }
      }

      function retireGone() {
        for (const { entries, key, entry } of setAside) {
          entry.setAside(undefined)
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
          const outgoing = setAside.find(
            (one) =>
              one.entries === entries &&
              one.key === key &&
              one.entry.locate() !== undefined
          )
          if (outgoing) return outgoing.entry.handle

          const ended = graph.state === stateOfEndedDocument()
          const { resolveGraph, resolveRoot, stand } = followGraph(
            graph,
            ended ? 'retired' : 'live'
          )
          let aside: object | undefined
          const locate = () => {
            const current = resolveGraph()
            const found = current && find(current)
            return found === undefined ||
              aside === undefined ||
              entityOf(found) === aside
              ? found
              : undefined
          }
          const handle = make(locate, resolveGraph)
          handlesMade.add(handle)
          locators.set(handle, locate)
          if (!ended)
            entries.set(key, {
              handle,
              resolveGraph,
              resolveRoot,
              locate,
              stand,
              setAside(entity) {
                aside = entity
              }
            })
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
