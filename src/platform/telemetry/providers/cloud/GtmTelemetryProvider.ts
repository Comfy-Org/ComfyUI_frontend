import type {
  AuthMetadata,
  BeginCheckoutMetadata,
  DefaultViewSetMetadata,
  EnterLinearMetadata,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  ExecutionTriggerSource,
  HelpCenterClosedMetadata,
  HelpCenterOpenedMetadata,
  HelpResourceClickedMetadata,
  NodeSearchMetadata,
  NodeSearchResultMetadata,
  PageViewMetadata,
  PageVisibilityMetadata,
  SettingChangedMetadata,
  ShareFlowMetadata,
  SubscriptionMetadata,
  SubscriptionSuccessMetadata,
  SurveyResponses,
  TabCountMetadata,
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

/**
 * Google Tag Manager telemetry provider.
 * Pushes events to the GTM dataLayer for GA4 and marketing integrations.
 *
 * Only implements events relevant to GTM/GA4 tracking.
 */
export class GtmTelemetryProvider implements TelemetryProvider {
  private initialized = false

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    if (typeof window === 'undefined') return

    const gtmId = window.__CONFIG__?.gtm_container_id
    if (gtmId) {
      this.initializeGtm(gtmId)
    } else {
      if (import.meta.env.MODE === 'development') {
        console.warn('[GTM] No GTM ID configured, skipping initialization')
      }
    }

    const measurementId = window.__CONFIG__?.ga_measurement_id
    if (measurementId) {
      this.bootstrapGtag(measurementId)
    }
  }

  private initializeGtm(gtmId: string): void {
    window.dataLayer = window.dataLayer || []

    window.dataLayer.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js'
    })

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`
    document.head.insertBefore(script, document.head.firstChild)

    this.initialized = true
  }

  private bootstrapGtag(measurementId: string): void {
    window.dataLayer = window.dataLayer || []

    if (typeof window.gtag !== 'function') {
      function gtag() {
        // gtag queue shape is dataLayer.push(arguments)
        // eslint-disable-next-line prefer-rest-params
        ;(window.dataLayer as unknown[] | undefined)?.push(arguments)
      }

      window.gtag = gtag as Window['gtag']
    }

    const gtagScriptSrc = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`
    const existingGtagScript = document.querySelector(
      `script[src="${gtagScriptSrc}"]`
    )

    if (!existingGtagScript) {
      const script = document.createElement('script')
      script.async = true
      script.src = gtagScriptSrc
      document.head.insertBefore(script, document.head.firstChild)
    }

    const gtag = window.gtag
    if (typeof gtag !== 'function') return

    gtag('js', new Date())
    gtag('config', measurementId, { send_page_view: false })
  }

  private sanitizeProperties(
    properties?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    if (!properties) return undefined

    return Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.slice(0, 100) : value
      ])
    )
  }

  private pushEvent(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) return
    window.dataLayer?.push({ event, ...this.sanitizeProperties(properties) })
  }

  trackPageView(pageName: string, properties?: PageViewMetadata): void {
    this.pushEvent('page_view', {
      page_title: pageName,
      page_location: properties?.path,
      page_referrer: properties?.referrer
    })
  }

  trackAuth(metadata: AuthMetadata): void {
    const payload = {
      method: metadata.method,
      ...(metadata.user_id ? { user_id: metadata.user_id } : {}),
      ...(metadata.email
        ? {
            user_data: {
              email: metadata.email.trim().toLowerCase()
            }
          }
        : {})
    }

    this.pushEvent(metadata.is_new_user ? 'sign_up' : 'login', payload)
  }

  trackBeginCheckout(metadata: BeginCheckoutMetadata): void {
    this.pushEvent('begin_checkout', metadata)
  }

  trackSubscription(
    event: 'modal_opened' | 'subscribe_clicked',
    metadata?: SubscriptionMetadata
  ): void {
    const ga4EventName =
      event === 'modal_opened' ? 'view_promotion' : 'select_promotion'
    this.pushEvent(ga4EventName, metadata ? { ...metadata } : undefined)
  }

  trackSignupOpened(): void {
    this.pushEvent('signup_opened')
  }

  trackMonthlySubscriptionSucceeded(
    metadata?: SubscriptionSuccessMetadata
  ): void {
    if (this.initialized && metadata?.ecommerce) {
      window.dataLayer?.push({ ecommerce: null })
    }

    this.pushEvent(
      'subscription_success',
      metadata ? { ...metadata } : undefined
    )
  }

  trackRunButton(options?: {
    subscribe_to_run?: boolean
    trigger_source?: ExecutionTriggerSource
  }): void {
    this.pushEvent('run_workflow', {
      subscribe_to_run: options?.subscribe_to_run ?? false,
      trigger_source: options?.trigger_source ?? 'unknown'
    })
  }

  trackWorkflowExecution(): void {
    this.pushEvent('execution_start')
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.pushEvent('execution_error', {
      node_type: metadata.nodeType,
      error: metadata.error
    })
  }

  trackExecutionSuccess(metadata: ExecutionSuccessMetadata): void {
    this.pushEvent('execution_success', {
      job_id: metadata.jobId
    })
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.pushEvent('select_content', {
      content_type: 'template',
      workflow_name: metadata.workflow_name,
      template_category: metadata.template_category
    })
  }

  trackTemplateLibraryOpened(metadata: TemplateLibraryMetadata): void {
    this.pushEvent('template_library_opened', {
      source: metadata.source
    })
  }

  trackTemplateLibraryClosed(metadata: TemplateLibraryClosedMetadata): void {
    this.pushEvent('template_library_closed', {
      template_selected: metadata.template_selected,
      time_spent_seconds: metadata.time_spent_seconds
    })
  }

  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.pushEvent('workflow_import', {
      missing_node_count: metadata.missing_node_count,
      open_source: metadata.open_source
    })
  }

  trackUserLoggedIn(): void {
    this.pushEvent('user_logged_in')
  }

  trackSurvey(
    stage: 'opened' | 'submitted',
    responses?: SurveyResponses
  ): void {
    const ga4EventName =
      stage === 'opened' ? 'survey_opened' : 'survey_submitted'
    this.pushEvent(ga4EventName, responses ? { ...responses } : undefined)
  }

  trackEmailVerification(stage: 'opened' | 'requested' | 'completed'): void {
    const eventMap = {
      opened: 'email_verify_opened',
      requested: 'email_verify_requested',
      completed: 'email_verify_completed'
    } as const
    this.pushEvent(eventMap[stage])
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    this.pushEvent('workflow_opened', {
      missing_node_count: metadata.missing_node_count,
      open_source: metadata.open_source
    })
  }

  trackWorkflowSaved(metadata: WorkflowSavedMetadata): void {
    this.pushEvent('workflow_saved', {
      is_app: metadata.is_app,
      is_new: metadata.is_new
    })
  }

  trackDefaultViewSet(metadata: DefaultViewSetMetadata): void {
    this.pushEvent('default_view_set', {
      default_view: metadata.default_view
    })
  }

  trackEnterLinear(metadata: EnterLinearMetadata): void {
    this.pushEvent('app_mode_opened', {
      source: metadata.source
    })
  }

  trackShareFlow(metadata: ShareFlowMetadata): void {
    this.pushEvent('share_flow', {
      step: metadata.step,
      source: metadata.source
    })
  }

  trackPageVisibilityChanged(metadata: PageVisibilityMetadata): void {
    this.pushEvent('page_visibility', {
      visibility_state: metadata.visibility_state
    })
  }

  trackTabCount(metadata: TabCountMetadata): void {
    this.pushEvent('tab_count', {
      tab_count: metadata.tab_count
    })
  }

  trackNodeSearch(metadata: NodeSearchMetadata): void {
    this.pushEvent('search', {
      search_term: metadata.query
    })
  }

  trackNodeSearchResultSelected(metadata: NodeSearchResultMetadata): void {
    this.pushEvent('select_item', {
      item_id: metadata.node_type,
      search_term: metadata.last_query
    })
  }

  trackTemplateFilterChanged(metadata: TemplateFilterMetadata): void {
    this.pushEvent('template_filter', {
      search_query: metadata.search_query,
      sort_by: metadata.sort_by,
      filtered_count: metadata.filtered_count,
      total_count: metadata.total_count
    })
  }

  trackSettingChanged(metadata: SettingChangedMetadata): void {
    this.pushEvent('setting_changed', {
      setting_id: metadata.setting_id
    })
  }

  trackUiButtonClicked(metadata: UiButtonClickMetadata): void {
    this.pushEvent('ui_button_click', {
      button_id: metadata.button_id
    })
  }

  trackHelpCenterOpened(metadata: HelpCenterOpenedMetadata): void {
    this.pushEvent('help_center_opened', {
      source: metadata.source
    })
  }

  trackHelpResourceClicked(metadata: HelpResourceClickedMetadata): void {
    this.pushEvent('help_resource_click', {
      resource_type: metadata.resource_type,
      is_external: metadata.is_external,
      source: metadata.source
    })
  }

  trackHelpCenterClosed(metadata: HelpCenterClosedMetadata): void {
    this.pushEvent('help_center_closed', {
      time_spent_seconds: metadata.time_spent_seconds
    })
  }

  trackWorkflowCreated(metadata: WorkflowCreatedMetadata): void {
    this.pushEvent('workflow_created', {
      workflow_type: metadata.workflow_type,
      previous_workflow_had_nodes: metadata.previous_workflow_had_nodes
    })
  }

  trackAddApiCreditButtonClicked(): void {
    this.pushEvent('add_credit_clicked')
  }

  trackApiCreditTopupButtonPurchaseClicked(amount: number): void {
    this.pushEvent('credit_topup_clicked', {
      credit_amount: amount
    })
  }
}
