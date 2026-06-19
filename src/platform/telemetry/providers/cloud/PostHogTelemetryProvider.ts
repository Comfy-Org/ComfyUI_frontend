import type { PostHog } from 'posthog-js'
import { watch } from 'vue'

import { createPostHogBeforeSend } from '@comfyorg/shared-frontend-utils/piiUtil'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useAppMode } from '@/composables/useAppMode'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import type {
  AuthFailedMetadata,
  AuthMethodSelectedMetadata,
  AuthMetadata,
  CanvasReadyMetadata,
  CheckoutInitiateFailedMetadata,
  CheckoutReturnedMetadata,
  CheckoutViewedMetadata,
  CheckoutWindowBlockedMetadata,
  BillingCycleToggledMetadata,
  AuthErrorMetadata,
  TemplateCategorySelectedMetadata,
  DefaultViewSetMetadata,
  EnterLinearMetadata,
  ShareFlowMetadata,
  ShareLinkOpenedMetadata,
  FirstExecutionCompletedMetadata,
  HelpCenterClosedMetadata,
  HelpCenterOpenedMetadata,
  HelpResourceClickedMetadata,
  NodeAddedMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  OAuthPopupResultMetadata,
  OnboardingRoutedMetadata,
  OutputViewedMetadata,
  PaywallViewedMetadata,
  SearchQueryMetadata,
  PageViewMetadata,
  PageVisibilityMetadata,
  RunButtonProperties,
  SettingChangedMetadata,
  SharedWorkflowRunMetadata,
  ShellLayoutMetadata,
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
import { normalizeSurveyResponses } from '../../utils/surveyNormalization'

const DEFAULT_DISABLED_EVENTS = [
  TelemetryEvents.PAGE_VISIBILITY_CHANGED,
  TelemetryEvents.TAB_COUNT_TRACKING,
  TelemetryEvents.NODE_SEARCH,
  TelemetryEvents.NODE_SEARCH_RESULT_SELECTED,
  TelemetryEvents.HELP_CENTER_OPENED,
  TelemetryEvents.HELP_RESOURCE_CLICKED,
  TelemetryEvents.HELP_CENTER_CLOSED
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
              // Enable web analytics on cloud.comfy.org ($pageview/$pageleave); overridable
              // via serverConfig. Heatmaps are server-side (RemoteConfig), not a client key.
              autocapture: true,
              capture_pageview: true,
              capture_pageleave: true,
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
            this.registerAppModeSuperProperty()
            this.registerCustomerTierSuperProperty()
            this.setFirstTouchAttribution()

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

  /**
   * Registers `is_app_mode` as a super-property so it rides every PostHog
   * event. App vs graph mode flips mid-session, so a watcher re-registers on
   * change to keep the value current at emit time. register() (not people.set)
   * because this is event-context, not a stable person trait.
   */
  private registerAppModeSuperProperty(): void {
    // Contain errors: this runs inside the posthog-js import .then(), so a throw would hit
    // init's .catch and disable the whole provider. Degrade to is_app_mode absent instead.
    try {
      const { isAppMode } = useAppMode()
      watch(
        isAppMode,
        (value) => {
          if (this.posthog) {
            this.posthog.register({ is_app_mode: value })
          }
        },
        { immediate: true }
      )
    } catch (error) {
      console.error('Failed to register is_app_mode super-property:', error)
    }
  }

  /**
   * Registers `customer_tier` as a super-property so every event carries the
   * current subscription tier. Sourced from the same useSubscription() ref as
   * the subscription_tier person property; registered on change once known.
   * This is the event-level mirror of the subscription_tier person property:
   * register() attaches it to events at emit time (vs person-on-events).
   */
  private registerCustomerTierSuperProperty(): void {
    // Defensive for the same reason as registerAppModeSuperProperty: a throw
    // from useSubscription() must not disable the provider at init.
    try {
      const { subscriptionTier } = useSubscription()
      watch(
        subscriptionTier,
        (tier) => {
          if (tier && this.posthog) {
            this.posthog.register({ customer_tier: tier })
          }
        },
        { immediate: true }
      )
    } catch (error) {
      console.error('Failed to register customer_tier super-property:', error)
    }
  }

  /**
   * First-touch attribution: on provider init, parse the landing URL's UTM
   * params and $set_once initial_utm_* on the person. set_once never
   * overwrites, so the very first touch is preserved across sessions. Only
   * present params are written; absent ones are skipped entirely.
   */
  private setFirstTouchAttribution(): void {
    if (!this.posthog) return
    const params = new URLSearchParams(window.location.search)
    const firstTouch: Record<string, string> = {}
    const source = params.get('utm_source')
    const medium = params.get('utm_medium')
    const campaign = params.get('utm_campaign')
    if (source) firstTouch.initial_utm_source = source
    if (medium) firstTouch.initial_utm_medium = medium
    if (campaign) firstTouch.initial_utm_campaign = campaign
    if (Object.keys(firstTouch).length === 0) return
    try {
      this.posthog.people.set_once(firstTouch)
    } catch (error) {
      console.error('Failed to set first-touch attribution:', error)
    }
  }

  trackSignupOpened(): void {
    this.trackEvent(TelemetryEvents.USER_SIGN_UP_OPENED)
  }

  trackAuthMethodSelected(metadata: AuthMethodSelectedMetadata): void {
    this.trackEvent(TelemetryEvents.AUTH_METHOD_SELECTED, metadata)
  }

  trackOAuthPopupResult(metadata: OAuthPopupResultMetadata): void {
    this.trackEvent(TelemetryEvents.OAUTH_POPUP_RESULT, metadata)
  }

  trackAuthFailed(metadata: AuthFailedMetadata): void {
    this.trackEvent(TelemetryEvents.AUTH_FAILED, metadata)
  }

  trackCanvasReady(metadata: CanvasReadyMetadata): void {
    this.trackEvent(TelemetryEvents.CANVAS_READY, metadata)
  }

  trackOnboardingRouted(metadata: OnboardingRoutedMetadata): void {
    this.trackEvent(TelemetryEvents.ONBOARDING_ROUTED, metadata)
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

  trackPaywallViewed(metadata: PaywallViewedMetadata): void {
    this.trackEvent(TelemetryEvents.PAYWALL_VIEWED, metadata)
  }

  trackCheckoutViewed(metadata: CheckoutViewedMetadata): void {
    this.trackEvent(TelemetryEvents.CHECKOUT_VIEWED, metadata)
  }

  trackCheckoutReturned(metadata: CheckoutReturnedMetadata): void {
    this.trackEvent(TelemetryEvents.CHECKOUT_RETURNED, metadata)
  }

  trackBillingCycleToggled(metadata: BillingCycleToggledMetadata): void {
    this.trackEvent(TelemetryEvents.BILLING_CYCLE_TOGGLED, metadata)
  }

  trackAuthError(metadata: AuthErrorMetadata): void {
    this.trackEvent(TelemetryEvents.AUTH_ERROR, metadata)
  }

  trackTemplateCategorySelected(
    metadata: TemplateCategorySelectedMetadata
  ): void {
    this.trackEvent(TelemetryEvents.TEMPLATE_CATEGORY_SELECTED, metadata)
  }

  trackAddApiCreditButtonClicked(): void {
    this.trackEvent(TelemetryEvents.ADD_API_CREDIT_BUTTON_CLICKED)
  }

  trackCheckoutInitiateFailed(metadata: CheckoutInitiateFailedMetadata): void {
    this.trackEvent(TelemetryEvents.CHECKOUT_INITIATE_FAILED, metadata)
  }

  trackCheckoutWindowBlocked(metadata?: CheckoutWindowBlockedMetadata): void {
    this.trackEvent(TelemetryEvents.CHECKOUT_WINDOW_BLOCKED, metadata)
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

  trackShareLinkOpened(metadata: ShareLinkOpenedMetadata): void {
    this.trackEvent(TelemetryEvents.SHARE_LINK_OPENED, metadata)
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.trackEvent(TelemetryEvents.PAGE_VISIBILITY_CHANGED, metadata)
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.trackEvent(TelemetryEvents.TAB_COUNT_TRACKING, metadata)
  }

  trackShellLayout(metadata: ShellLayoutMetadata): void {
    this.trackEvent(TelemetryEvents.SHELL_LAYOUT, metadata)
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

  trackFirstExecutionCompleted(
    metadata: FirstExecutionCompletedMetadata
  ): void {
    this.trackEvent(TelemetryEvents.FIRST_EXECUTION_COMPLETED, metadata)
  }

  trackOutputViewed(metadata: OutputViewedMetadata): void {
    this.trackEvent(TelemetryEvents.OUTPUT_VIEWED, metadata)
  }

  trackSharedWorkflowRun(metadata: SharedWorkflowRunMetadata): void {
    this.trackEvent(TelemetryEvents.SHARED_WORKFLOW_RUN, metadata)
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
