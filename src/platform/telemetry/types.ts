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

import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { AuditLog } from '@/services/customerEventsService'
import type { AppMode } from '@/utils/appMode'

export type AuthMethod = 'email' | 'google' | 'github'

export type PaymentIntentSource =
  | 'subscription_required'
  | 'out_of_credits'
  | 'top_up_blocked'
  | 'deep_link'
  | 'subscribe_to_run'
  | 'subscribe_now_button'
  | 'upgrade_to_add_credits'
  | 'settings_billing_panel'
  | 'avatar_menu_plans'
  | 'team_members_panel'
  | 'invite_member_upsell'
  | 'upload_model_upgrade'
  | 'team_upgrade_resume'
  | 'free_tier_quota'

export type SubscriptionCheckoutType = 'new' | 'change'
export type SubscriptionCheckoutTier = TierKey | 'team'

/**
 * Authentication metadata for sign-up tracking
 */
export interface AuthMetadata {
  method?: AuthMethod
  is_new_user?: boolean
  user_id?: string
  email?: string
  share_id?: string
  referrer_url?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export type AuthFlowAction =
  | 'email_sign_in'
  | 'email_sign_up'
  | 'google_sign_in'
  | 'google_sign_up'
  | 'github_sign_in'
  | 'github_sign_up'
  | 'password_reset'

/**
 * Metadata for failed authentication attempts
 */
export interface AuthErrorMetadata {
  error_code: string
  auth_action: AuthFlowAction
}

export type UnifiedAuthRetryFailureReason =
  | 'missing_bearer'
  | 'non_replayable_body'
  | 'remint_failed'
  | 'retry_rejected'
  | 'retry_request_failed'

export interface UnifiedAuthRetryMetadata {
  transport: 'axios' | 'fetch'
  outcome: 'succeeded' | 'failed'
  final_status?: number
  failure_reason?: UnifiedAuthRetryFailureReason
}

/**
 * Survey field ids mapped to answers. Fields are backend-overridable, so all
 * are optional.
 */
export interface SurveyResponses {
  // Current default schema (see defaultSurveySchema.ts)
  intent?: string | string[]
  intentOther?: string
  experience?: string
  focus?: string
  source?: string
  sourceOther?: string
  source_social?: string
  // Legacy fields — only emitted by older backend-supplied schemas, never by
  // the current default. Kept so historical responses still typecheck.
  familiarity?: string
  industry?: string
  useCase?: string
  making?: string[]
  role?: string
  teamSize?: string
  usage?: string
}

/** Stages inside the coachmark sequence, which is what `step_count` counts. */
export type OnboardingTourStepStage =
  | 'not_started'
  | 'started'
  | 'step_shown'
  | 'completed'
  | 'skipped'

/** The nudge follows the tour, so it has no step to report. */
export type OnboardingTourNudgeStage =
  | 'nudge_shown'
  | 'explore_templates_clicked'

export type OnboardingTourStage =
  | OnboardingTourStepStage
  | OnboardingTourNudgeStage

export type OnboardingTourSkipReason =
  | 'user'
  | 'target_timeout'
  | 'trigger_lost'
  | 'postponed'

export type OnboardingTourNotStartedReason =
  | 'already_seen'
  | 'no_roles'
  | 'run_only'
  | 'no_steps'
  | 'resolver_failed'

/**
 * `step_number` is 1-based and matches the "Step N of M" indicator the user
 * sees, with `step_count` as M. Both `step_number` and `coach_id` are absent
 * for steps with no numbered spotlight (e.g. the landing). `skip_reason` is
 * present only on the `skipped` stage.
 */
export interface OnboardingTourStepMetadata {
  tour: string
  step_count: number
  step_number?: number
  coach_id?: string
  skip_reason?: OnboardingTourSkipReason
  not_started_reason?: OnboardingTourNotStartedReason
}

/** The nudge is post-tour, so it reports no step and no count. */
export interface OnboardingTourNudgeMetadata {
  tour: string
  /**
   * Whether the tour was walked to the end. Without it `nudge_shown` and
   * `explore_templates_clicked` cannot be split by how the tour ended, so a
   * conversion from a completed tour and one from a tour that never started
   * land in the same bucket.
   */
  tour_completed?: boolean
}

export type OnboardingTourMetadata =
  | OnboardingTourStepMetadata
  | OnboardingTourNudgeMetadata

export interface SurveyResponsesNormalized extends SurveyResponses {
  industry_normalized?: string
  industry_raw?: string
  useCase_normalized?: string
  useCase_raw?: string
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
  has_toolkit_nodes: boolean
  toolkit_node_names: string[]
  trigger_source?: ExecutionTriggerSource
  view_mode: AppMode
  is_app_mode: boolean
  dock_state: ActionbarDockState
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
  has_toolkit_nodes: boolean
  toolkit_node_names: string[]
  toolkit_node_count: number
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

export interface WorkflowExecutionContext {
  workflow_type: 'template' | 'custom'
  view_mode: AppMode
  execution_scope: 'full' | 'partial'
  total_node_count: number
  executable_node_count: number
  custom_node_count: number
  api_node_count: number
  subgraph_count: number
}

export interface WorkflowQueueIntent {
  trigger_source?: ExecutionTriggerSource
}

export interface WorkflowExecutionIntent {
  trigger_source: ExecutionTriggerSource
}

export type WorkflowExecutionFailureReason =
  | 'prompt_build_failed'
  | 'submission_rejected'
  | 'submission_failed'
  | 'execution_failed'
  | 'execution_interrupted'

interface ExecutionOutcomeBaseMetadata extends WorkflowExecutionIntent {
  startTime: number
  submissionAcceptedAt?: number
  executionStartedAt?: number
  endTime: number
  workflowContext?: WorkflowExecutionContext
}

export type ExecutionOutcomeMetadata = ExecutionOutcomeBaseMetadata &
  (
    | {
        success: true
        failureReason: ''
      }
    | {
        success: false
        failureReason: WorkflowExecutionFailureReason
      }
  )

/**
 * Execution success metadata
 */
export interface ExecutionSuccessMetadata {
  jobId: string
}

export interface SharedWorkflowRunMetadata {
  job_id: string
  share_id: string
  view_mode: AppMode
  is_app_mode: boolean
}

export type ActionbarDockState = 'docked' | 'floating'

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
export interface MissingNodePack {
  /**
   * Custom node pack identifier (cnrId / aux_id from node properties).
   * `'unknown'` when the workflow JSON has no pack hint for the node.
   */
  pack_id: string
  node_types: string[]
}

export interface WorkflowImportMetadata {
  missing_node_count: number
  missing_node_types: string[]
  /**
   * Missing nodes grouped by their custom node pack. Populated from the
   * `cnr_id` / `aux_id` baked into node properties — no network lookups.
   */
  missing_node_packs?: MissingNodePack[]
  /**
   * The source of the workflow open/import action
   */
  open_source?:
    | 'file_button'
    | 'file_drop'
    | 'template'
    | 'shared_url'
    | 'unknown'
  share_id?: string
}

export interface EnterLinearMetadata {
  source?: string
}

export interface WorkflowSavedMetadata {
  is_app: boolean
  is_new: boolean
}

export interface DefaultViewSetMetadata {
  default_view: 'app' | 'graph'
}

type ShareFlowStep =
  | 'dialog_opened'
  | 'save_prompted'
  | 'link_created'
  | 'link_copied'

export interface ShareFlowMetadata {
  step: ShareFlowStep
  source?: 'app_mode' | 'graph_mode'
  share_id?: string
  view_mode: AppMode
  is_app_mode: boolean
}

export interface ShareLinkOpenedMetadata {
  share_id: string
  is_authenticated: boolean
  view_mode: AppMode
  is_app_mode: boolean
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
  source: 'sidebar' | 'menu' | 'command' | 'appbuilder' | 'first_run_nudge'
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
 * Shell layout snapshot, sent once per session when the app is ready
 */
export interface ShellLayoutMetadata {
  view_mode: AppMode
  is_app_mode: boolean
  dock_state: ActionbarDockState
  actionbar_position: string
  active_sidebar_tab: string | null
  right_side_panel_open: boolean
  bottom_panel_open: boolean
  open_workflow_tabs: number
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
 * Search query metadata. One event per debounced query change across
 * each search surface.
 */
export type SearchSurface =
  | 'node_modal'
  | 'node_sidebar'
  | 'apps'
  | 'templates'
  | 'settings'

export interface SearchQueryMetadata {
  surface: SearchSurface
  query: string
  query_length: number
  result_count: number
  has_results: boolean
}

/**
 * Node added metadata. `source` indicates how the user initiated the add.
 * Bulk additions during workflow load are excluded — workflow_imported
 * already covers that.
 */
export type NodeAddSource =
  | 'sidebar_drag'
  | 'asset_browser'
  | 'search_modal'
  | 'paste'
  | 'programmatic'
  | 'unknown'

export interface NodeAddedMetadata {
  node_type: string
  source: NodeAddSource
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
    | 'relevance'
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
  button_id: string
  element_group: string
}

/**
 * Widget (input/parameter) favorite toggle tracking metadata.
 * Used to measure discoverability of the right side panel favoriting feature.
 */
export interface WidgetFavoriteToggledMetadata {
  node_type: string
  widget_name: string
  widget_type: string
  is_favorited: boolean
  source: 'right_side_panel'
}

/**
 * Fired once per node when its `widgets_values_named` restore path
 * disagrees with what the legacy positional `widgets_values` restore
 * would have produced. Diagnostic only — never reflects an actual
 * mis-restored widget value, since the legacy side is a shadow
 * computation that's never applied when the flag is on.
 */
export interface NamedValuesShadowDiffMismatchMetadata {
  node_type: string
  pack_id?: string
  mismatch_widget_count: number
  checked_widget_count: number
  had_named_field: boolean
  has_on_serialize_hook: boolean
  has_on_configure_hook: boolean
}

/**
 * Fired once per workflow load (sampled), aggregating the shadow-diff
 * results across every node checked during that load.
 */
export interface NamedValuesShadowDiffSummaryMetadata {
  total_nodes_checked: number
  nodes_with_mismatch: number
  distinct_node_types: string[]
  distinct_pack_ids: string[]
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
    | 'status'
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
 * Page view metadata for route tracking
 */
export interface PageViewMetadata {
  path?: string
  referrer?: string
  title?: string
  [key: string]: unknown
}

export interface CheckoutAttributionMetadata {
  ga_client_id?: string
  ga_session_id?: string
  ga_session_number?: string
  im_ref?: string
  rewardful_referral?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
}

export interface SubscriptionMetadata {
  current_tier?: string
  reason?: PaymentIntentSource
}

export interface AddCreditsClickMetadata {
  source:
    | 'credits_panel'
    | 'avatar_menu'
    | 'settings_billing_panel'
    | 'deep_link'
}

export interface SubscriptionCancellationMetadata {
  current_tier?: string
  cycle?: BillingCycle
  /**
   * `manage_subscription_button` opens the external billing portal, where
   * cancellation is one of the few possible actions but not the only one —
   * treat it as probable, not certain, cancel intent.
   */
  source?: 'cancel_plan_menu' | 'manage_subscription_button'
  /** ISO date the subscription runs until if the cancel goes through. */
  end_date?: string
  /** Present only on the `failed` stage. */
  error_message?: string
}

export interface ResubscribeClickMetadata {
  source: 'pricing_dialog' | 'settings_billing_panel'
  /** Why the pricing dialog was opened, when the click came from one. */
  payment_intent_source?: PaymentIntentSource
}

export interface BeginCheckoutMetadata
  extends Record<string, unknown>, CheckoutAttributionMetadata {
  user_id: string
  tier: SubscriptionCheckoutTier
  cycle: BillingCycle
  checkout_type: SubscriptionCheckoutType
  checkout_attempt_id?: string
  billing_op_id?: string
  previous_tier?: TierKey
  payment_intent_source?: PaymentIntentSource
}

interface EcommerceItemMetadata {
  item_name: string
  item_category: string
  item_variant?: string
  price: number
  quantity: number
}

interface EcommerceMetadata {
  currency: string
  value: number
  items: EcommerceItemMetadata[]
}

export interface SubscriptionSuccessMetadata extends Record<string, unknown> {
  user_id?: string
  checkout_attempt_id?: string
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkout_type?: SubscriptionCheckoutType
  previous_tier?: TierKey
  payment_intent_source?: PaymentIntentSource
  /** Present when the success is reported off the workspace billing-op poller. */
  billing_op_id?: string
  value?: number
  currency?: string
  ecommerce?: EcommerceMetadata
  /**
   * Set when the underlying checkout attempt was initiated from the resubscribe
   * flow, so the pending-checkout recovery in `useSubscription.ts` can emit the
   * canonical `billing.resubscribe.succeeded` terminal instead of leaving the
   * legacy rail's `started`/`pending` resubscribe event unclosed forever.
   */
  operation?: 'resubscribe'
  /** The click-time source, carried through so the terminal event can report it. */
  resubscribe_source?: ResubscribeClickMetadata['source']
}

export interface WorkspaceInviteMetadata extends Record<string, unknown> {
  source: 'post_upgrade_success' | 'settings_members'
  count: number
}

export interface WorkspaceInviteFailedMetadata extends Record<string, unknown> {
  source: WorkspaceInviteMetadata['source']
  attempted_count: number
  failed_count: number
}

type BillingFailureCategory =
  | 'validation'
  | 'network'
  | 'api_rejected'
  | 'provider_decline'
  | 'redirect'
  | 'poll_timeout'
  | 'reconciliation_needed'
  | 'stale_operation'
  | 'rendering'
  | 'unknown'

type BillingErrorCode =
  | 'downgrade_not_allowed'
  | 'member_removal_failed'
  | 'missing_checkout_response'
  | 'missing_payment_method_url'
  | 'payment_popup_blocked'
  | 'reactivation_not_confirmed'
  | 'reactivation_amount_changed'

export interface BillingFailure {
  failure_category: BillingFailureCategory
  error_code?: BillingErrorCode
}

type BillingStarted = {
  stage: 'started'
  outcome: 'pending'
}

type BillingSucceeded = {
  stage: 'succeeded'
  outcome: 'success'
}

type BillingFailed = BillingFailure & {
  stage: 'failed'
  outcome: 'failure'
}

type BillingTimedOut = {
  stage: 'timeout'
  outcome: 'failure'
  failure_category: 'poll_timeout'
}

type SubscriptionCheckoutBillingEvent = {
  operation: 'subscription_checkout'
  billing_op_id?: string
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkout_type?: SubscriptionCheckoutType
  payment_intent_source?: PaymentIntentSource
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event.
   */
  duration_ms?: number
} & (BillingStarted | BillingSucceeded | BillingFailed)

type BillingOperationBillingEvent = {
  operation: 'operation'
  /** Absent when the initiating call itself failed, before the backend returned one to poll. */
  billing_op_id?: string
  operation_type: 'subscription' | 'topup' | 'cancel'
  tier?: SubscriptionCheckoutTier
  cycle?: BillingCycle
  checkout_type?: SubscriptionCheckoutType
  payment_intent_source?: PaymentIntentSource
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event, including the
   * initiating API call's latency (not just the poll-observation window).
   * On `timeout` this is how long the client watched, not the operation's
   * true duration.
   */
  duration_ms?: number
} & (BillingStarted | BillingSucceeded | BillingFailed | BillingTimedOut)

type ResubscribeBillingEvent = {
  operation: 'resubscribe'
  source: ResubscribeClickMetadata['source']
  payment_intent_source?: PaymentIntentSource
} & (BillingStarted | BillingSucceeded | BillingFailed)

type TopupBillingEvent = {
  operation: 'topup'
  billing_op_id?: string
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event.
   */
  duration_ms?: number
} & (BillingStarted | BillingSucceeded | BillingFailed)

type DowngradeToPersonalBillingEvent = {
  operation: 'downgrade_to_personal'
  member_removal_count: number
  member_removal_failures: number
  target_tier?: TierKey
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event.
   */
  duration_ms?: number
} & (BillingStarted | BillingSucceeded | BillingFailed)

export type BillingTelemetryEvent =
  | SubscriptionCheckoutBillingEvent
  | BillingOperationBillingEvent
  | ResubscribeBillingEvent
  | TopupBillingEvent
  | DowngradeToPersonalBillingEvent

type BillingTelemetryEventNameFor<T extends BillingTelemetryEvent> =
  T extends BillingTelemetryEvent
    ? `billing.${T['operation']}.${T['stage']}`
    : never

export type BillingTelemetryEventName =
  BillingTelemetryEventNameFor<BillingTelemetryEvent>

export function getBillingTelemetryEventName(
  event: BillingTelemetryEvent
): BillingTelemetryEventName {
  return `billing.${event.operation}.${event.stage}` as BillingTelemetryEventName
}

export function getBillingTelemetryEventPayload(event: BillingTelemetryEvent) {
  return {
    operation: event.operation,
    stage: event.stage,
    outcome: event.outcome,
    ...('billing_op_id' in event &&
      event.billing_op_id !== undefined && {
        billing_op_id: event.billing_op_id
      }),
    ...('operation_type' in event && {
      operation_type: event.operation_type
    }),
    ...('tier' in event && event.tier !== undefined && { tier: event.tier }),
    ...('cycle' in event &&
      event.cycle !== undefined && { cycle: event.cycle }),
    ...('checkout_type' in event &&
      event.checkout_type !== undefined && {
        checkout_type: event.checkout_type
      }),
    ...('payment_intent_source' in event &&
      event.payment_intent_source !== undefined && {
        payment_intent_source: event.payment_intent_source
      }),
    ...('source' in event && { source: event.source }),
    ...('failure_category' in event && {
      failure_category: event.failure_category
    }),
    ...('error_code' in event &&
      event.error_code !== undefined && { error_code: event.error_code }),
    ...('member_removal_count' in event && {
      member_removal_count: event.member_removal_count,
      member_removal_failures: event.member_removal_failures
    }),
    ...('target_tier' in event &&
      event.target_tier !== undefined && { target_tier: event.target_tier }),
    ...('duration_ms' in event &&
      event.duration_ms !== undefined && { duration_ms: event.duration_ms })
  }
}

/**
 * Telemetry provider interface for individual providers.
 * All methods are optional - providers only implement what they need.
 */
export interface TelemetryProvider {
  // Authentication flow events
  trackSignupOpened?(): void
  trackAuth?(metadata: AuthMetadata): void
  trackAuthFailed?(metadata: AuthErrorMetadata): void
  trackUnifiedAuthRetry?(metadata: UnifiedAuthRetryMetadata): void
  trackUserLoggedIn?(): void

