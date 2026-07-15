import type { AnalyticsBrowser } from '@customerio/cdp-analytics-browser'
import { omit } from 'es-toolkit'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'

import { TelemetryEvents } from '../../types'
import type {
  AuthMetadata,
  ExecutionSuccessMetadata,
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
  identity?: CustomerIoIdentity
}

interface CustomerIoIdentity {
  userId: string
  email?: string
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
  private eventQueue: QueuedEvent[] = []
  private identifiedUser: CustomerIoIdentity | null = null
  private identifyPromise: Promise<void> = Promise.resolve()

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
        void analytics.register(
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
          void this.identify({ userId: userIdOverride })
        }
        currentUser.onUserResolved((user) => {
          void this.identify({
            userId: userIdOverride || user.id,
            email: currentUser.userEmail.value || undefined
          })
        })
        currentUser.onUserLogout(() => {
          this.identifiedUser = null
          this.identifyPromise = Promise.resolve()
          void analytics.reset()
        })

        this.flushQueue()
      })
      .catch((error) => {
        console.error('Failed to load Customer.io:', error)
        this.isEnabled = false
        this.eventQueue = []
      })
  }

  private identify(identity: CustomerIoIdentity): Promise<void> {
    const analytics = this.analytics
    if (!analytics) return Promise.resolve()

    if (
      this.identifiedUser?.userId === identity.userId &&
      this.identifiedUser.email === identity.email
    ) {
      return this.identifyPromise
    }

    this.identifiedUser = identity
    this.identifyPromise = analytics
      .identify(
        identity.userId,
        identity.email ? { email: identity.email } : undefined
      )
      .then(() => undefined)
      .catch((error) => {
        if (this.identifiedUser === identity) this.identifiedUser = null
        console.error('Failed to identify Customer.io user:', error)
      })
    return this.identifyPromise
  }

  private async send(
    event: string,
    properties: Record<string, unknown>,
    identity?: CustomerIoIdentity
  ): Promise<void> {
    const analytics = this.analytics
    if (!analytics) return

    if (identity) await this.identify(identity)

    await analytics.track(event, properties).catch((error) => {
      console.error('Failed to track Customer.io event:', error)
    })
  }

  private track(
    event: string,
    metadata?: TelemetryEventProperties,
    identity?: CustomerIoIdentity
  ): void {
    if (!this.isEnabled) return
    const properties = { ...metadata, event_source: EVENT_SOURCE }
    if (this.analytics) {
      void this.send(event, properties, identity)
    } else {
      this.eventQueue.push({ event, properties, identity })
    }
  }

  private flushQueue(): void {
    if (!this.analytics) return
    for (const { event, properties, identity } of this.eventQueue) {
      void this.send(event, properties, identity)
    }
    this.eventQueue = []
  }

  trackAuth(metadata: AuthMetadata): void {
    this.track(
      TelemetryEvents.USER_AUTH_COMPLETED,
      omit(metadata, ['email', 'share_id']),
      metadata.user_id
        ? {
            userId: metadata.user_id,
            email: metadata.email || undefined
          }
        : undefined
    )
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
    this.track(TelemetryEvents.SHARE_FLOW, omit(metadata, ['share_id']))
  }
}
