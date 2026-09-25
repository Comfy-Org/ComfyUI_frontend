import { describe, expect, it } from 'vitest'
import { prepareModelRouterRender } from '../../../config/router-render'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { runnableCinematicModels } from './models'
import { cinematicVideoForm, videoResolutionsForAspect } from './video'
import {
  buildMotionComparison,
  motionComparisonModels
} from './motion-comparison'

const models = runnableCinematicModels(getAuthoredRouterWorkshopModelDetail)
const choices = motionComparisonModels(models)
const file = new File(
  [
    Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
      ),
      (char) => char.charCodeAt(0)
    )
  ],
  'frame.png',
  { type: 'image/png' }
)
const source = {
  file,
  url: 'blob:frame',
  name: 'Source frame',
  id: 'source-id'
}
function input(model = choices[0]) {
  if (!model.video) throw new Error('Missing video descriptor')
  return {
    model,
    source,
    action: 'The lantern flickers.',
    movements: ['locked', 'push-in'] as const,
    aspect: '16:9' as const,
    durationSeconds: model.video.defaultDuration,
    resolution: videoResolutionsForAspect(model.video, '16:9')[0],
    generateAudio: false
  }
}
describe('motion comparisons', () => {
  it('uses distinct direction prompts and freezes the reviewed payload', () => {
    const payload = buildMotionComparison(input())
    expect(payload.clips).toHaveLength(2)
    expect(payload.clips[0].prompt).toContain('camera locked')
    expect(payload.clips[0].prompt).not.toContain('dolly-in')
    expect(payload.clips[1].prompt).toContain('dolly-in')
    expect(
      payload.clips.every((clip) =>
        clip.prompt.includes('The lantern flickers.')
      )
    ).toBe(true)
    expect(payload.sourceFile).toBe(file)
    expect(payload.sourceId).toBe(source.id)
    expect(payload.seed).toBeUndefined()
    expect(Object.isFrozen(payload)).toBe(true)
    expect(Object.isFrozen(payload.clips)).toBe(true)
    expect(Object.isFrozen(payload.clips[0])).toBe(true)
  })
  it('rejects duplicates, excess directions, unsupported inputs and seed', () => {
    expect(() =>
      buildMotionComparison({ ...input(), movements: ['locked', 'locked'] })
    ).toThrow()
    expect(() =>
      buildMotionComparison({
        ...input(),
        movements: ['locked', 'push-in', 'pull-out', 'crane-up']
      })
    ).toThrow()
    expect(() =>
      buildMotionComparison({ ...input(), durationSeconds: 999 })
    ).toThrow()
    expect(() =>
      buildMotionComparison({ ...input(), model: models[0] })
    ).toThrow()
    expect(() => buildMotionComparison({ ...input(), seed: NaN })).toThrow()
    expect(() => buildMotionComparison({ ...input(), action: '' })).toThrow()
    expect(() =>
      buildMotionComparison({
        ...input(),
        source: {
          ...source,
          file: new File(['video'], 'clip.mp4', { type: 'video/mp4' })
        }
      })
    ).toThrow()
  })
  it.for(choices)(
    'prepares every clip using the admitted $slug Router contract',
    async (model) => {
      const detail = getAuthoredRouterWorkshopModelDetail(model.slug)
      if (!detail) throw new Error('Missing bundled model')
      const payload = buildMotionComparison(input(model))
      for (const clip of payload.clips) {
        const form = cinematicVideoForm(detail, clip.prompt, payload.aspect, {
          durationSeconds: payload.durationSeconds,
          resolution: payload.resolution,
          generateAudio: payload.generateAudio,
          firstFrame: payload.sourceFile
        })
        const prepared = await prepareModelRouterRender(
          detail,
          {},
          { form, uploadFile: async () => 'https://example.com/source.png' }
        )
        const body = JSON.stringify(prepared.body)
        expect(body).toContain(clip.prompt.replace(/\n/g, '\\n'))
        expect(body).toContain('https://example.com/source.png')
      }
    }
  )
  it('keeps a supported seed shared and excludes all text-only models', () => {
    const model = choices.find((candidate) => candidate.seed)
    if (!model) throw new Error('Missing seeded model')
    expect(buildMotionComparison({ ...input(model), seed: 42 }).seed).toBe(42)
    expect(choices).toHaveLength(5)
    expect(
      choices.every(
        (candidate) => candidate.video?.firstFrame !== 'unsupported'
      )
    ).toBe(true)
  })
})
