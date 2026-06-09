import type { PostHog } from 'posthog-js'
import { watch } from 'vue'

import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'

import { useAppMode } from '@/composables/useAppMode'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import type {
  AuthMetadata,
  DefaultViewSetMetadata,
  EnterLinearMetadata,
  ShareFlowMetadata,
  ExecutionTriggerSource,
  HelpCenterClosedMetadata,
  HelpCenterOpenedMetadata,
  HelpResourceClickedMetadata,
  NodeAddedMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  SearchQueryMetadata,
  PageViewMetadata,
  PageVisibilityMetadata,
  RunButtonProperties,
  SettingChangedMetadata,
  SubscriptionMetadata,
  SubscriptionSuccessMetadata,
  SurveyResponses,
  TabCountMetadata,
  TelemetryEventName,
  TelemetryEventProperties,
  TelemetryProvider,
  TemplateFilterMetadata,
  TemplateLibraryClosedMetadata,
  TemplateLibraryMetadata,
  TemplateMetadata,
  UiButtonClickMetadata,
  WorkflowCreatedMetadata,
  WorkflowImportMetadata,
  WorkflowSavedMetadata
} from '../../types'
import { TelemetryEvents } from '../../types'
import { getExecutionContext } from '../../utils/getExecutionContext'
import { normalizeSurveyResponses } from '../../utils/surveyNormalization'

const DEFAULT_DISABLED_EVENTS = [
  TelemetryEvents.WORKFLOW_OPENED,
  TelemetryEvents.PAGE_VISIBILITY_CHANGED,
  TelemetryEvents.TAB_COUNT_TRACKING,
  TelemetryEvents.NODE_SEARCH,
  TelemetryEvents.NODE_SEARCH_RESULT_SELECTED,
  TelemetryEvents.TEMPLATE_FILTER_CHANGED,
  TelemetryEvents.SETTING_CHANGED,
  TelemetryEvents.HELP_CENTER_OPENED,
  TelemetryEvents.HELP_RESOURCE_CLICKED,
  TelemetryEvents.HELP_CENTER_CLOSED,
  TelemetryEvents.WORKFLOW_CREATED,
  TelemetryEvents.UI_BUTTON_CLICKED
] as const satisfies TelemetryEventName[]

const TELEMETRY_EVENT_SET = new Set<TelemetryEventName>(
  Object.values(TelemetryEvents) as TelemetryEventName[]
)

interface QueuedEvent {
  eventName: TelemetryEventName
  properties?: TelemetryEventProperties
}

interface DesktopEntryProps {
  source_app: 'desktop'
  desktop_device_id?: string
}

function readDesktopEntryProps(): DesktopEntryProps | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get('utm_source') !== 'comfy.desktop') return null
  const props: DesktopEntryProps = { source_app: 'desktop' }
  const deviceId = params.get('desktop_device_id')
  if (deviceId) props.desktop_device_id = deviceId
  return props
}

/**
 * PostHog Telemetry Provider - Cloud Build Implementation
 *
 * Sends all telemetry events to PostHog so they can be correlated
 * with session recordings. Follows the same pattern as MixpanelTelemetryProvider.
 *
 * CRITICAL: OSS Build Safety
 * Entire file is tree-shaken away in OSS builds (DISTRIBUTION unset).
 */
export class PostHogTelemetryProvider implements TelemetryProvider {
  private isEnabled = true
  private posthog: PostHog | null = null
  private eventQueue: QueuedEvent[] = []
  private pendingFirstAuthAt = new Map<string, string>()
  private isInitialized = false
  private disabledEvents = new Set<TelemetryEventName>(DEFAULT_DISABLED_EVENTS)
  private desktopEntryProps: DesktopEntryProps | null = null

  constructor() {
    this.configureDisabledEvents(
      (window.__CONFIG__ as Partial<RemoteConfig> | undefined) ?? null
    )
    watch(
      remoteConfig,
      (config) => {
        this.configureDisabledEvents(config)
      },
      { immediate: true }
    )

    const apiKey = window.__CONFIG__?.posthog_project_token
    if (apiKey) {
      try {
        void import('posthog-js')
          .then((posthogModule) => {
            this.posthog = posthogModule.default
            const serverConfig = remoteConfig.value?.posthog_config ?? {}
            this.posthog!.init(apiKey, {
              api_host:
                window.__CONFIG__?.posthog_api_host || 'https://t.comfy.org',
              ui_host: 'https://us.posthog.com',
              autocapture: false,
              capture_pageview: false,
              capture_pageleave: false,
              persistence: 'localStorage+cookie',
              debug: import.meta.env.VITE_POSTHOG_DEBUG === 'true',
              ...serverConfig,
              person_profiles: 'identified_only',
              // cookie_domain omitted: posthog-js sets a first-party cross-subdomain cookie
              // automatically when persistence includes 'cookie' (the default).
              // Explicit override interacts badly with posthog-js#3578 where reset() fails
              // to clear localStorage on other subdomains, causing identity bleed on logout.
              before_send: createPostHogBeforeSend()
            })
            this.isInitialized = true
            this.flushEventQueue()
            this.registerDesktopEntryProps()

            const currentUser = useCurrentUser()
            currentUser.onUserResolved((user) => {
              if (this.posthog && user.id) {
                this.posthog.identify(user.id)
                this.setDesktopEntryPersonProperties()
                this.setSubscriptionProperties()
              }
            })
            // Anchored to session state rather than the logout button so it
            // also covers token revocation, account deletion, and cross-tab
            // sign-out (browserLocalPersistence). A logout that lands during
            // the posthog-js dynamic-import window will not be observed here:
            // events buffered pre-init are intentionally NOT queue-cleared on
            // logout, which leaves a narrow race where a logout + different
            // login both inside the import window would flush pre-init events
            // under the new identity. Accepted as a known edge — re-adding
            // pre-init logout handling would defeat the simplification.
            currentUser.onUserLogout(() => {
              this.posthog?.reset(true)
            })
          })
          .catch((error) => {
            console.error('Failed to load PostHog:', error)
            this.isEnabled = false
          })
      } catch (error) {
        console.error('Failed to initialize PostHog:', error)
        this.isEnabled = false
      }
    } else {
      console.warn('PostHog API key not provided in runtime config')
      this.isEnabled = false
    }
  }

