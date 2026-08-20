// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { filterByCategory } from '../../data/learningTutorials'
import LearningWatchPage from './LearningWatchPage.vue'

const youtubeTutorial = filterByCategory('basics')[0]
const hostedTutorial = filterByCategory('vfx')[0]

const stubs = {
  LearningVideoEmbed: { template: '<div data-testid="youtube-embed" />' },
  VideoPlayer: { template: '<div data-testid="hosted-video" />' }
}

function renderWatchPage(tutorial: typeof youtubeTutorial) {
  render(LearningWatchPage, {
    props: { tutorial, locale: 'en' },
    global: { stubs }
  })
}

describe('LearningWatchPage', () => {
  it('embeds the YouTube player for tutorials with a youtubeId', () => {
    expect(youtubeTutorial.youtubeId).toBeTruthy()
    renderWatchPage(youtubeTutorial)

    expect(screen.getByTestId('youtube-embed')).toBeTruthy()
    expect(screen.queryByTestId('hosted-video')).toBeNull()
  })

  it('falls back to the hosted VideoPlayer for self-hosted tutorials', () => {
    expect(hostedTutorial.videoSrc).toBeTruthy()
    renderWatchPage(hostedTutorial)

    expect(screen.getByTestId('hosted-video')).toBeTruthy()
    expect(screen.queryByTestId('youtube-embed')).toBeNull()
  })
})
