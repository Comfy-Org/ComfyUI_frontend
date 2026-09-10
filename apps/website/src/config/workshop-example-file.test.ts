import { describe, expect, it, vi } from 'vitest'

import {
  loadWorkshopExampleFile,
  workshopExampleFile
} from './workshop-example-file'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { defaultValues, schemaForModel } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'

describe('example source images', () => {
  it('downloads Veo’s first and last example frames once and sends actual Base64 bytes', async () => {
    const page = getRouterWorkshopModelDetail(
      'vertexai--veo-3-first-last-frame--animate-images'
    )
    if (!page?.execution) throw new Error('Missing Veo page')
    const fetchImage = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (url) =>
          new Response(
            String(url).includes('1.1.png') ? 'first frame' : 'last frame',
            { headers: { 'Content-Type': 'image/png' } }
          )
      )
    const values = defaultValues(schemaForModel(page), page.defaults)
    expect(values.first_frame).toMatchObject({
      sourceUrl: expect.stringContaining('1.1.png')
    })
    expect(values.last_frame).toMatchObject({
      sourceUrl: expect.stringContaining('1.2.png')
    })
    const prepare = () =>
      prepareWorkshopRouterInput(
        page.execution,
        values,
        new AbortController().signal
      )
    expect(await prepare()).toMatchObject({
      instances: [
        {
          image: {
            bytesBase64Encoded: btoa('first frame'),
            mimeType: 'image/png'
          },
          lastFrame: {
            bytesBase64Encoded: btoa('last frame'),
            mimeType: 'image/png'
          }
        }
      ]
    })
    await prepare()
    expect(fetchImage).toHaveBeenCalledTimes(2)
    expect(
      fetchImage.mock.calls.every(([, init]) => init?.credentials === 'omit')
    ).toBe(true)
  })

  it.for([
    {
      response: () =>
        new Response('not an image', {
          headers: { 'Content-Type': 'text/html' }
        })
    },
    { response: () => new Response('missing', { status: 404 }) },
    {
      response: () =>
        new Response('too large', {
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(8 * 1024 * 1024)
          }
        })
    },
    {
      response: () =>
        new Response(new Uint8Array(8 * 1024 * 1024), {
          headers: { 'Content-Type': 'image/png' }
        })
    }
  ])(
    'rejects invalid or oversized media before encoding',
    async ({ response }) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response())
      const value = workshopExampleFile('https://example.com/source.png')
      if (!value) throw new Error('Missing example')
      await expect(
        loadWorkshopExampleFile(value, new AbortController().signal)
      ).rejects.toThrow()
    }
  )

  it('does not fetch invalid schemes, credentialed URLs, or after cancellation', async () => {
    const fetchImage = vi.spyOn(globalThis, 'fetch')
    for (const url of [
      'file:///source.png',
      'javascript:alert(1)',
      'https://user:password@example.com/image.png'
    ])
      expect(workshopExampleFile(url)).toBeUndefined()
    const value = workshopExampleFile('https://example.com/source.png')
    if (!value) throw new Error('Missing example')
    const controller = new AbortController()
    controller.abort()
    await expect(
      loadWorkshopExampleFile(value, controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchImage).not.toHaveBeenCalled()
  })
})
