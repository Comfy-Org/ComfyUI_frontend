import { beforeEach, describe, expect, it } from 'vitest'

import { GtmTelemetryProvider } from './GtmTelemetryProvider'

describe('GtmTelemetryProvider', () => {
  beforeEach(() => {
    window.__CONFIG__ = {}
    window.dataLayer = undefined
    window.gtag = undefined
    document.head.innerHTML = ''
  })

  it('injects the GTM runtime script', () => {
    window.__CONFIG__ = {
      gtm_container_id: 'GTM-TEST123'
    }

    new GtmTelemetryProvider()

    const gtmScript = document.querySelector(
      'script[src="https://www.googletagmanager.com/gtm.js?id=GTM-TEST123"]'
    )

    expect(gtmScript).not.toBeNull()
    expect(window.dataLayer?.[0]).toMatchObject({
      event: 'gtm.js'
    })
  })

  it('bootstraps gtag when a GA measurement id exists', () => {
    window.__CONFIG__ = {
      ga_measurement_id: 'G-TEST123'
    }

    new GtmTelemetryProvider()

    const gtagScript = document.querySelector(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
    )
    const dataLayer = window.dataLayer as unknown[]

    expect(gtagScript).not.toBeNull()
    expect(typeof window.gtag).toBe('function')
    expect(dataLayer).toHaveLength(2)
    expect(Array.from(dataLayer[0] as IArguments)[0]).toBe('js')
    expect(Array.from(dataLayer[1] as IArguments)).toEqual([
      'config',
      'G-TEST123',
      {
        send_page_view: false
      }
    ])
  })

  it('does not inject duplicate gtag scripts across repeated init', () => {
    window.__CONFIG__ = {
      ga_measurement_id: 'G-TEST123'
    }

    new GtmTelemetryProvider()
    new GtmTelemetryProvider()

    const gtagScripts = document.querySelectorAll(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]'
    )

    expect(gtagScripts).toHaveLength(1)
  })

  describe('GA4 event methods', () => {
    let provider: GtmTelemetryProvider

    beforeEach(() => {
      window.__CONFIG__ = { gtm_container_id: 'GTM-TEST123' }
      provider = new GtmTelemetryProvider()
    })

    it('pushes subscription_change event', () => {
      provider.trackSubscription('subscribe_clicked')
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({
          event: 'subscription_change',
          action: 'subscribe_clicked'
        })
      )
    })

    it('pushes subscription_success event', () => {
      provider.trackMonthlySubscriptionSucceeded()
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'subscription_success' })
      )
    })

    it('pushes run_workflow event with trigger source', () => {
      provider.trackRunButton({
        subscribe_to_run: true,
        trigger_source: 'button'
      })
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({
          event: 'run_workflow',
          subscribe_to_run: true,
          trigger_source: 'button'
        })
      )
    })

    it('pushes workflow_execution event', () => {
      provider.trackWorkflowExecution()
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'workflow_execution' })
      )
    })

    it('pushes execution_error event', () => {
      provider.trackExecutionError({
        jobId: 'job-1',
        nodeType: 'KSampler',
        error: 'OOM'
      })
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({
          event: 'execution_error',
          node_type: 'KSampler',
          error: 'OOM'
        })
      )
    })

    it('pushes add_credit_clicked event', () => {
      provider.trackAddApiCreditButtonClicked()
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({ event: 'add_credit_clicked' })
      )
    })

    it('pushes template_used event', () => {
      provider.trackTemplate({
        workflow_name: 'SDXL Basic',
        template_source: 'library',
        template_category: 'image_generation'
      })
      expect(window.dataLayer).toContainEqual(
        expect.objectContaining({
          event: 'template_used',
          workflow_name: 'SDXL Basic',
          template_source: 'library',
          template_category: 'image_generation'
        })
      )
    })
  })
})
