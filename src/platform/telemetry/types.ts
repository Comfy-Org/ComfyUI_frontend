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

import type { AppMode } from '@/composables/useAppMode'
import type { SubscriptionDialogReason } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { AuditLog } from '@/services/customerEventsService'

/**
 * Authentication metadata for sign-up tracking
 */
export interface AuthMetadata {
  method?: 'email' | 'google' | 'github'
  is_new_user?: boolean
  user_id?: string
  email?: string
  share_id?: string
  referrer_url?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

export type AuthMethod = 'email' | 'google' | 'github'

/**
 * `view` distinguishes the sign-in surface from the sign-up surface so the
 * auth funnel can split the two cohorts that today collapse into one drop.
 */
export type AuthView = 'login' | 'signup'

/**
 * Emitted when the user picks an auth method (email/google/github), before any
 * Firebase call. Lights the first step of the auth black box: page_view ->
 * method_selected, which is dark today.
 */
export interface AuthMethodSelectedMetadata {
  method: AuthMethod
  view: AuthView
}

export type OAuthProvider = 'google' | 'github'

type OAuthPopupResult = 'success' | 'cancelled' | 'error'

/**
 * Outcome of an OAuth popup round-trip. Popup cancels and errors are silent
 * today, so the google/github leg of the auth funnel cannot be debugged.
 */
export interface OAuthPopupResultMetadata {
  provider: OAuthProvider
  result: OAuthPopupResult
  error_code?: string
}

/**
 * `firebase` covers the credential/popup step; `create_customer` covers the
 * backend provisioning call that runs after Firebase succeeds. A
 * `create_customer` failure is the "zombie customer": authenticated in Firebase
 * but never provisioned, so it emits no auth_completed today.
 */
type AuthFailureStage = 'firebase' | 'create_customer'

export interface AuthFailedMetadata {
  method: AuthMethod
  stage: AuthFailureStage
  error_code?: string
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
  role?: string
  teamSize?: string
  source?: string
  usage?: string
  intent?: string[]
}

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
  source: 'sidebar' | 'menu' | 'command' | 'appbuilder'
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

/**
 * Surface that triggered a subscribe-now click. Lets us attribute the
 * `app:subscribe_now_button_clicked` event to the specific CTA the user
 * actually clicked, rather than only the legacy SubscribeButton.
 */
type SubscribeClickSource =
  | 'pricing_table'
  | 'subscribe_to_run'
  | 'subscribe_button'

export interface SubscriptionMetadata {
  current_tier?: string
  reason?: SubscriptionDialogReason
  // Populated on subscribe-now clicks so the funnel can split intent by the
  // tier/cycle selected and the CTA surface that fired the event.
  tier?: TierKey
  cycle?: BillingCycle
  source?: SubscribeClickSource
}

/**
 * Fired when the user toggles the monthly/yearly billing cycle on the
 * pricing table. Lets us see whether the annual-discount nudge actually
 * moves the cycle selection before checkout.
 */
export interface BillingCycleToggledMetadata {
  from: BillingCycle
  to: BillingCycle
}

/**
 * Fired when an authentication attempt fails (sign-in or sign-up). Lets the
 * signup funnel see the error/bounce leak that `app:user_auth_completed`
 * (success-only) cannot.
 */
export interface AuthErrorMetadata {
  method: 'email' | 'google' | 'github'
  is_sign_up: boolean
  error_code?: string
  error_message?: string
}

/**
 * Fired when the user switches category/tab in the template selector (e.g.
 * "Getting Started" vs "All"), so we can see which curated entry points get
 * used before a template is opened.
 */
export interface TemplateCategorySelectedMetadata {
  category_id: string
  category_label?: string
}

/**
 * `no_url` = the server created no Stripe session (response missing
 * checkout_url); `server_error` = the checkout request itself failed. Both end
 * the monetization funnel before the user ever reaches Stripe, and both are a
 * silent bounce today.
 */
type CheckoutInitiateFailureStage = 'no_url' | 'server_error'

export interface CheckoutInitiateFailedMetadata {
  stage: CheckoutInitiateFailureStage
  error_code?: string
}

/**
 * The browser blocked window.open for the Stripe checkout tab. Distinct from a
 * server failure: the session existed, the popup never opened.
 */
export type CheckoutWindowBlockedMetadata = Record<string, never>

/**
 * Fired when a completed job's output media first becomes visible. Zero
 * telemetry today on whether the user actually SAW their result, which is the
 * activation moment.
 */
export interface OutputViewedMetadata {
  workflow_run_id: string
  media_type: string
  is_first_output: boolean
}

/**
 * The UserCheckView routing fork after auth. `waitlist` = not yet provisioned
 * on cloud; `survey` = onboarding survey still required; `onboarded` = sent to
 * the app. Lights the post-auth void where users vanish before the canvas.
 */
type OnboardingDestination = 'waitlist' | 'survey' | 'onboarded'

export interface OnboardingRoutedMetadata {
  destination: OnboardingDestination
  survey_completed: boolean
  has_cloud_status: boolean
}

/**
 * Fired once when the graph canvas is interactive. `is_new_user` anchors
 * new-user activation on the canvas (user_logged_in carries no such flag), and
 * `ms_since_auth` measures auth -> canvas latency.
 */
export interface CanvasReadyMetadata {
  is_new_user: boolean
  ms_since_auth?: number
}

export interface BeginCheckoutMetadata
  extends Record<string, unknown>, CheckoutAttributionMetadata {
  user_id: string
  tier: TierKey
  cycle: BillingCycle
  checkout_type: 'new' | 'change'
  previous_tier?: TierKey
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
  checkout_attempt_id: string
  tier: TierKey
  cycle: BillingCycle
  checkout_type: 'new' | 'change'
  previous_tier?: TierKey
  value: number
  currency: string
  ecommerce: EcommerceMetadata
}

/**
 * Fired when a paywall / subscription dialog is shown. The top of the
 * monetization funnel: today the dialog opens with no signal of WHY it was
 * triggered, so paywall -> checkout drop cannot be attributed to a reason
 * (run gate, out of credits, model upload, etc.).
 */
export interface PaywallViewedMetadata {
  reason: SubscriptionDialogReason | string
  current_tier?: string
}

/**
 * Fired when the Stripe checkout window successfully opens.
 * `checkout_attempt_id` correlates this open with the eventual
 * checkout_returned, closing the loop on the Stripe round-trip that is a
 * black box today.
 */
export interface CheckoutViewedMetadata {
  checkout_attempt_id: string
  tier: string
  cycle: string
}

type CheckoutReturnOutcome = 'success' | 'cancelled' | 'unknown'

/**
 * Fired when the user returns from the Stripe checkout tab. Pairs with
 * checkout_viewed via `checkout_attempt_id` so abandonment at Stripe can be
 * measured directly instead of inferred from a missing success event.
 */
export interface CheckoutReturnedMetadata {
  checkout_attempt_id: string
  outcome: CheckoutReturnOutcome
}

/**
 * Fired once per user on their first successful workflow execution. The
 * core activation moment: the wiring phase guards once-per-user so this
 * marks the transition from signed-up to activated.
 */
export interface FirstExecutionCompletedMetadata {
  workflow_run_id: string
  customer_tier?: string
}

/**
 * Telemetry provider interface for individual providers.
 * All methods are optional - providers only implement what they need.
 */
export interface TelemetryProvider {
  // Authentication flow events
  trackSignupOpened?(): void
  trackAuthMethodSelected?(metadata: AuthMethodSelectedMetadata): void
  trackOAuthPopupResult?(metadata: OAuthPopupResultMetadata): void
  trackAuthFailed?(metadata: AuthFailedMetadata): void
  trackAuth?(metadata: AuthMetadata): void
  trackUserLoggedIn?(): void
  trackCanvasReady?(metadata: CanvasReadyMetadata): void
  trackOnboardingRouted?(metadata: OnboardingRoutedMetadata): void

