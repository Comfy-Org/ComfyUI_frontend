// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import StepsSection from './StepsSection.vue'

const locales: Locale[] = ['en', 'zh-CN']

describe('StepsSection', () => {
  it.for(locales)('renders the beta CTA in %s', (locale) => {
    render(StepsSection, { props: { locale } })

    expect(screen.getByText(t('api.steps.beta.badge', locale))).toBeTruthy()
    expect(
      screen.getByText(t('api.steps.beta.description', locale))
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: t('api.steps.beta.cta', locale) })
    ).toBeTruthy()
  })

  it('sends the beta CTA to the serverless survey in a safe new tab', () => {
    render(StepsSection, { props: { locale: 'en' } })

    const cta = screen.getByRole('link', {
      name: t('api.steps.beta.cta', 'en')
    })

    expect(cta.getAttribute('href')).toBe(externalLinks.serverlessBeta)
    expect(cta.getAttribute('target')).toBe('_blank')
    expect(cta.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
