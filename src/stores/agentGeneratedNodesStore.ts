import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { NodeLocatorId } from '@/types/nodeIdentification'

interface MarkOptions {
  /** When the node landed. Defaults to now. */
  at?: number
  /** Space this mark off the last one, so a batch pops in sequence. */
  cascade?: boolean
}

/**
 * When the agent created each node, keyed the same way execution progress is,
 * so a node in a subgraph stays distinct from the node of that id at the root.
 *
 * A mark is provenance and holds for as long as the session does: the minimap
 * draws agent-authored nodes differently from the ones a human placed. The
 * stamp itself only feeds the entry animation. Nothing here survives a reload,
 * since provenance is not part of the serialised workflow.
 */
export const useAgentGeneratedNodesStore = defineStore(
  'agentGeneratedNodes',
  () => {
    const generatedAt = ref(new Map<NodeLocatorId, number>())

    /** Most recent stamp, or 0 when the agent has generated nothing. */
    const latestMarkAt = ref(0)

    /**
     * The gap held between entry animations of a cascade. A workflow the agent
     * builds from scratch arrives in a single frame, and stamping those nodes
     * together pops them all in one flash; spacing the stamps cascades them
     * instead. Nodes added to a graph already arrive spread across the turn, so
     * they are stamped as they land.
     */
    const POP_STAGGER_MS = 90

    /**
     * How far ahead of its arrival a stamp may be pushed. The minimap animates
     * until the newest stamp has popped, so an unbounded cascade would hold it
     * redrawing for 90ms x every node of a large workflow; past the budget the
     * remainder pops together.
     */
    const CASCADE_BUDGET_MS = 900

    /** Marks standing this session. A turn reads its own work off this count. */
    const markCount = computed(() => generatedAt.value.size)

    /**
     * The nodes marked after the first `skip`. Marks are only ever added, and
     * the map keeps insertion order, so a turn's own work is the tail past the
     * count it started with.
     */
    function markedNodesAfter(skip: number): NodeLocatorId[] {
      return [...generatedAt.value.keys()].slice(skip)
    }

    function markGenerated(
      locatorId: NodeLocatorId,
      { at = Date.now(), cascade = false }: MarkOptions = {}
    ): void {
      const stamp = cascade
        ? Math.min(
            Math.max(at, latestMarkAt.value + POP_STAGGER_MS),
            at + CASCADE_BUDGET_MS
          )
        : at
      generatedAt.value.set(locatorId, stamp)
      latestMarkAt.value = Math.max(latestMarkAt.value, stamp)
    }

    function generatedAtFor(locatorId: NodeLocatorId): number | undefined {
      return generatedAt.value.get(locatorId)
    }

    function clear(): void {
      generatedAt.value.clear()
      latestMarkAt.value = 0
    }

    return {
      latestMarkAt,
      markCount,
      markedNodesAfter,
      markGenerated,
      generatedAtFor,
      clear
    }
  }
)
