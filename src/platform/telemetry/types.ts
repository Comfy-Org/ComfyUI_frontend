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

import {
  AUTH_TELEMETRY_EVENT,
  SESSION_TELEMETRY_EVENT
} from '@comfyorg/account-core/telemetry'
import type {
  BillingTelemetryEvent,
  BillingTelemetryEventName,
  CheckoutJourneyTelemetryEvent,
  CheckoutJourneyTelemetryEventName,
  CheckoutJourneyTelemetryEventPayload,
  ResubscribeSource,
  SubscriptionCheckoutTier,
  SubscriptionCheckoutType
} from '@comfyorg/account-core/billing'
import { BILLING_TELEMETRY_EVENTS } from '@comfyorg/account-core/billing'
import type { BillingSource } from '@comfyorg/billing-contract'
import type { AgentRunMode } from '@comfyorg/ingest-types'
import type {
  AuthErrorMetadata,
  AuthFlowAction,
  AuthMethod,
  WebSessionTelemetryEvent
} from '@comfyorg/account-core/telemetry'
import type { SessionRefreshOutcome } from '@comfyorg/account-core/session'

import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { AppMode } from '@/utils/appMode'

export type { AuthMethod }

export type PaymentIntentSource = BillingSource

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

export type { AuthErrorMetadata, AuthFlowAction }

export type UnifiedAuthRetryFailureReason =
  | 'missing_bearer'
  | 'non_replayable_body'
  | 'remint_failed'
  | 'retry_rejected'
  | 'retry_request_failed'
  | 'token_unavailable'

export interface UnifiedAuthRetryMetadata {
  transport: 'axios' | 'fetch' | 'ws'
  outcome: 'succeeded' | 'failed'
  final_status?: number
  failure_reason?: UnifiedAuthRetryFailureReason
}

export type UnifiedAuthRefreshOutcome = SessionRefreshOutcome

/**
 * Outcome of one proactive unified Cloud-JWT refresh attempt. This lifecycle
 * drives session-cookie rotation, so a dead refresh chain breaks every
 * cookie-authenticated <img>/media load (FE-1595).
 */
export interface UnifiedAuthRefreshMetadata {
  outcome: UnifiedAuthRefreshOutcome
  retry_count?: number
}

/**
 * One failed image preview. An `<img>` error event reports no status, so
 * everything past `source` is reconstructed by `describeImageLoadFailure()`:
 * `status` comes from re-requesting the URL once, the rest from the URL and the
 * page. Fields are optional because a probe that was capped, blocked or never
 * applicable must still produce a report — a missing field is a real outcome,
 * recorded in `probe_outcome` rather than guessed at.
 */
export interface ImageLoadFailureMetadata {
  /**
   * Which surface failed. `node_image_preview` is the Vue node renderer;
   * `canvas_node_image` / `canvas_node_video` are the litegraph canvas previews
   * that every user gets by default, since `Comfy.VueNodes.Enabled` is off
   * unless App Builder turns it on. Splitting on this is what keeps a rate
   * measured on one renderer from being read as the rate for everyone.
   */
  source: 'node_image_preview' | 'canvas_node_image' | 'canvas_node_video'
  /** Load attempts made before giving up, including the first. */
  attempts?: number
  /** True when the load timed out rather than erroring — a stall, not a rejection. */
  timed_out?: boolean
  /** HTTP status of the follow-up probe. Absent unless `probe_outcome` is `probed`. */
  status?: number
  probe_outcome?:
    | 'probed'
    | 'probe_failed'
    | 'probe_timeout'
    | 'probe_capped'
    | 'probe_blocked'
    | 'probe_redirected'
    | 'probe_abandoned'
    | 'invalid_src'
  /** `/api/view?type=` — separates an expired output from a missing upload. */
  resource_kind?: 'output' | 'input' | 'temp' | 'unspecified' | 'not_api_view'
  /** Filename shape only; never the filename, which is user-authored. */
  filename_kind?: 'content_hash' | 'template' | 'named' | 'none'
  /** Time since this page loaded. Auth-expiry failures skew old; 404s do not. */
  page_age_ms?: number
  online?: boolean
  same_origin?: boolean
}