  // Subscription flow events
  trackSubscription?(
    event: 'modal_opened' | 'subscribe_clicked',
    metadata?: SubscriptionMetadata
  ): void
  trackBeginCheckout?(metadata: BeginCheckoutMetadata): void
  trackMonthlySubscriptionSucceeded?(
    metadata?: SubscriptionSuccessMetadata
  ): void
  trackMonthlySubscriptionCancelled?(): void
  trackSubscriptionCancellation?(
    event: 'flow_opened' | 'confirmed' | 'abandoned' | 'failed',
    metadata?: SubscriptionCancellationMetadata
  ): void
  trackResubscribeClicked?(metadata: ResubscribeClickMetadata): void
  trackAddApiCreditButtonClicked?(metadata?: AddCreditsClickMetadata): void
  trackApiCreditTopupButtonPurchaseClicked?(amount: number): void
  trackApiCreditTopupSucceeded?(): void
  trackWorkspaceInviteSent?(metadata: WorkspaceInviteMetadata): void
  trackWorkspaceInviteFailed?(metadata: WorkspaceInviteFailedMetadata): void
  trackRunButton?(properties: RunButtonProperties): void

  trackBillingEvent?(event: BillingTelemetryEvent): void

  // Credit top-up tracking (composition with internal utilities)
  startTopupTracking?(): void
  checkForCompletedTopup?(events: AuditLog[] | undefined | null): boolean
  clearTopupTracking?(): void

