import type {
  TelemetryProvider,
  AuthMetadata,
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
  TemplateFilterMetadata,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  UiButtonClickMetadata,
  WorkflowCreatedMetadata,
  WorkflowImportMetadata,
  ExecutionTriggerSource
} from '../types'
import type { TelemetryHooks } from '../interfaces/TelemetryHooks'

/**
 * Central telemetry service that manages multiple providers and resolves
 * context through hook-based dependency inversion.
 */
export class TelemetryService {
  private hooks: TelemetryHooks = {}
  private providers: TelemetryProvider[] = []

  /**
   * Register hooks from domain stores to provide context
   */
  registerHooks(hooks: Partial<TelemetryHooks>): void {
    this.hooks = { ...this.hooks, ...hooks }
  }

  /**
   * Add analytics provider to receive events
   */
  addProvider(provider: TelemetryProvider): void {
    this.providers.push(provider)
  }

  trackAuth(metadata: AuthMetadata): void {
    this.providers.forEach((provider) => provider.trackAuth(metadata))
  }

  trackUserLoggedIn(): void {
    this.providers.forEach((provider) => provider.trackUserLoggedIn())
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    this.providers.forEach((provider) => provider.trackSubscription(event))
  }

  trackMonthlySubscriptionSucceeded(): void {
    this.providers.forEach((provider) =>
      provider.trackMonthlySubscriptionSucceeded()
    )
  }

  trackAddApiCreditButtonClicked(): void {
    this.providers.forEach((provider) =>
      provider.trackAddApiCreditButtonClicked()
    )
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    this.providers.forEach((provider) =>
      provider.trackApiCreditTopupButtonPurchaseClicked(amount)
    )
  }

  trackApiCreditTopupSucceeded(): void {
    this.providers.forEach((provider) =>
      provider.trackApiCreditTopupSucceeded()
    )
  }

  trackRunButton(options?: {
    subscribe_to_run?: boolean
    trigger_source?: ExecutionTriggerSource
  }): void {
    // Resolve complete context through hooks
    const context = this.hooks.getExecutionContext?.()
    if (!context) return // Don't track if no context available

    const runButtonProperties: RunButtonProperties = {
      subscribe_to_run: options?.subscribe_to_run || false,
      workflow_type: context.is_template ? 'template' : 'custom',
      workflow_name: context.workflow_name ?? 'untitled',
      custom_node_count: context.custom_node_count,
      total_node_count: context.total_node_count,
      subgraph_count: context.subgraph_count,
      has_api_nodes: context.has_api_nodes,
      api_node_names: context.api_node_names,
      trigger_source: options?.trigger_source
    }

    this.providers.forEach((provider) =>
      provider.trackRunButton(runButtonProperties)
    )
  }

  startTopupTracking(): void {
    this.providers.forEach((provider) => provider.startTopupTracking())
  }

  checkForCompletedTopup(events: any[] | undefined | null): boolean {
    return this.providers.some((provider) =>
      provider.checkForCompletedTopup(events)
    )
  }

  clearTopupTracking(): void {
    this.providers.forEach((provider) => provider.clearTopupTracking())
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    this.providers.forEach((provider) => provider.trackSurvey(stage, responses))
  }

  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void {
    this.providers.forEach((provider) => provider.trackEmailVerification(stage))
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.providers.forEach((provider) => provider.trackTemplate(metadata))
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackTemplateLibraryOpened(metadata)
    )
  }

  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackTemplateLibraryClosed(metadata)
    )
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackWorkflowImported(metadata)
    )
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    this.providers.forEach((provider) => provider.trackWorkflowOpened(metadata))
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackPageVisibilityChanged(metadata)
    )
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.providers.forEach((provider) => provider.trackTabCount(metadata))
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    this.providers.forEach((provider) => provider.trackNodeSearch(metadata))
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackNodeSearchResultSelected(metadata)
    )
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackTemplateFilterChanged(metadata)
    )
  }

  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackHelpCenterOpened(metadata)
    )
  }

  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackHelpResourceClicked(metadata)
    )
  }

  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackHelpCenterClosed(metadata)
    )
  }

  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackWorkflowCreated(metadata)
    )
  }

  trackWorkflowExecution(): void {
    // Resolve context through hooks and only track if context is available
    const context = this.hooks.getExecutionContext?.()
    if (!context) return // Don't track if no context available

    this.providers.forEach((provider) =>
      provider.trackWorkflowExecution(context)
    )
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.providers.forEach((provider) => provider.trackExecutionError(metadata))
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackExecutionSuccess(metadata)
    )
  }

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    this.providers.forEach((provider) => provider.trackSettingChanged(metadata))
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    this.providers.forEach((provider) =>
      provider.trackUiButtonClicked(metadata)
    )
  }
}