  private flushEventQueue(): void {
    if (!this.isInitialized || !this.posthog) return

    this.flushPendingFirstAuthAt()

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!
      try {
        this.posthog.capture(event.eventName, event.properties || {})
      } catch (error) {
        console.error('Failed to track queued PostHog event:', error)
      }
    }
  }

  private flushPendingFirstAuthAt(): void {
    for (const [userId, firstAuthAt] of this.pendingFirstAuthAt) {
      this.setFirstAuthAt(userId, firstAuthAt)
    }
    this.pendingFirstAuthAt.clear()
  }

  private setFirstAuthAt(
    userId: string,
    firstAuthAt = new Date().toISOString()
  ): void {
    if (!this.isEnabled) return

    if (this.isInitialized && this.posthog) {
      try {
        this.posthog.identify(userId, undefined, { first_auth_at: firstAuthAt })
      } catch (error) {
        console.error('Failed to set PostHog first auth timestamp:', error)
      }
      return
    }

    if (!this.pendingFirstAuthAt.has(userId)) {
      this.pendingFirstAuthAt.set(userId, firstAuthAt)
    }
  }

  private trackEvent(
    eventName: TelemetryEventName,
    properties?: TelemetryEventProperties
  ): void {
    if (!this.isEnabled) return
    if (this.disabledEvents.has(eventName)) return

    const event: QueuedEvent = { eventName, properties }

    if (this.isInitialized && this.posthog) {
      try {
        this.posthog.capture(eventName, properties || {})
      } catch (error) {
        console.error('Failed to track PostHog event:', error)
      }
    } else {
      this.eventQueue.push(event)
    }
  }

  private captureRaw(
    eventName: TelemetryEventName,
    properties?: Record<string, unknown>
  ): void {
    if (!this.isEnabled) return
    if (this.disabledEvents.has(eventName)) return

    if (this.isInitialized && this.posthog) {
      try {
        this.posthog.capture(eventName, properties || {})
      } catch (error) {
        console.error('Failed to track PostHog event:', error)
      }
    } else {
      this.eventQueue.push({
        eventName,
        properties: properties as TelemetryEventProperties
      })
    }
  }

  private configureDisabledEvents(config: Partial<RemoteConfig> | null): void {
    const disabledSource =
      config?.telemetry_disabled_events ?? DEFAULT_DISABLED_EVENTS

    this.disabledEvents = this.buildEventSet(disabledSource)
  }

  private buildEventSet(values: TelemetryEventName[]): Set<TelemetryEventName> {
    return new Set(
      values.filter((value) => {
        const isValid = TELEMETRY_EVENT_SET.has(value)
        if (!isValid && import.meta.env.DEV) {
          console.warn(
            `Unknown telemetry event name in disabled list: ${value}`
          )
        }
        return isValid
      })
    )
  }

  private registerDesktopEntryProps(): void {
    if (!this.posthog) return
    const props = readDesktopEntryProps()
    if (!props) return
    this.desktopEntryProps = props
    try {
      this.posthog.register(props)
    } catch (error) {
      console.error('Failed to register desktop entry props:', error)
    }
  }

  // Persisted onto the person so backend-fired billing events inherit
  // desktop_device_id via person-on-events at ingest.
  private setDesktopEntryPersonProperties(): void {
    if (!this.posthog || !this.desktopEntryProps) return
    const now = new Date().toISOString()
    try {
      this.posthog.people.set({
        ...this.desktopEntryProps,
        last_seen_via_desktop: now
      })
      this.posthog.people.set_once({ first_seen_via_desktop: now })
    } catch (error) {
      console.error('Failed to set desktop entry person properties:', error)
    }
  }

  private setSubscriptionProperties(): void {
    const { subscriptionTier } = useSubscription()
    watch(
      subscriptionTier,
      (tier) => {
        if (tier && this.posthog) {
          this.posthog.people.set({ subscription_tier: tier })
        }
      },
      { immediate: true }
    )
  }

  trackSignupOpened(): void {
    this.trackEvent(TelemetryEvents.USER_SIGN_UP_OPENED)
  }

  trackAuth(metadata: AuthMetadata): void {
    if (metadata.is_new_user && metadata.user_id) {
      this.setFirstAuthAt(metadata.user_id)
    }
    this.trackEvent(TelemetryEvents.USER_AUTH_COMPLETED, metadata)
  }

  trackUserLoggedIn(): void {
    this.trackEvent(TelemetryEvents.USER_LOGGED_IN)
  }

  trackSubscription(
    event: 'modal_opened' | 'subscribe_clicked',
    metadata?: SubscriptionMetadata
  ): void {
    const eventName =
      event === 'modal_opened'
        ? TelemetryEvents.SUBSCRIPTION_REQUIRED_MODAL_OPENED
        : TelemetryEvents.SUBSCRIBE_NOW_BUTTON_CLICKED

    this.trackEvent(eventName, metadata)
  }

  trackAddApiCreditButtonClicked(): void {
    this.trackEvent(TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED)
  }

  trackMonthlySubscriptionSucceeded(
    metadata?: SubscriptionSuccessMetadata
  ): void {
    this.trackEvent(TelemetryEvents.MONTHLY_SUBSCRIPTION_SUCCEEDED, metadata)
  }

  trackMonthlySubscriptionCancelled(): void {
    this.trackEvent(TelemetryEvents.MONTHLY_SUBSCRIPTION_CANCELLED)
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    this.trackEvent(TelemetryEvents.API_CREDIT_TOPUP_BUTTON_PURCHASE_CLICKED, {
      credit_amount: amount
    })
  }

  trackApiCreditTopupSucceeded(): void {
    this.trackEvent(TelemetryEvents.API_CREDIT_TOPUP_SUCCEEDED)
  }

  trackRunButton(options?: {
    subscribe_to_run?: boolean
    trigger_source?: ExecutionTriggerSource
  }): void {
    const executionContext = getExecutionContext()
    const { mode, isAppMode } = useAppMode()

    const runButtonProperties: RunButtonProperties = {
      subscribe_to_run: options?.subscribe_to_run || false,
      workflow_type: executionContext.is_template ? 'template' : 'custom',
      workflow_name: executionContext.workflow_name ?? 'untitled',
      custom_node_count: executionContext.custom_node_count,
      total_node_count: executionContext.total_node_count,
      subgraph_count: executionContext.subgraph_count,
      has_api_nodes: executionContext.has_api_nodes,
      api_node_names: executionContext.api_node_names,
      has_toolkit_nodes: executionContext.has_toolkit_nodes,
      toolkit_node_names: executionContext.toolkit_node_names,
      trigger_source: options?.trigger_source,
      view_mode: mode.value,
      is_app_mode: isAppMode.value
    }

    this.trackEvent(TelemetryEvents.RUN_BUTTON_CLICKED, runButtonProperties)
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    const eventName =
      stage === 'opened'
        ? TelemetryEvents.USER_SURVEY_OPENED
        : TelemetryEvents.USER_SURVEY_SUBMITTED

    const normalizedResponses = responses
      ? normalizeSurveyResponses(responses)
      : undefined

    this.trackEvent(eventName, normalizedResponses)

    if (
      stage === 'submitted' &&
      normalizedResponses &&
      this.posthog &&
      this.isEnabled &&
      !this.disabledEvents.has(TelemetryEvents.USER_SURVEY_SUBMITTED)
    ) {
      try {
        this.posthog.people.set(normalizedResponses)
      } catch (error) {
        console.error('Failed to set PostHog user properties:', error)
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

  trackWorkflowSaved(metadata: WorkflowSavedMetadata): void {
    this.trackEvent(TelemetryEvents.WORKFLOW_SAVED, metadata)
  }

  trackDefaultViewSet(metadata: DefaultViewSetMetadata): void {
    this.trackEvent(TelemetryEvents.DEFAULT_VIEW_SET, metadata)
  }

  trackEnterLinear(metadata: EnterLinearMetadata): void {
    this.trackEvent(TelemetryEvents.ENTER_LINEAR_MODE, metadata)
  }

  trackShareFlow(metadata: ShareFlowMetadata): void {
    this.trackEvent(TelemetryEvents.SHARE_FLOW, metadata)
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

  trackSearchQuery(metadata: SearchQueryMetadata): void {
    this.trackEvent(TelemetryEvents.SEARCH_QUERY, metadata)
  }

  trackNodeAdded(metadata: NodeAddedMetadata): void {
    this.trackEvent(TelemetryEvents.NODE_ADDED, metadata)
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

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    this.trackEvent(TelemetryEvents.SETTING_CHANGED, metadata)
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    this.trackEvent(TelemetryEvents.UI_BUTTON_CLICKED, metadata)
  }

  trackPageView(pageName: string, properties?: PageViewMetadata): void {
    this.captureRaw(TelemetryEvents.PAGE_VIEW, {
      page_name: pageName,
      ...properties
    })
  }
}
