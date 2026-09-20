import { z } from 'astro/zod'
import { describe, expect, it } from 'vitest'

import rawSnapshots from '../src/data/workshop-router-openapi.snapshot.json'
import { deriveWorkshopFields } from '../src/config/workshop-fields'
import {
  parseRouterOpenApiSnapshot,
  routerInputSchema
} from '../src/config/workshop-router-openapi'
import { creatorFormFor, creatorVariantsFor } from './workshop-creator-forms'
import { curateWorkshopInputs } from './workshop-input-presentation'

const gptImageIds = [
  'openai/gpt-image-1',
  'openai/gpt-image-1.5',
  'openai/gpt-image-2'
] as const
const qualityOptions = ['low', 'medium', 'high']
const object = z.record(z.string(), z.json())
const sources = new Map(
  rawSnapshots.map((raw) => {
    const snapshot = parseRouterOpenApiSnapshot(raw)
    return [snapshot.id, snapshot] as const
  })
)

describe('GPT Image quality curation', () => {
  it.for(gptImageIds)('offers only supported quality choices for %s', (id) => {
    const snapshot = sources.get(id)
    if (!snapshot) throw new Error(`Missing Router snapshot: ${id}`)
    const source = routerInputSchema(snapshot)
    const sourceQuality = object.parse(source.properties).quality

    expect(object.parse(sourceQuality).enum).toEqual(
      expect.arrayContaining(qualityOptions)
    )

    const curated = curateWorkshopInputs(id, source)
    const forms = [
      creatorFormFor(id, curated),
      ...Object.values(creatorVariantsFor(id, curated))
    ].filter((form) => form !== undefined)
    const qualityFields = [
      curated.inputSchema,
      ...forms.map((form) => form.parameters)
    ].flatMap((parameters) =>
      deriveWorkshopFields(parameters, [], []).filter(
        (field) => field.name === 'quality'
      )
    )

    expect(qualityFields).not.toHaveLength(0)
    for (const quality of qualityFields) {
      expect(quality).toMatchObject({
        kind: 'select',
        options: qualityOptions,
        defaultValue: 'medium'
      })
    }
  })
})