  // Survey flow events
  trackSurvey?(stage: 'opened' | 'submitted', responses?: SurveyResponses): void

  // Onboarding coachmark tour events
  trackOnboardingTour?(
    stage: OnboardingTourStepStage,
    metadata: OnboardingTourStepMetadata
  ): void
  trackOnboardingTour?(
    stage: OnboardingTourNudgeStage,
    metadata: OnboardingTourNudgeMetadata
  ): void

  // Email verification events
  trackEmailVerification?(stage: 'opened' | 'requested' | 'completed'): void

  // Template workflow events
  trackTemplate?(metadata: TemplateMetadata): void
  trackTemplateLibraryOpened?(metadata: TemplateLibraryMetadata): void
  trackTemplateLibraryClosed?(metadata: TemplateLibraryClosedMetadata): void

  // Workflow management events
  trackWorkflowImported?(metadata: WorkflowImportMetadata): void
  trackWorkflowOpened?(metadata: WorkflowImportMetadata): void
  trackWorkflowSaved?(metadata: WorkflowSavedMetadata): void
  trackDefaultViewSet?(metadata: DefaultViewSetMetadata): void
  trackEnterLinear?(metadata: EnterLinearMetadata): void
  trackShareFlow?(metadata: ShareFlowMetadata): void
  trackShareLinkOpened?(metadata: ShareLinkOpenedMetadata): void

