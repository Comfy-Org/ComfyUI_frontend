// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import BuilderEnterpriseSection from './BuilderEnterpriseSection.vue'

describe('BuilderEnterpriseSection', () => {
  it('routes to Managed Builds and the contact page', () => {
    render(BuilderEnterpriseSection, { props: { locale: 'en' } })

    const hrefOf = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf(t('enterprise.managedBuilds.explore', 'en'))).toBe(
      '/enterprise/managed-builds'
    )
    expect(hrefOf(t('enterprise.managedBuilds.talkToUs', 'en'))).toBe(
      '/contact'
    )
  })
})
