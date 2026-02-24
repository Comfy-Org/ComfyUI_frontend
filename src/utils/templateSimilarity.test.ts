import { describe, expect, it } from 'vitest'

import type { TemplateSimilarityInput } from '@/utils/templateSimilarity'

import {
  findSimilarTemplates,
  toSimilarityInput
} from '@/utils/templateSimilarity'

function makeTemplate(
  overrides: Partial<TemplateSimilarityInput> & { name: string }
): TemplateSimilarityInput {
  return {
    categories: [],
    tags: [],
    models: [],
    requiredNodes: [],
    ...overrides
  }
}

describe('templateSimilarity', () => {
  describe('findSimilarTemplates', () => {
    it('returns templates sorted by descending similarity score', () => {
      const reference = makeTemplate({
        name: 'ref',
        categories: ['image-generation'],
        tags: ['flux', 'txt2img'],
        models: ['flux-dev']
      })
      const bestMatch = makeTemplate({
        name: 'best',
        categories: ['image-generation'],
        tags: ['flux', 'txt2img'],
        models: ['flux-dev']
      })
      const partialMatch = makeTemplate({
        name: 'partial',
        categories: ['image-generation'],
        tags: ['sdxl']
      })
      const weakMatch = makeTemplate({
        name: 'weak',
        tags: ['flux']
      })

      const results = findSimilarTemplates(reference, [
        weakMatch,
        bestMatch,
        partialMatch
      ])

      expect(results.map((r) => r.template.name)).toEqual([
        'best',
        'partial',
        'weak'
      ])
    })

    it('excludes the reference template from results', () => {
      const reference = makeTemplate({
        name: 'ref',
        categories: ['image-generation']
      })
      const clone = makeTemplate({
        name: 'ref',
        categories: ['image-generation']
      })
      const other = makeTemplate({
        name: 'other',
        categories: ['image-generation']
      })

      const results = findSimilarTemplates(reference, [clone, other])

      expect(results).toHaveLength(1)
      expect(results[0].template.name).toBe('other')
    })

    it('excludes templates with zero similarity', () => {
      const reference = makeTemplate({
        name: 'ref',
        categories: ['image-generation'],
        tags: ['flux']
      })
      const noOverlap = makeTemplate({
        name: 'none',
        categories: ['audio'],
        tags: ['tts']
      })

      const results = findSimilarTemplates(reference, [noOverlap])

      expect(results).toHaveLength(0)
    })

    it('respects the limit parameter', () => {
      const reference = makeTemplate({
        name: 'ref',
        categories: ['image-generation']
      })
      const candidates = Array.from({ length: 20 }, (_, i) =>
        makeTemplate({ name: `t-${i}`, categories: ['image-generation'] })
      )

      const results = findSimilarTemplates(reference, candidates, 5)

      expect(results).toHaveLength(5)
    })

    it('returns empty array when no candidates match', () => {
      const reference = makeTemplate({
        name: 'ref',
        categories: ['video-generation']
      })
      const candidates = [
        makeTemplate({ name: 'a', categories: ['audio'] }),
        makeTemplate({ name: 'b', categories: ['text'] })
      ]

      expect(findSimilarTemplates(reference, candidates)).toEqual([])
    })

    it('returns empty array when candidates list is empty', () => {
      const reference = makeTemplate({ name: 'ref', tags: ['flux'] })

      expect(findSimilarTemplates(reference, [])).toEqual([])
    })

    it('returns empty array when all templates have empty metadata', () => {
      const reference = makeTemplate({ name: 'ref' })
      const candidates = [
        makeTemplate({ name: 'a' }),
        makeTemplate({ name: 'b' })
      ]

      expect(findSimilarTemplates(reference, candidates)).toEqual([])
    })

    it('ranks category match higher than tag-only match', () => {
      const reference = makeTemplate({
        name: 'ref',
        categories: ['image-generation'],
        tags: ['flux']
      })
      const categoryOnly = makeTemplate({
        name: 'cat',
        categories: ['image-generation']
      })
      const tagOnly = makeTemplate({
        name: 'tag',
        tags: ['flux']
      })

      const results = findSimilarTemplates(reference, [tagOnly, categoryOnly])

      expect(results[0].template.name).toBe('cat')
      expect(results[0].score).toBeGreaterThan(results[1].score)
    })

    it('ranks shared models higher than shared tags', () => {
      const reference = makeTemplate({
        name: 'ref',
        tags: ['txt2img'],
        models: ['flux-dev']
      })
      const modelMatch = makeTemplate({
        name: 'model',
        models: ['flux-dev']
      })
      const tagMatch = makeTemplate({
        name: 'tag',
        tags: ['txt2img']
      })

      const results = findSimilarTemplates(reference, [tagMatch, modelMatch])

      expect(results[0].template.name).toBe('model')
      expect(results[0].score).toBeGreaterThan(results[1].score)
    })

    it('scores identical templates at 1.0', () => {
      const reference = makeTemplate({
        name: 'ref',
        categories: ['image-generation'],
        tags: ['flux', 'txt2img'],
        models: ['flux-dev'],
        requiredNodes: ['node-a']
      })
      const identical = makeTemplate({
        name: 'twin',
        categories: ['image-generation'],
        tags: ['flux', 'txt2img'],
        models: ['flux-dev'],
        requiredNodes: ['node-a']
      })

      const results = findSimilarTemplates(reference, [identical])

      expect(results[0].score).toBeCloseTo(1.0)
    })

    it('scores a real-world scenario correctly', () => {
      const reference = makeTemplate({
        name: 'flux-basic',
        categories: ['image-generation'],
        tags: ['flux', 'txt2img'],
        models: ['flux-dev']
      })
      const similar = makeTemplate({
        name: 'flux-advanced',
        categories: ['image-generation'],
        tags: ['flux', 'img2img'],
        models: ['flux-dev']
      })
      const unrelated = makeTemplate({
        name: 'audio-gen',
        categories: ['audio'],
        tags: ['tts', 'speech'],
        models: ['bark']
      })

      const results = findSimilarTemplates(reference, [unrelated, similar])

      expect(results).toHaveLength(1)
      expect(results[0].template.name).toBe('flux-advanced')
      expect(results[0].score).toBeGreaterThan(0.5)
    })
  })

  describe('toSimilarityInput', () => {
    it('wraps single category string into array', () => {
      const result = toSimilarityInput({
        name: 'test',
        category: 'image-generation',
        mediaType: 'image',
        mediaSubtype: 'png',
        description: ''
      })

      expect(result.categories).toEqual(['image-generation'])
    })

    it('returns empty categories when category is undefined', () => {
      const result = toSimilarityInput({
        name: 'test',
        mediaType: 'image',
        mediaSubtype: 'png',
        description: ''
      })

      expect(result.categories).toEqual([])
    })

    it('passes tags through unchanged', () => {
      const result = toSimilarityInput({
        name: 'test',
        tags: ['flux', 'txt2img'],
        mediaType: 'image',
        mediaSubtype: 'png',
        description: ''
      })

      expect(result.tags).toEqual(['flux', 'txt2img'])
    })

    it('passes models through unchanged', () => {
      const result = toSimilarityInput({
        name: 'test',
        models: ['flux-dev', 'sd-vae'],
        mediaType: 'image',
        mediaSubtype: 'png',
        description: ''
      })

      expect(result.models).toEqual(['flux-dev', 'sd-vae'])
    })

    it('maps requiresCustomNodes to requiredNodes', () => {
      const result = toSimilarityInput({
        name: 'test',
        requiresCustomNodes: ['node-a', 'node-b'],
        mediaType: 'image',
        mediaSubtype: 'png',
        description: ''
      })

      expect(result.requiredNodes).toEqual(['node-a', 'node-b'])
    })

    it('defaults missing arrays to empty arrays', () => {
      const result = toSimilarityInput({
        name: 'test',
        mediaType: 'image',
        mediaSubtype: 'png',
        description: ''
      })

      expect(result.tags).toEqual([])
      expect(result.models).toEqual([])
      expect(result.requiredNodes).toEqual([])
    })
  })
})
