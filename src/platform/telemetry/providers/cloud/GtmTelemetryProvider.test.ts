import { beforeEach, describe, expect, it } from 'vitest'

import { GtmTelemetryProvider } from './GtmTelemetryProvider'

function createInitializedProvider(): GtmTelemetryProvider {
  window.__CONFIG__ = { gtm_container_id: 'GTM-TEST123' }
  return new GtmTelemetryProvider()
}

function lastDataLayerEntry(): Record<string, unknown> | undefined {
  const dl = window.dataLayer as unknown[] | undefined
  return dl?.[dl.length - 1] as Record<string, unknown> | undefined
}

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

  describe('event dispatch', () => {
    it('pushes subscription modal as view_promotion', () => {
      const provider = createInitializedProvider()
      provider.trackSubscription('modal_opened')
      expect(lastDataLayerEntry()).toMatchObject({ event: 'view_promotion' })
    })

    it('pushes subscribe click as select_promotion', () => {
      const provider = createInitializedProvider()
      provider.trackSubscription('subscribe_clicked')
      expect(lastDataLayerEntry()).toMatchObject({ event: 'select_promotion' })
    })

    it('pushes subscription_success for subscription activation', () => {
      const provider = createInitializedProvider()
      provider.trackMonthlySubscriptionSucceeded()
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'subscription_success'
      })
    })

    it('pushes run_workflow with trigger_source', () => {
      const provider = createInitializedProvider()
      provider.trackRunButton({ trigger_source: 'button' })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'run_workflow',
        trigger_source: 'button',
        subscribe_to_run: false
      })
    })

    it('pushes execution_error with truncated error', () => {
      const provider = createInitializedProvider()
      const longError = 'x'.repeat(200)
      provider.trackExecutionError({
        jobId: 'job-1',
        nodeType: 'KSampler',
        error: longError
      })
      const entry = lastDataLayerEntry()
      expect(entry).toMatchObject({
        event: 'execution_error',
        node_type: 'KSampler'
      })
      expect((entry?.error as string).length).toBe(100)
    })

    it('pushes select_content for template events', () => {
      const provider = createInitializedProvider()
      provider.trackTemplate({
        workflow_name: 'flux-dev',
        template_category: 'image-gen'
      })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'select_content',
        content_type: 'template',
        workflow_name: 'flux-dev',
        template_category: 'image-gen'
      })
    })

    it('pushes survey_opened for survey opened stage', () => {
      const provider = createInitializedProvider()
      provider.trackSurvey('opened')
      expect(lastDataLayerEntry()).toMatchObject({ event: 'survey_opened' })
    })

    it('pushes survey_submitted with responses', () => {
      const provider = createInitializedProvider()
      provider.trackSurvey('submitted', {
        familiarity: 'expert',
        industry: 'gaming'
      })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'survey_submitted',
        familiarity: 'expert',
        industry: 'gaming'
      })
    })

    it('pushes email_verify_opened for opened stage', () => {
      const provider = createInitializedProvider()
      provider.trackEmailVerification('opened')
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'email_verify_opened'
      })
    })

    it('pushes email_verify_completed for completed stage', () => {
      const provider = createInitializedProvider()
      provider.trackEmailVerification('completed')
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'email_verify_completed'
      })
    })

    it('pushes search for node search (GA4 recommended)', () => {
      const provider = createInitializedProvider()
      provider.trackNodeSearch({ query: 'KSampler' })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'search',
        search_term: 'KSampler'
      })
    })

    it('pushes select_item for node search result (GA4 recommended)', () => {
      const provider = createInitializedProvider()
      provider.trackNodeSearchResultSelected({
        node_type: 'KSampler',
        last_query: 'sampler'
      })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'select_item',
        item_id: 'KSampler',
        search_term: 'sampler'
      })
    })

    it('pushes setting_changed with setting_id', () => {
      const provider = createInitializedProvider()
      provider.trackSettingChanged({ setting_id: 'theme' })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'setting_changed',
        setting_id: 'theme'
      })
    })

    it('pushes workflow_created with metadata', () => {
      const provider = createInitializedProvider()
      provider.trackWorkflowCreated({
        workflow_type: 'blank',
        previous_workflow_had_nodes: true
      })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'workflow_created',
        workflow_type: 'blank',
        previous_workflow_had_nodes: true
      })
    })

    it('pushes share_flow with step and source', () => {
      const provider = createInitializedProvider()
      provider.trackShareFlow({
        step: 'link_copied',
        source: 'app_mode'
      })
      expect(lastDataLayerEntry()).toMatchObject({
        event: 'share_flow',
        step: 'link_copied',
        source: 'app_mode'
      })
    })

    it('does not push events when not initialized', () => {
      window.__CONFIG__ = {}
      const provider = new GtmTelemetryProvider()
      provider.trackSubscription('modal_opened')
      expect(window.dataLayer).toBeUndefined()
    })
  })
})
