import { describe, expect, it, vi } from 'vitest'

import type { FieldSchema, FieldValue } from './workshop-playground'
import {
  readWorkshopImageMetadata,
  readWorkshopVideoMetadata
} from './workshop-media-metadata'
import { validateWorkshopMediaInputs } from './workshop-media-validation'

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
    maxVideoDurationSeconds: 15.5,
    videoWidthPixels: { minimum: 700, maximum: 4553 }
  }
}

const imageField: FieldSchema = {
  kind: 'text',
  name: 'reference_image',
  label: 'Reference image',
  required: true,
  multiline: false,
  presentation: {
    label: 'Reference image',
    help: '',
    hidden: false,
    advanced: false,
    control: 'media',
    urlUpload: 'image',
    imageAspectRatio: { minimum: 0.39, maximum: 2.5 }
  }
}

function metadata(durationSeconds: number, widthPixels = 1920) {
  return { durationSeconds, widthPixels, heightPixels: 1080 }
}

describe('Workshop media validation', () => {
  it.for([
    { widthPixels: 390, heightPixels: 1000 },
    { widthPixels: 2500, heightPixels: 1000 }
  ])('allows an image at an aspect-ratio boundary', async (size) => {
    vi.mocked(readWorkshopImageMetadata).mockResolvedValue(size)

    await expect(
      validateWorkshopMediaInputs(
        [imageField],
        { reference_image: 'https://media.example/source.png' },
        new AbortController().signal
      )
    ).resolves.toBeUndefined()
  })

  it.for([
    { widthPixels: 389, heightPixels: 1000 },
    { widthPixels: 2501, heightPixels: 1000 }
  ])('rejects an image outside the aspect-ratio range', async (size) => {
    vi.mocked(readWorkshopImageMetadata).mockResolvedValue(size)

    await expect(
      validateWorkshopMediaInputs(
        [imageField],
        { reference_image: 'https://media.example/source.png' },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      stage: 'input_preparation',
      fieldErrors: { reference_image: 'imageAspectRatioOutOfRange' }
    })
  })

  it('attributes an unreadable remote image to its field', async () => {
    const cause = new DOMException(
      'Image metadata unavailable',
      'NotSupportedError'
    )
    vi.mocked(readWorkshopImageMetadata).mockRejectedValue(cause)

    await expect(
      validateWorkshopMediaInputs(
        [imageField],
        { reference_image: 'https://media.example/source.png' },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'client',
      stage: 'input_preparation',
      fieldErrors: { reference_image: 'imageUnreadable' },
      cause
    })
  })

  it.for([4.2, 15.5])('allows a %s-second video', async (duration) => {
    vi.mocked(readWorkshopVideoMetadata).mockResolvedValue(metadata(duration))

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
      vi.mocked(readWorkshopVideoMetadata).mockImplementation(async (input) =>
        metadata(input === source ? 15.501 : 1)
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
    vi.mocked(readWorkshopVideoMetadata)
      .mockResolvedValueOnce(metadata(15.5))
      .mockResolvedValueOnce(metadata(15.501))

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

  it.for([700, 4553])('allows a %s-pixel-wide video', async (width) => {
    vi.mocked(readWorkshopVideoMetadata).mockResolvedValue(metadata(10, width))

    await expect(
      validateWorkshopMediaInputs(
        [videoField],
        { source_video: 'https://media.example/source.mp4' },
        new AbortController().signal
      )
    ).resolves.toBeUndefined()
  })

  it.for([699, 4554])('rejects a %s-pixel-wide video', async (width) => {
    vi.mocked(readWorkshopVideoMetadata).mockResolvedValue(metadata(10, width))

    await expect(
      validateWorkshopMediaInputs(
        [videoField],
        { source_video: 'https://media.example/source.mp4' },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'validation',
      requestId: null,
      stage: 'input_preparation',
      fieldErrors: { source_video: 'videoWidthOutOfRange' }
    })
  })

  it.for(['NotSupportedError', 'TimeoutError'])(
    'preserves a remote metadata %s as a client failure on its field',
    async (name) => {
      const cause = new DOMException('Video metadata unavailable', name)
      vi.mocked(readWorkshopVideoMetadata).mockRejectedValue(cause)

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

  it('asks for a local video to be selected again when metadata is unreadable', async () => {
    const file = new File(['video'], 'private-video.mp4', {
      type: 'video/mp4'
    })
    const cause = new DOMException(
      'Video metadata unavailable',
      'NotSupportedError'
    )
    vi.mocked(readWorkshopVideoMetadata).mockRejectedValue(cause)

    await expect(
      validateWorkshopMediaInputs(
        [videoField],
        {
          source_video: {
            name: file.name,
            size: file.size,
            type: file.type,
            file
          }
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      reason: 'client',
      stage: 'input_preparation',
      fieldErrors: { source_video: 'fileUnreadable' },
      cause
    })
  })

  it('preserves cancellation instead of reporting unreadable media', async () => {
    const pending = Promise.withResolvers<ReturnType<typeof metadata>>()
    vi.mocked(readWorkshopVideoMetadata).mockReturnValue(pending.promise)
    const controller = new AbortController()
    const result = validateWorkshopMediaInputs(
      [videoField],
      { source_video: 'https://media.example/source.mp4' },
      controller.signal
    )
    const reason = new DOMException('Cancelled', 'AbortError')

    controller.abort(reason)
    pending.reject(new DOMException('Decode stopped', 'NotSupportedError'))

    await expect(result).rejects.toBe(reason)
  })

  it.for([
    { name: 'missing', value: undefined },
    { name: 'empty URL', value: '' },
    { name: 'empty file list', value: [] }
  ] satisfies { name: string; value: FieldValue }[])(
    'does not read a $name optional input',
    async ({ value }) => {
      vi.mocked(readWorkshopVideoMetadata).mockRejectedValue(
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
    vi.mocked(readWorkshopVideoMetadata).mockRejectedValue(
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
      fieldErrors: { source_video: 'fileUnreadable' },
      cause: new TypeError('Missing video source')
    })
  })
})
