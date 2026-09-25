import { describe, expect, it } from 'vitest'
import { getRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { runnableCinematicModels } from './models'
import { modelCapabilities } from './model-capabilities'

const models = runnableCinematicModels(getRouterWorkshopModelDetail)
function capabilities(slug: string) {
  return modelCapabilities(
    getRouterWorkshopModelDetail(slug),
    models.find((model) => model.slug === slug)
  )
}
describe('authored model capabilities', () => {
  it('distinguishes Kling quality from pixel resolution and clip length from speed', () => {
    const rows = capabilities('kling--v3--generate-videos')
    expect(rows).toContainEqual({ kind: 'quality', values: ['std', 'pro'] })
    expect(rows).toContainEqual({
      kind: 'duration',
      values: Array.from({ length: 13 }, (_, i) => String(i + 3))
    })
    expect(rows).toContainEqual({ kind: 'audio', values: ['on', 'off'] })
    expect(rows.some((row) => row.kind === 'resolution')).toBe(false)
    expect(rows.find((row) => row.kind === 'inputs')?.values).toEqual(['text'])
  })
  it('shows actual LTX Fast dimensions and does not invent image input support', () => {
    const rows = capabilities('ltx--ltx-2-5-fast--generate-videos')
    expect(rows.find((row) => row.kind === 'resolution')?.values).toContain(
      '2160x3840'
    )
    expect(rows.find((row) => row.kind === 'inputs')?.values).toEqual(['text'])
  })
  it('explains Studio reference editing separately from a text model page', () => {
    expect(
      capabilities('byteplus--seedream-4-5--generate-images')
    ).toContainEqual({ kind: 'references', values: ['10'] })
    expect(
      capabilities('openai--gpt-image-2--generate-images').some(
        (row) => row.kind === 'references'
      )
    ).toBe(false)
  })
  it('does not infer capabilities without a usable definition', () => {
    expect(modelCapabilities(undefined)).toEqual([])
    const model = getRouterWorkshopModelDetail('kling--v3--generate-videos')
    if (!model) throw new Error('Missing Kling model')
    expect(
      modelCapabilities({ ...model, incompleteReason: 'missing-input-schema' })
    ).toEqual([])
  })
})
