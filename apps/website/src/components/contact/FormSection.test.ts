// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Locale } from '../../i18n/translations'

import FormSection from './FormSection.vue'

const stubs = {
  SectionLabel: true,
  SocialProofBarSection: {
    template: '<div data-testid="social-proof" />'
  },
  HubspotFormEmbed: {
    props: ['formId'],
    template: '<div data-testid="hubspot-form" :data-form-id="formId" />'
  }
}

function formIdFor(locale: Locale) {
  const { unmount } = render(FormSection, {
    props: { locale },
    global: { stubs }
  })
  const formId = screen.getByTestId('hubspot-form').getAttribute('data-form-id')
  unmount()
  return formId
}

describe('FormSection', () => {
  it('serves a locale its own HubSpot form when one exists', () => {
    expect(formIdFor('zh-CN')).not.toBe(formIdFor('en'))
  })

  it('falls back to the English form for locales without their own', () => {
    expect(formIdFor('ja')).toBe(formIdFor('en'))
  })

  // The contact pages no longer render this bar; dropping it strips both.
  it('renders the social proof bar', () => {
    const { unmount } = render(FormSection, { global: { stubs } })
    expect(screen.getAllByTestId('social-proof')).toHaveLength(1)
    unmount()
  })
})
