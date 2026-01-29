import type { AuditLog } from '@/services/customerEventsService'

import type {
  AuthMetadata,
  EnterLinearMetadata,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  ExecutionTriggerSource,
  HelpCenterClosedMetadata,
  HelpCenterOpenedMetadata,
  HelpResourceClickedMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  PageViewMetadata,
  PageVisibilityMetadata,
  SettingChangedMetadata,
  SurveyResponses,
  TabCountMetadata,
  TelemetryDispatcher,
  TelemetryProvider,
  TemplateFilterMetadata,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  UiButtonClickMetadata,
  WorkflowCreatedMetadata,
  WorkflowImportMetadata
} from './types'

/**
 * Registry that holds multiple telemetry providers and dispatches
 * all tracking calls to each registered provider.
 *
 * Implements TelemetryDispatcher (all methods required) while dispatching
 * to TelemetryProvider instances using optional chaining since providers
 * only implement the methods they care about.
 */
export class TelemetryRegistry implements TelemetryDispatcher {
  private providers: TelemetryProvider[] = []

  registerProvider(provider: TelemetryProvider): void {
    this.providers.push(provider)
  }

  trackSignupOpened(): void {
    this.providers.forEach((p) => p.trackSignupOpened?.())
  }

  trackAuth(metadata: AuthMetadata): void {
    this.providers.forEach((p) => p.trackAuth?.(metadata))
  }

  trackUserLoggedIn(): void {
    this.providers.forEach((p) => p.trackUserLoggedIn?.())
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    this.providers.forEach((p) => p.trackSubscription?.(event))
  }

  trackMonthlySubscriptionSucceeded(): void {
    this.providers.forEach((p) => p.trackMonthlySubscriptionSucceeded?.())
  }

  trackMonthlySubscriptionCancelled(): void {
    this.providers.forEach((p) => p.trackMonthlySubscriptionCancelled?.())
  }

  trackAddApiCreditButtonClicked(): void {
    this.providers.forEach((p) => p.trackAddApiCreditButtonClicked?.())
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    this.providers.forEach((p) =>
      p.trackApiCreditTopupButtonPurchaseClicked?.(amount)
    )
  }

  trackApiCreditTopupSucceeded(): void {
    this.providers.forEach((p) => p.trackApiCreditTopupSucceeded?.())
  }

  trackRunButton(options?: {
    subscribe_to_run?: boolean
    trigger_source?: ExecutionTriggerSource
  }): void {
    this.providers.forEach((p) => p.trackRunButton?.(options))
  }

  startTopupTracking(): void {
    this.providers.forEach((p) => p.startTopupTracking?.())
  }

  checkForCompletedTopup(events: AuditLog[] | undefined | null): boolean {
    return this.providers.some(
      (p) => p.checkForCompletedTopup?.(events) ?? false
    )
  }

  clearTopupTracking(): void {
    this.providers.forEach((p) => p.clearTopupTracking?.())
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    this.providers.forEach((p) => p.trackSurvey?.(stage, responses))
  }

  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void {
    this.providers.forEach((p) => p.trackEmailVerification?.(stage))
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.providers.forEach((p) => p.trackTemplate?.(metadata))
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.providers.forEach((p) => p.trackTemplateLibraryOpened?.(metadata))
  }

  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void {
    this.providers.forEach((p) => p.trackTemplateLibraryClosed?.(metadata))
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.providers.forEach((p) => p.trackWorkflowImported?.(metadata))
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    this.providers.forEach((p) => p.trackWorkflowOpened?.(metadata))
  }

  trackEnterLinear(metadata: EnterLinearMetadata): void {
    this.providers.forEach((p) => p.trackEnterLinear?.(metadata))
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.providers.forEach((p) => p.trackPageVisibilityChanged?.(metadata))
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.providers.forEach((p) => p.trackTabCount?.(metadata))
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    this.providers.forEach((p) => p.trackNodeSearch?.(metadata))
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    this.providers.forEach((p) => p.trackNodeSearchResultSelected?.(metadata))
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    this.providers.forEach((p) => p.trackTemplateFilterChanged?.(metadata))
  }

  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void {
    this.providers.forEach((p) => p.trackHelpCenterOpened?.(metadata))
  }

  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void {
    this.providers.forEach((p) => p.trackHelpResourceClicked?.(metadata))
  }

  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void {
    this.providers.forEach((p) => p.trackHelpCenterClosed?.(metadata))
  }

  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void {
    this.providers.forEach((p) => p.trackWorkflowCreated?.(metadata))
  }

  trackWorkflowExecution(): void {
    this.providers.forEach((p) => p.trackWorkflowExecution?.())
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.providers.forEach((p) => p.trackExecutionError?.(metadata))
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.providers.forEach((p) => p.trackExecutionSuccess?.(metadata))
  }

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    this.providers.forEach((p) => p.trackSettingChanged?.(metadata))
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    this.providers.forEach((p) => p.trackUiButtonClicked?.(metadata))
  }

  trackPageView(pageName: string, properties?: PageViewMetadata): void {
    this.providers.forEach((p) => p.trackPageView?.(pageName, properties))
  }
}
