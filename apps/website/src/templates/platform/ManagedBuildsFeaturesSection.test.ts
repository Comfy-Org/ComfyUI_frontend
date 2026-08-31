// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ManagedBuildsFeaturesSection from './ManagedBuildsFeaturesSection.vue'

describe('ManagedBuildsFeaturesSection', () => {
  it('renders all six cards and cross-links the platform products', () => {
    render(ManagedBuildsFeaturesSection, { props: { locale: 'en' } })

    for (const n of [1, 2, 3, 4, 5, 6] as const) {
      expect(
        screen.getByText(t(`enterprise.managedBuilds.${n}.title`, 'en'))
      ).toBeTruthy()
    }

    const hrefOf = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf(t('enterprise.managedBuilds.3.linkLabel', 'en'))).toBe(
      '/platform/models'
    )
    expect(hrefOf(t('enterprise.managedBuilds.6.linkLabel', 'en'))).toBe(
      '/platform/serverless'
    )
    expect(hrefOf(t('enterprise.managedBuilds.aboutBuilder', 'en'))).toBe(
      '/platform/builder'
    )
  })
})
