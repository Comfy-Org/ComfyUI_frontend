import { describe, expect, it, vi } from 'vitest'

import { readWorkshopVideoDuration } from './workshop-media-metadata'
import { validateWorkshopMediaInputs } from './workshop-media-validation'
import type { FieldSchema, FieldValue } from './workshop-playground'

vi.mock(import('./workshop-media-metadata'))

const videoField: FieldSchema = {
  kind: 'text',
  name: 'source_video',
  label: 'Source video',
  required: false,
  multiline: false,
  presentation: {
    label: 'Source video',
    help: '',
    hidden: false,
    advanced: false,
    control: 'media',
    urlUpload: 'video',
    maxVideoDurationSeconds: 15.5
  }
}

describe('Workshop media validation', () => {
  it.for([4.2, 15.5])('allows a %s-second video', async (duration) => {
    vi.mocked(readWorkshopVideoDuration).mockResolvedValue(duration)

    await expect(
      validateWorkshopMediaInputs(
        [videoField],
        { source_video: 'https://media.example/source.mp4' },
        new AbortController().signal
      )
    ).resolves.toBeUndefined()
  })

  it.for([
    {
      name: 'URL text',
      create: () => ({
        value: 'https://media.example/too-long.mp4',
        source: 'https://media.example/too-long.mp4'
      })
    },
    {
      name: 'local file',
      create: () => {
        const file = new File(['video'], 'private-video.mp4', {
          type: 'video/mp4'
        })
        return {
          value: {
            name: file.name,
            size: file.size,
            type: file.type,
            file,
            sourceUrl: 'https://media.example/old-video.mp4'
          },
          source: file
        }
      }
    },
    {
      name: 'remote file',
      create: () => ({
        value: {
          name: 'example.mp4',
          size: 100,
          type: 'video/mp4',
          sourceUrl: 'https://media.example/example.mp4'
        },
        source: 'https://media.example/example.mp4'
      })
    },
    {
      name: 'inline file',
      create: () => ({
        value: {
          name: 'example.mp4',
          size: 1,
          type: 'video/mp4',
          sourceDataUrl: 'data:video/mp4;base64,AA=='
        },
        source: 'data:video/mp4;base64,AA=='
      })
    }
  ] satisfies {
    name: string
    create: () => { value: FieldValue; source: File | string }
  }[])(
    'rejects a $name just over the configured duration',
    async ({ create }) => {
      const { value, source } = create()
      vi.mocked(readWorkshopVideoDuration).mockImplementation(async (input) =>
        input === source ? 15.501 : 1
      )

      await expect(
        validateWorkshopMediaInputs(
          [videoField],
          { source_video: value },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        reason: 'validation',
        requestId: null,
        stage: 'input_preparation',
        fieldErrors: { source_video: 'videoTooLong' }
      })
    }
  )

  it('checks later files in a multiple-video input', async () => {
    vi.mocked(readWorkshopVideoDuration)
      .mockResolvedValueOnce(15.5)
      .mockResolvedValueOnce(15.501)

    await expect(
      validateWorkshopMediaInputs(
        [videoField],
        {
          source_video: [
            {
              name: 'short.mp4',
              size: 1,
              type: 'video/mp4',
              sourceUrl: 'https://media.example/short.mp4'
            },
            {
              name: 'long.mp4',
              size: 1,
              type: 'video/mp4',
              sourceUrl: 'https://media.example/long.mp4'
            }
          ]
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      fieldErrors: { source_video: 'videoTooLong' }
    })
  })

  it.for(['NotSupportedError', 'TimeoutError'])(
    'preserves a metadata %s as a client failure on its field',
    async (name) => {
      const cause = new DOMException('Video metadata unavailable', name)
      vi.mocked(readWorkshopVideoDuration).mockRejectedValue(cause)

      await expect(
        validateWorkshopMediaInputs(
          [videoField],
          { source_video: 'https://media.example/source.mp4' },
          new AbortController().signal
        )
      ).rejects.toMatchObject({
        reason: 'client',
        requestId: null,
        stage: 'input_preparation',
        fieldErrors: { source_video: 'videoUnreadable' },
        cause
      })
    }
  )

  it('preserves cancellation instead of reporting unreadable media', async () => {
    const metadata = Promise.withResolvers<number>()
    vi.mocked(readWorkshopVideoDuration).mockReturnValue(metadata.promise)
    const controller = new AbortController()
    const result = validateWorkshopMediaInputs(
      [videoField],
      { source_video: 'https://media.example/source.mp4' },
      controller.signal
    )
    const reason = new DOMException('Cancelled', 'AbortError')

    controller.abort(reason)
    metadata.reject(new DOMException('Decode stopped', 'NotSupportedError'))

    await expect(result).rejects.toBe(reason)
  })

  it.for([
    { name: 'missing', value: undefined },
    { name: 'empty URL', value: '' },
    { name: 'empty file list', value: [] }
  ] satisfies { name: string; value: FieldValue }[])(
    'does not read a $name optional input',
    async ({ value }) => {
      vi.mocked(readWorkshopVideoDuration).mockRejectedValue(
        new Error('Unexpected metadata read')
      )

      await expect(
        validateWorkshopMediaInputs(
          [videoField],
          { source_video: value },
          new AbortController().signal
        )
      ).resolves.toBeUndefined()
    }
  )

  it('does not read inputs without a declared duration limit', async () => {
    vi.mocked(readWorkshopVideoDuration).mockRejectedValue(
      new Error('Unexpected metadata read')
    )

    await expect(
      validateWorkshopMediaInputs(
        [{ ...videoField, presentation: undefined }],
        { source_video: 'https://media.example/source.mp4' },
        new AbortController().signal
      )
    ).resolves.toBeUndefined()
  })

  it('identifies a file whose source is no longer available', async () => {
    await expect(
      validateWorkshopMediaInputs(
        [videoField],
        { source_video: { name: 'lost.mp4', type: 'video/mp4', size: 100 } },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'client',
      fieldErrors: { source_video: 'videoUnreadable' },
      cause: new TypeError('Missing video source')
    })
  })
})
