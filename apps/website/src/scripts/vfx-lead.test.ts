import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureVfxLeadSubmitted } from '@/scripts/posthog'
import { mountVfxLeadTracking } from './vfx-lead'

vi.mock(import('@/scripts/posthog'))
const FORM = 'mounted-contact-form'
let cleanup: (() => void) | undefined
function success(detail: unknown) {
  window.dispatchEvent(
    new CustomEvent('hs-form-event:on-submission:success', { detail })
  )
}
function mount(query: string) {
  window.history.replaceState(null, '', `/contact/?${query}`)
  cleanup = mountVfxLeadTracking(FORM)
}
afterEach(() => {
  cleanup?.()
  window.history.replaceState(null, '', '/')
})

describe('VFX completed leads', () => {
  it.for(['v2', 'v3'])(
    'captures %s only after success, with allowlisted attribution',
    (version) => {
      mount(
        `interest=vfx&landing_version=${version}&utm_source=linkedin&utm_medium=paid_social&utm_campaign=launch&utm_content=car&utm_term=vfx&email=private@example.com&message=private`
      )
      window.dispatchEvent(new Event('submit'))
      window.dispatchEvent(
        new CustomEvent('hs-form-event:on-submission:failed', {
          detail: { formId: FORM, instanceId: 'one' }
        })
      )
      expect(captureVfxLeadSubmitted).not.toHaveBeenCalled()
      success({
        formId: FORM,
        instanceId: 'one',
        email: 'private@example.com',
        answers: 'private'
      })
      expect(captureVfxLeadSubmitted).toHaveBeenCalledExactlyOnceWith({
        form_id: FORM,
        landing_version: version,
        interest: 'vfx',
        utm_source: 'linkedin',
        utm_medium: 'paid_social',
        utm_campaign: 'launch',
        utm_content: 'car',
        utm_term: 'vfx'
      })
    }
  )
  it.for([
    undefined,
    null,
    'bad',
    {},
    { formId: FORM },
    { formId: FORM, instanceId: '' }
  ])('ignores malformed success detail %j', (detail) => {
    mount('interest=vfx&landing_version=v3')
    success(detail)
    expect(captureVfxLeadSubmitted).not.toHaveBeenCalled()
  })
  it('ignores a successful submission from another form', () => {
    mount('interest=vfx&landing_version=v3')
    success({ formId: 'other', instanceId: 'one' })
    expect(captureVfxLeadSubmitted).not.toHaveBeenCalled()
  })
  it('deduplicates callbacks for the same successful instance', () => {
    mount('interest=vfx&landing_version=v3')
    success({ formId: FORM, instanceId: 'one' })
    success({ formId: FORM, instanceId: 'one' })
    expect(captureVfxLeadSubmitted).toHaveBeenCalledTimes(1)
  })
  it.for([
    '',
    'interest=other&landing_version=v3',
    'interest=vfx&landing_version=v4',
    'interest=vfx'
  ])('ignores non-VFX campaign context %s', (query) => {
    mount(query)
    success({ formId: FORM, instanceId: 'one' })
    expect(captureVfxLeadSubmitted).not.toHaveBeenCalled()
  })
  it('removes the success listener on unmount', () => {
    mount('interest=vfx&landing_version=v2')
    cleanup?.()
    success({ formId: FORM, instanceId: 'one' })
    expect(captureVfxLeadSubmitted).not.toHaveBeenCalled()
  })
  it('removes the success listener before Astro navigation', () => {
    mount('interest=vfx&landing_version=v2')
    document.dispatchEvent(new Event('astro:before-swap'))
    success({ formId: FORM, instanceId: 'one' })
    expect(captureVfxLeadSubmitted).not.toHaveBeenCalled()
  })
})
