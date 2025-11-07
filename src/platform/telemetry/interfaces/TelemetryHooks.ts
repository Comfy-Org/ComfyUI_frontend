import type {
  ExecutionContext,
  SurveyResponses,
  TemplateMetadata
} from '../types'

/**
 * Context types provided by domain stores to telemetry
 */
interface UserContext {
  id: string
  email?: string
  tier?: 'free' | 'pro' | 'enterprise'
}

interface WorkflowContext {
  filename?: string
  isTemplate: boolean
  nodeCount?: number
  hasCustomNodes?: boolean
}

interface SubscriptionContext {
  isSubscribed: boolean
  plan?: string
  creditsRemaining?: number
}

/**
 * Telemetry hooks interface for dependency inversion.
 * Domain stores register these hooks to provide context to telemetry
 * without creating circular dependencies.
 */
export interface TelemetryHooks {
  // Context providers
  getExecutionContext?(): ExecutionContext | null
  getCurrentUser?(): UserContext | null
  getActiveWorkflow?(): WorkflowContext | null

  // Setting providers
  getSurveyData?(): SurveyResponses | null
  getSubscriptionStatus?(): SubscriptionContext | null

  // Template metadata providers
  getTemplateMetadata?(filename: string): TemplateMetadata | null

  // Feature flag providers
  getFeatureFlags?(): Record<string, boolean>
}
