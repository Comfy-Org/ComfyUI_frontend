// @vitest-environment happy-dom
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HubspotFormEmbed from './HubspotFormEmbed.vue'

const hoisted = vi.hoisted(() => ({
  mockViewed: vi.fn(),
  mockSubmitted: vi.fn()
}))

vi.mock('../../scripts/posthog', () => ({
  captureContactFormViewed: hoisted.mockViewed,
  captureContactFormSubmitted: hoisted.mockSubmitted
}))

const EN_FORM_ID = '94e05eab-1373-47f7-ab5e-d84f9e6aa262'
const ZH_FORM_ID = '6885750c-02ef-4aa2-ba0d-213be9cccf93'

function dispatchV3Submission(id?: string) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'hsFormCallback', eventName: 'onFormSubmitted', id }
    })
  )
}

function dispatchV4Submission(formId?: string) {
  window.dispatchEvent(
    new CustomEvent('hs-form-event:on-submission:success', {
      detail: formId === undefined ? undefined : { formId }
    })
  )
}

function stubHubspotFormsV4(form: {
  formId?: string
  conversionId?: string
  unavailable?: boolean
}) {
  vi.stubGlobal('HubSpotFormsV4', {
    getFormFromEvent: () => {
      if (form.unavailable) throw new Error('form instance not registered')
      return {
        getFormId: () => form.formId,
        getConversionId: () => form.conversionId
      }
    }
  })
}

function suppressEmbedScriptInjection() {
  const alreadyInjectedMarker = document.createElement('script')
  alreadyInjectedMarker.id = 'hubspot-contact-form-embed'
  document.head.append(alreadyInjectedMarker)

  return () => alreadyInjectedMarker.remove()
}

describe('HubspotFormEmbed', () => {
  beforeEach(suppressEmbedScriptInjection)

  it('captures a contact form view on mount', () => {
    render(HubspotFormEmbed)

    expect(hoisted.mockViewed).toHaveBeenCalledWith('en')
  })

  it('captures the view for the localized form', () => {
    render(HubspotFormEmbed, { props: { locale: 'zh-CN' } })

    expect(hoisted.mockViewed).toHaveBeenCalledWith('zh-CN')
  })

  it('captures a submission from the v3 postMessage callback', () => {
    render(HubspotFormEmbed)
    dispatchV3Submission()

    expect(hoisted.mockSubmitted).toHaveBeenCalledWith(
      'en',
      EN_FORM_ID,
      undefined
    )
  })

  it('captures a submission from the v4 form event', () => {
    render(HubspotFormEmbed)
    dispatchV4Submission()

    expect(hoisted.mockSubmitted).toHaveBeenCalledWith(
      'en',
      EN_FORM_ID,
      undefined
    )
  })

  it('reports the localized form id on submission', () => {
    render(HubspotFormEmbed, { props: { locale: 'zh-CN' } })
    dispatchV4Submission()

    expect(hoisted.mockSubmitted).toHaveBeenCalledWith(
      'zh-CN',
      ZH_FORM_ID,
      undefined
    )
  })

  it('captures once when both HubSpot form versions report the submission', () => {
    render(HubspotFormEmbed)
    dispatchV3Submission()
    dispatchV4Submission()

    expect(hoisted.mockSubmitted).toHaveBeenCalledOnce()
  })

  it('captures a submission reported with this form id', () => {
    render(HubspotFormEmbed)
    dispatchV4Submission(EN_FORM_ID)

    expect(hoisted.mockSubmitted).toHaveBeenCalledWith(
      'en',
      EN_FORM_ID,
      undefined
    )
  })

  it('reports the HubSpot conversion id when the v4 API exposes one', () => {
    stubHubspotFormsV4({ formId: EN_FORM_ID, conversionId: 'conversion-xyz' })
    render(HubspotFormEmbed)
    dispatchV4Submission()

    expect(hoisted.mockSubmitted).toHaveBeenCalledWith(
      'en',
      EN_FORM_ID,
      'conversion-xyz'
    )
  })

  it('ignores a v4 submission the form API attributes to another form', () => {
    stubHubspotFormsV4({
      formId: 'some-other-form',
      conversionId: 'conversion-xyz'
    })
    render(HubspotFormEmbed)
    dispatchV4Submission()

    expect(hoisted.mockSubmitted).not.toHaveBeenCalled()
  })

  it('still captures when the v4 form API is unavailable', () => {
    stubHubspotFormsV4({ unavailable: true })
    render(HubspotFormEmbed)
    dispatchV4Submission(EN_FORM_ID)

    expect(hoisted.mockSubmitted).toHaveBeenCalledWith(
      'en',
      EN_FORM_ID,
      undefined
    )
  })

  it('ignores a submission reported for a different form', () => {
    render(HubspotFormEmbed)
    dispatchV3Submission('some-other-form')
    dispatchV4Submission('some-other-form')

    expect(hoisted.mockSubmitted).not.toHaveBeenCalled()
  })

  it('still captures this form after another form was submitted', () => {
    render(HubspotFormEmbed)
    dispatchV4Submission('some-other-form')
    dispatchV4Submission(EN_FORM_ID)

    expect(hoisted.mockSubmitted).toHaveBeenCalledOnce()
    expect(hoisted.mockSubmitted).toHaveBeenCalledWith(
      'en',
      EN_FORM_ID,
      undefined
    )
  })

  it('ignores unrelated window messages', () => {
    render(HubspotFormEmbed)
    window.dispatchEvent(new MessageEvent('message', { data: 'ping' }))
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'hsFormCallback', eventName: 'onFormReady' }
      })
    )

    expect(hoisted.mockSubmitted).not.toHaveBeenCalled()
  })

  it('stops listening once the form is unmounted', () => {
    const { unmount } = render(HubspotFormEmbed)
    unmount()
    dispatchV4Submission()

    expect(hoisted.mockSubmitted).not.toHaveBeenCalled()
  })
})
