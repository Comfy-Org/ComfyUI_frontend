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

// The embed stub mirrors the real component's <iframe>, named by its `title`,
// so the page is queried by the same accessible name without happy-dom
// actually fetching the YouTube player.
const stubs = {
  LearningVideoEmbed: {
    props: ['title'],
    template: '<iframe :title="title" />'
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

    expect(screen.getByTitle(youtubeTutorial.title.en)).toBeTruthy()
    expect(screen.queryByTestId('hosted-video')).toBeNull()
  })

  it('falls back to the hosted VideoPlayer for self-hosted tutorials', () => {
    renderWatchPage(hostedTutorial)

    expect(screen.getByTestId('hosted-video')).toBeTruthy()
    expect(screen.queryByTitle(hostedTutorial.title.en)).toBeNull()
  })

  it('titles the embed in English when the locale has no translation', () => {
    renderWatchPage(youtubeTutorial, 'ja')

    expect(screen.getByTitle(youtubeTutorial.title.en)).toBeTruthy()
  })

  it('titles the embed in English when the localized title is empty', () => {
    renderWatchPage(
      {
        ...youtubeTutorial,
        title: { ...youtubeTutorial.title, 'zh-CN': '' }
      },
      'zh-CN'
    )

    expect(screen.getByTitle(youtubeTutorial.title.en)).toBeTruthy()
  })
})