/**
 * One row per session describing how long startup took and where the time
 * went. `total_ms` is measured from navigation start, so it is directly
 * comparable to what a user experiences and can be percentiled across sessions
 * without joining per-phase events.
 *
 * `outcome` keeps the bad sessions in the data:
 * - `completed` — the loading screen came down normally.
 * - `failed` — startup threw; the loading screen came down anyway.
 * - `timed_out` — startup was still running at the watchdog deadline. Emitted
 *   *in addition to* whichever terminal row eventually follows, so a load that
 *   hangs is counted even when it never finishes. `pending` names the phases
 *   still open, which is where the session is stuck.
 *
 * Without the `timed_out` row the sessions users complain about are precisely
 * the ones absent from the data.
 */
export interface BootstrapCompleteMetadata {
  total_ms: number
  outcome: 'completed' | 'failed' | 'timed_out'
  phase_count: number
  /** Per-phase durations, keyed `<namespace>/<phase>` (e.g. `bootstrap/object-info`). */
  phases: Record<string, number>
  /** Phases still running when this row was emitted. Only set for `timed_out`. */
  pending?: string[]
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
  /** Whether the agent panel was open when the run was submitted. */
  agent_panel_open: boolean
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
  agent_panel_open: boolean
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
 * In-App Agent message rating metadata (PM-98). `vote` is null when the user retracts a
 * prior thumb, which the eval pipeline records as a retraction rather than dropping.
 */
export interface AgentMessageFeedbackMetadata extends Record<string, unknown> {
  message_id: string
  turn_id: string
  vote: 'up' | 'down' | null
  workflow_id: string | null
}

export type AgentPanelCloseSource =
  | 'close_button'
  | 'workflow_switch'
  | 'topbar_button'
  | 'pagehide'
export interface AgentPanelOpenedMetadata extends Record<string, unknown> {
  source: 'restored' | 'topbar_button' | 'automatic_consent' | 'activation'
}
export type AgentConsentNotOfferedReason =
  | 'first_run_screen'
  | 'tour_active'
  | 'dialog_open'
  | 'boot_undecided'
  | 'storage_unavailable'
export interface AgentConsentNotOfferedMetadata extends Record<
  string,
  unknown
> {
  reason: AgentConsentNotOfferedReason
}
/**
 * Why an automatic consent offer ended without either making the offer or
 * naming a surface that is holding it.
 *
 * `AgentConsentNotOfferedReason` covers the deferrals: a surface is in the way,
 * it is named, and the offer is retried when that surface clears. Everything
 * here is the other kind of ending - the attempt stopped for a reason of its
 * own. Some of those endings are correct (the offer was not needed) and some
 * are losses (it was owed and did not happen), so **a query over this event
 * must split by `exit`; a total is not a quantity.**
 *
 * Correctly not needed: `consent_already_accepted`, `card_already_seen`,
 * `already_offered`.
 * Owed and not made: everything else.
 *
 * There is deliberately no value for "the agent flag is off". Every exit here
 * is downstream of that check, so reporting it would emit once per page load
 * for everyone outside the rollout - a count of exposure rather than of the
 * mechanism - and the flag is already on every event as
 * `$feature/agent-in-app-experience`.
 *
 * The `request` stage is the one place these endings are *countable*: see
 * `AgentConsentOfferStage`. Every other stage reports the presence of an
 * ending once per page load, so counts are comparable within one
 * (`stage`, `exit`) pair and never across stages.
 */
export type AgentConsentOfferExit =
  /** No Comfy account is signed in. */
  | 'signed_out'
  /** Signed in, but the account has not resolved to a user id yet. */
  | 'account_unresolved'
  /** No active workspace id yet, and no switch is in progress. */
  | 'workspace_unresolved'
  /** A workspace switch is in progress, so the consent scope is moving. */
  | 'workspace_switching'
  /** The stored consent read has not settled, so consent is unknown. */
  | 'consent_unresolved'
  /** The stored consent read rejected. */
  | 'consent_read_failed'
  /** Consent is already stored for this scope, so no card is needed. */
  | 'consent_already_accepted'
  /** Another offer attempt for this page load has not finished. */
  | 'offer_in_flight'
  /** The card has already been on screen for this scope this page load. */
  | 'card_already_seen'
  /** Panel activation owns consent timing, so the automatic offer is dropped. */
  | 'activation_opened_panel'
  /** The one-shot auto-show key for this scope is already burned. */
  | 'already_offered'
  /** The first-run startup probe rejected. */
  | 'startup_probe_failed'
  /**
   * The consent scope moved while it was being resolved - a different account,
   * a workspace transition, or a switch that started - so the read that would
   * have decided whether to ask was never made. `request` stage only.
   */
  | 'scope_changed_before_read'
  /**
   * Resolving the consent scope raised. The account or the workspace went away
   * between the offer decision and the request. `request` stage only.
   */
  | 'scope_probe_failed'
  /**
   * The consent scope moved while the stored-consent read was in flight, so the
   * answer that came back belonged to a scope that is no longer current.
   * `request` stage only.
   */
  | 'scope_changed_after_read'
  /**
   * The card was asked for and the dialog closed before it rendered, so there
   * is no `agent_consent_shown` and no outcome to record against one. `request`
   * stage only.
   */
  | 'card_closed_before_mount'
/**
 * Which link in the offer chain exited. The same condition is checked at more
 * than one of these - the pair (`exit`, `stage`) is what identifies a single
 * exit in the code, so neither property is readable on its own.
 */
export type AgentConsentOfferStage =
  /** `loadConsentIfEligible` - before the consent read, or on its result. */
  | 'load'
  /** Waiting on the first-run startup decision. */
  | 'startup'
  /** `offerConsentUnprompted` - the offer attempt itself. */
  | 'offer'
  /**
   * The consent request itself - `requestConsentForCurrentUser` and the card
   * lifecycle in `showConsentDialog` - after the chain has decided to ask.
   *
   * The only stage that is **not** deduplicated, because it cannot inflate:
   * the automatic path reaches it at most once per consent scope per page load
   * (the one-shot auto-show key is burned first) and the button path reaches it
   * once per click, so a repeat here is a repeated attempt rather than a
   * measure of how long the tab was open.
   */
  | 'request'
export interface AgentConsentOfferExitedMetadata extends Record<
  string,
  unknown
> {
  exit: AgentConsentOfferExit
  stage: AgentConsentOfferStage
  /**
   * Whether a hold was armed at the moment of the exit, i.e. whether this page
   * load still has a queued retry. False on an owed-and-not-made exit means the
   * offer is gone for this page load with nothing scheduled to bring it back.
   *
   * Two qualifications, both from the `request` stage. It is **structurally
   * false** there: the offer drops the hold immediately before requesting, and
   * the only thing that re-arms it is the `canShow` hook, which runs after
   * every `request` exit. And the hold is not the only wake-up - `withConsent`
   * settling re-drives the chain when the identity changed - so on the two
   * `scope_changed_*` exits a retry does happen, by a mechanism this property
   * does not describe.
   */
  retry_armed: boolean
  /**
   * Which surface asked. Set **only** at the `request` stage, which is the one
   * stage reachable from the topbar button as well as the automatic offer;
   * every other stage is inside `offerConsentUnprompted` and automatic by
   * construction. A query about automatic offers must therefore either restrict
   * to `stage != 'request'` or filter `trigger = 'first_load'` - counting the
   * `request` stage unsplit mixes a user-initiated click into the automatic
   * denominator.
   */
  trigger?: AgentConsentTrigger
}
export type AgentOnboardingNotShownMetadata =
  | { reason: 'app_mode' | 'tour_active' }
  | { reason: 'target_missing'; step: number }
export interface AgentPanelClosedMetadata extends Record<string, unknown> {
  source: AgentPanelCloseSource
  open_duration_ms: number | null
}
export interface AgentEntryButtonClickedMetadata extends Record<
  string,
  unknown
> {
  resulting_state: 'opened' | 'closed'
}
export type AgentConsentTrigger =
  | 'first_load'
  | 'button_click'
  | 'first_message'
export interface AgentConsentShownMetadata extends Record<string, unknown> {
  trigger: AgentConsentTrigger
}
/**
 * How a consent card that was on screen ended, plus the moment consent becomes
 * stored. It used to carry only the two deciding values, which left a card that
 * was shown and then went quiet covering three different endings at once - a
 * dismissal, an acceptance whose save did not stick, and a signed-out
 * acceptance whose sign-in was abandoned. Those are now named, and
 * `save_error_shown` separates giving up after a failed save from walking away.
 *
 * **Only `accepted` means consent is stored.** That was this event's whole
 * meaning before the other values existed, so any query that counted it as "a
 * decision that stuck" must now filter `decision = 'accepted'`, and one that
 * wants "the user answered" wants `decision in ('accepted', 'rejected')`.
 *
 * **The pairing with `agent_consent_shown`, exactly.** For a signed-in user -
 * the whole cloud population - every impression ends in exactly one of these,
 * so an impression with no outcome is a defect rather than a dismissal. In the
 * signed-out (local) flow the card is only the first half: it ends at
 * `accepted_pending_sign_in`, and `accepted` follows separately if the sign-in
 * and the real save land. So `accepted` is the one value that is not always the
 * card's own ending, which is how it keeps meaning "consent is stored".
 */
export type AgentConsentDecision =
  /** Accepted, and the acceptance is durably stored. */
  | 'accepted'
  /** Declined on the card. Nothing is stored; the card can be offered again. */
  | 'rejected'
  /**
   * Closed without deciding - Escape, the overlay mask, or a programmatic close
   * such as navigation. Distinguishing this from `accept_not_persisted` is the
   * difference between the user walking away and the product failing them.
   */
  | 'dismissed'
  /**
   * Accepted, and the write did not stick without raising: the scope moved
   * mid-save or the workspace auth header was gone. The user believes they
   * consented and no consent exists.
   */
  | 'accept_not_persisted'
  /**
   * Accepted the card in the signed-out flow, where the card is only the first
   * half: a sign-in and a real save still have to land before consent exists,
   * and they report `accepted` themselves when they do. So this value with no
   * later `accepted` is an abandoned sign-in, which is the third case this
   * event could not previously name.
   */
  | 'accepted_pending_sign_in'
export interface AgentConsentResolvedMetadata extends Record<string, unknown> {
  decision: AgentConsentDecision
  /**
   * Whether the card had already shown a save error when it reached this
   * outcome. A raised save leaves the card open and retryable, so its ending is
   * one of the values above rather than an outcome of its own - this is what
   * tells "dismissed after the save failed" from "dismissed without trying",
   * and marks an `accepted` that only landed on a retry.
   */
  save_error_shown: boolean
}
export type AgentOnboardingAction = 'next' | 'finish' | 'skip'
/**
 * `step` is 1-based and matches the "Step N of M" indicator on the card.
 * `finish` marks completion, so the gap from `agent_onboarding_shown` is the
 * onboarding time.
 */
export interface AgentOnboardingStepMetadata extends Record<string, unknown> {
  step: number
  action: AgentOnboardingAction
}
/**
 * Where the composer's text came from, by the affordance that put it there:
 * `suggestion` is an empty-state suggestion chip, `edited` is an earlier prompt
 * reopened through the conversation's edit action, and `typed` is everything
 * the user wrote themselves. Each send falls into exactly one — a chip the user
 * then reworded stays `suggestion`, because the chip is still what it came from.
 */
export type AgentInputMethod = 'typed' | 'suggestion' | 'edited'
/**
 * A starter prompt by the slot it occupies in the empty state, not by the text
 * it shows: the copy is owned elsewhere and changes without the funnel
 * changing. `unregistered` means the rendered set is larger than this union —
 * a prompt was appended to either English distribution list without a matching
 * entry in `starterPrompts.ts`, so that extra chip reads as an unmapped slot.
 */
export type AgentStarterPromptId =
  | 'slot_1'
  | 'slot_2'
  | 'slot_3'
  | 'slot_4'
  | 'slot_5'
  | 'unregistered'
/**
 * Where the free-use notice was placed, for the DES-1221 placement experiment.
 *
 * Deliberately the PostHog variant keys verbatim: the analysis joins this property to
 * `$feature/agent-free-use-message-placement`, and a translation layer between
 * the two is one more place for the arms to drift apart.
 */
export type AgentFreeUsePlacement =
  | 'top-banner'
  | 'near-composer'
  | 'above-input'
  | 'inside-input'
export interface AgentFreeUseExposureMetadata extends Record<string, unknown> {
  placement: 'control' | AgentFreeUsePlacement
  '$feature/agent-free-use-message-placement': 'control' | AgentFreeUsePlacement
}
/**
 * Interactions with the notice itself. The experiment's primary outcome and
 * guardrails are all read off events that already exist — `agent_panel_opened`,
 * `agent_message_sent`, `agent_panel_closed`, node edits and run events — split
 * by the PostHog variant property. This event adds only what those cannot say:
 * whether the notice was actually on screen in its assigned arm, and what the
 * viewer did with it.
 */
export interface AgentFreeUseNoticeMetadata extends Record<string, unknown> {
  action: 'shown' | 'dismissed' | 'learn_more_clicked'
  placement: AgentFreeUsePlacement
}
export interface AgentStarterPromptClickedMetadata extends Record<
  string,
  unknown
> {
  prompt_id: AgentStarterPromptId
  /** Slot position, so a reorder is visible rather than silently re-labelling. */
  prompt_index: number
  /** Size of the rendered set, so a set that grew or shrank is visible too. */
  prompt_count: number
  /**
   * FNV-1a of the *displayed* text, 8 hex chars. Here so a copy change under a
   * stable `prompt_id` is detectable — without it, a before/after read cannot
   * tell a better slot from a rewritten one. Not the text itself (job `Don't`
   * #3), and not reversible.
   */
  prompt_text_hash: string
  /** The i18n locale that produced `prompt_text_hash`; two locales are two hashes of one prompt. */
  locale: string
  /**
   * Minted per click. Carried onto every `app:agent_message_sent` attempt
   * attributable to this click as `starter_prompt_click_id`. Retries mint a
   * new `client_message_id` but retain this id, so click conversion must count
   * distinct `starter_prompt_click_id` values rather than send events. A click
   * with no matching send attempt never converted.
   */
  click_id: string
  /**
   * Whether the composer was empty when the chip was clicked. Inserting
   * appends, so `false` means the submitted text is a mix of this prompt and
   * something else — do not read those as a clean per-prompt outcome.
   */
  draft_was_empty: boolean
}
export interface AgentMessageSentMetadata extends Record<string, unknown> {
  attachment_count: number
  node_tag_count: number
  /**
   * The thread the message was posted into, `null` when it starts a new one —
   * the backend mints that id in its acknowledgement, after this event fires.
   */
  thread_id: string | null
  /** The targeted workflow's cloud id, `null` when the tab has none yet. */
  workflow_id: string | null
  /**
   * Minted client-side, one per send attempt, so duplicate deliveries of this
   * event collapse onto one message. A retry after a failed send is a new
   * attempt and gets a new id. The backend does not receive it yet — the turn
   * POST contract carries no client id — so it dedups within the frontend
   * stream rather than joining to the backend turn; `thread_id` is the join
   * today.
   */
  client_message_id: string
  input_method: AgentInputMethod
  /**
   * Which starter prompt supplied this draft, `null` when none did. The last
   * chip clicked before the send wins, because inserting appends and the send
   * is one message. Starter-prompt suggestions always carry a non-null ID and
   * use `input_method: 'suggestion'`.
   */
  starter_prompt_id: AgentStarterPromptId | null
  /** `click_id` of the `app:agent_starter_prompt_clicked` this send came from, `null` when typed. */
  starter_prompt_click_id: string | null
}
export interface AgentNodeTaggedMetadata extends Record<string, unknown> {
  source: 'mention_picker'
}
export interface AgentAttachButtonClickedMetadata extends Record<
  string,
  unknown
> {
  method: 'menu' | 'drag_drop' | 'paste'
}
export interface AgentWorkflowAppliedMetadata extends Record<string, unknown> {
  workflow_id: string
  target: 'active_tab_switch' | 'active_tab_open'
}
export type AgentStopMethod = 'button' | 'escape'
export interface AgentStopClickedMetadata extends Record<string, unknown> {
  method: AgentStopMethod
  turn_id: string
  turn_elapsed_ms: number | null
}
export type AgentWorkflowBindSource =
  | 'active_tab'
  | 'selector_chip'
  | 'minted'
  | 'restored'
export interface AgentWorkflowBoundMetadata extends Record<string, unknown> {
  thread_id: string
  workflow_id: string
  prev_workflow_id: string | null
  bind_source: AgentWorkflowBindSource
}
export interface AgentRunApprovalShownMetadata extends Record<string, unknown> {
  turn_id: string
  workflow_id: string | null
}
export type AgentRunApprovalDecision = 'run' | 'cancel' | 'open_workflow'
export interface AgentRunApprovalResolvedMetadata extends Record<
  string,
  unknown
> {
  decision: AgentRunApprovalDecision
  time_to_decide_ms: number
}
export interface AgentRunModeChangedMetadata extends Record<string, unknown> {
  from: AgentRunMode['mode']
  to: AgentRunMode['mode']
}
export type AgentThreadStartSource =
  | 'new_chat_button'
  | 'first_open'
  | 'history_select'
  | 'history_delete'
export interface AgentThreadStartedMetadata extends Record<string, unknown> {
  source: AgentThreadStartSource
}

export type AgentErrorClass =
  | 'request_failed'
  | 'malformed_stream_event'
  | 'cancel_failed'
  | 'history_load_failed'
  | 'ask_answer_failed'
  | 'thread_list_load_failed'
  | 'workflow_open_failed'
export interface AgentErrorMetadata extends Record<string, unknown> {
  error_class: AgentErrorClass
  failure_stage: 'pre_acceptance' | 'post_acceptance'
  retryable: boolean
  turn_accepted: boolean
  /** `none` is a failure the user was never shown. */
  ui_treatment: 'inline_notice' | 'error_overlay' | 'toast' | 'none'
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
 * Fired once per duplicate link dropped during workflow load, when the loser
 * has a *different origin* from the survivor — i.e. a connection the file
 * recorded is silently discarded, not merely a redundant same-origin copy.
 * Cloud cannot see the accompanying `console.warn`, so this is the only
 * signal that a load lost a link. The survivor follows an authoritative
 * serialized reference: `input.link` for node inputs, `linkIds` priority
 * order for subgraph boundaries, and document order otherwise. `target`
 * names the contested input slot.
 */
export interface LinkDedupDropMetadata {
  droppedLinkId: number
  survivorLinkId: number
  target: string
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
    | 'agent_paywall'
}

export type AgentPaywallReason =
  | 'no_funds'
  | 'subscription_inactive'
  | 'member_cannot_pay'
  | 'sales_managed'
  | 'unknown'

/**
 * Which moment put the paywall in front of the user. The two are not
 * interchangeable and collapsing them made the funnel unreadable:
 *
 * - `refused_send` is reactive — a turn POST came back 402/`no_funds`, so the
 *   user had to compose and send a message to discover they could not.
 * - `credits_exhausted` is standing — the client already knows the workspace
 *   has no funds and says so beside the composer, without a refusal first.
 *
 * Reported because `app:agent_paywall_shown` alone cannot tell a rise in
 * impressions caused by the standing surface from one caused by more users
 * being refused. Without the split, "the paywall is showing more" is
 * ambiguous between the fix working and the product getting worse.
 */
export type AgentPaywallSurface = 'refused_send' | 'credits_exhausted'

export interface AgentPaywallShownMetadata {
  reason: AgentPaywallReason
  surface: AgentPaywallSurface
}

export type AgentPaywallCta = 'subscribe' | 'add_credits' | 'upgrade'

export interface AgentPaywallCtaMetadata {
  cta: AgentPaywallCta
  /** The surface whose impression this click follows. */
  surface: AgentPaywallSurface
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
  source: ResubscribeSource
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
  recovery_outcome?: 'late_success'
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

export interface FetchTimeoutMetadata {
  route: string
  method: string
  timeout_ms: number
}

/**
 * Telemetry provider interface for individual providers.
 * All methods are optional - providers only implement what they need.
 */
export interface TelemetryProvider {
  trackFeatureFlagEvaluation?(key: string, value: unknown): void

