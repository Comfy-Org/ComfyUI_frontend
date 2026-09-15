import { describe, expect, it } from 'vitest'

import rawCatalog from '../src/content/workshop-models.json'
import rawDisplay from '../src/content/workshop-display.json'
import rawRepairs from '../src/data/workshop-example-repairs.json'
import { workshopDisplaySchema } from '../src/content/workshop-display.schema'
import { workshopModelSchema } from '../src/content/workshop-models.schema'
import { buildWorkshopDisplay } from './generate-workshop-display'

const catalog = new Map(
  rawCatalog.map((entry) => {
    const model = workshopModelSchema.parse(entry)
    return [model.id, model]
  })
)
const display = rawDisplay.map((entry) => workshopDisplaySchema.parse(entry))
const model = catalog.get('vertexai/gemini-3-pro-image')
if (!model) throw new Error('Missing naming fixture')

const drop = {
  _displayName: 'Nano Banana Pro',
  _mediaConfidence: 'none',
  _needsReview: false,
  useCases: []
}

describe('Workshop display names', () => {
  it('imports the content name without renaming its catalog identity', () => {
    const [entry] = buildWorkshopDisplay({ [model.id]: drop }, catalog)
    expect(entry.displayName).toBe('Nano Banana Pro')
    expect(entry.modelId).toBe('vertexai/gemini-3-pro-image')
    expect(entry.id).toBe('vertexai--gemini-3-pro-image--edit-images')
    expect(entry.slug).toBe(entry.id)
    expect(model.displayName).toBe('Gemini 3 Pro Image')
  })

  it('prefers an explicit override and trims surrounding whitespace', () => {
    const [entry] = buildWorkshopDisplay(
      {
        [model.id]: { ...drop, displayName: '  Editorial name  ' }
      },
      catalog
    )
    expect(entry.displayName).toBe('Editorial name')
  })

  it('allows a missing override to fall back to the catalog', () => {
    const [entry] = buildWorkshopDisplay(
      {
        [model.id]: { ...drop, _displayName: undefined }
      },
      catalog
    )
    expect(entry.displayName).toBeUndefined()
  })

  it('does not turn copied catalog names into editorial overrides', () => {
    const [entry] = buildWorkshopDisplay(
      {
        [model.id]: { ...drop, _displayName: model.displayName }
      },
      catalog
    )
    expect(entry.displayName).toBeUndefined()
  })

  it('preserves nested input media and typed preset values with their output', () => {
    const example = {
      title: 'Two image references',
      description: 'Keep both source images in their original order.',
      values: {
        prompt: 'Combine these references',
        count: 2,
        enhance: false,
        medias: [
          { role: 'image', value: 'https://example.com/first.png' },
          { role: 'image', value: 'https://example.com/second.png' }
        ]
      }
    }
    const sample = {
      url: 'https://example.com/output.png',
      kind: 'image'
    }
    const [entry] = buildWorkshopDisplay(
      {
        [model.id]: {
          ...drop,
          examples: [example],
          media: { samples: [sample] },
          advancedFields: ['seed', 'resolution']
        }
      },
      catalog
    )
    expect(entry.examples).toEqual([example])
    expect(entry.media.samples).toEqual([sample])
    expect(entry.advancedFields).toEqual(['seed', 'resolution'])
  })

  it.for(['', '   ', 42])(
    'rejects an invalid editorial name: %s',
    (displayName) => {
      expect(() =>
        buildWorkshopDisplay({ [model.id]: { ...drop, displayName } }, catalog)
      ).toThrow('displayName')
    }
  )

  it('round-trips the packed overlay without losing editorial content', () => {
    expect(buildWorkshopDisplay(display, catalog)).toEqual(display)
  })

  it('rejects a packed example without its paired sample', () => {
    const entry = {
      ...display[0],
      media: {},
      examples: [
        {
          title: 'Unpaired example',
          description: '',
          values: { prompt: 'A prompt without an output sample' }
        }
      ]
    }

    expect(() => buildWorkshopDisplay([entry], catalog)).toThrow(
      'Examples and samples must remain paired by index'
    )
  })

  it.for(rawRepairs.repairs)(
    'restores $id from the durable source during a legacy import',
    (repair) => {
      const entry = display.find((candidate) => candidate.id === repair.id)
      if (!entry) throw new Error(`Missing repair fixture: ${repair.id}`)
      const examples = entry.examples.map((example) =>
        example.title === repair.exampleTitle
          ? { ...example, values: {} }
          : example
      )
      const { id, slug, modelId, useCase, withheldContent, ...content } = entry

      const result = buildWorkshopDisplay(
        { [modelId]: { ...content, examples, useCases: [useCase] } },
        catalog
      )
      const restored = result.find((candidate) => candidate.id === id)
      const restoredExample = restored?.examples.find(
        (example) => example.title === repair.exampleTitle
      )

      expect(slug).toBe(id)
      expect(withheldContent).toBeUndefined()
      expect(restoredExample?.values).toEqual(repair.values)
    }
  )

  it('preserves packed repairs, editorial values, and changed samples', () => {
    const repair = rawRepairs.repairs[0]
    const entry = display.find((candidate) => candidate.id === repair.id)
    if (!entry) throw new Error(`Missing repair fixture: ${repair.id}`)
    const example = entry.examples.at(0)
    const otherExamples = entry.examples.slice(1)
    const samples = entry.media.samples ?? []
    const sample = samples.at(0)
    const otherSamples = samples.slice(1)
    if (!example || !sample) throw new Error('Incomplete repair fixture')

    expect(buildWorkshopDisplay([entry], catalog)).toEqual([entry])

    const editorialValues = { prompt: 'Keep this editorial value' }
    const edited = {
      ...entry,
      examples: [{ ...example, values: editorialValues }, ...otherExamples]
    }
    expect(
      buildWorkshopDisplay([edited], catalog)[0].examples[0].values
    ).toEqual(editorialValues)

    const changedSample = {
      ...entry,
      media: {
        ...entry.media,
        samples: [
          { ...sample, url: 'https://example.com/different-output.webp' },
          ...otherSamples
        ]
      },
      examples: [{ ...example, values: {} }, ...otherExamples]
    }
    expect(
      buildWorkshopDisplay([changedSample], catalog)[0].examples[0].values
    ).toEqual({})
  })
})
