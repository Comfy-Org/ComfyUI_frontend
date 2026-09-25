import { describe, expect, it } from 'vitest'

import {
  assertNoModelSlugAliasCollisions,
  authoredRouterModelSlugAliases,
  authoredWorkshopModels,
  routerModelSlugAliases,
  routerWorkshopModelPaths,
  workshopModels
} from './workshop-browse-content'
import {
  isWorkshopModelDisabled,
  workshopModelAvailability
} from './workshop-model-availability'
import {
  getAuthoredRouterWorkshopModelDetail,
  getRouterWorkshopModelDetail
} from './workshop-router-content'

describe('canonical model display names', () => {
  it('does not publish editorial prices as exact Router charges', () => {
    expect(authoredWorkshopModels.length).toBeGreaterThan(0)
    for (const model of authoredWorkshopModels) {
      expect(model.creditsPerRun).toBeUndefined()
      expect(
        getAuthoredRouterWorkshopModelDetail(model.slug)?.creditsPerRun
      ).toBeUndefined()
    }
  })

  it('does not expose Router slugs as catalogue or detail titles', () => {
    for (const model of authoredWorkshopModels) {
      expect(model.name.trim()).not.toBe('')
      expect(model.name).not.toBe(model.routerId.split('/')[1])
      expect(getAuthoredRouterWorkshopModelDetail(model.slug)?.name).toBe(
        model.name
      )
      expect(model.href).toBe(`/models/${model.slug}/`)
    }
  })

  it('preserves editorial names and distinguishes a native alias’s selected mode', () => {
    expect(
      getAuthoredRouterWorkshopModelDetail('vertexai--gemini-3-pro-image')?.name
    ).toBe('Nano Banana Pro Text-to-Image')
    expect(
      getAuthoredRouterWorkshopModelDetail(
        'byteplus--dreamina-seedance-2-0-fast-260128'
      )?.name
    ).toBe('Seedance 2.0 Fast Text-to-Video')
  })

  it.for([
    {
      slug: 'vertexai--veo-3--animate-images',
      name: 'Veo 3 Image-to-Video'
    },
    {
      slug: 'vertexai--veo-3--generate-videos',
      name: 'Veo 3 Text-to-Video'
    }
  ])('keeps task-specific model names coherent for $slug', ({ slug, name }) => {
    expect(getAuthoredRouterWorkshopModelDetail(slug)?.name).toBe(name)
  })

  it('places reference and corrected text-to-image models in their intended use cases', () => {
    const placements = [
      'byteplus--seedance-2-5-reference--generate-videos',
      'openai--gpt-image-2--generate-images'
    ].map((slug) => {
      const model = authoredWorkshopModels.find((item) => item.slug === slug)
      return [model?.useCases, model?.task]
    })

    expect(placements).toEqual([
      [['animate-images'], 'image-to-video'],
      [['generate-images'], 'text-to-image']
    ])
  })

  it('keeps unqualified redirects on a generation role when split pages have examples', () => {
    expect(
      getAuthoredRouterWorkshopModelDetail('byteplus--seedream-5-0-pro-260628')
        ?.slug
    ).toBe('byteplus--seedream-5-pro--generate-images')
    expect(
      getAuthoredRouterWorkshopModelDetail('xai--grok-imagine-video')?.slug
    ).toBe('xai--grok-imagine-video--generate-videos')
  })
})

