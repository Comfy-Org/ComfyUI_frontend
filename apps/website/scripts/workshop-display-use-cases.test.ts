import { describe, expect, it } from 'vitest'

import {
  workshopDisplayEntriesSchema,
  workshopDisplaySourceSchema
} from '../src/content/workshop-display.schema'
import { splitWorkshopDisplay } from './workshop-display-use-cases'

const thumbnail = { url: 'https://example.com/output.png', kind: 'image' }
const example = {
  title: 'An image edit',
  description: 'Change the background.',
  values: { prompt: 'Use a snowy background.', count: 2, enhance: false }
}
const source = workshopDisplaySourceSchema.parse({
  id: 'byteplus/seedream-4',
  useCases: ['generate-images', 'edit-images'],
  media: { thumbnail, samples: [thumbnail] },
  examples: [example],
  mediaConfidence: 'exact',
  needsReview: false
})

describe('model-plus-use-case content identity', () => {
  it('gives two uses of one model distinct stable IDs and media ownership', () => {
    const entries = splitWorkshopDisplay([source])
    expect(
      entries.map(({ id, slug, modelId, useCase }) => ({
        id,
        slug,
        modelId,
        useCase
      }))
    ).toEqual([
      {
        id: 'byteplus--seedream-4--generate-images',
        slug: 'byteplus--seedream-4--generate-images',
        modelId: source.id,
        useCase: 'generate-images'
      },
      {
        id: 'byteplus--seedream-4--edit-images',
        slug: 'byteplus--seedream-4--edit-images',
        modelId: source.id,
        useCase: 'edit-images'
      }
    ])
    expect(entries[0].media).toEqual({})
    expect(entries[0].examples).toEqual([])
    expect(entries[0].needsReview).toBe(true)
    expect(entries[1].media).toEqual(source.media)
    expect(entries[1].examples).toEqual([example])
    expect(
      splitWorkshopDisplay([
        { ...source, displayName: 'New editorial name' }
      ]).map(({ slug }) => slug)
    ).toEqual(entries.map(({ slug }) => slug))
  })

  it('rejects duplicate rows and inconsistent or unsafe slugs instead of overwriting a map entry', () => {
    const [entry] = splitWorkshopDisplay([source])
    expect(() => workshopDisplayEntriesSchema.parse([entry, entry])).toThrow(
      'Duplicate content slug'
    )
    for (const slug of ['../../other', 'just-the-model', `${entry.slug}--2`])
      expect(() =>
        workshopDisplayEntriesSchema.parse([{ ...entry, slug }])
      ).toThrow()
    expect(() =>
      workshopDisplayEntriesSchema.parse([{ ...entry, id: 'another-id' }])
    ).toThrow('Content id/slug')
  })

  it('retains conflicting media and its exact paired inputs without publishing them in two rows', () => {
    const entries = splitWorkshopDisplay([
      { ...source, useCases: ['edit-images'] },
      { ...source, id: 'other/model', useCases: ['generate-images'] }
    ])
    for (const entry of entries) {
      expect(entry.media.thumbnail).toBeUndefined()
      expect(entry.media.samples).toEqual([])
      expect(entry.examples).toEqual([])
      expect(entry.withheldContent).toEqual({
        reason: 'shared-across-use-cases',
        media: source.media,
        examples: source.examples
      })
    }
    expect(() =>
      workshopDisplayEntriesSchema.parse(
        entries.map((entry) => ({
          ...entry,
          media: source.media,
          examples: source.examples
        }))
      )
    ).toThrow('Media is shared across use cases')
  })

  it('allows sibling versions to share imagery within the same use case', () => {
    const entries = splitWorkshopDisplay([
      { ...source, useCases: ['edit-images'] },
      { ...source, id: 'other/model', useCases: ['edit-images'] }
    ])
    expect(
      entries.every((entry) => entry.media.thumbnail?.url === thumbnail.url)
    ).toBe(true)
    expect(entries.every((entry) => entry.withheldContent === undefined)).toBe(
      true
    )
  })

  it('requires an explicit media assignment for a new multi-use-case source', () => {
    expect(() =>
      splitWorkshopDisplay([{ ...source, id: 'new/model' }])
    ).toThrow('Choose a media use case before splitting new/model')
  })

  it('rejects a media assignment outside the declared use cases', () => {
    expect(() =>
      splitWorkshopDisplay([
        { ...source, useCases: ['generate-images', 'animate-images'] }
      ])
    ).toThrow(
      'Media use case edit-images is not declared for byteplus/seedream-4'
    )
  })
})
