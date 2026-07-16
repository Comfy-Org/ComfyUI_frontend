import type { AnalyticsBrowser } from '@customerio/cdp-analytics-browser'
import { omit, withTimeout } from 'es-toolkit'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { AuthUserInfo } from '@/types/authTypes'

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

const SDK_OPERATION_TIMEOUT_MS = 10_000

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
  private isPageViewTrackingReady = false
  private eventQueue: QueuedEvent[] = []
  private pageViewQueued = false
  private identifiedUser: CustomerIoIdentity | null = null
  private sessionIdentity: CustomerIoIdentity | null = null
  private operationQueue: Promise<void> = Promise.resolve()

  constructor() {
    const {
      write_key: writeKey,
      site_id: siteId,
      user_id: userIdOverride
    } = window.__CONFIG__?.customer_io ?? {}
    this.sessionIdentity = userIdOverride ? { userId: userIdOverride } : null
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
        const identifyResolvedUser = (user: AuthUserInfo) => {
          const identity = {
            userId: userIdOverride || user.id,
            email: currentUser.userEmail.value || undefined
          }
          this.sessionIdentity = identity
          return this.enqueueOperation(() => this.identify(identity))
        }

        if (userIdOverride && !currentUser.resolvedUserInfo.value) {
          void this.enqueueOperation(() =>
            this.identify({ userId: userIdOverride })
          )
        }
        currentUser.onUserResolved((user) => {
          void identifyResolvedUser(user)
        })
        currentUser.onUserLogout(() => {
          this.sessionIdentity = null
          void this.enqueueOperation(() => this.resetIdentity())
        })

        void this.flushQueue()
        void inAppRegistration
          .catch((error) => {
            console.error(
              'Failed to initialize Customer.io in-app plugin:',
              error
            )
          })
          .finally(() => {
            this.isPageViewTrackingReady = true
            this.flushPageView()
          })
      })
      .catch((error) => {
        console.error('Failed to load Customer.io:', error)
        this.isEnabled = false
        this.eventQueue = []
      })
  }

  private enqueueOperation(
    operation: () => Promise<void> | void
  ): Promise<void> {
    this.operationQueue = this.operationQueue.then(operation).catch((error) => {
      console.error('Failed to process Customer.io operation:', error)
    })
    return this.operationQueue
  }

  private async resetIdentity(): Promise<void> {
    this.identifiedUser = null
    const analytics = this.analytics
    if (!analytics) return
    await withTimeout(async () => {
      await analytics.reset()
    }, SDK_OPERATION_TIMEOUT_MS)
  }

  private async restoreSessionIdentity(): Promise<void> {
    if (this.sessionIdentity) {
      await this.identify(this.sessionIdentity)
    } else {
      await this.resetIdentity()
    }
  }

  private async identify(identity: CustomerIoIdentity): Promise<void> {
    const analytics = this.analytics
    if (!analytics) return

    if (
      this.identifiedUser?.userId === identity.userId &&
      this.identifiedUser.email === identity.email
    ) {
      return
    }

    this.identifiedUser = identity
    try {
      await withTimeout(async () => {
        await analytics.identify(
          identity.userId,
          identity.email ? { email: identity.email } : undefined
        )
      }, SDK_OPERATION_TIMEOUT_MS)
    } catch (error) {
      this.identifiedUser = null
      console.error('Failed to identify Customer.io user:', error)
    }
  }

  private async send(
    event: string,
    properties: Record<string, unknown>,
    identity?: CustomerIoIdentity
  ): Promise<void> {
    const analytics = this.analytics
    if (!analytics) return

    if (identity) await this.identify(identity)

    void analytics.track(event, properties).catch((error) => {
      console.error('Failed to track Customer.io event:', error)
    })

    if (identity) await this.restoreSessionIdentity()
  }

  private track(
    event: string,
    metadata?: TelemetryEventProperties,
    identity?: CustomerIoIdentity
  ): void {
    if (!this.isEnabled) return
    const properties = { ...metadata, event_source: EVENT_SOURCE }
    if (this.analytics) {
      void this.enqueueOperation(() => this.send(event, properties, identity))
    } else {
      this.eventQueue.push({ event, properties, identity })
    }
  }

  private async flushQueue(): Promise<void> {
    if (!this.analytics) return
    const queue = this.eventQueue
    this.eventQueue = []
    await this.enqueueOperation(async () => {
      for (const { event, properties, identity } of queue) {
        await this.send(event, properties, identity)
      }
    })
  }

  private sendPageView(): void {
    void this.analytics?.page()?.catch((error) => {
      console.error('Failed to track Customer.io page view:', error)
    })
  }

  private flushPageView(): void {
    if (!this.isPageViewTrackingReady || !this.pageViewQueued) {
      return
    }
    this.pageViewQueued = false
    this.sendPageView()
  }

  trackPageView(_pageName: string, _properties?: PageViewMetadata): void {
    if (!this.isEnabled) return
    if (!this.isPageViewTrackingReady) {
      this.pageViewQueued = true
      return
    }
    this.sendPageView()
  }

  trackAuth(metadata: AuthMetadata): void {
    const identity = metadata.user_id
      ? {
          userId: metadata.user_id,
          email: metadata.email || undefined
        }
      : undefined
    this.track(
      TelemetryEvents.USER_AUTH_COMPLETED,
      omit(metadata, ['email', 'share_id']),
      identity
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
