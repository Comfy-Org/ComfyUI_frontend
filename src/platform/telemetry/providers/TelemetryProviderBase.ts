import type {
  AuthMetadata,
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
  TelemetryProvider,
  TemplateFilterMetadata,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  UiButtonClickMetadata,
  WorkflowCreatedMetadata,
  WorkflowImportMetadata
} from '../types'

/**
 * Abstract base class for telemetry providers with lifecycle management.
 * Concrete providers should extend this class for consistent behavior.
 */
export abstract class TelemetryProviderBase implements TelemetryProvider {
  protected isEnabled = true
  protected isInitialized = false

  /**
   * Initialize the provider (e.g., load external libraries)
   */
  abstract initialize(): Promise<void>

  /**
   * Check if the provider is ready to track events
   */
  isReady(): boolean {
    return this.isEnabled && this.isInitialized
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
  }

  // All abstract methods from TelemetryProvider interface with proper typing
  abstract trackAuth(metadata: AuthMetadata): void
  abstract trackUserLoggedIn(): void
  abstract trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void
  abstract trackMonthlySubscriptionSucceeded(): void
  abstract trackAddApiCreditButtonClicked(): void
  abstract trackApiCreditTopupButtonPurchaseClicked(amount: number): void
  abstract trackApiCreditTopupSucceeded(): void
  abstract trackRunButton(properties: RunButtonProperties): void
  abstract startTopupTracking(): void
  abstract checkForCompletedTopup(events: any[] | undefined | null): boolean
  abstract clearTopupTracking(): void
  abstract trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void
  abstract trackEmailVerification(
    stage: 'opened' | 'requested' | 'completed'
  ): void
  abstract trackTemplate(metadata: TemplateMetadata): void
  abstract trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void
  abstract trackTemplateLibraryClosed(
    metadata: TemplateLibraryClosedMetadata
  ): void
  abstract trackWorkflowImported(metadata: WorkflowImportMetadata): void
  abstract trackWorkflowOpened(metadata: WorkflowImportMetadata): void
  abstract trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void
  abstract trackTabCount(metadata: TabCountMetadata): void
  abstract trackNodeSearch(metadata: NodeSearchMetadata): void
  abstract trackNodeSearchResultSelected(
    metadata: NodeSearchResultMetadata
  ): void
  abstract trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void
  abstract trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void
  abstract trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void
  abstract trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void
  abstract trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void
  abstract trackWorkflowExecution(context?: ExecutionContext): void
  abstract trackExecutionError(metadata: ExecutionErrorMetadata): void
  abstract trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void
  abstract trackSettingChanged(metadata: SettingChangedMetadata): void
  abstract trackUiButtonClicked(metadata: UiButtonClickMetadata): void
}