describe('model availability', () => {
  it('withholds every disabled page from the catalogue, routes and redirects', () => {
    for (const [slug, { disabled }] of workshopModelAvailability) {
      if (!disabled) continue
      expect(workshopModels.map((model) => model.slug)).not.toContain(slug)
      expect(routerWorkshopModelPaths).not.toContain(slug)
      expect(getRouterWorkshopModelDetail(slug)).toBeUndefined()
    }
    for (const target of routerModelSlugAliases.values())
      expect(isWorkshopModelDisabled(target)).toBe(false)
  })

  it('keeps authored contracts testable independently of publication', () => {
    for (const model of authoredWorkshopModels) {
      const disabled = isWorkshopModelDisabled(model.slug)
      expect(
        getAuthoredRouterWorkshopModelDetail(model.slug)?.execution
      ).toBeDefined()
      expect(workshopModels.some(({ slug }) => slug === model.slug)).toBe(
        !disabled
      )
      expect(getRouterWorkshopModelDetail(model.slug)?.slug).toBe(
        disabled ? undefined : model.slug
      )
      expect(routerWorkshopModelPaths.includes(model.slug)).toBe(!disabled)
    }
  })

  it('keeps authored aliases stable while withholding disabled redirects', () => {
    const alias = 'wan--happyhorse-1.1-i2v'
    const target = authoredRouterModelSlugAliases.get(alias)
    expect(target).toBe('wan--happyhorse-image-to-video--animate-images')
    expect(routerModelSlugAliases.get(alias)).toBe(
      target && !isWorkshopModelDisabled(target) ? target : undefined
    )
  })

  it('rejects a canonical page that collides with a redirect alias', () => {
    expect(() =>
      assertNoModelSlugAliasCollisions(
        new Map([['duplicate', 'target']]),
        new Set(['duplicate'])
      )
    ).toThrow('Content slug collides with a legacy redirect: duplicate')
  })
})

const KNOWN_DUPLICATE_SUMMARIES: ReadonlyArray<
  readonly [string, readonly string[]]
> = [
  [
    'Generates an image from text with up to 9 reference images.',
    [
      'bfl--flux-2-pro--generate-images',
      'luma_2--uni-1-image-generation--generate-images'
    ]
  ],
  [
    'Generates a video from a mix of reference images, videos, and audio.',
    [
      'byteplus--seedance-2-fast-reference--generate-videos',
      'byteplus--seedance-2-reference--generate-videos'
    ]
  ],
  [
    'Generates a short video clip with audio from text.',
    [
      'byteplus--seedance-2-fast-text-to-video--generate-videos',
      'byteplus--seedance-2-text-to-video--generate-videos'
    ]
  ],
  [
    'Generates or edits an image at up to ~4K with up to 10 reference images.',
    [
      'byteplus--seedream-4--edit-images',
      'byteplus--seedream-4--generate-images'
    ]
  ],
  [
    'Generates or edits an image with higher quality than 4.0, minimum 3.68MP.',
    [
      'byteplus--seedream-4-5--edit-images',
      'byteplus--seedream-4-5--generate-images'
    ]
  ],
  [
    'Generates or edits an image with up to 14 reference images, PNG output.',
    [
      'byteplus--seedream-5-lite--edit-images',
      'byteplus--seedream-5-lite--generate-images'
    ]
  ],
  [
    'Generates or edits a 1K or 2K image with up to 10 references.',
    [
      'byteplus--seedream-5-pro--edit-images',
      'byteplus--seedream-5-pro--generate-images'
    ]
  ],
  [
    'Generates or edits video with audio through Gemini Omni 1.1 interactions. Length (3-10s) is set in the prompt; 360p to 4k.',
    [
      'gemini--omni-1.1-flash--animate-images',
      'gemini--omni-1.1-flash--edit-videos',
      'gemini--omni-1.1-flash--generate-videos'
    ]
  ],
  [
    'Generates or edits video with audio through Gemini Omni Flash interactions. Length (3-10s) is set in the prompt; 360p to 4k.',
    [
      'gemini--omni-flash-preview--animate-images',
      'gemini--omni-flash-preview--edit-videos',
      'gemini--omni-flash-preview--generate-videos'
    ]
  ],
  [
    'Generates a cinematic video clip from text.',
    [
      'kling--text-to-video--generate-videos',
      'luma--ray-2-text-to-video--generate-videos'
    ]
  ],
  [
    'Generates or edits an image with top-tier text rendering, 1K/2K/4K output, reference images, and optional mask inpainting.',
    [
      'openai--gpt-image-2--generate-images',
      'openai--gpt-image-2.5-flare--generate-images',
      'openai--gpt-image-2.5-sunburst--generate-images'
    ]
  ],
  [
    'Edits one to three images.',
    [
      'qwen--qwen-image-3.0-image-edit--edit-images',
      'qwen--qwen-image-3.0-pro-image-edit--edit-images'
    ]
  ],
  [
    'Generates an SVG illustration from a text prompt.',
    [
      'recraft--v3-text-to-vector--generate-images',
      'recraft--v4-text-to-vector--generate-images'
    ]
  ],
  [
    'Generates raster images.',
    [
      'recraft--v4.1-pro-text-to-image--generate-images',
      'recraft--v4.1-text-to-image--generate-images',
      'recraft--v4.1-utility-pro-text-to-image--generate-images',
      'recraft--v4.1-utility-text-to-image--generate-images'
    ]
  ],
  [
    'Generates SVG illustrations.',
    [
      'recraft--v4.1-pro-text-to-vector--generate-images',
      'recraft--v4.1-text-to-vector--generate-images',
      'recraft--v4.1-utility-pro-text-to-vector--generate-images',
      'recraft--v4.1-utility-text-to-vector--generate-images'
    ]
  ],
  [
    'Generates or edits an image quickly with up to 14 reference images (Gemini 2.5 Flash Image / Nano Banana).',
    [
      'vertexai--gemini-2.5-flash-image--edit-images',
      'vertexai--gemini-2.5-flash-image--generate-images'
    ]
  ],
  [
    'Generates a high-quality image with selectable 1K/2K/4K resolution (Gemini 3 Pro Image).',
    [
      'vertexai--gemini-3-pro-image--edit-images',
      'vertexai--gemini-3-pro-image--generate-images'
    ]
  ],
  [
    'Generates or edits images at up to 4K with up to 14 reference images and adjustable thinking (Nano Banana 2 / Gemini 3.1 Flash Image).',
    [
      'vertexai--gemini-nano-banana-2--edit-images',
      'vertexai--gemini-nano-banana-2--generate-images'
    ]
  ],
  [
    'Generates a cinematic video clip with native audio from text.',
    ['vertexai--veo-3--animate-images', 'vertexai--veo-3--generate-videos']
  ],
  [
    'Edits an existing video from a prompt and optional reference images.',
    [
      'wan--happyhorse-video-edit--edit-videos',
      'wan--video-edit-2.7--edit-videos'
    ]
  ],
  [
    'Generates a video clip from text with optional driving audio.',
    [
      'wan--text-to-video--generate-videos',
      'wan--text-to-video-2.7--generate-videos'
    ]
  ],
  [
    'Upscales an image to 2K/4K/8K with sharp, detailed results.',
    [
      'wavespeed--seedvr2-image--edit-images',
      'wavespeed--ultimate-image-upscaler--edit-images'
    ]
  ],
  [
    'Generates a short video clip from text or a start frame.',
    [
      'xai--grok-imagine-video--animate-images',
      'xai--grok-imagine-video--generate-videos'
    ]
  ],
  [
    'Generates a 1–15 second video at up to 1080p from text or a start frame.',
    [
      'xai--grok-imagine-video-1.5--animate-images',
      'xai--grok-imagine-video-1.5--generate-videos'
    ]
  ]
]