  // Page visibility events
  trackPageVisibilityChanged?(metadata: PageVisibilityMetadata): void

  // Tab tracking events
  trackTabCount?(metadata: TabCountMetadata): void

  // Shell layout snapshot events
  trackShellLayout?(metadata: ShellLayoutMetadata): void

  // Node search analytics events
  trackNodeSearch?(metadata: NodeSearchMetadata): void
  trackNodeSearchResultSelected?(metadata: NodeSearchResultMetadata): void

  // Search query analytics
  trackSearchQuery?(metadata: SearchQueryMetadata): void

  // Node-added-to-canvas analytics
  trackNodeAdded?(metadata: NodeAddedMetadata): void

  // Template filter tracking events
  trackTemplateFilterChanged?(metadata: TemplateFilterMetadata): void

  // Help center events
  trackHelpCenterOpened?(metadata: HelpCenterOpenedMetadata): void
  trackHelpResourceClicked?(metadata: HelpResourceClickedMetadata): void
  trackHelpCenterClosed?(metadata: HelpCenterClosedMetadata): void

  // Workflow creation events
  trackWorkflowCreated?(metadata: WorkflowCreatedMetadata): void

  // Workflow execution events
  trackWorkflowExecution?(): void
  trackExecutionOutcome?(metadata: ExecutionOutcomeMetadata): void
  trackExecutionError?(metadata: ExecutionErrorMetadata): void
  trackExecutionSuccess?(metadata: ExecutionSuccessMetadata): void
  trackSharedWorkflowRun?(metadata: SharedWorkflowRunMetadata): void

