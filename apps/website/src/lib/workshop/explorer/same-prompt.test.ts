import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { websiteRoot } from '@website/paths'
import { workshopPages } from '@/config/workshop-page-content'
import { canCompare } from './compare'

import type { SamePromptSample } from '@/data/compareSamePrompt'
import { SAME_PROMPT_SAMPLES } from '@/data/compareSamePrompt'
import { samePromptRows, samePromptTypes, sharesSamples } from './same-prompt'

const samples: SamePromptSample[] = [
  {
    type: 'typography',
    prompt: 'A poster',
    source: 'magnific',
    images: { a: '/a-poster.webp', c: '/c-poster.webp' }
  },
  {
    type: 'portraits',
    prompt: 'A fisherman',
    source: 'magnific',
    images: { a: '/a-face.webp', b: '/b-face.webp' }
  },
  {
    type: 'portraits',
    prompt: 'A baker',
    source: 'magnific',
    images: { c: '/c-baker.webp' }
  }
]

describe('same-prompt samples', () => {
  it.for([
    { slugs: ['a', 'b'], types: ['portraits'] },
    { slugs: ['a', 'c'], types: ['typography'] },
    { slugs: ['a', 'b', 'c'], types: ['portraits', 'typography'] },
    { slugs: ['b', 'c'], types: [] }
  ])(
    'offers $types for $slugs: a type needs a prompt two of them answered',
    ({ slugs, types }) => {
      expect(samePromptTypes(samples, slugs)).toEqual(types)
    }
  )

  it.for([
    { slugs: ['a', 'b'], filter: 'all', prompts: ['A fisherman'] },
    {
      slugs: ['a', 'b', 'c'],
      filter: 'all',
      prompts: ['A poster', 'A fisherman']
    },
    { slugs: ['a', 'b', 'c'], filter: 'portraits', prompts: ['A fisherman'] },
    { slugs: ['a', 'b'], filter: 'typography', prompts: [] }
  ] as const)(
    'lays out $prompts for $slugs under $filter',
    ({ slugs, filter, prompts }) => {
      expect(
        samePromptRows(samples, slugs, filter).map((sample) => sample.prompt)
      ).toEqual(prompts)
    }
  )

  it.for([
    { a: 'a', b: 'b', shares: true },
    { a: 'c', b: 'a', shares: true },
    { a: 'b', b: 'c', shares: false }
  ])('says $a and $b share a prompt: $shares', ({ a, b, shares }) => {
    expect(sharesSamples(samples, a, b)).toBe(shares)
  })

  it('records where every published sample was made and ships its image', () => {
    for (const sample of SAME_PROMPT_SAMPLES) {
      expect(sample.source).toBe('magnific')
      for (const url of Object.values(sample.images))
        expect(existsSync(join(websiteRoot, 'public', url))).toBe(true)
    }
  })

  it('names only models the catalogue can compare', () => {
    const slugs = new Set(
      SAME_PROMPT_SAMPLES.flatMap((sample) => Object.keys(sample.images))
    )
    for (const slug of slugs) {
      const model = workshopPages.find((page) => page.slug === slug)
      expect({ slug, comparable: !!model && canCompare(model) }).toEqual({
        slug,
        comparable: true
      })
    }
  })
})