  // Authentication flow events
  trackSignupOpened?(): void
  trackAuth?(metadata: AuthMetadata): void
  trackAuthFailed?(metadata: AuthErrorMetadata): void
  trackUnifiedAuthRetry?(metadata: UnifiedAuthRetryMetadata): void
  trackUnifiedAuthRefresh?(metadata: UnifiedAuthRefreshMetadata): void
  trackWebSessionEvent?(event: WebSessionTelemetryEvent): void
  trackImageLoadFailed?(metadata: ImageLoadFailureMetadata): void
  trackUserLoggedIn?(): void
  trackBootstrapComplete?(metadata: BootstrapCompleteMetadata): void

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

  /** Emit a checkout-journey lifecycle event to this provider. */
  trackCheckoutJourneyEvent?(event: CheckoutJourneyTelemetryEvent): void

  trackAgentPaywallShown?(metadata: AgentPaywallShownMetadata): void
  trackAgentPaywallCtaClicked?(metadata: AgentPaywallCtaMetadata): void

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

  // In-App Agent message rating (PM-98)
  trackAgentMessageFeedback?(metadata: AgentMessageFeedbackMetadata): void
  trackAgentPanelOpened?(metadata: AgentPanelOpenedMetadata): void
  trackAgentPanelClosed?(metadata: AgentPanelClosedMetadata): void
  trackAgentEntryButtonClicked?(metadata: AgentEntryButtonClickedMetadata): void
  trackAgentCloseButtonClicked?(): void
  trackAgentConsentShown?(metadata: AgentConsentShownMetadata): void
  trackAgentConsentResolved?(metadata: AgentConsentResolvedMetadata): void
  trackAgentOnboardingShown?(): void
  trackAgentOnboardingStep?(metadata: AgentOnboardingStepMetadata): void
  trackAgentMessageSent?(metadata: AgentMessageSentMetadata): void
  trackAgentStarterPromptClicked?(
    metadata: AgentStarterPromptClickedMetadata
  ): void
  trackAgentFreeUseNotice?(metadata: AgentFreeUseNoticeMetadata): void
  trackAgentFreeUseExposure?(metadata: AgentFreeUseExposureMetadata): void
  trackAgentNodeTagged?(metadata: AgentNodeTaggedMetadata): void
  trackAgentAttachButtonClicked?(
    metadata: AgentAttachButtonClickedMetadata
  ): void
  trackAgentWorkflowApplied?(metadata: AgentWorkflowAppliedMetadata): void
  trackAgentError?(metadata: AgentErrorMetadata): void
  trackAgentStopClicked?(metadata: AgentStopClickedMetadata): void
  trackAgentWorkflowBound?(metadata: AgentWorkflowBoundMetadata): void
  trackAgentRunApprovalShown?(metadata: AgentRunApprovalShownMetadata): void
  trackAgentRunApprovalResolved?(
    metadata: AgentRunApprovalResolvedMetadata
  ): void
  trackAgentRunModeChanged?(metadata: AgentRunModeChangedMetadata): void
  trackAgentThreadStarted?(metadata: AgentThreadStartedMetadata): void
  trackAgentConsentNotOffered?(metadata: AgentConsentNotOfferedMetadata): void
  trackAgentConsentOfferExited?(metadata: AgentConsentOfferExitedMetadata): void
  trackAgentOnboardingNotShown?(metadata: AgentOnboardingNotShownMetadata): void

