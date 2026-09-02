// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks } from '../../config/routes'
import { t } from '../../i18n/translations'
import LookingForElseSection from './LookingForElseSection.vue'

describe('LookingForElseSection', () => {
  it('points the community card at GitHub and the self-hosted docs', () => {
    render(LookingForElseSection, { props: { locale: 'en' } })

    const hrefOf = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf(t('pricing.lookingForElse.community.github', 'en'))).toBe(
      externalLinks.github
    )
    expect(hrefOf(t('pricing.lookingForElse.community.docs', 'en'))).toBe(
      externalLinks.docsSelfHosted
    )
  })
})
