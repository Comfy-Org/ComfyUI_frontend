// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import FormSection from './FormSection.vue'

vi.mock('../../composables/useHeroAnimation', () => ({
  useHeroAnimation: () => {}
}))

vi.mock('./HubspotFormEmbed.vue', () => ({
  default: { name: 'HubspotFormEmbed', template: '<div />' }
}))

const SUPPORT_MAILTO = 'mailto:support@comfy.org'

function renderFormSection(locale?: 'zh-CN') {
  render(FormSection, { props: locale ? { locale } : {} })
}

function hrefOfLink(name: string) {
  return screen.getByRole('link', { name }).getAttribute('href')
}

describe('FormSection support routing', () => {
  it('routes to the Help Center and the support mailbox', () => {
    renderFormSection()

    expect(hrefOfLink(t('contact.form.supportLinkCta'))).toBe(
      externalLinks.support
    )
    expect(hrefOfLink('support@comfy.org')).toBe(SUPPORT_MAILTO)
  })

  it('no longer sends people looking for support to the docs site', () => {
    renderFormSection()

    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(hrefs.some((href) => href?.includes('docs.comfy.org'))).toBe(false)
  })

  it('says the form itself reaches sales', () => {
    renderFormSection()

    expect(
      screen.getByText(t('contact.form.supportLink'), { exact: false })
    ).toBeTruthy()
  })

  it('routes to the same support channels for zh-CN', () => {
    renderFormSection('zh-CN')

    expect(hrefOfLink(t('contact.form.supportLinkCta', 'zh-CN'))).toBe(
      externalLinks.support
    )
    expect(hrefOfLink('support@comfy.org')).toBe(SUPPORT_MAILTO)
  })

  it('localizes the support copy for zh-CN', () => {
    renderFormSection('zh-CN')

    expect(
      screen.getByText(t('contact.form.supportLink', 'zh-CN'), { exact: false })
    ).toBeTruthy()
    expect(
      screen.queryByText(t('contact.form.supportLink'), { exact: false })
    ).toBeNull()
  })
})