  // Right side panel widget favorite events
  trackWidgetFavoriteToggled?(metadata: WidgetFavoriteToggledMetadata): void

  // Named values shadow-diff diagnostics
  trackNamedValuesShadowDiffMismatch?(
    metadata: NamedValuesShadowDiffMismatchMetadata
  ): void
  trackNamedValuesShadowDiffSummary?(
    metadata: NamedValuesShadowDiffSummaryMetadata
  ): void

  // Link deduplication diagnostics
  trackLinkDedupDrop?(metadata: LinkDedupDropMetadata): void

  // Page view tracking
  trackPageView?(pageName: string, properties?: PageViewMetadata): void

  // Network error events
  trackFetchTimeout?(metadata: FetchTimeoutMetadata): void
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
  USER_SIGN_UP_OPENED: AUTH_TELEMETRY_EVENT.signUpOpened,
  USER_AUTH_COMPLETED: AUTH_TELEMETRY_EVENT.authCompleted,
  USER_AUTH_FAILED: AUTH_TELEMETRY_EVENT.authFailed,
  USER_LOGGED_IN: 'app:user_logged_in',
  UNIFIED_AUTH_RETRY_SUCCEEDED: 'auth.unified.request_retry.succeeded',
  UNIFIED_AUTH_RETRY_FAILED: 'auth.unified.request_retry.failed',
  UNIFIED_AUTH_REFRESH_SUCCEEDED: SESSION_TELEMETRY_EVENT.refreshSucceeded,
  UNIFIED_AUTH_REFRESH_FAILED: SESSION_TELEMETRY_EVENT.refreshFailed,
  IMAGE_LOAD_FAILED: 'app:image_load_failed',
  BOOTSTRAP_COMPLETE: 'app:bootstrap_complete',

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

