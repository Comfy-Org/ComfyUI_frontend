/**
 * set_title from the root LGraph's own `node:property:changed` event
 * (fired by `setTrackedNodeState` — see `nodeShellState.ts`), filtered to
 * the `title` property. Subscribing only to the ROOT graph's event target
 * is what scopes this to top-level nodes: a subgraph-interior node's title
 * change fires on that Subgraph instance's own event target, never this
 * one, so it is never minted — `set_title` (comfy-multi-player ADR-032,
 * package-local and provisional) has no interior/subgraph-instance variant
 * to address it with.
 */
import type { SerializedNodeId } from '@/types/nodeId'

import type { GraphOperation } from './graphOperations'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

export interface TitleChangeView {
  nodeId: SerializedNodeId
  title: string
}

interface TitleEventFeed {
  /** Fires after the root graph's own tracked `title` property change. */
  onChange(listener: (change: TitleChangeView) => void): () => void
}

export interface TitleMintPortDeps {
  events: TitleEventFeed
  session: MintSession
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
}

export interface TitleMintPort {
  detach(): void
}

export function attachTitleMintPort(deps: TitleMintPortDeps): TitleMintPort {
  function onChange(change: TitleChangeView): void {
    const mintable = shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      teardown: deps.session.inTeardown()
    })
    if (!mintable) return

    deps.enqueue([
      {
        op: 'set_title',
        node_id: change.nodeId,
        title: change.title
      }
    ])
  }

  const detach = deps.events.onChange(onChange)
  return { detach }
}
