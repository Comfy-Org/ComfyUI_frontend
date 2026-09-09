// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import PlatformHeroBadge from './PlatformHeroBadge.vue'

describe('PlatformHeroBadge', () => {
  it('renders a custom label and status', () => {
    render(PlatformHeroBadge, {
      props: {
        locale: 'en',
        label: 'Models API',
        statusLabel: t('nav.badgeComingSoon', 'en')
      }
    })

    expect(screen.getByText('Models API')).toBeTruthy()
    expect(screen.getByText(t('nav.badgeComingSoon', 'en'))).toBeTruthy()
  })

  it('uses the localized default label and Beta status', () => {
    render(PlatformHeroBadge, { props: { locale: 'zh-CN' } })

    expect(screen.getByText(t('platform.hero.badge', 'zh-CN'))).toBeTruthy()
    expect(screen.getByText(t('nav.badgeBeta', 'zh-CN'))).toBeTruthy()
  })
})
