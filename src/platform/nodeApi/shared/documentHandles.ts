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

export type RestoredState = FlattenableWorkflowGraph & { readonly id?: string }

type Ending =
  | { readonly phase: 'staging'; readonly graph: LGraph }
  | { readonly phase: 'configuring'; readonly outgoingState: LGraph['state'] }

interface Restoring {
  readonly outgoingState: LGraph['state']
  readonly nodesByGraph: ReadonlyMap<string, ReadonlySet<string>>
}

interface Retirable {
  clear(): void
  setAsideAbsent(nodesByGraph: ReadonlyMap<string, ReadonlySet<string>>): void
  retireGone(): void
}

export interface DocumentHandles {
  /** Retires current handles; new handles stay retired through staging, then only for the outgoing graph until {@link endLoad}. */
  endDocument(graph: LGraph): void
  /** The load that ended a document stopped: it finished, failed or was replaced. */
  endLoad(): void
  /** Retires every handle made so far. */
  beginDocument(): void
  /** Until settlement, handles to nodes omitted by this restore read only their outgoing entities. */
  beforeHistoryRestore(graph: LGraph, state: RestoredState): void
  /** Retires missing handles with reissuable keys and set-aside handles whose keys another entity took. */
  afterHistoryRestore(): void
  createCache<THandle extends object, TLive>(
    options?: CacheOptions<TLive>
  ): HandleCache<THandle, TLive>
  /** True if `value` is a handle made here. */
  owns(value: unknown): boolean
  /** How many documents began or ended, and restores finished, so far; it only grows. */
  rebuilds(): number
}

/** `shownRoot` is the root graph of the document on screen; a handle made in another document is retired as it is made. */
export function createDocumentHandles(
  shownRoot: () => LGraph | undefined = () => undefined
): DocumentHandles {
  let documentNumber = 0
  let rebuildCount = 0
  let ending: Ending | undefined
  let restoring: Restoring | undefined
  const handlesMade = new WeakSet<object>()
  const caches = new Set<Retirable>()

  function isOffScreen(graph: LGraph): boolean {
    const shown = shownRoot()
    return shown !== undefined && graph.rootGraph !== shown
  }

  function isEndedIn(graph: LGraph): boolean {
    if (!ending) return false
    return ending.phase === 'staging' || ending.outgoingState === graph.state
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
    rebuildCount++
    documentNumber++
    for (const cache of caches) cache.clear()
  }

  function leftOutOfRestore(graph: LGraph, nodeId: string): boolean {
    return (
      restoring?.outgoingState === graph.state &&
      !restoring.nodesByGraph.get(graph.id)?.has(nodeId)
    )
  }

  return {
    endDocument(graph) {
      retireAllHandles()
      ending = { phase: 'staging', graph }
    },
    endLoad() {
      ending = undefined
    },
    beginDocument() {
      retireAllHandles()
      if (ending?.phase === 'staging')
        ending = { phase: 'configuring', outgoingState: ending.graph.state }
    },
    beforeHistoryRestore(graph, state) {
      const nodesByGraph = nodeIdsByGraph(state)
      restoring = { outgoingState: graph.state, nodesByGraph }
      for (const cache of caches) cache.setAsideAbsent(nodesByGraph)
    },
    afterHistoryRestore() {
      rebuildCount++
      restoring = undefined
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
      let setAside = new Map<Entries, Entries>()

      function canReissue(entry: Entry<THandle, TLive>, key: string) {
        const graph = entry.resolveGraph() ?? entry.resolveRoot()
        return !graph || reissuable(graph, key)
      }

      function putAside(
        entries: Entries,
        key: string,
        entry: Entry<THandle, TLive>
      ) {
        const live = entry.locate()
        entry.setAside(live === undefined ? {} : entityOf(live))
        entries.delete(key)
        const aside = setAside.get(entries) ?? new Map()
        aside.set(key, entry)
        setAside.set(entries, aside)
      }

      function setAsideAbsent(
        nodesByGraph: ReadonlyMap<string, ReadonlySet<string>>
      ) {
        if (!nodeOf) return
        for (const [graphId, entries] of entriesByGraph) {
          const restored = nodesByGraph.get(graphId)
          for (const [key, entry] of entries) {
            if (!restored?.has(nodeOf(key))) putAside(entries, key, entry)
          }
        }
      }

      function settleSetAside(
        entries: Entries,
        key: string,
        entry: Entry<THandle, TLive>
      ) {
        const stillNamed = entry.locate() !== undefined
        entry.setAside(undefined)
        if (stillNamed && !entries.has(key)) {
          entries.set(key, entry)
          return
        }
        const givenToAnother = entries.has(key) || entry.locate() !== undefined
        if (givenToAnother || canReissue(entry, key)) entry.stand('retired')
        else entries.set(key, entry)
      }

      function retireGone() {
        for (const [entries, aside] of setAside) {
          for (const [key, entry] of aside) settleSetAside(entries, key, entry)
        }
        setAside = new Map()
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
          setAside = new Map()
        },
        setAsideAbsent,
        retireGone
      })
      return {
        handleFor(graph, key, find, make) {
          const offScreen = isOffScreen(graph)
          let entries = entriesByGraph.get(graph.id)
          if (!entries) {
            entries = new Map()
            entriesByGraph.set(graph.id, entries)
          }
          const existing = offScreen ? undefined : entries.get(key)
          if (existing) return existing.handle
          const outgoing = offScreen
            ? undefined
            : setAside.get(entries)?.get(key)
          if (outgoing?.locate() !== undefined) return outgoing.handle

          const ended = offScreen || isEndedIn(graph)
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
          if (ended) return handle
          const entry: Entry<THandle, TLive> = {
            handle,
            resolveGraph,
            resolveRoot,
            locate,
            stand,
            setAside(entity) {
              aside = entity
            }
          }
          if (!outgoing && nodeOf && leftOutOfRestore(graph, nodeOf(key)))
            putAside(entries, key, entry)
          else entries.set(key, entry)
          return handle
        },
        locator: (value) =>
          typeof value === 'object' && value !== null
            ? locators.get(value)
            : undefined
      }
    },
    owns: (value) =>
      typeof value === 'object' && value !== null && handlesMade.has(value),
    rebuilds: () => rebuildCount
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
