import type { OverridedMixpanel } from 'mixpanel-browser'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import {
  checkForCompletedTopup as checkTopupUtil,
  clearTopupTracking as clearTopupUtil,
  startTopupTracking as startTopupUtil
} from '@/platform/telemetry/topupTracker'

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
  TelemetryEventProperties,
  TemplateFilterMetadata,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  UiButtonClickMetadata,
  WorkflowCreatedMetadata,
  WorkflowImportMetadata
} from '../../types'
import { TelemetryEvents } from '../../types'
import { normalizeSurveyResponses } from '../../utils/surveyNormalization'
import { TelemetryProviderBase } from '../TelemetryProviderBase'

interface QueuedEvent {
  eventName: TelemetryEventName
  properties?: TelemetryEventProperties
}

/**
 * Mixpanel Telemetry Provider - Cloud Build Implementation
 *
 * CRITICAL: OSS Build Safety
 * This provider integrates with Mixpanel for cloud telemetry tracking.
 * Entire file is tree-shaken away in OSS builds (DISTRIBUTION unset).
 *
 * To verify OSS builds exclude this code:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `grep -RinE --include='*.js' 'trackWorkflow|trackEvent|mixpanel' dist/` (should find nothing)
 * 3. Check dist/assets/*.js files contain no tracking code
 */
export class MixpanelTelemetryProvider extends TelemetryProviderBase {
  private mixpanel: OverridedMixpanel | null = null
  private eventQueue: QueuedEvent[] = []

  async initialize(): Promise<void> {
    const token = window.__CONFIG__?.mixpanel_token

    if (!token) {
      this.setEnabled(false)
      return
    }

    try {
      const mixpanelModule = await import('mixpanel-browser')
      this.mixpanel = mixpanelModule.default

      this.mixpanel.init(token, {
        debug: import.meta.env.DEV,
        track_pageview: true,
        api_host: 'https://mp.comfy.org',
        cross_subdomain_cookie: true,
        persistence: 'cookie',
        loaded: () => {
          this.isInitialized = true
          this.flushEventQueue()
          useCurrentUser().onUserResolved((user) => {
            if (this.mixpanel && user.id) {
              this.mixpanel.identify(user.id)
            }
          })
        }
      })
    } catch (error) {
      console.error('Failed to load Mixpanel:', error)
      this.setEnabled(false)
    }
  }

  private flushEventQueue(): void {
    if (!this.isInitialized || !this.mixpanel) {
      return
    }

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!
      try {
        this.mixpanel.track(event.eventName, event.properties || {})
      } catch (error) {
        console.error('Failed to track queued event:', error)
      }
    }
  }

  private trackEvent(
    eventName: TelemetryEventName,
    properties?: TelemetryEventProperties
  ): void {
    if (!this.isEnabled) {
      return
    }

    const event: QueuedEvent = { eventName, properties }

    if (this.isInitialized && this.mixpanel) {
      // Mixpanel is ready, track immediately
      try {
        this.mixpanel.track(eventName, properties || {})
      } catch (error) {
        console.error('Failed to track event:', error)
      }
    } else {
      // Mixpanel not ready yet, queue the event
      this.eventQueue.push(event)
    }
  }

  trackSignupOpened(): void {
    this.trackEvent(TelemetryEvents.USER_SIGN_UP_OPENED)
  }

  trackAuth(metadata: AuthMetadata): void {
    this.trackEvent(TelemetryEvents.USER_AUTH_COMPLETED, metadata)
  }

  trackUserLoggedIn(): void {
    this.trackEvent(TelemetryEvents.USER_LOGGED_IN)
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    const eventName =
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED

    this.trackEvent(eventName)
  }

  trackAddApiCreditButtonClicked(): void {
    this.trackEvent(TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED)
  }

  trackMonthlySubscriptionSucceeded(): void {
    this.trackEvent(TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED)
  }

  /**
   * Track when a user completes a subscription cancellation flow.
   * Fired after we detect the backend reports `is_active: false` and the UI stops polling.
   */
  trackMonthlySubscriptionCancelled(): void {
    this.trackEvent(TelemetryEvents.MONTHLY_SUBSCRIPTION_CANCELLED)
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    const metadata: CreditTopupMetadata = {
      credit_amount: amount
    }
    this.trackEvent(
      TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED,
      metadata
    )
  }

  trackApiCreditTopupSucceeded(): void {
    this.trackEvent(TelemetryEvents.API_CREDIT_TOPUP_SUCCEEDED)
  }

  // Credit top-up tracking methods (composition with utility functions)
  startTopupTracking(): void {
    startTopupUtil()
  }

  checkForCompletedTopup(events: any[] | undefined | null): boolean {
    return checkTopupUtil(events)
  }

  clearTopupTracking(): void {
    clearTopupUtil()
  }

  trackRunButton(properties: RunButtonProperties): void {
    this.trackEvent(TelemetryEvents.RUN_BUTTON_CLICKED, properties)
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    const eventName =
      stage === 'opened'
        ? TelemetryEvents.USER_SURVEY_OPENED
        : TelemetryEvents.USER_SURVEY_SUBMITTED

    // Apply normalization to survey responses
    const normalizedResponses = responses
      ? normalizeSurveyResponses(responses)
      : undefined

    this.trackEvent(eventName, normalizedResponses)

    // If this is a survey submission, also set user properties with normalized data
    if (stage === 'submitted' && normalizedResponses && this.mixpanel) {
      try {
        this.mixpanel.people.set(normalizedResponses)
      } catch (error) {
        console.error('Failed to set survey user properties:', error)
      }
    }
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

    this.trackEvent(eventName)
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_WORKFLOW_OPENED, metadata)
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_LIBRARY_OPENED, metadata)
  }

  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_LIBRARY_CLOSED, metadata)
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.trackEvent(TelemetryEvents.WORKFLOW_IMPORTED, metadata)
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    this.trackEvent(TelemetryEvents.WORKFLOW_OPENED, metadata)
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.trackEvent(TelemetryEvents.PAGE_VISIBILITY_CHANGED, metadata)
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.trackEvent(TelemetryEvents.TAB_COUNT_TRACKING, metadata)
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    this.trackEvent(TelemetryEvents.NODE_SEARCH, metadata)
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    this.trackEvent(TelemetryEvents.NODE_SEARCH_RESULT_SELECTED, metadata)
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_FILTER_CHANGED, metadata)
  }

  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void {
    this.trackEvent(TelemetryEvents.HELP_CENTER_OPENED, metadata)
  }

  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void {
    this.trackEvent(TelemetryEvents.HELP_RESOURCE_CLICKED, metadata)
  }

  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void {
    this.trackEvent(TelemetryEvents.HELP_CENTER_CLOSED, metadata)
  }

  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void {
    this.trackEvent(TelemetryEvents.WORKFLOW_CREATED, metadata)
  }

  trackWorkflowExecution(context?: ExecutionContext): void {
    this.trackEvent(TelemetryEvents.EXECUTION_START, context)
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.trackEvent(TelemetryEvents.EXECUTION_ERROR, metadata)
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.trackEvent(TelemetryEvents.EXECUTION_SUCCESS, metadata)
  }

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    this.trackEvent(TelemetryEvents.SETTING_CHANGED, metadata)
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    this.trackEvent(TelemetryEvents.UI_BUTTON_CLICKED, metadata)
  }
}
