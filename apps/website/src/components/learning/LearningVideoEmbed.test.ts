// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import LearningVideoEmbed from './LearningVideoEmbed.vue'

function renderEmbed(youtubeId = 'TQhIYT1ZYGQ', title = 'Node Graph Basics') {
  render(LearningVideoEmbed, { props: { youtubeId, title } })
  return screen.getByTitle(title)
}

describe('LearningVideoEmbed', () => {
  it('embeds the privacy-friendly nocookie player for the given id', () => {
    const iframe = renderEmbed('abc123', 'Full Node Graph Basics')

    expect(iframe.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&mute=1&rel=0'
    )
  })

  it('lazy-loads the titled frame and allows fullscreen', () => {
    const iframe = renderEmbed('abc123', 'Full Node Graph Basics')

    expect(iframe.getAttribute('loading')).toBe('lazy')
    expect(iframe.hasAttribute('allowfullscreen')).toBe(true)
  })
})
