import { describe, expect, it } from 'vitest'
import { getRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { runnableCinematicModels } from './models'
import {
  modelCapabilities,
  videoDurationGuidance,
  videoModelSummary
} from './model-capabilities'

const models = runnableCinematicModels(getRouterWorkshopModelDetail)
function capabilities(slug: string) {
  return modelCapabilities(
    getRouterWorkshopModelDetail(slug),
    models.find((model) => model.slug === slug)
  )
}
describe('authored model capabilities', () => {
  it('labels the authored automatic duration sentinel without presenting negative seconds', () => {
    expect(
      videoDurationGuidance([{ kind: 'duration', values: ['-1', '5', '10'] }])
    ).toEqual({ supported: 'Auto / 5s / 10s' })
  })
  it('compresses only continuous integer lengths in the quick selector', () => {
    const model = models.find((entry) => entry.video)
    if (!model?.video) throw new Error('Missing video fixture')
    expect(
      videoModelSummary({
        ...model,
        video: { ...model.video, durations: [4, 5, 6, 7, 8] }
      })
    ).toBe('4–8s · Studio starting point: 5s')
    expect(
      videoModelSummary({
        ...model,
        video: { ...model.video, durations: [2, 3, 4, 5, 8] }
      })
    ).toBe('2s / 3s / 4s / 5s / 8s · Studio starting point: 5s')
  })
  it('summarizes video choices without adding clip guidance to image choices', () => {
    const video = models.find((model) => model.video)
    const image = models.find((model) => !model.video)
    if (!video?.video || !image) throw new Error('Missing model fixtures')
    const summary = videoModelSummary(video)
    expect(summary).toContain('Studio starting point:')
    expect(summary).toBe('4–30s · Studio starting point: 5s')
    expect(videoModelSummary(image)).toBeUndefined()
  })
  it('suggests only an authored clip length nearest five seconds, with shorter ties', () => {
    expect(
      videoDurationGuidance([{ kind: 'duration', values: ['10', '4', '6'] }])
    ).toEqual({
      supported: '10s / 4s / 6s',
      suggestedSeconds: 4,
      suggestion: 'Studio starting point: 4s'
    })
    expect(
      videoDurationGuidance([{ kind: 'duration', values: ['8'] }], 'zh-CN')
    ).toEqual({
      supported: '8秒',
      suggestedSeconds: 8,
      suggestion: '工作室建议起点: 8秒'
    })
  })
  it('does not invent a supported starting length from ranges or absent controls', () => {
    expect(
      videoDurationGuidance([{ kind: 'duration', values: ['3–15'] }])
    ).toEqual({ supported: '3–15s' })
    expect(videoDurationGuidance([])).toEqual({
      supported: 'Not specified here — check model page controls'
    })
    expect(
      videoDurationGuidance([{ kind: 'duration', values: ['auto'] }])
    ).toEqual({ supported: 'auto' })
    expect(
      videoDurationGuidance([{ kind: 'duration', values: ['0', '5'] }])
        .suggestedSeconds
    ).toBeUndefined()
  })
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
