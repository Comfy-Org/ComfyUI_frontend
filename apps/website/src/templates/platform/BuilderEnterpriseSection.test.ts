import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import BuilderEnterpriseSection from './BuilderEnterpriseSection.vue'

describe('BuilderEnterpriseSection', () => {
  it('compares Builder with Managed Builds', () => {
    render(BuilderEnterpriseSection, { props: { locale: 'en' } })

    expect(screen.getAllByRole('row')).toHaveLength(5)
    expect(
      screen.getByRole('columnheader', {
        name: t('platform.products.builder.title', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('columnheader', {
        name: t('enterprise.managedBuilds.heading', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', {
          name: t('enterprise.managedBuilds.explore', {}, { locale: 'en' })
        })
        .getAttribute('href')
    ).toBe('/enterprise/managed-builds/')
    expect(
      screen.getByText(
        t('platform.builderEnterprise.teamSharing.label', {}, { locale: 'en' })
      )
    ).toBeTruthy()
    expect(
      screen.getByText(
        t('platform.builderEnterprise.governance.label', {}, { locale: 'en' })
      )
    ).toBeTruthy()
    expect(
      screen.getAllByText(
        t('platform.builderEnterprise.enterpriseOnly', {}, { locale: 'en' })
      )
    ).toHaveLength(2)
  })
})
