import type {
  ComfyDesktop2TelemetryBridge,
  ComfyDesktop2TelemetryValue
} from '@comfyorg/comfyui-desktop-bridge-types'
import {
  checkForCompletedTopup as checkTopupUtil,
  clearTopupTracking as clearTopupUtil,
  startTopupTracking as startTopupUtil
} from '@/platform/telemetry/topupTracker'
import type { AuditLog } from '@/services/customerEventsService'

import type {
  AddCreditsClickMetadata,
  AuthMetadata,
  BeginCheckoutMetadata,
  DefaultViewSetMetadata,
  EnterLinearMetadata,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  HelpCenterClosedMetadata,
  HelpCenterOpenedMetadata,
  HelpResourceClickedMetadata,
  NodeAddedMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  PageViewMetadata,
  PageVisibilityMetadata,
  RunButtonProperties,
  SearchQueryMetadata,
  SettingChangedMetadata,
  ShareFlowMetadata,
  ShareLinkOpenedMetadata,
  SharedWorkflowRunMetadata,
  ResubscribeClickMetadata,
  SubscriptionCancellationMetadata,
  SubscriptionMetadata,
  SubscriptionSuccessMetadata,
  SurveyResponses,
  TabCountMetadata,
  TelemetryEventName,
  TelemetryProvider,
  TemplateFilterMetadata,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  UiButtonClickMetadata,
  WorkflowCreatedMetadata,
  WorkflowImportMetadata,
  WorkflowSavedMetadata
} from '../../types'
import { CANCELLATION_STAGE_EVENTS, TelemetryEvents } from '../../types'
import { normalizeSurveyResponses } from '../../utils/surveyNormalization'

type HostTelemetryProperties = Parameters<
  ComfyDesktop2TelemetryBridge['capture']
>[1]

function isHostTelemetryPrimitive(
  value: unknown
): value is ComfyDesktop2TelemetryValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function toHostTelemetryProperties(
  properties?: object
): HostTelemetryProperties {
  if (!properties) return undefined

  const out: NonNullable<HostTelemetryProperties> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (isHostTelemetryPrimitive(value)) {
      out[key] = value
    } else if (Array.isArray(value) && value.every(isHostTelemetryPrimitive)) {
      out[key] = value
    }
  }

  return out
}

export class HostTelemetrySink implements TelemetryProvider {
  private capture(event: TelemetryEventName, properties?: object): void {
    window.__comfyDesktop2?.Telemetry?.capture(
      event,
      toHostTelemetryProperties(properties)
    )
  }

  trackSignupOpened(): void {
    this.capture(TelemetryEvents.USER_SIGN_UP_OPENED)
  }

  trackAuth(metadata: AuthMetadata): void {
    this.capture(TelemetryEvents.USER_AUTH_COMPLETED, metadata)
  }

  trackUserLoggedIn(): void {
    this.capture(TelemetryEvents.USER_LOGGED_IN)
  }

  trackSubscription(
    event: 'modal_opened' | 'subscribe_clicked',
    metadata?: SubscriptionMetadata
  ): void {
    this.capture(
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED,
      metadata
    )
  }

  trackBeginCheckout(metadata: BeginCheckoutMetadata): void {
    this.capture(TelemetryEvents.BEGIN_CHECKOUT, metadata)
  }

  trackMonthlySubscriptionSucceeded(
    metadata?: SubscriptionSuccessMetadata
  ): void {
    this.capture(TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED, metadata)
  }

  trackMonthlySubscriptionCancelled(): void {
    this.capture(TelemetryEvents.MONTHLY_SUBSCRIPTION_CANCELLED)
  }

  trackSubscriptionCancellation(
    event: 'flow_opened' | 'confirmed' | 'abandoned' | 'failed',
    metadata?: SubscriptionCancellationMetadata
  ): void {
    this.capture(CANCELLATION_STAGE_EVENTS[event], metadata)
  }

  trackResubscribeClicked(metadata: ResubscribeClickMetadata): void {
    this.capture(TelemetryEvents.RESUBSCRIBE_BUTTON_CLICKED, metadata)
  }

  trackAddApiCreditButtonClicked(metadata?: AddCreditsClickMetadata): void {
    this.capture(TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED, metadata)
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    this.capture(TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED, {
      credit_amount: amount
    })
  }

  trackApiCreditTopupSucceeded(): void {
    this.capture(TelemetryEvents.API_CREDIT_TOPUP_SUCCEEDED)
  }

