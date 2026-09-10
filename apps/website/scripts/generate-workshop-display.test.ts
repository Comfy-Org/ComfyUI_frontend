import { describe, expect, it } from 'vitest'

import rawCatalog from '../src/content/workshop-models.json'
import rawDisplay from '../src/content/workshop-display.json'
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
    expect(entry.id).toBe('vertexai/gemini-3-pro-image')
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

  it.for(['', '   ', 42])(
    'rejects an invalid editorial name: %s',
    (displayName) => {
      expect(() =>
        buildWorkshopDisplay({ [model.id]: { ...drop, displayName } }, catalog)
      ).toThrow('displayName')
    }
  )

  it('round-trips the packed overlay without losing editorial content', () => {
    expect(
      buildWorkshopDisplay(
        Object.fromEntries(display.map((entry) => [entry.id, entry])),
        catalog
      )
    ).toEqual(display)
  })
})
