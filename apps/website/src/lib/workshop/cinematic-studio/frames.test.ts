import { describe, expect, it } from 'vitest'

import { resolveModelRouterRender } from '@/config/router-render'
import { getAuthoredRouterWorkshopModelDetail } from '@/config/workshop-router-content'
import {
  contractAspects,
  frameParameters,
  frameSize,
  nearestAspect,
  referenceCapacity,
  watermarksOff
} from './frames'
import type { CinematicModel } from './models'
import { shotAspects, takesReferences } from './models'

function contract(slug: string) {
  const execution = getAuthoredRouterWorkshopModelDetail(slug)?.execution
  if (!execution) throw new Error(`Missing ${slug}`)
  return execution
}

const SEEDREAM = 'byteplus--seedream-4-5--generate-images'
const GPT_IMAGE = 'openai--gpt-image-2--generate-images'
const RECRAFT = 'recraft--v4.1-text-to-image--generate-images'
const KREA = 'krea--krea-2-large--generate-images'
const FLUX = 'bfl--flux-2-pro--generate-images'

describe('contractAspects', () => {
  it('offers every frame to a model with free width and height', () => {
    expect(contractAspects(contract(FLUX))).toHaveLength(7)
  })

  it('hides the frames a size menu cannot make', () => {
    expect(contractAspects(contract(GPT_IMAGE))).toEqual([
      '16:9',
      '3:2',
      '2:3',
      '1:1',
      '9:16'
    ])
  })

  it('counts a listed size within a few percent of a frame as that frame', () => {
    expect(contractAspects(contract(RECRAFT))).toContain('16:9')
    expect(contractAspects(contract(KREA))).toContain('21:9')
    expect(contractAspects(contract(RECRAFT))).not.toContain('4:3')
  })
})

describe('frameSize', () => {
  it('asks for a size of the chosen shape, not the nearest pixel count', () => {
    expect(frameSize(contract(SEEDREAM), '1:1', 1024)).toEqual({
      size: '2048x2048'
    })
    expect(frameSize(contract(SEEDREAM), '16:9', 2048)).toEqual({
      size: '2560x1440'
    })
  })

  it('sends that size through the real parameter mapper', () => {
    const detail = getAuthoredRouterWorkshopModelDetail(RECRAFT)!
    const { values } = resolveModelRouterRender(
      detail,
      frameParameters(detail.execution, '16:9', 2048)
    )
    expect(values.size).toBe('1344x768')
  })

  it('leaves free-size models to the Router mapping', () => {
    expect(frameSize(contract(FLUX), '21:9', 2048)).toBeUndefined()
  })
})

describe('referenceCapacity', () => {
  it('reads how many reference images a contract takes', () => {
    expect(referenceCapacity(contract(FLUX))).toBeGreaterThan(1)
    expect(referenceCapacity(contract(GPT_IMAGE))).toBe(0)
  })
})

describe('nearestAspect', () => {
  it('keeps a frame the model can make', () => {
    expect(nearestAspect('21:9', ['21:9', '1:1'])).toBe('21:9')
  })

  it('moves to the closest shape the model can make', () => {
    expect(nearestAspect('21:9', ['16:9', '1:1', '9:16'])).toBe('16:9')
    expect(nearestAspect('4:3', ['3:2', '1:1'])).toBe('3:2')
  })
})

describe('studio model rules', () => {
  const model: CinematicModel = {
    slug: 'a',
    name: 'A',
    provider: 'P',
    logo: '',
    referenceSlug: 'a-edit',
    referenceMax: 1,
    aspects: ['21:9', '16:9'],
    referenceAspects: ['16:9']
  }

  it('takes the reference operation frames once references are attached', () => {
    expect(shotAspects(model, false)).toEqual(['21:9', '16:9'])
    expect(shotAspects(model, true)).toEqual(['16:9'])
  })

  it('refuses more references than the operation takes', () => {
    expect(takesReferences(model, 1)).toBe(true)
    expect(takesReferences(model, 2)).toBe(false)
    expect(takesReferences({ ...model, referenceSlug: undefined }, 1)).toBe(
      false
    )
    expect(takesReferences(undefined, 0)).toBe(true)
  })
})

describe('watermarksOff', () => {
  it('turns off every watermark switch a contract has', () => {
    expect(
      watermarksOff(contract('byteplus--seedream-5-pro--generate-images'))
    ).toEqual({ watermark: false })
    expect(
      watermarksOff(contract('byteplus--seedream-5-pro--edit-images'))
    ).toEqual({ watermark: false })
    expect(
      watermarksOff(
        contract('qwen--qwen-image-3.0-text-to-image--generate-images')
      )
    ).toEqual({ param_watermark: false })
  })

  it('leaves models without one alone', () => {
    expect(watermarksOff(contract(FLUX))).toBeUndefined()
  })

  it('reaches the Router body through the real parameter mapper', () => {
    const detail = getAuthoredRouterWorkshopModelDetail(
      'byteplus--seedream-5-pro--generate-images'
    )!
    const frame = frameParameters(detail.execution, '16:9', 2048)
    const { values } = resolveModelRouterRender(detail, {
      ...frame,
      model_specific: {
        ...frame.model_specific,
        ...watermarksOff(detail.execution)
      }
    })
    expect(values.watermark).toBe(false)
    expect(values.size).toBe('1920x1080')
  })
})