  // Settings events
  trackSettingChanged?(metadata: SettingChangedMetadata): void

  // Generic UI button click events
  trackUiButtonClicked?(metadata: UiButtonClickMetadata): void

  // Right side panel widget favorite events
  trackWidgetFavoriteToggled?(metadata: WidgetFavoriteToggledMetadata): void

  // Named values shadow-diff diagnostics
  trackNamedValuesShadowDiffMismatch?(
    metadata: NamedValuesShadowDiffMismatchMetadata
  ): void
  trackNamedValuesShadowDiffSummary?(
    metadata: NamedValuesShadowDiffSummaryMetadata
  ): void

  // Page view tracking
  trackPageView?(pageName: string, properties?: PageViewMetadata): void
}

/**
 * Telemetry dispatcher interface returned by useTelemetry().
 * All methods are required - the registry implements all methods and dispatches
 * to registered providers using optional chaining.
 */
export type TelemetryDispatcher = Required<TelemetryProvider>

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
  USER_AUTH_FAILED: 'app:user_auth_failed',
  USER_LOGGED_IN: 'app:user_logged_in',
  UNIFIED_AUTH_RETRY_SUCCEEDED: 'auth.unified.request_retry.succeeded',
  UNIFIED_AUTH_RETRY_FAILED: 'auth.unified.request_retry.failed',

