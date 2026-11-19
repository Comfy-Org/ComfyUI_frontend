import type { LGraph } from '@/lib/litegraph/src/LGraph'

/** Finds a handle's graph again, or nothing once its document or graph is gone. */
export type GraphResolver = () => LGraph | undefined

interface Entry<THandle extends object, TLive> {
  held: THandle | undefined
  readonly weak: WeakRef<THandle>
  readonly resolveGraph: GraphResolver
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
  /**
   * Retires each handle whose entity is gone and whose key the graph could give to a new entity;
   * the cache holds any other handle of a gone entity only weakly, until its entity is back.
   */
  afterHistoryRestore(): void
  /** `reissuable` says whether the graph could give `key` to a new entity; unless it says no, a restore retires a handle whose entity is gone. */
  createCache<THandle extends object, TLive>(
    reissuable?: (graph: LGraph, key: string) => boolean
  ): HandleCache<THandle, TLive>
  /** True if `value` is a handle made here. */
  owns(value: unknown): boolean
}

const FIRST_SWEEP = 256

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
    createCache<THandle extends object, TLive>(
      reissuable: (graph: LGraph, key: string) => boolean = () => true
    ): HandleCache<THandle, TLive> {
      const entriesByGraph = new Map<
        string,
        Map<string, Entry<THandle, TLive>>
      >()
      const locators = new WeakMap<object, () => TLive | undefined>()
      let entryCount = 0
      let sweepAt = FIRST_SWEEP

      function sweep(retireReissuable: boolean) {
        for (const entries of entriesByGraph.values()) {
          for (const [key, entry] of entries) {
            if (keeps(entry, key, retireReissuable)) continue
            entries.delete(key)
            entryCount--
          }
        }
        sweepAt = Math.max(FIRST_SWEEP, entryCount * 2)
      }

      function keeps(
        entry: Entry<THandle, TLive>,
        key: string,
        retireReissuable: boolean
      ): boolean {
        if (entry.locate() !== undefined) {
          entry.held ??= entry.weak.deref()
          return entry.held !== undefined
        }
        if (retireReissuable && isReissued(entry, key)) {
          entry.retire()
          return false
        }
        entry.held = undefined
        return entry.weak.deref() !== undefined
      }

      function isReissued(entry: Entry<THandle, TLive>, key: string) {
        const graph = entry.resolveGraph()
        return !graph || reissuable(graph, key)
      }

      caches.add({
        clear() {
          entriesByGraph.clear()
          entryCount = 0
          sweepAt = FIRST_SWEEP
        },
        retireGone: () => sweep(true)
      })
      return {
        handleFor(graph, key, find, make) {
          let entries = entriesByGraph.get(graph.id)
          if (!entries) {
            entries = new Map()
            entriesByGraph.set(graph.id, entries)
          }
          const existing = entries.get(key)
          const kept = existing && (existing.held ?? existing.weak.deref())
          if (existing && kept) {
            existing.held = kept
            return kept
          }
          if (existing) {
            entries.delete(key)
            entryCount--
          }

          const { resolveGraph, retire } = followGraph(graph)
          const locate = () => {
            const current = resolveGraph()
            return current && find(current)
          }
          const handle = make(locate, resolveGraph)
          handlesMade.add(handle)
          locators.set(handle, locate)
          entries.set(key, {
            held: handle,
            weak: new WeakRef(handle),
            resolveGraph,
            locate,
            retire
          })
          if (++entryCount > sweepAt) sweep(false)
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
