import type { LGraph } from '@/lib/litegraph/src/LGraph'

/** Finds a handle's graph again, or nothing once its document or graph is gone. */
export type GraphResolver = () => LGraph | undefined

interface Entry<THandle extends object> {
  readonly handle: THandle
  readonly resolveGraph: GraphResolver
  retire(): void
}

interface HandleCache<THandle extends object> {
  handleFor(
    graph: LGraph,
    key: string,
    create: (resolveGraph: GraphResolver) => THandle
  ): THandle
}

interface Retirable {
  clear(): void
  retireGone(): void
}

export interface DocumentHandles {
  /** Retires every handle made so far. */
  beginDocument(): void
  /** Retires each handle whose entity is gone and whose key the graph could give to a new entity. */
  afterHistoryRestore(): void
  /**
   * `exists` says whether the entity named `key` is still in a graph; `reissuable`, whether the
   * graph could give `key` to a new entity. Unless it says no, a restore retires a handle whose entity is gone.
   */
  createCache<THandle extends object>(
    exists: (graph: LGraph, key: string) => boolean,
    reissuable?: (graph: LGraph, key: string) => boolean
  ): HandleCache<THandle>
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
    const resolveGraph: GraphResolver = () => {
      if (retired || documentNumber !== madeInDocument) return undefined
      return root.id === id ? root : root.subgraphs.get(id)
    }
    return {
      resolveGraph,
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
    createCache<THandle extends object>(
      exists: (graph: LGraph, key: string) => boolean,
      reissuable: (graph: LGraph, key: string) => boolean = () => true
    ): HandleCache<THandle> {
      const entriesByGraph = new Map<string, Map<string, Entry<THandle>>>()
      caches.add({
        clear: () => entriesByGraph.clear(),
        retireGone() {
          for (const entries of entriesByGraph.values()) {
            for (const [key, entry] of entries) {
              const graph = entry.resolveGraph()
              if (graph && (exists(graph, key) || !reissuable(graph, key)))
                continue
              entry.retire()
              entries.delete(key)
            }
          }
        }
      })
      return {
        handleFor(graph, key, create) {
          let entries = entriesByGraph.get(graph.id)
          if (!entries) {
            entries = new Map()
            entriesByGraph.set(graph.id, entries)
          }
          const existing = entries.get(key)
          if (existing) return existing.handle

          const { resolveGraph, retire } = followGraph(graph)
          const handle = create(resolveGraph)
          handlesMade.add(handle)
          entries.set(key, { handle, resolveGraph, retire })
          return handle
        }
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
