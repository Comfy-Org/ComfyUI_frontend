import { describe, expect, it, vi } from 'vitest'

import type {
  RouterWorkshopModel,
  WorkshopModel
} from '@/config/models-catalogue'
import {
  canCompare,
  comparableWith,
  comparedSearch,
  compareRows,
  MAX_COMPARED,
  parseCompared,
  toggleCompared
} from './compare'

function hosted(
  overrides: Partial<RouterWorkshopModel> = {}
): RouterWorkshopModel {
  return {
    slug: 'kling',
    name: 'Kling',
    workflowCount: 0,
    routerId: 'kling/kling',
    capabilities: [],
    ...overrides
  }
}

describe('toggleCompared', () => {
  it('adds, removes and stops at the limit', () => {
    const full = Array.from({ length: MAX_COMPARED }, (_, i) => `m${i}`)
    expect(toggleCompared([], 'a')).toEqual(['a'])
    expect(toggleCompared(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleCompared(full, 'extra')).toEqual(full)
    expect(toggleCompared(full, 'm0')).toEqual(full.slice(1))
  })
})

describe('canCompare', () => {
  it.for([
    ['a hosted model', hosted(), true],
    [
      'a model missing its input schema',
      hosted({ incompleteReason: 'missing-input-schema' }),
      false
    ],
    [
      'a workflow',
      {
        slug: 'workflows/relight',
        name: 'Relight',
        workflowCount: 0,
        capabilities: [],
        href: '/hub/workflows/relight/',
        type: 'CLOUD',
        workflowId: 'relight'
      } satisfies WorkshopModel,
      false
    ]
  ] as const)('%s → %s', ([, model, expected]) => {
    expect(canCompare(model)).toBe(expected)
  })
})

describe('compareRows', () => {
  it.for([
    { run: '1', access: 'Run · API' },
    { run: undefined, access: 'API' }
  ] as const)(
    'lists one value per model for every real field (run opt-in $run)',
    ({ run, access }) => {
      vi.stubEnv('PUBLIC_WORKSHOP_ROUTER_RUN', run)
      const rows = compareRows(
        [
          hosted({
            provider: 'Kling',
            modality: 'video',
            task: 'text-to-video',
            creditsPerRun: 24
          }),
          hosted({ slug: 'mystery', name: 'Mystery' })
        ],
        'en'
      )
      expect(
        Object.fromEntries(rows.map((row) => [row.key, row.values]))
      ).toEqual({
        provider: ['Kling', '—'],
        task: ['Text to Video', expect.any(String)],
        access: [access, access]
      })
    }
  )
})

describe('the compare address', () => {
  it.for([
    { search: '', slugs: [] },
    { search: '?compare=a,b', slugs: ['a', 'b'] },
    { search: '?q=x&compare=a,,a,b', slugs: ['a', 'b'] },
    { search: '?compare=a,b,c,d,e', slugs: ['a', 'b', 'c', 'd'] }
  ])('reads $search as $slugs', ({ search, slugs }) => {
    expect(parseCompared(search)).toEqual(slugs)
  })

  it.for([
    { search: '', slugs: ['a', 'b'], next: '?compare=a,b' },
    { search: '?tab=image', slugs: ['a', 'b'], next: '?tab=image&compare=a,b' },
    { search: '?tab=image&compare=a,b', slugs: [], next: '?tab=image' },
    { search: '?compare=a,b', slugs: [], next: '' }
  ])('writes $slugs into $search as $next', ({ search, slugs, next }) => {
    expect(comparedSearch(search, slugs)).toBe(next)
  })
})

describe('comparableWith', () => {
  const textToImage = (slug: string, rank?: number) =>
    hosted({ slug, name: slug, task: 'text-to-image', recommendedRank: rank })
  const catalogue = [
    textToImage('self', 1),
    textToImage('third', 3),
    textToImage('first', 1),
    hosted({ slug: 'video', task: 'text-to-video' }),
    textToImage('broken', 0),
    textToImage('second', 2),
    textToImage('fourth', 4)
  ].map((model) =>
    model.slug === 'broken'
      ? { ...model, incompleteReason: 'missing-input-schema' as const }
      : model
  )

  it('offers the three most popular comparable models with the same task', () => {
    expect(
      comparableWith(catalogue[0], catalogue).map((model) => model.slug)
    ).toEqual(['first', 'second', 'third'])
  })

  it('puts the models that answered a prompt this one answered first', () => {
    const samples = [
      {
        type: 'portraits' as const,
        prompt: 'A fisherman',
        source: 'magnific' as const,
        images: { self: '/self.webp', fourth: '/fourth.webp' }
      }
    ]
    expect(
      comparableWith(catalogue[0], catalogue, samples).map(
        (model) => model.slug
      )
    ).toEqual(['fourth', 'first', 'second'])
  })

  it.for([
    ['a model with no task', hosted({ slug: 'self' })],
    [
      'a model that cannot be compared',
      {
        ...textToImage('self'),
        incompleteReason: 'missing-input-schema' as const
      }
    ]
  ] as const)('offers nothing for %s', ([, model]) => {
    expect(comparableWith(model, catalogue)).toEqual([])
  })
})
