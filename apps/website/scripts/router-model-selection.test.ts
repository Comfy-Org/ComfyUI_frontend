// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  authoredWorkshopModels,
  workshopModels
} from '../src/config/workshop-browse-content'
import { isWorkshopModelDisabled } from '../src/config/workshop-model-availability'
import { selectRouterModels } from './router-model-selection'

describe('Router model test selection', () => {
  it('keeps disabled pages out of a default sweep', () => {
    const selected = selectRouterModels({})
    expect(selected).toEqual(
      workshopModels.filter((model) =>
        ['image', 'video', 'audio'].includes(model.modality ?? '')
      )
    )
    expect(selected.some((model) => isWorkshopModelDisabled(model.slug))).toBe(
      false
    )
  })

  it('treats an empty slug list as a default sweep', () => {
    expect(selectRouterModels({ slugs: [] })).toEqual(selectRouterModels({}))
  })

  it('allows an explicitly named disabled authored page to be rechecked', () => {
    const disabled = authoredWorkshopModels.find(
      (model) =>
        isWorkshopModelDisabled(model.slug) &&
        ['image', 'video', 'audio'].includes(model.modality ?? '')
    )
    if (!disabled) throw new Error('Missing disabled media fixture')

    expect(selectRouterModels({ slugs: [disabled.slug] })).toEqual([disabled])
  })

  it('limits a default sweep to the requested media type', () => {
    const selected = selectRouterModels({ modality: 'audio' })

    expect(selected.length).toBeGreaterThan(0)
    expect(selected.every((model) => model.modality === 'audio')).toBe(true)
  })

  it('rejects an unknown explicit page before any generation', () => {
    expect(() =>
      selectRouterModels({ slugs: ['missing--model--generate-images'] })
    ).toThrow('Not an authored media page: missing--model--generate-images')
  })

  it('rejects a default sweep with no published media pages', () => {
    expect(() => selectRouterModels({}, { published: [] })).toThrow(
      'No published media pages selected'
    )
  })
})
