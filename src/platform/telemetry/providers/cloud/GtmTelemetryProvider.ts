import type {
  AuthMetadata,
  BeginCheckoutMetadata,
  ExecutionErrorMetadata,
  ExecutionTriggerSource,
  PageViewMetadata,
  TemplateMetadata,
  TelemetryProvider
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

  private pushEvent(event: string, properties?: Record<string, unknown>): void {
    if (!this.initialized) return
    window.dataLayer?.push({ event, ...properties })
  }

  trackPageView(pageName: string, properties?: PageViewMetadata): void {
    this.pushEvent('page_view', {
      page_title: pageName,
      page_location: properties?.path,
      page_referrer: properties?.referrer
    })
  }

  trackAuth(metadata: AuthMetadata): void {
    const basePayload = {
      method: metadata.method,
      ...(metadata.user_id ? { user_id: metadata.user_id } : {})
    }

    if (metadata.is_new_user) {
      this.pushEvent('sign_up', basePayload)
      return
    }

    this.pushEvent('login', basePayload)
  }

  trackBeginCheckout(metadata: BeginCheckoutMetadata): void {
    this.pushEvent('begin_checkout', metadata)
  }

  trackSubscription(event: 'modal_opened' | 'subscribe_clicked'): void {
    this.pushEvent('subscription_change', { action: event })
  }

  trackMonthlySubscriptionSucceeded(): void {
    this.pushEvent('subscription_success')
  }

  trackRunButton(options?: {
    subscribe_to_run?: boolean
    trigger_source?: ExecutionTriggerSource
  }): void {
    this.pushEvent('run_workflow', {
      subscribe_to_run: options?.subscribe_to_run,
      trigger_source: options?.trigger_source
    })
  }

  trackWorkflowExecution(): void {
    this.pushEvent('workflow_execution')
  }

  trackExecutionError(metadata: ExecutionErrorMetadata): void {
    this.pushEvent('execution_error', {
      node_type: metadata.nodeType,
      error: metadata.error
    })
  }

  trackAddApiCreditButtonClicked(): void {
    this.pushEvent('add_credit_clicked')
  }

  trackTemplate(metadata: TemplateMetadata): void {
    this.pushEvent('template_used', {
      workflow_name: metadata.workflow_name,
      template_source: metadata.template_source,
      template_category: metadata.template_category
    })
  }
}
