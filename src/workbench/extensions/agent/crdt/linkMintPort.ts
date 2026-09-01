/**
 * The blessed connect port: litegraph's registerLinkTopology bridge calls
 * linkStore synchronously for EVERY link change, so nothing escapes this seam.
 * Register/replace mint a CONCRETE connect (a replace displaces the incumbent
 * register by LWW - no severance). Deletes mint a standalone disconnect and
 * also feed the severance log so delete_node can carry removed_links when the
 * link deletion was part of node removal.
 */
import type { NodeId as WireNodeId } from '@comfyorg/comfy-multi-player'

import type { GraphOperation } from './graphOperations'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

/** The structural slice of the store's GraphScope this port reads. */
export interface LinkScopeView {
  rootGraphId: string
  owningGraphId: string
}

/**
 * The structural slice of `LinkTopology` this port reads. A floating
 * topology (either end unassigned) is reroute-chain bookkeeping, not a
 * link - the wiring feed filters those out before this port sees them.
 */
export interface LinkTopologyView {
  id: string | number
  originNodeId: string | number
  originSlot: number
  targetNodeId: string | number
  targetSlot: number
  type: string | number
}

interface LinkEventFeed {
  /** Fires after a successful `registerLink` or `replaceLink`. */
  onPlaced(
    listener: (scope: LinkScopeView, topology: LinkTopologyView) => void
  ): () => void
  /** Fires after `deleteLink` removes a registered topology. */
  onDeleted(
    listener: (scope: LinkScopeView, topology: LinkTopologyView) => void
  ): () => void
}

/**
 * The delete_node capture seam: the layout port takes a deleted node's
 * severed link ids from here at mint time.
 */
export interface SeveranceLog {
  /**
   * Link ids severed for `nodeId` in the current capture window, each
   * consumed globally (a link touches two nodes; only one delete carries it).
   */
  take(owningGraphId: string, nodeId: string): WireNodeId[]
}

export interface LinkMintPortDeps {
  events: LinkEventFeed
  session: MintSession
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** A whole-graph clear is carrying its own semantic `clear` operation. */
  isIntentionalClear(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
}

export interface LinkMintPort {
  severances: SeveranceLog
  detach(): void
}

interface SeveranceEntry {
  linkId: WireNodeId
  topology: LinkTopologyView
  owningGraphId: string
  /** The gate was open at severance: unconsumed means a real divergence. */
  mintable: boolean
  /** Only root-scope link deletions can be represented as standalone ops. */
  rootScoped: boolean
}

function isRootScope(scope: LinkScopeView): boolean {
  return String(scope.owningGraphId) === String(scope.rootGraphId)
}

export function attachLinkMintPort(deps: LinkMintPortDeps): LinkMintPort {
  const severancesByNode = new Map<string, SeveranceEntry[]>()
  const consumedLinkIds = new Set<string>()
  let sweepScheduled = false

  function graphEntityKey(owningGraphId: string, entityId: string | number) {
    return `${owningGraphId}:${String(entityId)}`
  }

  function linkKey(entry: SeveranceEntry): string {
    return graphEntityKey(entry.owningGraphId, entry.linkId)
  }

  function gateOpen(): boolean {
    return shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      teardown: deps.session.inTeardown()
    })
  }

  function surfaceUnrepresentable(what: string, id: string | number): void {
    // A doc that no longer matches the local graph must be observable,
    // never silent (the surfacing-honesty principle).
    console.error(
      `[agent-crdt] ${what} has no wire op; the bound doc diverges from the local graph`,
      id
    )
  }

  function onPlaced(scope: LinkScopeView, topology: LinkTopologyView): void {
    if (!gateOpen()) return
    if (!isRootScope(scope)) {
      surfaceUnrepresentable('subgraph-interior connect', topology.id)
      return
    }
    deps.enqueue([
      {
        op: 'connect',
        link_id: topology.id,
        from_node: topology.originNodeId,
        from_slot: topology.originSlot,
        to_node: topology.targetNodeId,
        to_slot: topology.targetSlot,
        link_type: String(topology.type)
      }
    ])
  }

  function scheduleSweep(): void {
    if (sweepScheduled) return
    sweepScheduled = true
    // Double microtask: the layout store delivers its queued changes on ONE
    // microtask, so the delete_node mint consumes its capture before this
    // sweep decides what was left dangling.
    queueMicrotask(() => {
      queueMicrotask(() => {
        sweepScheduled = false
        const surfaced = new Set<string>()
        for (const entries of severancesByNode.values()) {
          for (const entry of entries) {
            const key = linkKey(entry)
            if (!entry.mintable || consumedLinkIds.has(key)) continue
            if (surfaced.has(key)) continue
            surfaced.add(key)
            if (entry.rootScoped) {
              deps.enqueue([
                {
                  op: 'disconnect',
                  link_id: entry.linkId,
                  to_node: entry.topology.targetNodeId,
                  to_slot: entry.topology.targetSlot
                }
              ])
            } else {
              surfaceUnrepresentable(
                'subgraph-interior disconnect',
                String(entry.linkId)
              )
            }
          }
        }
        severancesByNode.clear()
        consumedLinkIds.clear()
      })
    })
  }

  function capture(nodeId: string | number, entry: SeveranceEntry): void {
    const key = graphEntityKey(entry.owningGraphId, nodeId)
    const bucket = severancesByNode.get(key)
    if (bucket) bucket.push(entry)
    else severancesByNode.set(key, [entry])
  }

  function onDeleted(scope: LinkScopeView, topology: LinkTopologyView): void {
    const mintable = gateOpen() && !deps.isIntentionalClear()
    const rootScoped = isRootScope(scope)
    const entry: SeveranceEntry = {
      linkId: topology.id,
      topology,
      owningGraphId: String(scope.owningGraphId),
      mintable,
      rootScoped
    }
    capture(topology.originNodeId, entry)
    capture(topology.targetNodeId, entry)
    scheduleSweep()
  }

  const detachPlaced = deps.events.onPlaced(onPlaced)
  const detachDeleted = deps.events.onDeleted(onDeleted)

  return {
    severances: {
      take(owningGraphId: string, nodeId: string): WireNodeId[] {
        const taken: WireNodeId[] = []
        const nodeKey = graphEntityKey(owningGraphId, nodeId)
        for (const entry of severancesByNode.get(nodeKey) ?? []) {
          if (!entry.rootScoped) continue
          const key = linkKey(entry)
          if (consumedLinkIds.has(key)) continue
          consumedLinkIds.add(key)
          taken.push(entry.linkId)
        }
        return taken
      }
    },
    detach() {
      detachPlaced()
      detachDeleted()
    }
  }
}