  // Subscription flow events
  trackSubscription?(
    event: 'modal_opened' | 'subscribe_clicked',
    metadata?: SubscriptionMetadata
  ): void
  trackPaywallViewed?(metadata: PaywallViewedMetadata): void
  trackBeginCheckout?(metadata: BeginCheckoutMetadata): void
  trackCheckoutViewed?(metadata: CheckoutViewedMetadata): void
  trackCheckoutReturned?(metadata: CheckoutReturnedMetadata): void
  trackCheckoutInitiateFailed?(metadata: CheckoutInitiateFailedMetadata): void
  trackCheckoutWindowBlocked?(metadata?: CheckoutWindowBlockedMetadata): void
  trackBillingCycleToggled?(metadata: BillingCycleToggledMetadata): void
  trackAuthError?(metadata: AuthErrorMetadata): void
  trackTemplateCategorySelected?(
    metadata: TemplateCategorySelectedMetadata
  ): void
  trackMonthlySubscriptionSucceeded?(
    metadata?: SubscriptionSuccessMetadata
  ): void
  trackMonthlySubscriptionCancelled?(): void
  trackAddApiCreditButtonClicked?(): void
  trackApiCreditTopupButtonPurchaseClicked?(amount: number): void
  trackApiCreditTopupSucceeded?(): void
  trackRunButton?(options?: {
    subscribe_to_run?: boolean
    trigger_source?: ExecutionTriggerSource
  }): void

