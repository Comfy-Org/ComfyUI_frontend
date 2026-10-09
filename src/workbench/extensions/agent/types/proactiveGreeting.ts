export type AgentGreeting =
  | { kind: 'emptyCanvas' }
  | { kind: 'workflowOpen' }
  | { kind: 'firstOpen' }
  | { kind: 'unconnectedInput'; node: string; input: string }
