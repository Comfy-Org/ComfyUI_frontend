// @vitest-environment happy-dom
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
        name: t('platform.products.builder.title', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('columnheader', {
        name: t('enterprise.managedBuilds.heading', 'en')
      })
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', {
          name: t('enterprise.managedBuilds.explore', 'en')
        })
        .getAttribute('href')
    ).toBe('/enterprise/managed-builds')
    expect(
      screen.getByText(t('platform.builderEnterprise.teamSharing.label', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.builderEnterprise.governance.label', 'en'))
    ).toBeTruthy()
    expect(
      screen.getAllByText(t('platform.builderEnterprise.enterpriseOnly', 'en'))
    ).toHaveLength(2)
  })
})