  // Subscription Flow
  RUN_BUTTON_CLICKED: 'app:run_button_click',
  SUBSCRIPTION_REQUIRED_MODAL_OPENED: 'app:subscription_required_modal_opened',
  SUBSCRIBE_NOW_BUTTON_CLICKED: 'app:subscribe_now_button_clicked',
  MONTHLY_SUBSCRIPTION_SUCCEEDED: 'app:monthly_subscription_succeeded',
  MONTHLY_SUBSCRIPTION_CANCELLED: 'app:monthly_subscription_cancelled',
  SUBSCRIPTION_CANCEL_FLOW_OPENED: 'app:subscription_cancel_flow_opened',
  SUBSCRIPTION_CANCEL_CONFIRMED: 'app:subscription_cancel_confirmed',
  SUBSCRIPTION_CANCEL_ABANDONED: 'app:subscription_cancel_abandoned',
  SUBSCRIPTION_CANCEL_FAILED: 'app:subscription_cancel_failed',
  RESUBSCRIBE_BUTTON_CLICKED: 'app:resubscribe_button_clicked',
  ADD_API_CREDIT_BUTTON_CLICKED: 'app:add_api_credit_button_clicked',
  API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED:
    'app:api_credit_topup_button_purchase_clicked',
  API_CREDIT_TOPUP_SUCCEEDED: 'app:api_credit_topup_succeeded',
  WORKSPACE_INVITE_SENT: 'app:workspace_invite_sent',
  WORKSPACE_INVITE_FAILED: 'app:workspace_invite_failed',
  BEGIN_CHECKOUT: 'begin_checkout',

