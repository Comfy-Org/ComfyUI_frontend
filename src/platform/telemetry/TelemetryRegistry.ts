import type { AuditLog } from '@/services/customerEventsService'

import type {
  AddCreditsClickMetadata,
  AuthErrorMetadata,
  AuthMetadata,
  BeginCheckoutMetadata,
  DefaultViewSetMetadata,
  EnterLinearMetadata,
  ShareFlowMetadata,
  ShareLinkOpenedMetadata,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  HelpCenterClosedMetadata,
  HelpCenterOpenedMetadata,
  HelpResourceClickedMetadata,
  NodeAddedMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  OnboardingTourMetadata,
  OnboardingTourStage,
  SearchQueryMetadata,
  PageViewMetadata,
  PageVisibilityMetadata,
  ResubscribeClickMetadata,
  RunButtonProperties,
  SettingChangedMetadata,
  SharedWorkflowRunMetadata,
  ShellLayoutMetadata,
  SubscriptionCancellationMetadata,
  SubscriptionMetadata,
  SubscriptionSuccessMetadata,
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
  WorkflowImportMetadata,
  WorkflowSavedMetadata,
  WorkspaceInviteMetadata
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

  private dispatch(action: (provider: TelemetryProvider) => void): void {
    this.providers.forEach((provider) => {
      try {
        action(provider)
      } catch (error) {
        console.error('[Telemetry] Provider dispatch failed', error)
      }
    })
  }

  trackSignupOpened(): void {
    this.dispatch((provider) => provider.trackSignupOpened?.())
  }

  trackAuth(metadata: AuthMetadata): void {
    this.dispatch((provider) => provider.trackAuth?.(metadata))
  }

  trackAuthFailed(metadata: AuthErrorMetadata): void {
    this.dispatch((provider) => provider.trackAuthFailed?.(metadata))
  }

  trackUserLoggedIn(): void {
    this.dispatch((provider) => provider.trackUserLoggedIn?.())
  }

  trackSubscription(
    event: 'modal_opened' | 'subscribe_clicked',
    metadata?: SubscriptionMetadata
  ): void {
    this.dispatch((provider) => provider.trackSubscription?.(event, metadata))
  }

  trackBeginCheckout(metadata: BeginCheckoutMetadata): void {
    this.dispatch((provider) => provider.trackBeginCheckout?.(metadata))
  }

  trackMonthlySubscriptionSucceeded(
    metadata?: SubscriptionSuccessMetadata
  ): void {
    this.dispatch((provider) =>
      provider.trackMonthlySubscriptionSucceeded?.(metadata)
    )
  }

  trackMonthlySubscriptionCancelled(): void {
    this.dispatch((provider) => provider.trackMonthlySubscriptionCancelled?.())
  }

  trackSubscriptionCancellation(
    event: 'flow_opened' | 'confirmed' | 'abandoned' | 'failed',
    metadata?: SubscriptionCancellationMetadata
  ): void {
    this.dispatch((provider) =>
      provider.trackSubscriptionCancellation?.(event, metadata)
    )
  }

  trackResubscribeClicked(metadata: ResubscribeClickMetadata): void {
    this.dispatch((provider) => provider.trackResubscribeClicked?.(metadata))
  }

  trackAddApiCreditButtonClicked(metadata?: AddCreditsClickMetadata): void {
    this.dispatch((provider) =>
      provider.trackAddApiCreditButtonClicked?.(metadata)
    )
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    this.dispatch((provider) =>
      provider.trackApiCreditTopupButtonPurchaseClicked?.(amount)
    )
  }

  trackApiCreditTopupSucceeded(): void {
    this.dispatch((provider) => provider.trackApiCreditTopupSucceeded?.())
  }

  trackWorkspaceInviteSent(metadata: WorkspaceInviteMetadata): void {
    this.dispatch((provider) => provider.trackWorkspaceInviteSent?.(metadata))
  }

  trackRunButton(properties: RunButtonProperties): void {
    this.dispatch((provider) => provider.trackRunButton?.(properties))
  }

  startTopupTracking(): void {
    this.dispatch((provider) => provider.startTopupTracking?.())
  }

  checkForCompletedTopup(events: AuditLog[] | undefined | null): boolean {
    return this.providers.some((provider) => {
      try {
        return provider.checkForCompletedTopup?.(events) ?? false
      } catch (error) {
        console.error('[Telemetry] Provider dispatch failed', error)
        return false
      }
    })
  }

  clearTopupTracking(): void {
    this.dispatch((provider) => provider.clearTopupTracking?.())
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    this.dispatch((provider) => provider.trackSurvey?.(stage, responses))
  }

  trackOnboardingTour(
    stage: OnboardingTourStage,
    metadata: OnboardingTourMetadata
  ): void {
    this.dispatch((provider) => provider.trackOnboardingTour?.(stage, metadata))
  }

  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void {
    this.dispatch((provider) => provider.trackEmailVerification?.(stage))
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.dispatch((provider) => provider.trackTemplate?.(metadata))
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.dispatch((provider) => provider.trackTemplateLibraryOpened?.(metadata))
  }

  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void {
    this.dispatch((provider) => provider.trackTemplateLibraryClosed?.(metadata))
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.dispatch((provider) => provider.trackWorkflowImported?.(metadata))
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    this.dispatch((provider) => provider.trackWorkflowOpened?.(metadata))
  }

  trackWorkflowSaved(metadata: WorkflowSavedMetadata): void {
    this.dispatch((provider) => provider.trackWorkflowSaved?.(metadata))
  }

  trackDefaultViewSet(metadata: DefaultViewSetMetadata): void {
    this.dispatch((provider) => provider.trackDefaultViewSet?.(metadata))
  }

  trackEnterLinear(metadata: EnterLinearMetadata): void {
    this.dispatch((provider) => provider.trackEnterLinear?.(metadata))
  }

  trackShareFlow(metadata: ShareFlowMetadata): void {
    this.dispatch((provider) => provider.trackShareFlow?.(metadata))
  }

  trackShareLinkOpened(metadata: ShareLinkOpenedMetadata): void {
    this.dispatch((provider) => provider.trackShareLinkOpened?.(metadata))
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.dispatch((provider) => provider.trackPageVisibilityChanged?.(metadata))
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.dispatch((provider) => provider.trackTabCount?.(metadata))
  }

  trackShellLayout(metadata: ShellLayoutMetadata): void {
    this.dispatch((provider) => provider.trackShellLayout?.(metadata))
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    this.dispatch((provider) => provider.trackNodeSearch?.(metadata))
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    this.dispatch((provider) =>
      provider.trackNodeSearchResultSelected?.(metadata)
    )
  }

  trackSearchQuery(metadata: SearchQueryMetadata): void {
    this.dispatch((provider) => provider.trackSearchQuery?.(metadata))
  }

  trackNodeAdded(metadata: NodeAddedMetadata): void {
    this.dispatch((provider) => provider.trackNodeAdded?.(metadata))
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    this.dispatch((provider) => provider.trackTemplateFilterChanged?.(metadata))
  }

  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void {
    this.dispatch((provider) => provider.trackHelpCenterOpened?.(metadata))
  }

  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void {
    this.dispatch((provider) => provider.trackHelpResourceClicked?.(metadata))
  }

  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void {
    this.dispatch((provider) => provider.trackHelpCenterClosed?.(metadata))
  }

  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void {
    this.dispatch((provider) => provider.trackWorkflowCreated?.(metadata))
  }

  trackWorkflowExecution(): void {
    this.dispatch((provider) => provider.trackWorkflowExecution?.())
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.dispatch((provider) => provider.trackExecutionError?.(metadata))
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.dispatch((provider) => provider.trackExecutionSuccess?.(metadata))
  }

  trackSharedWorkflowRun(metadata: SharedWorkflowRunMetadata): void {
    this.dispatch((provider) => provider.trackSharedWorkflowRun?.(metadata))
  }

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    this.dispatch((provider) => provider.trackSettingChanged?.(metadata))
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    this.dispatch((provider) => provider.trackUiButtonClicked?.(metadata))
  }

  trackPageView(pageName: string, properties?: PageViewMetadata): void {
    this.dispatch((provider) => provider.trackPageView?.(pageName, properties))
  }
}
