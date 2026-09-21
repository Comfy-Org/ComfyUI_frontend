import { describe, expect, it } from 'vitest'

import models from '../src/data/workshop-creator-models.json'
import variants from '../src/data/workshop-content-inputs.json'
import { workshopCreatorDefinitionSchema } from './workshop-creator-definition'

describe('creator family configuration boundary', () => {
  it.for([
    { family: 'seedance', options: { mode: 'image', urlMedia: 'false' } },
    { family: 'seedance', options: { mode: 'image', urlMedia: 1 } },
    { family: 'seedance', options: { mode: 'imag' } },
    { family: 'seedance' },
    { family: 'tencent-file', options: { field: 'Wrong' } },
    { family: 'luma-image', options: { agents: 'false' } },
    { family: 'flat', options: { fixedValues: { count: [] } } },
    { family: 'flat', options: { typo: true } },
    { family: 'missing' }
  ])(
    'rejects malformed options rather than changing the chosen request path: %j',
    (value) => {
      expect(workshopCreatorDefinitionSchema.safeParse(value).success).toBe(
        false
      )
    }
  )

  it('validates every base and merged content-variant definition', () => {
    const definitions = new Map(Object.entries(models.models))
    expect(definitions.size).toBeGreaterThan(0)
    for (const definition of definitions.values()) {
      expect(
        workshopCreatorDefinitionSchema.safeParse(definition).success
      ).toBe(true)
    }
    for (const variant of Object.values(variants)) {
      const raw = definitions.get(variant.routerId)
      if (!raw) continue
      const definition = workshopCreatorDefinitionSchema.parse(raw)
      expect(
        workshopCreatorDefinitionSchema.safeParse({
          ...definition,
          options: {
            ...definition.options,
            ...('options' in variant ? variant.options : {})
          }
        }).success
      ).toBe(true)
    }
  })
})