  AGENT_PAYWALL_SHOWN: 'app:agent_paywall_shown',
  AGENT_PAYWALL_CTA_CLICKED: 'app:agent_paywall_cta_clicked',

  // Canonical Billing Lifecycle
  ...BILLING_TELEMETRY_EVENTS,

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

  // In-App Agent
  AGENT_MESSAGE_FEEDBACK: 'app:agent_message_feedback',
  AGENT_PANEL_OPENED: 'app:agent_panel_opened',
  AGENT_PANEL_CLOSED: 'app:agent_panel_closed',
  AGENT_ENTRY_BUTTON_CLICKED: 'app:agent_entry_button_clicked',
  AGENT_CLOSE_BUTTON_CLICKED: 'app:agent_close_button_clicked',
  AGENT_CONSENT_SHOWN: 'app:agent_consent_shown',
  AGENT_CONSENT_RESOLVED: 'app:agent_consent_resolved',
  AGENT_ONBOARDING_SHOWN: 'app:agent_onboarding_shown',
  AGENT_ONBOARDING_STEP: 'app:agent_onboarding_step',
  AGENT_MESSAGE_SENT: 'app:agent_message_sent',
  AGENT_STARTER_PROMPT_CLICKED: 'app:agent_starter_prompt_clicked',
  AGENT_FREE_USE_NOTICE: 'app:agent_free_use_notice',
  AGENT_FREE_USE_EXPOSURE: 'app:agent_free_use_exposure',
  AGENT_NODE_TAGGED: 'app:agent_node_tagged',
  AGENT_ATTACH_BUTTON_CLICKED: 'app:agent_attach_button_clicked',
  AGENT_WORKFLOW_APPLIED: 'app:agent_workflow_applied',
  AGENT_ERROR: 'app:agent_error',
  AGENT_STOP_CLICKED: 'app:agent_stop_clicked',
  AGENT_WORKFLOW_BOUND: 'app:agent_workflow_bound',
  AGENT_RUN_APPROVAL_SHOWN: 'app:agent_run_approval_shown',
  AGENT_RUN_APPROVAL_RESOLVED: 'app:agent_run_approval_resolved',
  AGENT_RUN_MODE_CHANGED: 'app:agent_run_mode_changed',
  AGENT_THREAD_STARTED: 'app:agent_thread_started',
  AGENT_CONSENT_NOT_OFFERED: 'app:agent_consent_not_offered',
  AGENT_CONSENT_OFFER_EXITED: 'app:agent_consent_offer_exited',
  AGENT_ONBOARDING_NOT_SHOWN: 'app:agent_onboarding_not_shown',