  // Canonical Billing Lifecycle
  BILLING_SUBSCRIPTION_CHECKOUT_STARTED:
    'billing.subscription_checkout.started',
  BILLING_SUBSCRIPTION_CHECKOUT_SUCCEEDED:
    'billing.subscription_checkout.succeeded',
  BILLING_SUBSCRIPTION_CHECKOUT_FAILED: 'billing.subscription_checkout.failed',
  BILLING_OPERATION_STARTED: 'billing.operation.started',
  BILLING_OPERATION_SUCCEEDED: 'billing.operation.succeeded',
  BILLING_OPERATION_FAILED: 'billing.operation.failed',
  BILLING_OPERATION_TIMEOUT: 'billing.operation.timeout',
  BILLING_RESUBSCRIBE_STARTED: 'billing.resubscribe.started',
  BILLING_RESUBSCRIBE_SUCCEEDED: 'billing.resubscribe.succeeded',
  BILLING_RESUBSCRIBE_FAILED: 'billing.resubscribe.failed',
  BILLING_TOPUP_STARTED: 'billing.topup.started',
  BILLING_TOPUP_SUCCEEDED: 'billing.topup.succeeded',
  BILLING_TOPUP_FAILED: 'billing.topup.failed',
  BILLING_DOWNGRADE_TO_PERSONAL_STARTED:
    'billing.downgrade_to_personal.started',
  BILLING_DOWNGRADE_TO_PERSONAL_SUCCEEDED:
    'billing.downgrade_to_personal.succeeded',
  BILLING_DOWNGRADE_TO_PERSONAL_FAILED: 'billing.downgrade_to_personal.failed',

  // Onboarding Survey
  USER_SURVEY_OPENED: 'app:user_survey_opened',
  USER_SURVEY_SUBMITTED: 'app:user_survey_submitted',

  // Onboarding Coachmarks
  ONBOARDING_TOUR_NOT_STARTED: 'app:onboarding_tour_not_started',
  ONBOARDING_TOUR_STARTED: 'app:onboarding_tour_started',
  ONBOARDING_TOUR_STEP_SHOWN: 'app:onboarding_tour_step_shown',
  ONBOARDING_TOUR_COMPLETED: 'app:onboarding_tour_completed',
  ONBOARDING_TOUR_SKIPPED: 'app:onboarding_tour_skipped',
  ONBOARDING_TOUR_NUDGE_SHOWN: 'app:onboarding_tour_nudge_shown',
  ONBOARDING_TOUR_EXPLORE_TEMPLATES_CLICKED:
    'app:onboarding_tour_explore_templates_clicked',

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
  ENTER_LINEAR_MODE: 'app:app_mode_opened',
  SHARE_FLOW: 'app:share_flow',
  SHARE_LINK_OPENED: 'app:share_link_opened',

  // Page Visibility
  PAGE_VISIBILITY_CHANGED: 'app:page_visibility_changed',

  // Tab Tracking
  TAB_COUNT_TRACKING: 'app:tab_count_tracking',

  // Shell Layout
  SHELL_LAYOUT: 'app:shell_layout',

  // Node Search Analytics
  NODE_SEARCH: 'app:node_search',
  NODE_SEARCH_RESULT_SELECTED: 'app:node_search_result_selected',
  SEARCH_QUERY: 'app:search_query',
  NODE_ADDED: 'app:node_added_to_workflow',

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
  WORKFLOW_SAVED: 'app:workflow_saved',
  DEFAULT_VIEW_SET: 'app:default_view_set',