  trackRunButton(properties: RunButtonProperties): void {
    this.capture(TelemetryEvents.RUN_BUTTON_CLICKED, properties)
  }

  startTopupTracking(): void {
    startTopupUtil()
  }

  checkForCompletedTopup(events: AuditLog[] | undefined | null): boolean {
    return checkTopupUtil(events)
  }

  clearTopupTracking(): void {
    clearTopupUtil()
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    this.capture(
      stage === 'opened'
        ? TelemetryEvents.USER_SURVEY_OPENED
        : TelemetryEvents.USER_SURVEY_SUBMITTED,
      responses ? normalizeSurveyResponses(responses) : undefined
    )
  }

  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void {
    const event =
      stage === 'opened'
        ? TelemetryEvents.USER_EMAIL_VERIFY_OPENED
        : stage === 'requested'
          ? TelemetryEvents.USER_EMAIL_VERIFY_REQUESTED
          : TelemetryEvents.USER_EMAIL_VERIFY_COMPLETED
    this.capture(event)
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.capture(TelemetryEvents.TEMPLATE_WORKFLOW_OPENED, metadata)
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.capture(TelemetryEvents.TEMPLATE_LIBRARY_OPENED, metadata)
  }

  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void {
    this.capture(TelemetryEvents.TEMPLATE_LIBRARY_CLOSED, metadata)
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.capture(TelemetryEvents.WORKFLOW_IMPORTED, metadata)
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    this.capture(TelemetryEvents.WORKFLOW_OPENED, metadata)
  }

  trackWorkflowSaved(metadata: WorkflowSavedMetadata): void {
    this.capture(TelemetryEvents.WORKFLOW_SAVED, metadata)
  }

  trackDefaultViewSet(metadata: DefaultViewSetMetadata): void {
    this.capture(TelemetryEvents.DEFAULT_VIEW_SET, metadata)
  }

  trackEnterLinear(metadata: EnterLinearMetadata): void {
    this.capture(TelemetryEvents.ENTER_LINEAR_MODE, metadata)
  }

  trackShareFlow(metadata: ShareFlowMetadata): void {
    this.capture(TelemetryEvents.SHARE_FLOW, metadata)
  }

  trackShareLinkOpened(metadata: ShareLinkOpenedMetadata): void {
    this.capture(TelemetryEvents.SHARE_LINK_OPENED, metadata)
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.capture(TelemetryEvents.PAGE_VISIBILITY_CHANGED, metadata)
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.capture(TelemetryEvents.TAB_COUNT_TRACKING, metadata)
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    this.capture(TelemetryEvents.NODE_SEARCH, metadata)
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    this.capture(TelemetryEvents.NODE_SEARCH_RESULT_SELECTED, metadata)
  }

  trackSearchQuery(metadata: SearchQueryMetadata): void {
    this.capture(TelemetryEvents.SEARCH_QUERY, metadata)
  }

  trackNodeAdded(metadata: NodeAddedMetadata): void {
    this.capture(TelemetryEvents.NODE_ADDED, metadata)
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    this.capture(TelemetryEvents.TEMPLATE_FILTER_CHANGED, metadata)
  }

  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void {
    this.capture(TelemetryEvents.HELP_CENTER_OPENED, metadata)
  }

  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void {
    this.capture(TelemetryEvents.HELP_RESOURCE_CLICKED, metadata)
  }

  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void {
    this.capture(TelemetryEvents.HELP_CENTER_CLOSED, metadata)
  }

  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void {
    this.capture(TelemetryEvents.WORKFLOW_CREATED, metadata)
  }

  trackWorkflowExecution(): void {
    this.capture(TelemetryEvents.EXECUTION_START)
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.capture(TelemetryEvents.EXECUTION_ERROR, metadata)
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.capture(TelemetryEvents.EXECUTION_SUCCESS, metadata)
  }

  trackSharedWorkflowRun(metadata: SharedWorkflowRunMetadata): void {
    this.capture(TelemetryEvents.SHARED_WORKFLOW_RUN, metadata)
  }

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    this.capture(TelemetryEvents.SETTING_CHANGED, metadata)
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    this.capture(TelemetryEvents.UI_BUTTON_CLICKED, metadata)
  }

  trackPageView(pageName: string, properties?: PageViewMetadata): void {
    this.capture(TelemetryEvents.PAGE_VIEW, {
      page_name: pageName,
      ...properties
    })
  }
}
