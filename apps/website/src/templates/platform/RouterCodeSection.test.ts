// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import RouterCodeSection from './RouterCodeSection.vue'

describe('RouterCodeSection', () => {
  it('presents the code block header and provider-scoped sample', () => {
    render(RouterCodeSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.router.codeBlock.header', 'en')
      })
    ).toBeTruthy()
    expect(
      screen.getAllByText('client.models.subscribe', { exact: false }).length
    ).toBeGreaterThan(0)
  })
})