  // Credit top-up tracking (composition with internal utilities)
  startTopupTracking?(): void
  checkForCompletedTopup?(events: AuditLog[] | undefined | null): boolean
  clearTopupTracking?(): void

  // Survey flow events
  trackSurvey?(stage: 'opened' | 'submitted', responses?: SurveyResponses): void

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
  trackExecutionError?(metadata: ExecutionErrorMetadata): void
  trackExecutionSuccess?(metadata: ExecutionSuccessMetadata): void
  trackFirstExecutionCompleted?(metadata: FirstExecutionCompletedMetadata): void
  trackOutputViewed?(metadata: OutputViewedMetadata): void
  trackSharedWorkflowRun?(metadata: SharedWorkflowRunMetadata): void

  // Settings events
  trackSettingChanged?(metadata: SettingChangedMetadata): void

  // Generic UI button click events
  trackUiButtonClicked?(metadata: UiButtonClickMetadata): void

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
  AUTH_METHOD_SELECTED: 'app:auth_method_selected',
  OAUTH_POPUP_RESULT: 'app:oauth_popup_result',
  AUTH_FAILED: 'app:auth_failed',
  USER_AUTH_COMPLETED: 'app:user_auth_completed',
  USER_LOGGED_IN: 'app:user_logged_in',
  CANVAS_READY: 'app:canvas_ready',
  ONBOARDING_ROUTED: 'app:onboarding_routed',

  // Subscription Flow
  RUN_BUTTON_CLICKED: 'app:run_button_click',
  SUBSCRIPTION_REQUIRED_MODAL_OPENED: 'app:subscription_required_modal_opened',
  SUBSCRIBE_NOW_BUTTON_CLICKED: 'app:subscribe_now_button_clicked',
  PAYWALL_VIEWED: 'app:paywall_viewed',
  CHECKOUT_VIEWED: 'app:checkout_viewed',
  CHECKOUT_RETURNED: 'app:checkout_returned',
  CHECKOUT_INITIATE_FAILED: 'app:checkout_initiate_failed',
  CHECKOUT_WINDOW_BLOCKED: 'app:checkout_window_blocked',
  BILLING_CYCLE_TOGGLED: 'app:billing_cycle_toggled',
  AUTH_ERROR: 'app:auth_error',
  TEMPLATE_CATEGORY_SELECTED: 'app:template_category_selected',
  MONTHLY_SUBSCRIPTION_SUCCEEDED: 'app:monthly_subscription_succeeded',
  MONTHLY_SUBSCRIPTION_CANCELLED: 'app:monthly_subscription_cancelled',
  ADD_API_CREDIT_BUTTON_CLICKED: 'app:add_api_credit_button_clicked',
  API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED:
    'app:api_credit_topup_button_purchase_clicked',
  API_CREDIT_TOPUP_SUCCEEDED: 'app:api_credit_topup_succeeded',

  // Onboarding Survey
  USER_SURVEY_OPENED: 'app:user_survey_opened',
  USER_SURVEY_SUBMITTED: 'app:user_survey_submitted',

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
  FIRST_EXECUTION_COMPLETED: 'app:first_execution_completed',
  OUTPUT_VIEWED: 'app:output_viewed',
  SHARED_WORKFLOW_RUN: 'app:shared_workflow_run',
  // Generic UI Button Click
  UI_BUTTON_CLICKED: 'app:ui_button_clicked',

  // Page View
  PAGE_VIEW: 'app:page_view'
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
  | AuthMethodSelectedMetadata
  | OAuthPopupResultMetadata
  | AuthFailedMetadata
  | CanvasReadyMetadata
  | OnboardingRoutedMetadata
  | CheckoutInitiateFailedMetadata
  | CheckoutWindowBlockedMetadata
  | OutputViewedMetadata
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
  | PaywallViewedMetadata
  | CheckoutViewedMetadata
  | CheckoutReturnedMetadata
  | FirstExecutionCompletedMetadata
  | BillingCycleToggledMetadata
  | AuthErrorMetadata
  | TemplateCategorySelectedMetadata
