/**
 * Telemetry Provider Interface
 *
 * CRITICAL: OSS Build Safety
 * This module is excluded from OSS builds via conditional compilation.
 * When DISTRIBUTION is unset (OSS builds), Vite's tree-shaking removes this code entirely,
 * ensuring the open source build contains no telemetry dependencies.
 *
 * To verify OSS builds are clean:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `grep -RinE --include='*.js' 'trackWorkflow|trackEvent|mixpanel' dist/` (should find nothing)
 * 3. Check dist/assets/*.js files contain no tracking code
 */

import type { AuditLog } from '@/services/customerEventsService'

/**
 * Authentication metadata for sign-up tracking
 */
export interface AuthMetadata {
  method?: 'email' | 'google' | 'github'
  is_new_user?: boolean
  referrer_url?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

/**
 * Survey response data for user profiling
 * Maps 1-to-1 with actual survey fields
 */
export interface SurveyResponses {
  familiarity?: string
  industry?: string
  useCase?: string
  making?: string[]
}

/**
 * Run button tracking properties
 */
export interface RunButtonProperties {
  subscribe_to_run: boolean
  workflow_type: 'template' | 'custom'
  workflow_name: string
  custom_node_count: number
  total_node_count: number
  subgraph_count: number
  has_api_nodes: boolean
  api_node_names: string[]
  trigger_source?: ExecutionTriggerSource
}

/**
 * Execution context for workflow tracking
 */
export interface ExecutionContext {
  is_template: boolean
  workflow_name?: string
  // Template metadata (only present when is_template = true)
  template_source?: string
  template_category?: string
  template_tags?: string[]
  template_models?: string[]
  template_use_case?: string
  template_license?: string
  // Node composition metrics
  custom_node_count: number
  api_node_count: number
  subgraph_count: number
  total_node_count: number
  has_api_nodes: boolean
  api_node_names: string[]
  trigger_source?: ExecutionTriggerSource
}

/**
 * Execution error metadata
 */
export interface ExecutionErrorMetadata {
  jobId: string
  nodeId?: string
  nodeType?: string
  error?: string
}

/**
 * Execution success metadata
 */
export interface ExecutionSuccessMetadata {
  jobId: string
}

/**
 * Template metadata for workflow tracking
 */
export interface TemplateMetadata {
  workflow_name: string
  template_source?: string
  template_category?: string
  template_tags?: string[]
  template_models?: string[]
  template_use_case?: string
  template_license?: string
}

/**
 * Credit topup metadata
 */
export interface CreditTopupMetadata {
  credit_amount: number
}

/**
 * Workflow import metadata
 */
export interface WorkflowImportMetadata {
  missing_node_count: number
  missing_node_types: string[]
  /**
   * The source of the workflow open/import action
   */
  open_source?: 'file_button' | 'file_drop' | 'template' | 'unknown'
}

/**
 * Workflow open metadata
 */
/**
 * Enumerated sources for workflow open/import actions.
 */
export type WorkflowOpenSource = NonNullable<
  WorkflowImportMetadata['open_source']
>

/**
 * Template library metadata
 */
export interface TemplateLibraryMetadata {
  source: 'sidebar' | 'menu' | 'command'
}

/**
 * Template library closed metadata
 */
export interface TemplateLibraryClosedMetadata {
  template_selected: boolean
  time_spent_seconds: number
}

/**
 * Page visibility metadata
 */
export interface PageVisibilityMetadata {
  visibility_state: 'visible' | 'hidden'
}

/**
 * Tab count metadata
 */
export interface TabCountMetadata {
  tab_count: number
}

/**
 * Settings change metadata
 */
export interface SettingChangedMetadata {
  setting_id: string
  previous_value?: unknown
  new_value?: unknown
}

/**
 * Node search metadata
 */
export interface NodeSearchMetadata {
  query: string
}

/**
 * Node search result selection metadata
 */
export interface NodeSearchResultMetadata {
  node_type: string
  last_query: string
}

/**
 * Template filter tracking metadata
 */
export interface TemplateFilterMetadata {
  search_query?: string
  selected_models: string[]
  selected_use_cases: string[]
  selected_runs_on: string[]
  sort_by:
    | 'default'
    | 'recommended'
    | 'popular'
    | 'alphabetical'
    | 'newest'
    | 'vram-low-to-high'
    | 'model-size-low-to-high'
  filtered_count: number
  total_count: number
}

/**
 * UI button click tracking metadata
 */
export interface UiButtonClickMetadata {
  /** Canonical identifier for the button (e.g., "comfy_logo") */
  button_id: string
}

/**
 * Help center opened metadata
 */
export interface HelpCenterOpenedMetadata {
  source: 'menu' | 'topbar' | 'sidebar'
}

/**
 * Help resource clicked metadata
 */
export interface HelpResourceClickedMetadata {
  resource_type:
    | 'docs'
    | 'discord'
    | 'github'
    | 'help_feedback'
    | 'manager'
    | 'release_notes'
  is_external: boolean
  source:
    | 'menu'
    | 'help_center'
    | 'error_dialog'
    | 'credits_panel'
    | 'subscription'
}

/**
 * Help center closed metadata
 */
export interface HelpCenterClosedMetadata {
  time_spent_seconds: number
}

/**
 * Workflow created metadata
 */
export interface WorkflowCreatedMetadata {
  workflow_type: 'blank' | 'default'
  previous_workflow_had_nodes: boolean
}

/**
 * Core telemetry provider interface
 */
export interface TelemetryProvider {
  // Authentication flow events
  trackSignupOpened(): void
  trackAuth(metadata: AuthMetadata): void
  trackUserLoggedIn(): void

