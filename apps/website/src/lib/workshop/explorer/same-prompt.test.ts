import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { websiteRoot } from '@website/paths'
import { workshopPages } from '@/config/workshop-page-content'
import { canCompare } from './compare'

import type { SamePromptSample } from '@/data/compareSamePrompt'
import { SAME_PROMPT_SAMPLES } from '@/data/compareSamePrompt'
import { samePromptRows, samePromptTypes } from './same-prompt'

const samples: SamePromptSample[] = [
  {
    type: 'typography',
    prompt: 'A poster',
    source: 'magnific',
    images: { a: '/a-poster.webp' }
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
    { slugs: ['a', 'b'], types: ['portraits', 'typography'] },
    { slugs: ['b', 'c'], types: ['portraits'] },
    { slugs: ['x', 'y'], types: [] }
  ])(
    'offers $types for $slugs, in the fixed type order',
    ({ slugs, types }) => {
      expect(samePromptTypes(samples, slugs)).toEqual(types)
    }
  )

  it.for([
    { slugs: ['a', 'b'], filter: 'all', prompts: ['A poster', 'A fisherman'] },
    {
      slugs: ['a', 'c'],
      filter: 'portraits',
      prompts: ['A fisherman', 'A baker']
    },
    { slugs: ['b', 'c'], filter: 'typography', prompts: [] }
  ] as const)(
    'lays out $prompts for $slugs under $filter',
    ({ slugs, filter, prompts }) => {
      expect(
        samePromptRows(samples, slugs, filter).map((sample) => sample.prompt)
      ).toEqual(prompts)
    }
  )

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
