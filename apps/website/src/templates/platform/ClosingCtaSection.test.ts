import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ClosingCtaSection from './ClosingCtaSection.vue'

describe('ClosingCtaSection', () => {
  it('reduces the callout height when dense', () => {
    render(ClosingCtaSection, {
      props: { locale: 'en', dense: true, headingAfterBadge: 'for builders' }
    })

    expect(
      screen.getByRole('region', { name: t('platform.hero.badge', 'en') })
    ).toHaveAttribute('data-density', 'dense')
  })
})