  // Subscription flow events
  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void
  trackMonthlySubscriptionSucceeded(): void
  trackMonthlySubscriptionCancelled(): void
  trackAddApiCreditButtonClicked(): void
  trackApiCreditTopupButtonPurchaseClicked(amount: number): void
  trackApiCreditTopupSucceeded(): void
  trackRunButton(options?: {
    subscribe_to_run?: boolean
    trigger_source?: ExecutionTriggerSource
  }): void

  // Credit top-up tracking (composition with internal utilities)
  startTopupTracking(): void
  checkForCompletedTopup(events: AuditLog[] | undefined | null): boolean
  clearTopupTracking(): void

  // Survey flow events
  trackSurvey(stage: 'opened' | 'submitted', responses?: SurveyResponses): void

  // Email verification events
  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void

  // Template workflow events
  trackTemplate(metadata: TemplateMetadata): void
  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void
  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void

  // Workflow management events
  trackWorkflowImported(metadata: WorkflowImportMetadata): void
  trackWorkflowOpened(metadata: WorkflowImportMetadata): void

  // Page visibility events
  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void

  // Tab tracking events
  trackTabCount(metadata: TabCountMetadata): void

  // Node search analytics events
  trackNodeSearch(metadata: NodeSearchMetadata): void
  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void

  // Template filter tracking events
  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void

  // Help center events
  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void
  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void
  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void

  // Workflow creation events
  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void

  // Workflow execution events
  trackWorkflowExecution(): void
  trackExecutionError(metadata: ExecutionErrorMetadata): void
  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void

  // Settings events
  trackSettingChanged(metadata: SettingChangedMetadata): void

