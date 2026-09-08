// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import { customerVideoStories, formatDuration } from '../../data/customerVideos'
import WatchSection from './WatchSection.vue'

const stories = customerVideoStories.map((story) => ({
  ...story,
  duration: formatDuration(story.durationSeconds)
}))

describe('WatchSection', () => {
  it('renders the WATCH group label', () => {
    render(WatchSection, { props: { stories } })

    expect(screen.getByText('WATCH')).toBeTruthy()
  })

  it('renders one card per story, each linking to its watch page', () => {
    render(WatchSection, { props: { stories } })

    for (const story of stories) {
      expect(screen.getByRole('heading', { name: story.title })).toBeTruthy()
    }
    expect(screen.getAllByRole('link')).toHaveLength(stories.length)
  })
})
