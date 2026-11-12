import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { UUID } from '@/utils/uuid'

export interface SubgraphHost {
  readonly graphId: UUID
  readonly nodeId: NodeId
  readonly subgraphId: UUID
}

export interface SubgraphHostContext {
  readonly rootGraphId: UUID | null
  readonly hosts: readonly SubgraphHost[]
}

export type SubgraphHostEvent =
  | {
      readonly type: 'navigated'
      readonly rootGraphId: UUID
      readonly graphId: UUID
    }
  | {
      readonly type: 'entered'
      readonly rootGraphId: UUID
      readonly host: SubgraphHost
    }

export const emptySubgraphHostContext: SubgraphHostContext = {
  rootGraphId: null,
  hosts: []
}

export function transitionSubgraphHostContext(
  state: SubgraphHostContext,
  event: SubgraphHostEvent
): SubgraphHostContext {
  const hosts = state.rootGraphId === event.rootGraphId ? state.hosts : []
  switch (event.type) {
    case 'navigated': {
      const index = hosts.findIndex((host) => host.subgraphId === event.graphId)
      return {
        rootGraphId: event.rootGraphId,
        hosts:
          event.graphId === event.rootGraphId || index < 0
            ? []
            : hosts.slice(0, index + 1)
      }
    }
    case 'entered': {
      const parentIndex = hosts.findIndex(
        (host) => host.subgraphId === event.host.graphId
      )
      return {
        rootGraphId: event.rootGraphId,
        hosts: [...hosts.slice(0, parentIndex + 1), event.host]
      }
    }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}
