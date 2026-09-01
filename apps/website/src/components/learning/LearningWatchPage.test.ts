// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { LearningTutorial } from '../../data/learningTutorials'
import type { Locale } from '../../i18n/translations'

import { filterByCategory } from '../../data/learningTutorials'
import LearningWatchPage from './LearningWatchPage.vue'

const youtubeTutorial = filterByCategory('basics').find(
  (tutorial) => tutorial.youtubeId !== undefined
)
if (!youtubeTutorial)
  throw new Error('Expected a Basics tutorial with youtubeId')

const hostedTutorial = filterByCategory('vfx').find(
  (tutorial) => tutorial.videoSrc !== undefined
)
if (!hostedTutorial) throw new Error('Expected a VFX tutorial with videoSrc')

const stubs = {
  LearningVideoEmbed: {
    props: ['title'],
    template: '<div data-testid="youtube-embed">{{ title }}</div>'
  },
  VideoPlayer: { template: '<div data-testid="hosted-video" />' }
}

function renderWatchPage(tutorial: LearningTutorial, locale: Locale = 'en') {
  render(LearningWatchPage, {
    props: { tutorial, locale },
    global: { stubs }
  })
}

describe('LearningWatchPage', () => {
  it('embeds the YouTube player for tutorials with a youtubeId', () => {
    renderWatchPage(youtubeTutorial)

    expect(screen.getByTestId('youtube-embed')).toBeTruthy()
    expect(screen.queryByTestId('hosted-video')).toBeNull()
  })

  it('uses the English title when the locale title is unavailable', () => {
    renderWatchPage(youtubeTutorial, 'ja')

    expect(screen.getByTestId('youtube-embed').textContent).toBe(
      youtubeTutorial.title.en
    )
  })

  it('falls back to the hosted VideoPlayer for self-hosted tutorials', () => {
    renderWatchPage(hostedTutorial)

    expect(screen.getByTestId('hosted-video')).toBeTruthy()
    expect(screen.queryByTestId('youtube-embed')).toBeNull()
  })

  it('titles the embed in English when the locale has no translation', () => {
    renderWatchPage(youtubeTutorial, 'ja')

    expect(screen.getByTestId('youtube-embed').textContent).toBe(
      youtubeTutorial.title.en
    )
  })
})