function normaliseSummary(summary: string): string {
  return summary.trim().toLowerCase().replace(/\s+/g, ' ')
}

describe('model summaries', () => {
  it('ships no new duplicate summary, and the known duplicates only shrink', () => {
    const slugsBySummary = new Map<string, string[]>()
    for (const { slug, summary } of workshopModels) {
      if (!summary) continue
      const key = normaliseSummary(summary)
      slugsBySummary.set(key, [...(slugsBySummary.get(key) ?? []), slug])
    }
    const known = new Map(
      KNOWN_DUPLICATE_SUMMARIES.map(([summary, slugs]) => [
        normaliseSummary(summary),
        slugs
      ])
    )

    const problems = [
      ...[...slugsBySummary]
        .filter(([, slugs]) => slugs.length > 1)
        .filter(([key, slugs]) =>
          slugs.some((slug) => !known.get(key)?.includes(slug))
        )
        .map(
          ([key, slugs]) =>
            `Duplicate summary on ${slugs.join(', ')}: "${key}". Write a distinct summary.`
        ),
      ...[...known]
        .filter(([key, slugs]) => {
          const current = slugsBySummary.get(key) ?? []
          return (
            current.length < 2 || slugs.some((slug) => !current.includes(slug))
          )
        })
        .map(
          ([key]) =>
            `Stale entry, remove it from KNOWN_DUPLICATE_SUMMARIES: "${key}"`
        )
    ]

    expect(problems).toEqual([])
  })
})
