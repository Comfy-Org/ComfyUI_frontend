import { describe, expect, it, vi } from 'vitest'

import { workshopExampleFile } from './workshop-example-file'
import { loadWorkshopExampleFile } from './workshop-example-file-loader'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from './workshop-router-content'
import type { FormValues } from './workshop-playground'
import { defaultValues, schemaForModel } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'
import { workshopExampleValues } from './workshop-example-values'
import { createWorkshopUrlUploader } from './workshop-url-upload'

describe('example source images', () => {
  it.for([
    {
      slug: 'luma--photon-1-image-generation--generate-images',
      field: 'image_ref'
    },
    {
      slug: 'luma--photon-flash-1-image-modify--edit-images',
      field: 'modify_image_ref'
    },
    { slug: 'luma_2--uni-1-image-edit--edit-images', field: 'source' },
    { slug: 'luma_2--uni-1-max-image-edit--edit-images', field: 'source' }
  ])(
    'loads the Luma example source into its native nested field: $slug',
    async ({ slug, field }) => {
      const page = getRouterWorkshopModelDetail(slug)
      if (!page?.execution) throw new Error('Missing Luma page')
      const values = defaultValues(schemaForModel(page), page.defaults)
      expect(values.image_url).toMatch(/^https:\/\//)
      const body = await prepareWorkshopRouterInput(
        page.execution,
        values,
        new AbortController().signal
      )
      expect(body[field]).toEqual(
        field === 'image_ref'
          ? [{ url: values.image_url }]
          : { url: values.image_url }
      )
      expect(body).not.toHaveProperty('image_url')
      if (slug.startsWith('luma_2--')) expect(body.type).toBe('image_edit')
      if (field !== 'image_ref') {
        await expect(
          prepareWorkshopRouterInput(
            page.execution,
            { ...values, image_url: undefined },
            new AbortController().signal
          )
        ).rejects.toMatchObject({ fieldErrors: { image_url: 'required' } })
      }
    }
  )
  async function prepareReferenceAssets(slug: string, companionUrl: string) {
    const page = getRouterWorkshopModelDetail(slug)
    if (!page?.execution) throw new Error('Missing Wan page')
    const initialValues = defaultValues(schemaForModel(page), page.defaults)
    const values: FormValues = { ...initialValues, image_url_2: companionUrl }
    const uploaded: string[] = []
    let grants = 0
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (init?.method === 'POST') {
        grants += 1
        return Response.json({
          upload_url: `https://storage.example/upload-${grants}`,
          download_url: `https://storage.example/reference-${grants}.png`
        })
      }
      if (init?.method === 'PUT') {
        if (!(init.body instanceof File)) throw new Error('Missing upload')
        uploaded.push(await init.body.text())
        return new Response(null)
      }
      return new Response(String(url), {
        headers: { 'Content-Type': 'image/png' }
      })
    })
    const uploader = createWorkshopUrlUploader()
    const body = await prepareWorkshopRouterInput(
      page.execution,
      values,
      new AbortController().signal,
      undefined,
      (file, signal) => uploader(file, 'token', 'owner:workspace', signal)
    )
    return { body, primaryUrl: values.image_url, uploaded }
  }

  it('re-hosts the pinned template companion after the primary reference', async () => {
    const companionUrl =
      'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@3db6490611e6a16b84b09110e61a07264ce47cd3/input/reference.png'
    const { body, primaryUrl, uploaded } = await prepareReferenceAssets(
      'wan--reference-to-video-3.0--animate-images',
      companionUrl
    )

    expect(primaryUrl).toMatch(/^https:\/\//)
    expect(body).toMatchObject({
      input: {
        media: [
          { type: 'reference_image', url: primaryUrl },
          {
            type: 'reference_image',
            url: 'https://storage.example/reference-1.png'
          }
        ]
      }
    })
    expect(uploaded).toEqual([companionUrl])
    expect(
      vi.mocked(fetch).mock.calls.map(([url, init]) => ({
        url: String(url),
        method: init?.method,
        credentials: init?.credentials,
        body: init?.body
      }))
    ).toEqual([
      { url: companionUrl, credentials: 'omit' },
      {
        url: expect.stringMatching(/\/customers\/storage$/),
        method: 'POST',
        credentials: 'omit',
        body: expect.any(String)
      },
      {
        url: 'https://storage.example/upload-1',
        method: 'PUT',
        credentials: 'omit',
        body: expect.objectContaining({ type: 'image/png' })
      }
    ])
  })

  it('passes both reference URLs through in order when neither is a template asset', async () => {
    const companionUrl =
      'https://example.com/wan--reference-video-2.7--animate-images.png'
    const { body, primaryUrl, uploaded } = await prepareReferenceAssets(
      'wan--reference-video-2.7--animate-images',
      companionUrl
    )

    expect(primaryUrl).toMatch(/^https:\/\//)
    expect(body).toMatchObject({
      input: {
        media: [
          { type: 'reference_image', url: primaryUrl },
          { type: 'reference_image', url: companionUrl }
        ]
      }
    })
    expect(uploaded).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves all reference images in a native multi-image request, not filenames or URLs as Base64', async () => {
    const page = getRouterWorkshopModelDetail(
      'bfl--flux-2-max--generate-images'
    )
    if (!page?.execution) throw new Error('Missing BFL page')
    vi.mocked(fetch).mockImplementation(
      async (url) =>
        new Response(String(url), {
          headers: { 'Content-Type': 'image/png' }
        })
    )
    const sources = page.defaults.media_image
    if (!Array.isArray(sources)) throw new Error('Missing example images')
    expect(sources).toHaveLength(3)
    const body = await prepareWorkshopRouterInput(
      page.execution,
      defaultValues(schemaForModel(page), page.defaults),
      new AbortController().signal
    )
    expect([body.input_image, body.input_image_2, body.input_image_3]).toEqual(
      sources.map((source) => btoa(source))
    )
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(
      vi
        .mocked(fetch)
        .mock.calls.every(([, init]) => init?.credentials === 'omit')
    ).toBe(true)
  })

  it('rejects invalid or excess example files instead of silently dropping or relabeling them', () => {
    const page = getRouterWorkshopModelDetail(
      'vertexai--gemini-3-pro-image--edit-images'
    )
    if (!page?.execution) throw new Error('Missing Gemini page')
    for (const images of [
      ['https://example.com/one.png', 'https://example.com/video.mp4'],
      ['https://example.com/one.png', 'javascript:alert(1)'],
      Array.from(
        { length: 5 },
        (_, index) => `https://example.com/${index}.png`
      )
    ])
      expect(
        workshopExampleValues(page.execution, { images })
      ).not.toHaveProperty('images')
  })

  it('downloads Veo’s first and last example frames once and sends actual Base64 bytes', async () => {
    const page = getRouterWorkshopModelDetail(
      'vertexai--veo-3-first-last-frame--animate-images'
    )
    if (!page?.execution) throw new Error('Missing Veo page')
    vi.mocked(fetch).mockImplementation(
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
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(
      vi
        .mocked(fetch)
        .mock.calls.every(([, init]) => init?.credentials === 'omit')
    ).toBe(true)
  })

  it('loads an extensionless media URL using its response content type', async () => {
    const source = 'https://example.com/media?id=123'
    vi.mocked(fetch).mockResolvedValue(
      new Response('image bytes', {
        headers: { 'Content-Type': 'image/png' }
      })
    )
    const value = workshopExampleFile(source)
    expect(value).toMatchObject({
      name: 'media',
      type: 'application/octet-stream',
      previewUrl: source,
      sourceUrl: source
    })
    if (!value) throw new Error('Missing example')

    const file = await loadWorkshopExampleFile(
      value,
      new AbortController().signal
    )
    expect(file.name).toBe('media')
    expect(file.type).toBe('image/png')
    await expect(file.text()).resolves.toBe('image bytes')
  })

  it.for([
    {
      reason: 'invalid content type',
      error: 'Invalid example media type',
      source: 'https://example.com/media?id=123',
      response: () =>
        new Response('not an image', {
          headers: { 'Content-Type': 'text/html' }
        })
    },
    {
      reason: 'error status',
      error: 'Example media unavailable or too large',
      response: () => new Response('missing', { status: 404 })
    },
    {
      reason: 'declared size',
      error: 'Example media unavailable or too large',
      response: () =>
        new Response('too large', {
          headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(8 * 1024 * 1024)
          }
        })
    },
    {
      reason: 'actual size',
      error: 'Example media too large',
      response: () =>
        new Response(new Uint8Array(8 * 1024 * 1024), {
          headers: { 'Content-Type': 'image/png' }
        })
    }
  ])(
    'rejects invalid or oversized media before encoding: $reason',
    async ({ response, error, source = 'https://example.com/source.png' }) => {
      vi.mocked(fetch).mockImplementation(async () => response())
      const value = workshopExampleFile(source)
      if (!value) throw new Error('Missing example')
      await expect(
        loadWorkshopExampleFile(value, new AbortController().signal)
      ).rejects.toThrow(error)
    }
  )

  it('does not fetch invalid schemes, credentialed URLs, or after cancellation', async () => {
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
    expect(fetch).not.toHaveBeenCalled()
  })
})
