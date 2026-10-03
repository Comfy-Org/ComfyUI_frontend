import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { externalLinks, getRoutes } from '../../config/routes'
import { t } from '../../i18n/translations'
import DeveloperPlatformSection from './DeveloperPlatformSection.vue'

describe('DeveloperPlatformSection', () => {
  it('reuses the Developer Platform closing callout', () => {
    render(DeveloperPlatformSection, { props: { locale: 'en' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.hero.badge', {}, { locale: 'en' })
      })
    ).toBeTruthy()
    expect(
      screen.getByText(t('home.platform.body', {}, { locale: 'en' }))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.hero.badge', {}, { locale: 'en' }))
    ).toBeTruthy()

    const hrefOf = (name: string) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(hrefOf(t('platform.hero.getStarted', {}, { locale: 'en' }))).toBe(
      getRoutes('en').platform
    )
    const getStartedLink = screen.getByRole('link', {
      name: t('platform.hero.getStarted', {}, { locale: 'en' })
    })
    expect(getStartedLink.getAttribute('target')).toBeNull()
    expect(hrefOf(t('platform.hero.readDocs', {}, { locale: 'en' }))).toBe(
      externalLinks.docsPlatform
    )
  })

  it('passes the Chinese locale through to the shared callout', () => {
    render(DeveloperPlatformSection, { props: { locale: 'zh-CN' } })

    expect(
      screen.getByRole('heading', {
        name: t('platform.hero.badge', {}, { locale: 'zh-CN' })
      })
    ).toBeTruthy()
    expect(
      screen
        .getByRole('link', {
          name: t('platform.hero.getStarted', {}, { locale: 'zh-CN' })
        })
        .getAttribute('href')
    ).toBe(getRoutes('zh-CN').platform)
  })
})
