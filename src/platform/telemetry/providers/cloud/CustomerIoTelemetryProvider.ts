import type { AnalyticsBrowser } from '@customerio/cdp-analytics-browser'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import { TelemetryEvents } from '../../types'
import type {
  AuthMetadata,
  ExecutionSuccessMetadata,
  PageViewMetadata,
  ShareFlowMetadata,
  SubscriptionMetadata,
  TelemetryEventProperties,
  TelemetryProvider,
  TemplateLibraryMetadata,
  TemplateMetadata
} from '../../types'

export const EVENT_SOURCE = 'web-sdk'

interface QueuedEvent {
  event: string
  properties: Record<string, unknown>
}

/**
 * Customer.io (Data Pipelines) Telemetry Provider - Cloud Build Implementation
 *
 * CRITICAL: OSS Build Safety
 * Only registered from the cloud-only initTelemetry, so the file and its SDK
 * import are tree-shaken away in OSS/desktop builds.
 */
export class CustomerIoTelemetryProvider implements TelemetryProvider {
  private analytics: AnalyticsBrowser | null = null
  private isEnabled = true
  private isInAppPluginReady = false
  private eventQueue: QueuedEvent[] = []
  private pageViewQueued = true

  constructor() {
    const {
      write_key: writeKey,
      site_id: siteId,
      user_id: userIdOverride
    } = window.__CONFIG__?.customer_io ?? {}
    if (!writeKey || !siteId) {
      this.isEnabled = false
      return
    }

    void import('@customerio/cdp-analytics-browser')
      .then(({ AnalyticsBrowser, InAppPlugin }) => {
        const analytics = AnalyticsBrowser.load({ writeKey })
        const inAppRegistration = analytics.register(
          InAppPlugin({
            siteId,
            events: null,
            anonymousInApp: false,
            _env: undefined,
            _logging: undefined,
            colorScheme: 'system'
          })
        )
        this.analytics = analytics

        const currentUser = useCurrentUser()
        if (userIdOverride) {
          void analytics.identify(userIdOverride)
        } else {
          currentUser.onUserResolved((user) => void analytics.identify(user.id))
        }
        currentUser.onUserLogout(() => void analytics.reset())

        this.flushQueue()
        void inAppRegistration
          .then(() => {
            this.isInAppPluginReady = true
            this.flushPageView()
          })
          .catch((error) => {
            console.error(
              'Failed to initialize Customer.io in-app plugin:',
              error
            )
          })
      })
      .catch((error) => {
        console.error('Failed to load Customer.io:', error)
        this.isEnabled = false
        this.eventQueue = []
      })
  }

  private send(event: string, properties: Record<string, unknown>): void {
    void this.analytics?.track(event, properties)?.catch((error) => {
      console.error('Failed to track Customer.io event:', error)
    })
  }

  private track(event: string, metadata?: TelemetryEventProperties): void {
    if (!this.isEnabled) return
    const properties = { ...metadata, event_source: EVENT_SOURCE }
    if (this.analytics) {
      this.send(event, properties)
    } else {
      this.eventQueue.push({ event, properties })
    }
  }

  private flushQueue(): void {
    if (!this.analytics) return
    for (const { event, properties } of this.eventQueue) {
      this.send(event, properties)
    }
    this.eventQueue = []
  }

  private sendPageView(): void {
    void this.analytics?.page()?.catch((error) => {
      console.error('Failed to track Customer.io page view:', error)
    })
  }

  private flushPageView(): void {
    if (!this.analytics || !this.isInAppPluginReady || !this.pageViewQueued) {
      return
    }
    this.pageViewQueued = false
    this.sendPageView()
  }

  trackPageView(_pageName: string, _properties?: PageViewMetadata): void {
    if (!this.isEnabled) return
    if (!this.analytics || !this.isInAppPluginReady) {
      this.pageViewQueued = true
      return
    }
    this.sendPageView()
  }

  trackAuth(metadata: AuthMetadata): void {
    this.track(TelemetryEvents.USER_AUTH_COMPLETED, metadata)
  }

  trackSubscription(
    event: 'modal_opened' | 'subscribe_clicked',
    metadata?: SubscriptionMetadata
  ): void {
    this.track(
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED,
      metadata
    )
  }

  trackAddApiCreditButtonClicked(): void {
    this.track(TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED)
  }

  trackWorkflowExecution(): void {
    this.track(TelemetryEvents.EXECUTION_START)
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.track(TelemetryEvents.EXECUTION_SUCCESS, metadata)
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.track(TelemetryEvents.TEMPLATE_WORKFLOW_OPENED, metadata)
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.track(TelemetryEvents.TEMPLATE_LIBRARY_OPENED, metadata)
  }

  trackShareFlow(metadata: ShareFlowMetadata): void {
    this.track(TelemetryEvents.SHARE_FLOW, metadata)
  }
}
