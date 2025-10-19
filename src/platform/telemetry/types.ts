/**
 * Telemetry Provider Interface
 *
 * ⚠️ CRITICAL: OSS Build Safety ⚠️
 * This module is excluded from OSS builds via conditional compilation.
 * When DISTRIBUTION is unset (OSS builds), Vite's tree-shaking removes this code entirely,
 * ensuring the open source build contains no telemetry dependencies.
 *
 * To verify OSS builds are clean:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `rg -r dist "telemetry|mixpanel"` (should find nothing)
 * 3. Check dist/assets/*.js files contain no tracking code
 */

/**
 * Authentication metadata for sign-up tracking
 */
export interface AuthMetadata {
  signup_method?: 'email' | 'google' | 'github'
  referrer_url?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

/**
 * Survey response data for user profiling
 */
export interface SurveyResponses {
  industry?: string
  team_size?: string
  use_case?: string
  familiarity?: string
  intended_use?: 'personal' | 'client' | 'inhouse'
}

/**
 * Run context for subscription tracking
 */
export interface RunContext {
  subscribe_to_run: boolean
  workflow_type?: 'template' | 'custom'
  workflow_name?: string
  is_first_run?: boolean
}

/**
 * Template metadata for workflow tracking
 */
export interface TemplateMetadata {
  workflow_id?: string
  workflow_name: string
  category?: string
  source?: string
}

/**
 * Core telemetry provider interface
 */
export interface TelemetryProvider {
  // Authentication flow events
  trackSignUp(stage: 'opened' | 'completed', metadata?: AuthMetadata): void

  // Subscription flow events
  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void
  trackRunButton(subscribeToRun: boolean, context?: Partial<RunContext>): void

  // Survey flow events
  trackSurvey(stage: 'opened' | 'submitted', responses?: SurveyResponses): void

  // Email verification events
  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void

  // Template workflow events
  trackTemplate(metadata: TemplateMetadata): void
}

/**
 * Telemetry event constants
 */
export const TelemetryEvents = {
  // Authentication Flow
  USER_SIGN_UP_OPENED: 'user_sign_up_opened',
  USER_SIGN_UP_COMPLETED: 'user_sign_up_completed',

  // Subscription Flow
  RUN_BUTTON_CLICKED: 'run_button_clicked',
  SUBSCRIPTION_REQUIRED_MODAL_OPENED: 'subscription_required_modal_opened',
  SUBSCRIBE_NOW_BUTTON_CLICKED: 'subscribe_now_button_clicked',

  // Onboarding Survey
  USER_SURVEY_OPENED: 'user_survey_opened',
  USER_SURVEY_SUBMITTED: 'user_survey_submitted',

  // Email Verification
  USER_EMAIL_VERIFY_OPENED: 'user_email_verify_opened',
  USER_EMAIL_VERIFY_REQUESTED: 'user_email_verify_requested',
  USER_EMAIL_VERIFY_COMPLETED: 'user_email_verify_completed',

  // Enhanced Template Tracking
  TEMPLATE_WORKFLOW_OPENED: 'template_workflow_opened'
} as const

export type TelemetryEventName =
  (typeof TelemetryEvents)[keyof typeof TelemetryEvents]
