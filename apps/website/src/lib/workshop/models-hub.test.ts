import { describe, expect, it } from 'vitest'

import type { RouterWorkshopModel } from '@/config/models-catalogue'
import type { OpenWeightModel } from './explorer/open-weight-models'
import { familyShowcase, latestLaunch } from './models-hub'

function hosted(
  slug: string,
  name = slug,
  extra: Omit<Partial<RouterWorkshopModel>, 'routerId'> = {}
): RouterWorkshopModel {
  return {
    slug,
    name,
    workflowCount: 1,
    href: `/hub/models/${slug}/`,
    routerId: `acme/${slug}`,
    capabilities: [],
    ...extra
  }
}

function open(name: string): OpenWeightModel {
  return {
    slug: name.toLowerCase().replaceAll(' ', '-'),
    name,
    modality: 'video',
    useCase: 'generate-videos',
    tasks: [],
    thumbnailUrl: 'https://example.com/open.webp'
  }
}

const releases = [
  { slug: 'older', releasedAt: '2026-02-26' },
  { slug: 'newest', releasedAt: '2026-07-31' },
  { slug: 'middle', releasedAt: '2026-07-08' }
]

describe('latestLaunch', () => {
  it.for([
    {
      kind: 'every release is listed',
      models: [hosted('older'), hosted('middle'), hosted('newest')],
      latest: 'newest'
    },
    {
      kind: 'the newest release is not in the catalogue',
      models: [hosted('older'), hosted('middle')],
      latest: 'middle'
    },
    {
      kind: 'the newest release has no page',
      models: [
        hosted('older'),
        hosted('newest', 'newest', { href: undefined })
      ],
      latest: 'older'
    },
    {
      kind: 'no release is listed',
      models: [hosted('other')],
      latest: undefined
    }
  ])('features $latest when $kind', ({ models, latest }) => {
    expect(latestLaunch(models, releases)?.slug).toBe(latest)
  })
})

describe('familyShowcase', () => {
  it('lists every release newest first, hosted before open weights of the same version', () => {
    const showcase = familyShowcase(
      'Wan',
      [
        hosted('wan-26', 'Wan 2.6 Text-to-Video', { recommendedRank: 9 }),
        hosted('wan-30', 'Wan 3.0 Text-to-Video', {
          recommendedRank: 2,
          thumbnail: { url: 'https://example.com/wan.webp', kind: 'image' }
        }),
        hosted('wan-30-i2v', 'Wan 3.0 Image-to-Video', { recommendedRank: 5 }),
        hosted('happy', 'HappyHorse Text-to-Video')
      ],
      [
        open('Wan2.1 T2v 14B'),
        open('Wan2.2 Ti2v 5B'),
        open('Wan2 2 Animate 14B'),
        open('Flux1 Dev')
      ]
    )

    expect(
      showcase?.releases.map(({ version, open: isOpen }) => [version, isOpen])
    ).toEqual([
      ['3.0', false],
      ['2.6', false],
      ['2.2', true],
      ['2.1', true]
    ])
    expect(showcase?.releases[0].query).toBe('Wan 3.0')
    expect(showcase?.releases[2].query).toBe('Wan2.2')
    expect(showcase?.cover?.slug).toBe('wan-30')
  })

  const still = {
    url: 'https://example.com/still.webp',
    kind: 'image' as const
  }
  const clip = { url: 'https://example.com/clip.mp4', kind: 'video' as const }

  it.for([
    {
      kind: 'the most popular release has a still image',
      thumbnails: [still, clip],
      cover: 'wan-popular'
    },
    {
      kind: 'the most popular release is a video without a poster',
      thumbnails: [clip, still],
      cover: 'wan-niche'
    },
    {
      kind: 'the most popular release is a video with a poster',
      thumbnails: [
        { ...clip, poster: 'https://example.com/poster.jpg' },
        still
      ],
      cover: 'wan-popular'
    },
    {
      kind: 'the most popular release has no media',
      thumbnails: [undefined, still],
      cover: 'wan-niche'
    },
    {
      kind: 'no release has a still',
      thumbnails: [clip, clip],
      cover: undefined
    }
  ])('covers the family with $cover when $kind', ({ thumbnails, cover }) => {
    const [popular, niche] = thumbnails
    const showcase = familyShowcase(
      'Wan',
      [
        hosted('wan-popular', 'Wan 3.0 Text-to-Video', {
          recommendedRank: 1,
          thumbnail: popular
        }),
        hosted('wan-niche', 'Wan 2.5 Image Edit', {
          recommendedRank: 2,
          thumbnail: niche
        })
      ],
      []
    )

    expect(showcase?.cover?.slug).toBe(cover)
  })

  it('has nothing to show for a family the catalogue does not carry', () => {
    expect(
      familyShowcase('Wan', [hosted('flux', 'Flux 2')], [open('Flux1 Dev')])
    ).toBeUndefined()
  })
})
