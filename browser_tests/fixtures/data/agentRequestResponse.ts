import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { PostMessageInput } from '@/workbench/extensions/agent/services/agent/agentRestClient'

export type AgentResponseStep =
  | {
      kind: 'agent_event'
      event: AgentWsEvent
    }
  | {
      kind: 'graph_operations'
      operations: readonly GraphOperation[]
    }

export interface AgentRequestResponseScenario {
  request: PostMessageInput
  responses: readonly AgentResponseStep[]
}
