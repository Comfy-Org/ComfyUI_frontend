import { describe, expect, it } from 'vitest'

import { hubAppSlugs, hubWorkflowSlugs } from '@/config/hub-models'
import hubTemplates from '@/data/hubTemplates.json'
import { customerVideoStories } from '@/data/customerVideos'
import { learningTutorials } from '@/data/learningTutorials'
import { getIndustryVertical, industryVerticals } from './industryVerticals'

const builtPaths = new Set([
  ...hubWorkflowSlugs.map((slug) => `/hub/${slug}/`),
  ...hubAppSlugs.map((slug) => `/hub/${slug}/`)
])

const publishedMedia = new Set([
  ...learningTutorials.flatMap((tutorial) => [
    tutorial.poster,
    tutorial.videoSrc
  ]),
  ...customerVideoStories.flatMap((story) => [story.poster, story.videoSrc])
])

const publishedDestinations = new Set([
  ...builtPaths,
  ...hubTemplates.map(
    (template) =>
      `https://cloud.comfy.org/?template=${encodeURIComponent(template.name)}`
  ),
  'https://comfy.org/workflows/f4e29143100c-f4e29143100c/'
])

const verticals = Object.values(industryVerticals).map(({ id }) =>
  getIndustryVertical(id)
)

describe('industry vertical content', () => {
  it.for(verticals)('opens six published workflows for $id', (vertical) => {
    expect(vertical.workflows).toHaveLength(6)
    expect(
      vertical.workflows.map((item) => publishedDestinations.has(item.href))
    ).toEqual(Array.from({ length: 6 }, () => true))
  })

  it.for(verticals)(
    'opens three published featured workflows for $id',
    (vertical) => {
      expect(vertical.featured).toHaveLength(3)
      expect(
        vertical.featured.map((item) => publishedDestinations.has(item.href))
      ).toEqual([true, true, true])
    }
  )

  it.for(verticals.filter((vertical) => vertical.hero.type === 'video'))(
    'uses published hero video and poster for $id',
    (vertical) => {
      expect(
        [vertical.hero.src, vertical.hero.poster].map((src) =>
          publishedMedia.has(src)
        )
      ).toEqual([true, true])
    }
  )

  it.for(
    verticals
      .flatMap((vertical) => vertical.featured)
      .filter((item) => item.mediaType === 'video')
  )('uses published video for $title', (item) => {
    expect(publishedMedia.has(item.media)).toBe(true)
  })
})
