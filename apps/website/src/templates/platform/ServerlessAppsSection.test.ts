import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { t } from '../../i18n/translations'
import ServerlessAppsSection from './ServerlessAppsSection.vue'

describe('ServerlessAppsSection', () => {
  it('presents creative apps as a customer-facing Comfy API use case', () => {
    render(ServerlessAppsSection, { props: { locale: 'en' } })

    expect(screen.getByText('CREATIVE APPS')).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        name: t('platform.serverlessApps.heading', 'en')
      })
    ).toBeTruthy()
    expect(screen.getByText(/without exposing the graph/)).toBeTruthy()
    expect(
      screen.getByRole('link', {
        name: t('platform.serverlessApps.browseApps', 'en')
      })
    ).toHaveAttribute('href', '/workflows/?type=apps')
    expect(
      screen.getByRole('link', {
        name: t('platform.serverlessApps.browseApps', 'en')
      })
    ).toHaveClass('font-bold')

    const video = screen.getByLabelText(
      t('platform.serverlessApps.videoLabel', 'en')
    )
    expect(video).toHaveAttribute('autoplay')
    expect(video).toHaveAttribute('muted')
    expect(video).toHaveAttribute('loop')
    expect(video).toHaveAttribute('playsinline')
    expect(video).not.toHaveAttribute('controls')
    expect(video).toContainHTML(
      '<source src="/assets/platform/serverless/app-serverless.mp4" type="video/mp4">'
    )
  })

  it('features the Silverside customer quote and links to its story', () => {
    render(ServerlessAppsSection, { props: { locale: 'en' } })

    expect(screen.queryByText('CASE STUDY')).toBeNull()
    expect(
      screen.getByText(t('platform.serverlessCaseStudy.quote', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.serverlessCaseStudy.name', 'en'))
    ).toBeTruthy()
    expect(
      screen.getByText(t('platform.serverlessCaseStudy.role', 'en'))
    ).toBeTruthy()
    const storyLink = screen.getByRole('link', {
      name: t('platform.serverlessCaseStudy.linkLabel', 'en')
    })
    expect(storyLink).toHaveAttribute('href', '/customers/svedka-silverside')
    expect(storyLink).toHaveClass('mx-auto', 'w-full', 'lg:w-3/4')
    expect(storyLink).not.toHaveClass('hover:bg-transparency-white-t8')
    const quote = screen.getByText(
      t('platform.serverlessCaseStudy.quote', 'en')
    )
    expect(quote).toHaveClass('text-2xl/relaxed')
    expect(quote).not.toHaveClass('lg:text-3xl/relaxed')
  })
})
