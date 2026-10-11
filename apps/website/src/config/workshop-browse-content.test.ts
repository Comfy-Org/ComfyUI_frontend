import { describe, expect, it } from 'vitest'

import {
  assertNoModelSlugAliasCollisions,
  authoredRouterModelSlugAliases,
  authoredWorkshopModels,
  correctedUseCase,
  editorialSummariesFor,
  modelDisplayName,
  modelSummaryFor,
  publishableMedia,
  routerModelSlugAliases,
  routerWorkshopModelPaths,
  unpublishedSummaryWarning,
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
import { hubModelHref } from './hub-models'

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
      expect(model.href).toBe(
        isWorkshopModelDisabled(model.slug)
          ? undefined
          : hubModelHref(model.slug)
      )
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

function normaliseSummary(summary: string): string {
  return summary.trim().toLowerCase().replace(/\s+/g, ' ')
}

describe('model summaries', () => {
  it('gives every model page a summary', () => {
    const missing = workshopModels
      .filter(({ summary }) => !summary?.trim())
      .map(({ slug }) => slug)

    expect(missing).toEqual([])
  })

  it('ships no summary shared by two pages', () => {
    const slugsBySummary = new Map<string, string[]>()
    for (const { slug, summary } of workshopModels) {
      if (!summary) continue
      const key = normaliseSummary(summary)
      slugsBySummary.set(key, [...(slugsBySummary.get(key) ?? []), slug])
    }

    const problems = [...slugsBySummary]
      .filter(([, slugs]) => slugs.length > 1)
      .map(
        ([key, slugs]) =>
          `Duplicate summary on ${slugs.join(', ')}: "${key}". Write a distinct one per page in src/data/workshop-model-summaries.json.`
      )

    expect(problems).toEqual([])
  })
})

describe('editorial summary overrides', () => {
  it('trims each override for a model page', () => {
    expect(
      editorialSummariesFor({ 'a--b': '  Distinct copy. ' }, new Set(['a--b']))
    ).toEqual(new Map([['a--b', 'Distinct copy.']]))
  })

  it.for([
    {
      case: 'a page that is not a model page',
      slug: 'missing',
      summary: 'Copy.'
    },
    { case: 'a blank override', slug: 'a--b', summary: '   ' }
  ])('rejects $case', ({ slug, summary }) => {
    expect(() =>
      editorialSummariesFor({ [slug]: summary }, new Set(['a--b']))
    ).toThrow(`Invalid model summary for page: ${slug}`)
  })

  it('warns only about overrides for pages this build does not publish', () => {
    expect(unpublishedSummaryWarning(['a', 'b', 'c'], new Set(['b']))).toBe(
      'Model summaries kept for pages this build does not publish: a, c'
    )
    expect(unpublishedSummaryWarning(['b'], new Set(['b']))).toBeUndefined()
  })

  it.for([
    {
      editorial: 'Editorial.',
      description: 'Draws images.',
      summary: 'Editorial.'
    },
    {
      editorial: undefined,
      description: 'Draws images (Model).',
      summary: 'Draws images.'
    },
    { editorial: undefined, description: '', summary: undefined }
  ])(
    'summarises $description with editorial $editorial as $summary',
    ({ editorial, description, summary }) => {
      expect(
        modelSummaryFor(editorial, description, {
          name: 'Model',
          provider: 'Provider'
        })
      ).toBe(summary)
    }
  )
})

describe('browse model fields', () => {
  it('applies the entry override before the Router override and the authored use case', () => {
    const overrides = new Map([
      ['entry', 'edit-images' as const],
      ['router', 'audio' as const]
    ])
    expect(
      [
        { entryId: 'entry', routerId: 'router' },
        { entryId: 'other', routerId: 'router' },
        { entryId: 'other', routerId: 'other' }
      ].map((ids) => correctedUseCase(overrides, ids, 'generate-images'))
    ).toEqual(['edit-images', 'audio', 'generate-images'])
  })

  it('withholds media from a page whose media shows the wrong model', () => {
    const thumbnail = {
      url: 'https://example.com/t.png',
      kind: 'image' as const
    }
    const media = { thumbnail, samples: Array(8).fill(thumbnail) }
    expect(publishableMedia(media, false)).toEqual({
      exampleCount: 6,
      thumbnail
    })
    expect(publishableMedia({}, false)).toEqual({
      exampleCount: 0,
      thumbnail: undefined
    })
    expect(publishableMedia(media, true)).toEqual({
      exampleCount: 0,
      thumbnail: undefined
    })
  })

  it.for([
    {
      case: 'the authored name',
      names: { authored: 'Authored', canonical: 'Canonical', shared: 2 },
      expected: 'Authored'
    },
    {
      case: 'the entry name when models share a Router use case',
      names: { canonical: 'Canonical', shared: 2 },
      expected: 'Entry'
    },
    {
      case: 'the canonical name',
      names: { canonical: 'Canonical', shared: 1 },
      expected: 'Canonical'
    },
    { case: 'the entry name', names: {}, expected: 'Entry' }
  ])('names a model with $case', ({ names, expected }) => {
    expect(
      modelDisplayName({
        authored: names.authored,
        canonical: names.canonical,
        entry: 'Entry',
        modelsSharingRouterUseCase: names.shared
      })
    ).toBe(expected)
  })
})
