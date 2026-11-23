import type { LGraph } from '@/lib/litegraph/src/LGraph'

/** Finds a handle's graph again, or nothing once its document or graph is gone. */
export type GraphResolver = () => LGraph | undefined

interface Entry<THandle extends object, TLive> {
  readonly handle: THandle
  readonly resolveGraph: GraphResolver
  readonly resolveRoot: GraphResolver
  readonly locate: () => TLive | undefined
  retire(): void
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

interface Retirable {
  clear(): void
  retireGone(): void
}

export interface DocumentHandles {
  /** Retires every handle made so far. */
  beginDocument(): void
  /** Retires each handle whose entity is gone and whose key its graph, or the root whose ids a gone subgraph shared, could give to a new entity. */
  afterHistoryRestore(): void
  /** `reissuable` says whether the graph could give `key` to a new entity; unless it says no, a restore retires a handle whose entity is gone. */
  createCache<THandle extends object, TLive>(
    reissuable?: (graph: LGraph, key: string) => boolean
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
    let retired = false
    const resolveRoot: GraphResolver = () =>
      retired || documentNumber !== madeInDocument ? undefined : root
    const resolveGraph: GraphResolver = () => {
      const current = resolveRoot()
      return current?.id === id ? current : current?.subgraphs.get(id)
    }
    return {
      resolveGraph,
      resolveRoot,
      retire() {
        retired = true
      }
    }
  }

  return {
    beginDocument() {
      documentNumber++
      for (const cache of caches) cache.clear()
    },
    afterHistoryRestore() {
      for (const cache of caches) cache.retireGone()
    },
    createCache<THandle extends object, TLive>(
      reissuable: (graph: LGraph, key: string) => boolean = () => true
    ): HandleCache<THandle, TLive> {
      const entriesByGraph = new Map<
        string,
        Map<string, Entry<THandle, TLive>>
      >()
      const locators = new WeakMap<object, () => TLive | undefined>()

      function retireGone() {
        for (const entries of entriesByGraph.values()) {
          for (const [key, entry] of entries) {
            if (entry.locate() !== undefined) continue
            const graph = entry.resolveGraph() ?? entry.resolveRoot()
            if (graph && !reissuable(graph, key)) continue
            entry.retire()
            entries.delete(key)
          }
        }
      }

      caches.add({ clear: () => entriesByGraph.clear(), retireGone })
      return {
        handleFor(graph, key, find, make) {
          let entries = entriesByGraph.get(graph.id)
          if (!entries) {
            entries = new Map()
            entriesByGraph.set(graph.id, entries)
          }
          const existing = entries.get(key)
          if (existing) return existing.handle

          const { resolveGraph, resolveRoot, retire } = followGraph(graph)
          const locate = () => {
            const current = resolveGraph()
            return current && find(current)
          }
          const handle = make(locate, resolveGraph)
          handlesMade.add(handle)
          locators.set(handle, locate)
          entries.set(key, {
            handle,
            resolveGraph,
            resolveRoot,
            locate,
            retire
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

/** True unless `id` is a counted id at or below `lastIssued`, which the graph's counter will not give out again. */
export function isReissuable(id: string, lastIssued: number): boolean {
  const counted = Number(id)
  return !(Number.isSafeInteger(counted) && counted <= lastIssued)
}
