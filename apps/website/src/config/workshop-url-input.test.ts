import { describe, expect, it, vi } from 'vitest'

import { workshopContract } from './workshop-contract-catalog'
import { prepareWorkshopRouterInput } from './workshop-request'
import { defaultValues, schemaForModel } from './workshop-playground'
import type { FileValue, FormValues } from './workshop-playground'
import { formForContract } from './workshop-contract'

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

  it('passes existing URLs unchanged and encodes Base64 image arrays without contacting storage', async () => {
    const upload = vi.fn()
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
    const base64Model = setup('vertexai/gemini-3-pro-image')
    const body = await prepareWorkshopRouterInput(
      base64Model.contract,
      {
        ...base64Model.values,
        prompt: 'Combine images',
        images: [
          selected('first'),
          selected('second', 'image.jpg', 'image/jpeg')
        ]
      },
      base64Model.signal,
      undefined,
      upload
    )
    expect(body).toMatchObject({
      contents: [
        {
          parts: [
            { text: 'Combine images' },
            { inlineData: { data: btoa('first'), mimeType: 'image/png' } },
            { inlineData: { data: btoa('second'), mimeType: 'image/jpeg' } }
          ]
        }
      ]
    })
    expect(upload).not.toHaveBeenCalled()
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
})