  // Generic UI button click events
  trackUiButtonClicked(metadata: UiButtonClickMetadata): void
}

/**
 * Telemetry event constants
 *
 * Event naming conventions:
 * - 'app:' prefix: UI/user interaction events
 * - No prefix: Backend/system events (execution lifecycle)
 */
export const TelemetryEvents = {
  // Authentication Flow
  USER_SIGN_UP_OPENED: 'app:user_sign_up_opened',
  USER_AUTH_COMPLETED: 'app:user_auth_completed',
  USER_LOGGED_IN: 'app:user_logged_in',

  // Subscription Flow
  RUN_BUTTON_CLICKED: 'app:run_button_click',
  SUBSCRIPTION_REQUIRED_MODAL_OPENED: 'app:subscription_required_modal_opened',
  SUBSCRIBE_NOW_BUTTON_CLICKED: 'app:subscribe_now_button_clicked',
  MONTHLY_SUBSCRIPTION_SUCCEEDED: 'app:monthly_subscription_succeeded',
  MONTHLY_SUBSCRIPTION_CANCELLED: 'app:monthly_subscription_cancelled',
  ADD_API_CREDIT_BUTTON_CLICKED: 'app:add_api_credit_button_clicked',
  API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED:
    'app:api_credit_topup_button_purchase_clicked',
  API_CREDIT_TOPUP_SUCCEEDED: 'app:api_credit_topup_succeeded',

  // Onboarding Survey
  USER_SURVEY_OPENED: 'app:user_survey_opened',
  USER_SURVEY_SUBMITTED: 'app:user_survey_submitted',

  // Email Verification
  USER_EMAIL_VERIFY_OPENED: 'app:user_email_verify_opened',
  USER_EMAIL_VERIFY_REQUESTED: 'app:user_email_verify_requested',
  USER_EMAIL_VERIFY_COMPLETED: 'app:user_email_verify_completed',

  // Template Tracking
  TEMPLATE_WORKFLOW_OPENED: 'app:template_workflow_opened',
  TEMPLATE_LIBRARY_OPENED: 'app:template_library_opened',
  TEMPLATE_LIBRARY_CLOSED: 'app:template_library_closed',

  // Workflow Management
  WORKFLOW_IMPORTED: 'app:workflow_imported',
  WORKFLOW_OPENED: 'app:workflow_opened',

  // Page Visibility
  PAGE_VISIBILITY_CHANGED: 'app:page_visibility_changed',

  // Tab Tracking
  TAB_COUNT_TRACKING: 'app:tab_count_tracking',

  // Node Search Analytics
  NODE_SEARCH: 'app:node_search',
  NODE_SEARCH_RESULT_SELECTED: 'app:node_search_result_selected',

  // Template Filter Analytics
  TEMPLATE_FILTER_CHANGED: 'app:template_filter_changed',

  // Settings
  SETTING_CHANGED: 'app:setting_changed',

  // Help Center Analytics
  HELP_CENTER_OPENED: 'app:help_center_opened',
  HELP_RESOURCE_CLICKED: 'app:help_resource_clicked',
  HELP_CENTER_CLOSED: 'app:help_center_closed',

  // Workflow Creation
  WORKFLOW_CREATED: 'app:workflow_created',

  // Execution Lifecycle
  EXECUTION_START: 'execution_start',
  EXECUTION_ERROR: 'execution_error',
  EXECUTION_SUCCESS: 'execution_success',
  // Generic UI Button Click
  UI_BUTTON_CLICKED: 'app:ui_button_clicked'
} as const

export type TelemetryEventName =
  (typeof TelemetryEvents)[keyof typeof TelemetryEvents]

export type ExecutionTriggerSource =
  | 'button'
  | 'keybinding'
  | 'legacy_ui'
  | 'unknown'
  | 'linear'

/**
 * Union type for all possible telemetry event properties
 */
export type TelemetryEventProperties =
  | AuthMetadata
  | SurveyResponses
  | TemplateMetadata
  | ExecutionContext
  | RunButtonProperties
  | ExecutionErrorMetadata
  | ExecutionSuccessMetadata
  | CreditTopupMetadata
  | WorkflowImportMetadata
  | TemplateLibraryMetadata
  | TemplateLibraryClosedMetadata
  | PageVisibilityMetadata
  | TabCountMetadata
  | NodeSearchMetadata
  | NodeSearchResultMetadata
  | TemplateFilterMetadata
  | SettingChangedMetadata
  | UiButtonClickMetadata
  | HelpCenterOpenedMetadata
  | HelpResourceClickedMetadata
  | HelpCenterClosedMetadata
  | WorkflowCreatedMetadata
