import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '@/i18n/translations'
import PlatformHeroBadge from './PlatformHeroBadge.vue'

describe('PlatformHeroBadge', () => {
  it('renders a custom label and status', () => {
    render(PlatformHeroBadge, {
      props: {
        locale: 'en',
        label: 'Models API',
        statusLabel: t('nav.badgeComingSoon', {}, { locale: 'en' })
      }
    })

    expect(screen.getByText('Models API')).toBeTruthy()
    expect(
      screen.getByText(t('nav.badgeComingSoon', {}, { locale: 'en' }))
    ).toBeTruthy()
  })

  it('uses the localized default label and shows no status', () => {
    render(PlatformHeroBadge, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByText(t('platform.hero.badge', {}, { locale: 'zh-CN' }))
    ).toBeTruthy()
    expect(
      screen.queryByText(t('nav.badgeBeta', {}, { locale: 'zh-CN' }))
    ).toBeNull()
  })
})
