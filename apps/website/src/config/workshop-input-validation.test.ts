import { assert, describe, expect, it, vi } from 'vitest'

import { formForContract } from './workshop-contract'
import { workshopContract } from './workshop-contract-catalog'
import { initialWorkshopPageState } from './workshop-page-state'
import {
  defaultValues,
  schemaForModel,
  validateForm
} from './workshop-playground'
import type { FormValues } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'
import { getAuthoredRouterWorkshopModelDetail } from './workshop-router-content'

const image = { name: 'image.png', size: 1, type: 'image/png' }

function form(slug: string, changes: FormValues) {
  const model = getAuthoredRouterWorkshopModelDetail(slug)
  assert(model?.execution)
  const state = initialWorkshopPageState(model)
  return {
    ...state,
    contract: model.execution,
    values: { ...state.values, ...changes }
  }
}

describe('production input validation regressions', () => {
  it.for([
    {
      first_frame: undefined,
      last_frame: image,
      reference_images: undefined,
      errors: { first_frame: 'required' }
    },
    {
      first_frame: image,
      last_frame: undefined,
      reference_images: [image],
      errors: { reference_images: 'incompatible' }
    },
    {
      first_frame: undefined,
      last_frame: undefined,
      reference_images: [image],
      errors: {}
    },
    { first_frame: image, last_frame: [], reference_images: [], errors: {} }
  ])(
    'validates generic Veo frame combinations before encoding',
    async ({ errors, ...inputs }) => {
      const contract = workshopContract('veo/veo-3.1-generate-001')
      assert(contract)
      const schema = schemaForModel({
        fields: [],
        form: formForContract(contract)
      })
      const values = {
        ...defaultValues(schema),
        prompt: 'A landscape',
        ...inputs
      }
      expect(validateForm(schema, values)).toEqual(errors)
      if (!Object.keys(errors).length) return
      const encode = vi.fn()
      await expect(
        prepareWorkshopRouterInput(
          contract,
          values,
          new AbortController().signal,
          encode
        )
      ).rejects.toMatchObject({ reason: 'validation', fieldErrors: errors })
      expect(encode).not.toHaveBeenCalled()
    }
  )

  it('requires a single source image for Seedream layers', () => {
    const { schema, values } = form('byteplus--seedream-5-pro--edit-images', {
      layer_decomposition: true,
      size: '2K',
      images: [image, image]
    })
    expect(validateForm(schema, values)).toEqual({ images: 'incompatible' })
    expect(
      validateForm(schema, { ...values, layer_decomposition: false })
    ).toEqual({})
  })
  it('requires a first frame on the Veo first/last page without offering reference images', () => {
    const { schema, values } = form(
      'vertexai--veo-3-first-last-frame--animate-images',
      {
        first_frame: undefined,
        last_frame: image
      }
    )
    expect(validateForm(schema, values)).toMatchObject({
      first_frame: 'required'
    })
    expect(schema.some((field) => field.name === 'reference_images')).toBe(
      false
    )
    expect(validateForm(schema, { ...values, first_frame: image })).toEqual({})
  })

  it.for([10, 11, 15])(
    'limits classic Grok reference duration at %s seconds before uploading',
    async (duration) => {
      const { schema, values, contract } = form(
        'xai--grok-imagine-video-reference--animate-images',
        { duration }
      )
      const errors = validateForm(schema, values)
      expect(errors).toEqual(duration <= 10 ? {} : { duration: 'badOption' })
      if (duration <= 10) return
      const upload = vi.fn()
      await expect(
        prepareWorkshopRouterInput(
          contract,
          values,
          new AbortController().signal,
          undefined,
          upload
        )
      ).rejects.toMatchObject({
        reason: 'validation',
        fieldErrors: { duration: 'badOption' }
      })
      expect(upload).not.toHaveBeenCalled()
    }
  )

  it.for([
    { layer_decomposition: true, size: '1024x1024', invalid: true },
    { layer_decomposition: true, size: 'auto', invalid: false },
    { layer_decomposition: true, size: '1.5K', invalid: false },
    { layer_decomposition: true, size: '2K', invalid: false },
    { layer_decomposition: false, size: '1024x1024', invalid: false },
    { layer_decomposition: false, size: 'auto', invalid: true },
    { layer_decomposition: false, size: '1.5K', invalid: true }
  ])(
    'validates Seedream size $size with separate layers=$layer_decomposition',
    ({ layer_decomposition, size, invalid }) => {
      const { schema, values } = form('byteplus--seedream-5-pro--edit-images', {
        layer_decomposition,
        size,
        images: [image]
      })
      expect(validateForm(schema, values)).toEqual(
        invalid ? { size: 'incompatible' } : {}
      )
    }
  )
})
