import { describe, expect, it, vi } from 'vitest'
import { prepareModelRouterRender } from './router-render'
import {
  getAuthoredRouterWorkshopModelDetail,
  getRouterWorkshopModelDetail
} from './workshop-router-content'
import { routerWorkshopModelPaths } from './workshop-browse-content'
import { isWorkshopModelDisabled } from './workshop-model-availability'
import {
  cinematicVideoDescriptor,
  cinematicVideoForm
} from '../lib/workshop/cinematic-studio/video'

const slug = 'ltx--ltx-2-5-fast--generate-videos'
describe('LTX 2.5 Fast authored route', () => {
  it('binds a distinct page to the Fast contract without borrowing Pro media or pricing', () => {
    const model = getAuthoredRouterWorkshopModelDetail(slug)
    expect(model).toMatchObject({
      slug,
      name: 'LTX 2.5 Fast',
      modality: 'video',
      execution: { id: 'ltx/ltx-2-5-fast' },
      examples: []
    })
    expect(model?.thumbnailUrl).toBeUndefined()
    expect(getRouterWorkshopModelDetail(slug)?.execution?.id).toBe(
      'ltx/ltx-2-5-fast'
    )
    expect(routerWorkshopModelPaths).toContain(slug)
    expect(
      getAuthoredRouterWorkshopModelDetail(
        'ltx--text-to-video-v2--generate-videos'
      )?.execution?.id
    ).toBe('ltx/ltx-2-5-pro')
    expect(
      isWorkshopModelDisabled('ltx--text-to-video-v2--generate-videos')
    ).toBe(true)
  })
  it('prepares actual Fast generation through the same model-page Router path', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected network'))
    try {
      const model = getAuthoredRouterWorkshopModelDetail(slug)
      if (!model?.execution) throw new Error('Missing Fast contract')
      const descriptor = cinematicVideoDescriptor(model.execution)
      expect(descriptor).toMatchObject({
        firstFrame: 'unsupported',
        lastFrame: false,
        generateAudio: true
      })
      expect(descriptor?.resolutions).toContain('3840x2160')
      const prepared = await prepareModelRouterRender(
        model,
        {},
        {
          form: cinematicVideoForm(
            model,
            'A slow dolly through a forest',
            '16:9',
            { durationSeconds: 5, resolution: '1280x720', generateAudio: false }
          )
        }
      )
      expect(prepared.routerId).toBe('ltx/ltx-2-5-fast')
      expect(prepared.body).toEqual({
        prompt: 'A slow dolly through a forest',
        duration: 5,
        resolution: '1280x720',
        generate_audio: false,
        fps: 25
      })
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      fetch.mockRestore()
    }
  })
})
