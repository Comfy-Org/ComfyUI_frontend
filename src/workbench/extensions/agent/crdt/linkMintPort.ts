/**
 * The blessed connect port: litegraph's registerLinkTopology bridge calls
 * linkStore synchronously for EVERY link change, so nothing escapes this seam.
 * Register/replace mint a CONCRETE connect (a replace displaces the incumbent
 * register by LWW - no severance). Deletes cannot mint (no disconnect op in
 * the frozen vocabulary): they feed the severance log for delete_node, and an
 * unconsumed local severance surfaces as observable divergence after a double
 * microtask (strictly after the layout store's single-microtask delivery).
 */
import type { NodeId as WireNodeId } from '@comfyorg/comfy-multi-player'

import type {
  GraphMutationTarget,
  TargetedGraphOperations
} from './graphOperations'
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
    listener: (
      target: GraphMutationTarget,
      scope: LinkScopeView,
      topology: LinkTopologyView
    ) => void
  ): () => void
  /** Fires after `deleteLink` removes a registered topology. */
  onDeleted(
    listener: (
      target: GraphMutationTarget,
      scope: LinkScopeView,
      topology: LinkTopologyView
    ) => void
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
  take(target: GraphMutationTarget, nodeId: string): WireNodeId[]
}

export interface LinkMintPortDeps {
  events: LinkEventFeed
  session: MintSession
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(batch: TargetedGraphOperations): boolean
}

export interface LinkMintPort {
  severances: SeveranceLog
  detach(): void
}

interface SeveranceEntry {
  linkId: WireNodeId
  consumptionKey: string
  /** The gate was open at severance: unconsumed means a real divergence. */
  mintable: boolean
}

function isRootScope(scope: LinkScopeView): boolean {
  return String(scope.owningGraphId) === String(scope.rootGraphId)
}

function matchesTarget(
  target: GraphMutationTarget,
  scope: LinkScopeView
): boolean {
  return target.rootGraphId === String(scope.rootGraphId)
}

function severanceKey(
  workflowId: string,
  rootGraphId: string,
  nodeId: string
): string {
  return JSON.stringify([workflowId, rootGraphId, nodeId])
}

export function attachLinkMintPort(deps: LinkMintPortDeps): LinkMintPort {
  const severancesByNode = new Map<string, SeveranceEntry[]>()
  const consumedLinkIds = new Set<string>()
  let sweepScheduled = false

  function gateOpen(): boolean {
    return shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      localProvenance: !deps.session.inRemoteApply(),
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

  function onPlaced(
    target: GraphMutationTarget,
    scope: LinkScopeView,
    topology: LinkTopologyView
  ): void {
    if (!gateOpen()) return
    if (!matchesTarget(target, scope)) {
      surfaceUnrepresentable('cross-document connect', topology.id)
      return
    }
    if (!isRootScope(scope)) {
      surfaceUnrepresentable('subgraph-interior connect', topology.id)
      return
    }
    const accepted = deps.enqueue({
      target,
      operations: [
        {
          op: 'connect',
          link_id: topology.id,
          from_node: topology.originNodeId,
          from_slot: topology.originSlot,
          to_node: topology.targetNodeId,
          to_slot: topology.targetSlot,
          link_type: String(topology.type)
        }
      ]
    })
    if (!accepted) surfaceUnrepresentable('rejected connect', topology.id)
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
            const key = entry.consumptionKey
            if (!entry.mintable || consumedLinkIds.has(key)) continue
            if (surfaced.has(key)) continue
            surfaced.add(key)
            surfaceUnrepresentable('link disconnect', entry.linkId)
          }
        }
        severancesByNode.clear()
        consumedLinkIds.clear()
      })
    })
  }

  function capture(key: string, entry: SeveranceEntry): void {
    const bucket = severancesByNode.get(key)
    if (bucket) bucket.push(entry)
    else severancesByNode.set(key, [entry])
  }

  function onDeleted(
    target: GraphMutationTarget,
    scope: LinkScopeView,
    topology: LinkTopologyView
  ): void {
    // Key on the scope that owns the link, so a severance from another
    // document is never consumed by this target's delete_node and survives
    // to the sweep as a divergence.
    const owningRoot = String(scope.rootGraphId)
    const entry: SeveranceEntry = {
      linkId: topology.id,
      consumptionKey: severanceKey(
        target.workflowId,
        owningRoot,
        String(topology.id)
      ),
      mintable: gateOpen() && isRootScope(scope)
    }
    for (const nodeId of [topology.originNodeId, topology.targetNodeId]) {
      capture(
        severanceKey(target.workflowId, owningRoot, String(nodeId)),
        entry
      )
    }
    scheduleSweep()
  }

  const detachPlaced = deps.events.onPlaced(onPlaced)
  const detachDeleted = deps.events.onDeleted(onDeleted)

  return {
    severances: {
      take(target: GraphMutationTarget, nodeId: string): WireNodeId[] {
        const taken: WireNodeId[] = []
        for (const entry of severancesByNode.get(
          severanceKey(target.workflowId, target.rootGraphId, nodeId)
        ) ?? []) {
          const key = entry.consumptionKey
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
