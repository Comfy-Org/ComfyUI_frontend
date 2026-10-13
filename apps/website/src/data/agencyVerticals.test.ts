import { describe, expect, it } from 'vitest'

import { hubAppSlugs, hubWorkflowSlugs } from '@/config/hub-models'
import hubTemplates from '@/data/hubTemplates.json'
import { learningTutorials } from '@/data/learningTutorials'
import { getAgencyVertical } from './agencyVerticals'

const verticals = [
  'vfx',
  'advertising',
  'film-animation',
  'architectural-visualization'
] as const

const publishedMedia = new Set([
  ...learningTutorials.flatMap(({ poster, videoSrc }) => [poster, videoSrc]),
  ...hubTemplates.flatMap(({ thumbnails }) => thumbnails)
])

const workflowPaths = new Set(
  [...hubAppSlugs, ...hubWorkflowSlugs].map((slug) => `/hub/${slug}/`)
)

const workflows = verticals.flatMap((id) =>
  getAgencyVertical(id, 'en').workflows.map(({ href, template }) => ({
    destination: new URL(href, 'https://comfy.org'),
    template
  }))
)

describe('agency vertical content', () => {
  it.for(verticals)('shows published production media for %s', (id) => {
    const { hero, examples } = getAgencyVertical(id, 'en')
    expect(
      [hero.src, hero.poster, ...examples.map(({ media }) => media.src)].filter(
        (src) => !publishedMedia.has(src)
      )
    ).toEqual([])
  })

  it.for(
    workflows.filter(({ destination }) =>
      destination.pathname.startsWith('/hub/')
    )
  )(
    'offers a published Hub destination: $destination.pathname',
    ({ destination }) => {
      expect(destination.hostname).toBe('comfy.org')
      expect(workflowPaths.has(destination.pathname)).toBe(true)
    }
  )

  it.for(
    workflows.filter(
      ({ destination }) => destination.hostname === 'cloud.comfy.org'
    )
  )(
    'opens a supported Cloud template: $destination.href',
    ({ destination }) => {
      expect(hubTemplates.map(({ name }) => name)).toContain(
        destination.searchParams.get('template')
      )
    }
  )

  it.for(
    workflows.filter(({ destination }) =>
      destination.pathname.startsWith('/workflows/')
    )
  )(
    'opens a published legacy workflow: $template.name',
    ({ destination, template }) => {
      expect(destination.hostname).toBe('comfy.org')
      expect(destination.pathname).toBe(`/workflows/${template.name}/`)
    }
  )

  it.for(verticals)('localizes example copy and media labels for %s', (id) => {
    const english = getAgencyVertical(id, 'en').examples
    const chinese = getAgencyVertical(id, 'zh-CN').examples
    expect(chinese.map(({ title }) => title)).not.toEqual(
      english.map(({ title }) => title)
    )
    expect(
      chinese.map(({ title, description, media }) => [
        title,
        description,
        media.alt
      ])
    ).toEqual(
      chinese.map(() => [
        expect.stringMatching(/[\u4e00-\u9fff]/),
        expect.stringMatching(/[\u4e00-\u9fff]/),
        expect.stringMatching(/[\u4e00-\u9fff]/)
      ])
    )
  })
})
