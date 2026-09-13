import { expect, it, vi } from 'vitest'

import { prepareModelRouterRender } from '../src/config/router-render'
import { loadWorkshopExampleFile } from '../src/config/workshop-example-file'
import { getRouterWorkshopModelDetail } from '../src/config/workshop-router-content'
import { prepareWorkshopRequestCallback } from '../src/config/workshop-request-callbacks'

vi.mock(
  import('../src/config/workshop-example-file'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    loadWorkshopExampleFile: vi.fn()
  })
)

it.for([{}, { image_url: 'https://example.com/still.png' }])(
  'rejects an edit without source video even when an image is present',
  (images) => {
    expect(() =>
      prepareWorkshopRequestCallback(
        {
          kind: 'callback',
          callback: 'gemini-video',
          options: { mode: 'edit' }
        },
        { values: { input: 'Edit the scene', ...images }, files: {} }
      )
    ).toThrow(
      expect.objectContaining({
        reason: 'validation',
        fieldErrors: { video: 'required' }
      })
    )
  }
)

it.for([
  'gemini--omni-1.1-flash--edit-videos',
  'gemini--omni-flash-preview--edit-videos'
])(
  'sends source video bytes for initial and standard inputs to %s',
  async (slug) => {
    const model = getRouterWorkshopModelDetail(slug)
    if (!model) throw new Error(`Unknown model ${slug}`)
    const clip = new File([new Uint8Array([0, 1, 255, 34])], 'clip.mp4', {
      type: 'video/mp4'
    })
    vi.mocked(loadWorkshopExampleFile).mockResolvedValue(clip)
    const uploadFile = vi.fn(async () => 'https://example.com/stored.mp4')
    const initial = await prepareModelRouterRender(model, {}, { uploadFile })
    expect(initial.body).toMatchObject({
      input: [
        { type: 'text', text: initial.values.input },
        { type: 'video', data: 'AAH/Ig==', mime_type: 'video/mp4' }
      ],
      generation_config: { video_config: { task: 'edit' } }
    })
    expect(initial.body).not.toHaveProperty('input.1.uri')
    expect(loadWorkshopExampleFile).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: expect.any(String) }),
      expect.any(AbortSignal)
    )
    const supplied = await prepareModelRouterRender(
      model,
      { source_videos: [clip] },
      { uploadFile }
    )
    expect(supplied.body).toEqual(initial.body)
    expect(uploadFile).not.toHaveBeenCalled()
  }
)
