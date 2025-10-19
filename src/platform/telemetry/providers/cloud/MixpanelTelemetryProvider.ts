import mixpanel from 'mixpanel-browser'

import type {
  AuthMetadata,
  RunContext,
  SurveyResponses,
  TelemetryEventName,
  TelemetryProvider,
  TemplateMetadata
} from '../../types'
import { TelemetryEvents } from '../../types'

/**
 * Mixpanel Telemetry Provider - Cloud Build Implementation
 *
 * ⚠️ CRITICAL: OSS Build Safety ⚠️
 * This provider integrates with Mixpanel for cloud telemetry tracking.
 * Entire file is tree-shaken away in OSS builds (DISTRIBUTION unset).
 *
 * To verify OSS builds exclude this code:
 * 1. `DISTRIBUTION= pnpm build` (OSS build)
 * 2. `rg -r dist "telemetry|mixpanel"` (should find nothing)
 * 3. Check dist/assets/*.js files contain no tracking code
 */
export class MixpanelTelemetryProvider implements TelemetryProvider {
  private isEnabled: boolean

  constructor() {
    const token = __MIXPANEL_TOKEN__

    if (token) {
      try {
        mixpanel.init(token, {
          debug: import.meta.env.DEV,
          track_pageview: true,
          persistence: 'localStorage'
        })
        this.isEnabled = true
      } catch (error) {
        console.error('Failed to initialize Mixpanel:', error)
        this.isEnabled = false
      }
    } else {
      console.warn('Mixpanel token not provided')
      this.isEnabled = false
    }
  }

  /**
   * Track event with Mixpanel
   */
  private trackEvent(
    eventName: TelemetryEventName,
    properties: Record<string, unknown> = {}
  ): void {
    if (!this.isEnabled) {
      return
    }

    try {
      mixpanel.track(eventName, properties)
    } catch (error) {
      console.error('Failed to track event:', error)
    }
  }

  trackSignUp(stage: 'opened' | 'completed', metadata?: AuthMetadata): void {
    const eventName =
      stage === 'opened'
        ? TelemetryEvents.USER_SIGN_UP_OPENED
        : TelemetryEvents.USER_SIGN_UP_COMPLETED

    this.trackEvent(eventName, {
      ...metadata,
      timestamp: Date.now()
    })
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    const eventName =
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED

    this.trackEvent(eventName, {
      timestamp: Date.now()
    })
  }

  trackRunButton(subscribeToRun: boolean, context?: Partial<RunContext>): void {
    this.trackEvent(TelemetryEvents.RUN_BUTTON_CLICKED, {
      subscribe_to_run: subscribeToRun,
      ...context,
      timestamp: Date.now()
    })
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    const eventName =
      stage === 'opened'
        ? TelemetryEvents.USER_SURVEY_OPENED
        : TelemetryEvents.USER_SURVEY_SUBMITTED

    this.trackEvent(eventName, {
      ...responses,
      timestamp: Date.now()
    })
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

    this.trackEvent(eventName, {
      timestamp: Date.now()
    })
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_WORKFLOW_OPENED, {
      ...metadata,
      timestamp: Date.now()
    })
  }
}
