// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { StoryCard } from '../../utils/customers'
import StorySection from './StorySection.vue'

const stories: StoryCard[] = [
  {
    slug: 'series-entertainment',
    title: 'How Series Entertainment rebuilt production with ComfyUI',
    category: 'GAME & VIDEO PRODUCTION',
    cover: 'https://media.comfy.org/website/customers/series/cover.webp',
    description: 'Scaling emotional storytelling across 100,000+ assets.'
  },
  {
    slug: 'moment-factory',
    title: 'How Moment Factory reimagined projection mapping',
    category: 'PUBLIC ART',
    cover:
      'https://media.comfy.org/website/customers/moment-factory/cover.webp',
    description: 'Architectural-scale 3D projection mapping with ComfyUI.'
  }
]

describe('StorySection', () => {
  it('renders the READ group label', () => {
    render(StorySection, { props: { stories } })

    expect(screen.getByText('READ')).toBeTruthy()
  })

  it('renders one card per story with its title, category, and description', () => {
    render(StorySection, { props: { stories } })

    for (const story of stories) {
      expect(screen.getByRole('heading', { name: story.title })).toBeTruthy()
      expect(screen.getByText(story.category)).toBeTruthy()
      expect(screen.getByText(story.description)).toBeTruthy()
      const link = screen.getByRole('link', { name: new RegExp(story.title) })
      expect(link).toHaveProperty(
        'href',
        expect.stringContaining(`/customers/${story.slug}`)
      )
    }
  })

  it('prefixes card links with the locale', () => {
    render(StorySection, { props: { stories, locale: 'zh-CN' } })

    const link = screen.getByRole('link', {
      name: new RegExp(stories[0].title)
    })
    expect(link).toHaveProperty(
      'href',
      expect.stringContaining(`/zh-CN/customers/${stories[0].slug}`)
    )
  })
})
