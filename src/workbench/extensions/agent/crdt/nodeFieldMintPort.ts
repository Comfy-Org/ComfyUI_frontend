/**
 * `set_node_field` from the root LGraph's own `node:property:changed` event
 * (fired by `setTrackedNodeState` — see `nodeShellState.ts`), filtered to the
 * fields this port knows how to mint: `title` and `mode`. Subscribing only to
 * the ROOT graph's event target is what scopes this to top-level nodes: a
 * subgraph-interior node's property change fires on that Subgraph instance's
 * own event target, never this one, so it is never minted — `set_node_field`
 * (comfy-multi-player ADR-032, package-local and provisional) has no
 * interior/subgraph-instance variant to address it with.
 *
 * `flags.collapsed` and `flags.pinned` are also writable `set_node_field`
 * targets, but `LGraphNode.collapsed`/`pinned` mutate `this.flags` in place
 * rather than going through `setTrackedNodeState`, so there is no equivalent
 * change event to mint them from yet. Follow-up: give collapse/pin the same
 * tracked-property treatment `title`/`mode` already have.
 */
import type { SerializedNodeId } from '@/types/nodeId'

import type { GraphOperation } from './graphOperations'
import { shouldMint } from './mintGate'
import type { MintSession } from './mintSession'

export type NodeFieldChangeView =
  | { nodeId: SerializedNodeId; field: 'title'; value: string }
  | { nodeId: SerializedNodeId; field: 'mode'; value: number }

interface NodeFieldEventFeed {
  /** Fires after the root graph's own tracked `title`/`mode` property change. */
  onChange(listener: (change: NodeFieldChangeView) => void): () => void
}

export interface NodeFieldMintPortDeps {
  events: NodeFieldEventFeed
  session: MintSession
  /** Slice 00's product gate. */
  isEnabled(): boolean
  /** A semantic doc is bound for the active workflow. */
  isDocBound(): boolean
  /** Receives minted semantic operations (the sender's inbox). */
  enqueue(operations: GraphOperation[]): void
}

export interface NodeFieldMintPort {
  detach(): void
}

function toOperation(change: NodeFieldChangeView): GraphOperation {
  switch (change.field) {
    case 'title':
      return {
        op: 'set_node_field',
        node_id: change.nodeId,
        field: 'title',
        value: change.value
      }
    case 'mode':
      return {
        op: 'set_node_field',
        node_id: change.nodeId,
        field: 'mode',
        value: change.value
      }
  }
}

export function attachNodeFieldMintPort(
  deps: NodeFieldMintPortDeps
): NodeFieldMintPort {
  function onChange(change: NodeFieldChangeView): void {
    const mintable = shouldMint({
      flagEnabled: deps.isEnabled(),
      docBound: deps.isDocBound(),
      teardown: deps.session.inTeardown()
    })
    if (!mintable) return

    deps.enqueue([toOperation(change)])
  }

  const detach = deps.events.onChange(onChange)
  return { detach }
}