  // Right Side Panel Widget Favorites
  WIDGET_FAVORITE_TOGGLED: 'app:widget_favorite_toggled',

  // Named Values Shadow Diff (Comfy.Workflow.NamedValuesRestore diagnostics)
  NAMED_VALUES_SHADOW_DIFF_MISMATCH: 'app:named_values_shadow_diff_mismatch',
  NAMED_VALUES_SHADOW_DIFF_SUMMARY: 'app:named_values_shadow_diff_summary',

  // Link deduplication diagnostics
  LINK_DEDUP_DROP: 'app:link_dedup_drop',

  // Page View
  PAGE_VIEW: 'app:page_view',

  // Network
  FETCH_TIMEOUT: 'app:fetch_timeout'
} as const

export type TelemetryEventName =
  | (typeof TelemetryEvents)[keyof typeof TelemetryEvents]
  | BillingTelemetryEventName
  | CheckoutJourneyTelemetryEventName
  | WebSessionTelemetryEvent['name']

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
  | UnifiedAuthRefreshMetadata
  | WebSessionTelemetryEvent['properties']
  | ImageLoadFailureMetadata
  | BootstrapCompleteMetadata
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
  | LinkDedupDropMetadata
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
  | CheckoutJourneyTelemetryEventPayload
  | AgentPaywallShownMetadata
  | AgentPaywallCtaMetadata
  | FetchTimeoutMetadata
