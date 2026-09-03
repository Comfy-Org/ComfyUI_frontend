import { describe, expect, it } from 'vitest'

import {
  defaultWorkshopValues,
  relatedWorkshopModels,
  workshopDetailModels
} from './workshop-detail'

describe('Workshop model details', () => {
  it('has one detail record for every catalog route', () => {
    expect(workshopDetailModels).toHaveLength(268)
    expect(new Set(workshopDetailModels.map((model) => model.slug)).size).toBe(
      268
    )
  })

  it('loads generated field defaults', () => {
    expect(
      defaultWorkshopValues([
        {
          kind: 'toggle',
          name: 'enhance',
          label: 'Enhance',
          required: false,
          defaultValue: true
        }
      ])
    ).toEqual({ enhance: true })
  })

  it('prefers related models from the same provider and modality', () => {
    const model = workshopDetailModels[0]
    const related = relatedWorkshopModels(model)
    expect(related).toHaveLength(4)
    expect(related).not.toContainEqual(model)
    const bestScore =
      Number(related[0].provider === model.provider) * 2 +
      Number(related[0].modality === model.modality)
    for (const candidate of related.slice(1)) {
      const score =
        Number(candidate.provider === model.provider) * 2 +
        Number(candidate.modality === model.modality)
      expect(score).toBeLessThanOrEqual(bestScore)
    }
  })
})
