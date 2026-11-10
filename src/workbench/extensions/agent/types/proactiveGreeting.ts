import type { ProactiveGreetingTelemetryContext } from '@comfyorg/telemetry/types'

type AgentGreetingVariant = 'A' | 'B' | 'C' | 'D'

export interface AgentGreeting {
  variant: AgentGreetingVariant
  canvas: 'empty' | 'workflow'
  copyLocale?: string
}

export interface AgentGreetingAssignment {
  userId: string
  workspaceId: string
  variant: AgentGreetingVariant
  telemetry?: ProactiveGreetingTelemetryContext
}
