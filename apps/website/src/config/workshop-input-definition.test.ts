import { describe, expect, it } from 'vitest'

import { workshopInputDefinitionSchema } from './workshop-input-definition'

const input = {
  label: 'Image',
  help: '',
  hidden: false,
  advanced: false,
  control: 'media' as const
}

describe('Workshop input definitions', () => {
  it('accepts ordered positive image aspect-ratio bounds', () => {
    expect(
      workshopInputDefinitionSchema.safeParse({
        ...input,
        imageAspectRatio: { minimum: 0.39, maximum: 2.5 }
      }).success
    ).toBe(true)
  })

  it.for([
    { minimum: 0, maximum: 2.5 },
    { minimum: 0.39, maximum: 0 },
    { minimum: 2.5, maximum: 0.39 }
  ])('rejects invalid image aspect-ratio bounds: %o', (imageAspectRatio) => {
    expect(
      workshopInputDefinitionSchema.safeParse({
        ...input,
        imageAspectRatio
      }).success
    ).toBe(false)
  })
})