  // Execution Lifecycle
  EXECUTION_START: 'execution_start',
  EXECUTION_ERROR: 'execution_error',
  EXECUTION_SUCCESS: 'execution_success',
  SHARED_WORKFLOW_RUN: 'app:shared_workflow_run',
  // Generic UI Button Click
  UI_BUTTON_CLICKED: 'app:ui_button_clicked',

  // Right Side Panel Widget Favorites
  WIDGET_FAVORITE_TOGGLED: 'app:widget_favorite_toggled',

  // Named Values Shadow Diff (Comfy.Workflow.NamedValuesRestore diagnostics)
  NAMED_VALUES_SHADOW_DIFF_MISMATCH: 'app:named_values_shadow_diff_mismatch',
  NAMED_VALUES_SHADOW_DIFF_SUMMARY: 'app:named_values_shadow_diff_summary',

  // Page View
  PAGE_VIEW: 'app:page_view'
} as const

export type TelemetryEventName =
  (typeof TelemetryEvents)[keyof typeof TelemetryEvents]

export const OnboardingTourEvents: Record<
  OnboardingTourStage,
  TelemetryEventName
> = {
  not_started: TelemetryEvents.ONBOARDING_TOUR_NOT_STARTED,
  started: TelemetryEvents.ONBOARDING_TOUR_STARTED,
  step_shown: TelemetryEvents.ONBOARDING_TOUR_STEP_SHOWN,
  completed: TelemetryEvents.ONBOARDING_TOUR_COMPLETED,
  skipped: TelemetryEvents.ONBOARDING_TOUR_SKIPPED,
  nudge_shown: TelemetryEvents.ONBOARDING_TOUR_NUDGE_SHOWN,
  explore_templates_clicked:
    TelemetryEvents.ONBOARDING_TOUR_EXPLORE_TEMPLATES_CLICKED
}

export const CANCELLATION_STAGE_EVENTS = {
  flow_opened: TelemetryEvents.SUBSCRIPTION_CANCEL_FLOW_OPENED,
  confirmed: TelemetryEvents.SUBSCRIPTION_CANCEL_CONFIRMED,
  abandoned: TelemetryEvents.SUBSCRIPTION_CANCEL_ABANDONED,
  failed: TelemetryEvents.SUBSCRIPTION_CANCEL_FAILED
} as const

const executionTriggerSources = [
  'button',
  'keybinding',
  'legacy_ui',
  'unknown',
  'linear',
  'auto_queue'
] as const

export type ExecutionTriggerSource = (typeof executionTriggerSources)[number]

export function normalizeExecutionTriggerSource(
  value: unknown
): ExecutionTriggerSource {
  return (
    executionTriggerSources.find((triggerSource) => triggerSource === value) ??
    'unknown'
  )
}

/**
 * Union type for all possible telemetry event properties
 */
export type TelemetryEventProperties =
  | AuthMetadata
  | OnboardingTourMetadata
  | AuthErrorMetadata
  | UnifiedAuthRetryMetadata
  | SurveyResponses
  | TemplateMetadata
  | ExecutionContext
  | RunButtonProperties
  | ExecutionErrorMetadata
  | ExecutionSuccessMetadata
  | SharedWorkflowRunMetadata
  | CreditTopupMetadata
  | WorkflowImportMetadata
  | TemplateLibraryMetadata
  | TemplateLibraryClosedMetadata
  | PageVisibilityMetadata
  | TabCountMetadata
  | ShellLayoutMetadata
  | NodeSearchMetadata
  | NodeSearchResultMetadata
  | SearchQueryMetadata
  | TemplateFilterMetadata
  | SettingChangedMetadata
  | UiButtonClickMetadata
  | WidgetFavoriteToggledMetadata
  | NamedValuesShadowDiffMismatchMetadata
  | NamedValuesShadowDiffSummaryMetadata
  | HelpCenterOpenedMetadata
  | HelpResourceClickedMetadata
  | HelpCenterClosedMetadata
  | WorkflowCreatedMetadata
  | EnterLinearMetadata
  | ShareFlowMetadata
  | ShareLinkOpenedMetadata
  | WorkflowSavedMetadata
  | DefaultViewSetMetadata
  | SubscriptionMetadata
  | SubscriptionSuccessMetadata
  | WorkspaceInviteFailedMetadata
  | BillingTelemetryEvent
