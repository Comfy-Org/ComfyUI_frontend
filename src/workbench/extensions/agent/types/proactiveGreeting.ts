type AgentGreetingVariant = 'A' | 'B' | 'C' | 'D'

export interface AgentGreeting {
  variant: AgentGreetingVariant
  canvas: 'empty' | 'workflow'
}

export interface AgentGreetingAssignment {
  userId: string
  workspaceId: string
  variant: AgentGreetingVariant
}
