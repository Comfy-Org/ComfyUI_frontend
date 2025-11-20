import { api } from '@/scripts/api'
import type {
  AuthMetadata,
  CreditTopupMetadata,
  ExecutionContext,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  HelpCenterClosedMetadata,
  HelpCenterOpenedMetadata,
  HelpResourceClickedMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  PageVisibilityMetadata,
  RunButtonProperties,
  SettingChangedMetadata,
  SurveyResponses,
  TabCountMetadata,
  TelemetryEventName,
  TemplateFilterMetadata,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  UiButtonClickMetadata,
  WorkflowCreatedMetadata,
  WorkflowImportMetadata
} from '../../types'
import { TelemetryEvents } from '../../types'
import { TelemetryProviderBase } from '../TelemetryProviderBase'

/**
 * Cloud Analytics Provider for server-side event tracking.
 * Posts events to the backend's cloud analytics service (ClickHouse) via api.postCloudAnalytics.
 * This complements client-side tracking (Mixpanel) with server-side data collection.
 */
export class CloudAnalyticsProvider extends TelemetryProviderBase {
  async initialize(): Promise<void> {
    this.isInitialized = true
  }

  private async postEvent(
    eventName: TelemetryEventName,
    eventData?: any
  ): Promise<void> {
    if (!this.isEnabled || !this.isInitialized) {
      return
    }

    try {
      await api.postCloudAnalytics(eventName, eventData || {})
    } catch (error) {
      console.error('Failed to post cloud analytics event:', error)
    }
  }

  trackAuth(metadata: AuthMetadata): void {
    void this.postEvent(TelemetryEvents.USER_AUTH_COMPLETED, metadata)
  }

  trackUserLoggedIn(): void {
    void this.postEvent(TelemetryEvents.USER_LOGGED_IN)
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    const eventName =
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED
    void this.postEvent(eventName)
  }

  trackMonthlySubscriptionSucceeded(): void {
    void this.postEvent(TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED)
  }

  trackAddApiCreditButtonClicked(): void {
    void this.postEvent(TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED)
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    const metadata: CreditTopupMetadata = { credit_amount: amount }
    void this.postEvent(
      TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED,
      metadata
    )
  }

  trackApiCreditTopupSucceeded(): void {
    void this.postEvent(TelemetryEvents.API_CREDIT_TOPUP_SUCCEEDED)
  }

  trackRunButton(properties: RunButtonProperties): void {
    void this.postEvent(TelemetryEvents.RUN_BUTTON_CLICKED, properties)
  }

  startTopupTracking(): void {
    // Not applicable for server-side tracking
  }

  checkForCompletedTopup(_events: any[] | undefined | null): boolean {
    // Not applicable for server-side tracking
    return false
  }

  clearTopupTracking(): void {
    // Not applicable for server-side tracking
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    const eventName =
      stage === 'opened'
        ? TelemetryEvents.USER_SURVEY_OPENED
        : TelemetryEvents.USER_SURVEY_SUBMITTED
    void this.postEvent(eventName, responses)
  }

  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void {
    let eventName: TelemetryEventName
    switch (stage) {
      case 'opened':
        eventName = TelemetryEvents.USER_EMAIL_VERIFY_OPENED
        break
      case 'requested':
        eventName = TelemetryEvents.USER_EMAIL_VERIFY_REQUESTED
        break
      case 'completed':
        eventName = TelemetryEvents.USER_EMAIL_VERIFY_COMPLETED
        break
    }
    void this.postEvent(eventName)
  }

  trackTemplate(metadata: TemplateMetadata): void {
    void this.postEvent(TelemetryEvents.TEMPLATE_WORKFLOW_OPENED, metadata)
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    void this.postEvent(TelemetryEvents.TEMPLATE_LIBRARY_OPENED, metadata)
  }

  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void {
    void this.postEvent(TelemetryEvents.TEMPLATE_LIBRARY_CLOSED, metadata)
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    void this.postEvent(TelemetryEvents.WORKFLOW_IMPORTED, metadata)
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    void this.postEvent(TelemetryEvents.WORKFLOW_OPENED, metadata)
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    void this.postEvent(TelemetryEvents.PAGE_VISIBILITY_CHANGED, metadata)
  }

  trackTabCount(metadata: TabCountMetadata): void {
    void this.postEvent(TelemetryEvents.TAB_COUNT_TRACKING, metadata)
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    void this.postEvent(TelemetryEvents.NODE_SEARCH, metadata)
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    void this.postEvent(TelemetryEvents.NODE_SEARCH_RESULT_SELECTED, metadata)
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    void this.postEvent(TelemetryEvents.TEMPLATE_FILTER_CHANGED, metadata)
  }

  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void {
    void this.postEvent(TelemetryEvents.HELP_CENTER_OPENED, metadata)
  }

  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void {
    void this.postEvent(TelemetryEvents.HELP_RESOURCE_CLICKED, metadata)
  }

  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void {
    void this.postEvent(TelemetryEvents.HELP_CENTER_CLOSED, metadata)
  }

  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void {
    void this.postEvent(TelemetryEvents.WORKFLOW_CREATED, metadata)
  }

  trackWorkflowExecution(context?: ExecutionContext): void {
    void this.postEvent(TelemetryEvents.EXECUTION_START, context)
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    void this.postEvent(TelemetryEvents.EXECUTION_ERROR, metadata)
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    void this.postEvent(TelemetryEvents.EXECUTION_SUCCESS, metadata)
  }

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    void this.postEvent(TelemetryEvents.SETTING_CHANGED, metadata)
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    void this.postEvent(TelemetryEvents.UI_BUTTON_CLICKED, metadata)
  }
}
