import { assert, describe, expect, it, vi } from 'vitest'

import { workshopContract } from './workshop-contract-catalog'
import { prepareWorkshopRouterInput } from './workshop-request'
import { defaultValues, schemaForModel } from './workshop-playground'
import type { FileValue, FormValues } from './workshop-playground'
import { formForContract } from './workshop-contract'
import {
  WorkshopRouterError,
  workshopResponseDetails
} from './workshop-router-errors'

function selected(
  bytes: string,
  name = 'image.png',
  type = 'image/png'
): FileValue {
  const file = new File([bytes], name, { type })
  return { file, name, type, size: file.size }
}

function setup(id: string) {
  const contract = workshopContract(id)
  if (!contract) throw new Error(`Missing fixture ${id}`)
  const fields = schemaForModel({ fields: [], form: formForContract(contract) })
  return {
    contract,
    values: defaultValues(fields),
    signal: new AbortController().signal
  }
}

describe('URL and Base64 request inputs', () => {
  it('uploads distinct reference images and preserves their order in the nested Qwen body', async () => {
    const { contract, values, signal } = setup('qwen/qwen-image-3.0')
    const upload = vi.fn(
      async (file: File) => `https://storage.example/${await file.text()}.png`
    )
    const first = selected('first')
    const second = selected('second')
    const input: FormValues = {
      ...values,
      prompt: 'Combine both images',
      image_url: first,
      image_url_2: second
    }
    const body = await prepareWorkshopRouterInput(
      contract,
      input,
      signal,
      undefined,
      upload
    )
    expect(body).toMatchObject({
      input: {
        messages: [
          {
            content: [
              { image: 'https://storage.example/first.png' },
              { image: 'https://storage.example/second.png' },
              { text: 'Combine both images' }
            ]
          }
        ]
      }
    })
    expect(upload).toHaveBeenCalledTimes(2)
    expect(input.image_url).toBe(first)
    expect(input.image_url_2).toBe(second)
  })

  it('passes URL inputs unchanged and uploads Gemini image arrays once', async () => {
    const upload = vi.fn(
      async (file: File) => `https://storage.example/${await file.text()}.png`
    )
    const urlModel = setup('wavespeed/seedvr2')
    expect(
      await prepareWorkshopRouterInput(
        urlModel.contract,
        { ...urlModel.values, image: 'https://example.com/source.png' },
        urlModel.signal,
        undefined,
        upload
      )
    ).toMatchObject({ image: 'https://example.com/source.png' })
    expect(upload).not.toHaveBeenCalled()
    const geminiModel = setup('vertexai/gemini-3-pro-image')
    const body = await prepareWorkshopRouterInput(
      geminiModel.contract,
      {
        ...geminiModel.values,
        prompt: 'Combine images',
        images: [
          selected('first'),
          selected('second', 'image.jpg', 'image/jpeg')
        ]
      },
      geminiModel.signal,
      undefined,
      upload
    )
    expect(body).toMatchObject({
      contents: [
        {
          parts: [
            { text: 'Combine images' },
            {
              fileData: {
                fileUri: 'https://storage.example/first.png',
                mimeType: 'image/png'
              }
            },
            {
              fileData: {
                fileUri: 'https://storage.example/second.png',
                mimeType: 'image/jpeg'
              }
            }
          ]
        }
      ]
    })
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('preflights every URL file before starting uploads, using real file MIME rather than metadata', async () => {
    const { contract, values, signal } = setup('qwen/qwen-image-3.0')
    const upload = vi.fn()
    await expect(
      prepareWorkshopRouterInput(
        contract,
        {
          ...values,
          prompt: 'Combine',
          image_url: selected('valid'),
          image_url_2: {
            ...selected('video', 'video.mp4', 'video/mp4'),
            type: 'image/png'
          }
        },
        signal,
        undefined,
        upload
      )
    ).rejects.toMatchObject({ fieldErrors: { image_url_2: 'badType' } })
    expect(upload).not.toHaveBeenCalled()
  })

  it('reports upload failure on its field and never substitutes Base64 into a URL input', async () => {
    const { contract, values, signal } = setup('wavespeed/seedvr2')
    for (const upload of [
      undefined,
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      vi.fn().mockResolvedValue(btoa('image'))
    ]) {
      await expect(
        prepareWorkshopRouterInput(
          contract,
          { ...values, image: selected('image') },
          signal,
          undefined,
          upload
        )
      ).rejects.toMatchObject({ fieldErrors: { image: 'uploadFailed' } })
    }
  })

  it('applies the request-size limit to URLs, not the uploaded file bytes', async () => {
    const { contract, values, signal } = setup('wavespeed/seedvr2')
    const file = new File([new Uint8Array(11 * 1024 * 1024)], 'large.png', {
      type: 'image/png'
    })
    const upload = vi
      .fn()
      .mockResolvedValue('https://storage.example/large.png')
    const body = await prepareWorkshopRouterInput(
      contract,
      {
        ...values,
        image: { file, name: file.name, size: file.size, type: file.type }
      },
      signal,
      undefined,
      upload
    )
    expect(body.image).toBe('https://storage.example/large.png')
    await expect(
      prepareWorkshopRouterInput(
        contract,
        {
          ...values,
          image: [selected('first'), selected('second')]
        },
        signal,
        undefined,
        upload
      )
    ).rejects.toMatchObject({ fieldErrors: { image: 'rejected' } })
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('keeps cancellation distinct from upload failure and does not upload remaining images', async () => {
    const { contract, values } = setup('qwen/qwen-image-3.0')
    const controller = new AbortController()
    const upload = vi.fn(async () => {
      controller.abort()
      return 'https://storage.example/first.png'
    })
    await expect(
      prepareWorkshopRouterInput(
        contract,
        {
          ...values,
          prompt: 'Combine',
          image_url: selected('first'),
          image_url_2: selected('second')
        },
        controller.signal,
        undefined,
        upload
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it.for(['NotReadableError', 'NotFoundError', 'SecurityError'])(
    'identifies an unreadable URL input after a failed PUT: %s',
    async (name) => {
      const { contract, values, signal } = setup('wavespeed/seedvr2')
      const image = selected('image')
      assert.instanceOf(image.file, File)
      const sample = new Blob(['i'])
      const cause = new DOMException('Private file detail', name)
      vi.spyOn(image.file, 'slice').mockReturnValue(sample)
      vi.spyOn(sample, 'arrayBuffer').mockRejectedValue(cause)
      const upload = vi
        .fn()
        .mockRejectedValue(
          new WorkshopRouterError('upload', null, {}, undefined, 'upload_put')
        )

      await expect(
        prepareWorkshopRouterInput(
          contract,
          { ...values, image },
          signal,
          undefined,
          upload
        )
      ).rejects.toMatchObject({
        reason: 'client',
        stage: 'file_read',
        fieldErrors: { image: 'fileUnreadable' },
        cause
      })
    }
  )

  it('keeps a failed PUT classified as an upload error when the file is readable', async () => {
    const { contract, values, signal } = setup('wavespeed/seedvr2')
    const upload = vi
      .fn()
      .mockRejectedValue(
        new WorkshopRouterError('upload', null, {}, undefined, 'upload_put')
      )

    await expect(
      prepareWorkshopRouterInput(
        contract,
        { ...values, image: selected('image') },
        signal,
        undefined,
        upload
      )
    ).rejects.toMatchObject({
      reason: 'upload',
      stage: 'upload_put',
      fieldErrors: { image: 'uploadFailed' }
    })
  })

  it.for([
    { stage: 'upload_grant', response: undefined },
    {
      stage: 'upload_put',
      response: workshopResponseDetails(new Response(null, { status: 403 }))
    }
  ] as const)(
    'does not mask an explicit service failure at $stage with a file error',
    async ({ stage, response }) => {
      const { contract, values, signal } = setup('wavespeed/seedvr2')
      const image = selected('image')
      assert.instanceOf(image.file, File)
      const sample = new Blob(['i'])
      vi.spyOn(image.file, 'slice').mockReturnValue(sample)
      vi.spyOn(sample, 'arrayBuffer').mockRejectedValue(
        new DOMException('Gone', 'NotFoundError')
      )
      const upload = vi
        .fn()
        .mockRejectedValue(
          new WorkshopRouterError('upload', 'request-id', {}, response, stage)
        )

      await expect(
        prepareWorkshopRouterInput(
          contract,
          { ...values, image },
          signal,
          undefined,
          upload
        )
      ).rejects.toMatchObject({
        reason: 'upload',
        requestId: 'request-id',
        stage,
        response,
        fieldErrors: { image: 'uploadFailed' }
      })
    }
  )

  it('preserves cancellation while checking an unreadable upload', async () => {
    const { contract, values } = setup('wavespeed/seedvr2')
    const controller = new AbortController()
    const image = selected('image')
    assert.instanceOf(image.file, File)
    const sample = new Blob(['i'])
    vi.spyOn(image.file, 'slice').mockReturnValue(sample)
    vi.spyOn(sample, 'arrayBuffer').mockImplementation(async () => {
      controller.abort()
      throw new DOMException('Gone', 'NotFoundError')
    })
    const upload = vi
      .fn()
      .mockRejectedValue(
        new WorkshopRouterError('upload', null, {}, undefined, 'upload_put')
      )

    await expect(
      prepareWorkshopRouterInput(
        contract,
        { ...values, image },
        controller.signal,
        undefined,
        upload
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
