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

/**
 * `LearningVideoEmbed` is deliberately NOT stubbed. It was, and the stub echoed
 * whatever `title` it was handed — so the two locale tests below were asserting
 * the stub's own template. The real embed could have stopped putting the title
 * on its iframe and they would still have passed, which is the one thing they
 * exist to catch. `VideoPlayer` stays stubbed: it is the other branch of the
 * choice under test, not the thing being measured.
 */
const stubs = {
  VideoPlayer: { template: '<div data-testid="hosted-video" />' }
}

/** The embed's accessible title, read from the iframe a reader would land on. */
const embedTitle = () => document.querySelector('iframe')?.getAttribute('title')

function renderWatchPage(tutorial: LearningTutorial, locale: Locale = 'en') {
  render(LearningWatchPage, {
    props: { tutorial, locale },
    global: { stubs }
  })
}

describe('LearningWatchPage', () => {
  it('embeds the YouTube player for tutorials with a youtubeId', () => {
    renderWatchPage(youtubeTutorial)

    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.queryByTestId('hosted-video')).toBeNull()
  })

  it('falls back to the hosted VideoPlayer for self-hosted tutorials', () => {
    renderWatchPage(hostedTutorial)

    expect(screen.getByTestId('hosted-video')).toBeTruthy()
    expect(screen.queryByTestId('youtube-embed')).toBeNull()
  })

  /**
   * Both directions, on fixtures rather than on whichever tutorial happens to
   * be untranslated today. The previous version asserted that a real tutorial
   * had no Japanese, so it started failing the moment one was translated —
   * reporting a defect in the data instead of in the component.
   */
  it('titles the embed in the locale when the tutorial has a translation', () => {
    renderWatchPage(
      {
        ...youtubeTutorial,
        title: { en: 'Node graph basics', ja: 'ノードの基本' }
      },
      'ja'
    )

    expect(embedTitle()).toBe('ノードの基本')
  })

  it('titles the embed in English when the locale has no translation', () => {
    renderWatchPage(
      { ...youtubeTutorial, title: { en: 'Node graph basics' } },
      'ja'
    )

    expect(embedTitle()).toBe('Node graph basics')
  })
})
