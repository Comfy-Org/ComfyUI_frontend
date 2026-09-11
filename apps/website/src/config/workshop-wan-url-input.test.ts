import { describe, expect, it, vi } from 'vitest'

import { prepareModelRouterRender, router_render } from './router-render'
import { initialWorkshopPageState } from './workshop-page-state'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { createWorkshopUrlUploader } from './workshop-url-upload'

function setup(slug = 'wan--reference-to-video-3.0--animate-images') {
  const model = getRouterWorkshopModelDetail(slug)
  if (!model) throw new Error(`Missing model ${slug}`)
  const form = initialWorkshopPageState(model)
  return { model, form }
}

function storage() {
  let grants = 0
  const requests = vi.fn<typeof fetch>(async (url, init) => {
    if (init?.method === 'POST') {
      expect(String(url)).toMatch(/\/customers\/storage$/)
      expect(new Headers(init.headers).get('Authorization')).toBe(
        'Bearer token'
      )
      grants += 1
      return Response.json({
        upload_url: `https://storage.example/upload-${grants}`,
        download_url: `https://storage.example/image-${grants}.png`
      })
    }
    expect(new Headers(init?.headers).has('Authorization')).toBe(false)
    if (init?.method === 'PUT') {
      expect(init.body).toBeInstanceOf(File)
      return new Response(null)
    }
    return new Response(String(url), {
      headers: { 'Content-Type': 'image/png' }
    })
  })
  vi.stubGlobal('fetch', requests)
  const uploader = createWorkshopUrlUploader()
  return {
    requests,
    grants: () => grants,
    uploadFile: (file: File, signal: AbortSignal) =>
      uploader(file, 'token', 'owner:workspace', signal)
  }
}

describe('Wan 3 source URL rehosting', () => {
  it.for([
    'wan--reference-to-video-3.0--animate-images',
    'wan--reference-to-video-3.0-prime--animate-images'
  ])('preserves reference order and retry bodies for %s', async (slug) => {
    const { model, form } = setup(slug)
    const transport = storage()
    const values = {
      ...form.values,
      prompt: 'Combine the references',
      image_url: `https://example.com/${slug}@revision/first.png`,
      image_url_2: `https://example.com/${slug}@revision/second.png`
    }
    const options = {
      form: { schema: form.schema, values },
      uploadFile: transport.uploadFile
    }
    const first = await prepareModelRouterRender(model, {}, options)
    expect(first.body).toMatchObject({
      input: {
        prompt: 'Combine the references',
        media: [
          {
            type: 'reference_image',
            url: 'https://storage.example/image-1.png'
          },
          {
            type: 'reference_image',
            url: 'https://storage.example/image-2.png'
          }
        ]
      }
    })
    const retry = await prepareModelRouterRender(
      model,
      {},
      {
        ...options,
        form: { schema: form.schema, values: { ...values } }
      }
    )
    expect(retry.body).toEqual(first.body)
    expect(transport.grants()).toBe(2)
    expect(transport.requests).toHaveBeenCalledTimes(6)
    expect(values.image_url).toContain('@revision')
  })

  it('retains an active form upload when other sources evict the shared cache', async () => {
    const { model, form } = setup('wan--image-to-video-3.0--animate-images')
    const transport = storage()
    const values = {
      ...form.values,
      image_url: 'https://example.com/active@revision.png'
    }
    const options = {
      form: { schema: form.schema, values },
      uploadFile: transport.uploadFile
    }
    const first = await prepareModelRouterRender(model, {}, options)
    for (let i = 0; i < 9; i++) {
      await prepareModelRouterRender(
        model,
        {},
        {
          ...options,
          form: {
            schema: form.schema,
            values: {
              ...values,
              image_url: `https://example.com/other-${i}@revision.png`
            }
          }
        }
      )
    }
    const retry = await prepareModelRouterRender(model, {}, options)
    expect(retry.body).toEqual(first.body)
    expect(transport.grants()).toBe(10)
    expect(transport.requests).toHaveBeenCalledTimes(30)
  })

  it('keeps ordinary URLs and uploaded binary inputs working', async () => {
    const { model, form } = setup()
    const transport = storage()
    const file = new File(['binary image'], 'local.png', { type: 'image/png' })
    const prepared = await prepareModelRouterRender(
      model,
      {},
      {
        form: {
          schema: form.schema,
          values: {
            ...form.values,
            image_url: 'https://example.com/ordinary.png',
            image_url_2: {
              file,
              name: file.name,
              size: file.size,
              type: file.type
            }
          }
        },
        uploadFile: transport.uploadFile
      }
    )
    expect(prepared.body).toMatchObject({
      input: {
        media: [
          { type: 'reference_image', url: 'https://example.com/ordinary.png' },
          {
            type: 'reference_image',
            url: 'https://storage.example/image-1.png'
          }
        ]
      }
    })
    expect(transport.requests).toHaveBeenCalledTimes(2)
  })

  it('does not generate or cache a failed download, and permits a later retry', async () => {
    const { model, form } = setup('wan--image-to-video-3.0--animate-images')
    const transport = storage()
    transport.requests.mockResolvedValueOnce(
      new Response(null, { status: 503 })
    )
    const options = {
      model,
      token: 'token',
      form: {
        schema: form.schema,
        values: {
          ...form.values,
          image_url: 'https://example.com/failure@revision.png'
        }
      },
      uploadFile: transport.uploadFile
    }
    await expect(router_render(model.slug, {}, options)).rejects.toMatchObject({
      fieldErrors: { image_url: 'uploadFailed' }
    })
    expect(transport.grants()).toBe(0)
    expect(transport.requests).toHaveBeenCalledTimes(1)
    await expect(
      prepareModelRouterRender(model, {}, options)
    ).resolves.toMatchObject({
      body: {
        input: {
          media: [
            { type: 'first_frame', url: 'https://storage.example/image-1.png' }
          ]
        }
      }
    })
  })

  it('stops an aborted source download before storage or generation', async () => {
    const { model, form } = setup('wan--image-to-video-3.0--animate-images')
    const controller = new AbortController()
    const requests = vi.fn<typeof fetch>(async () => {
      controller.abort()
      return new Response('image', { headers: { 'Content-Type': 'image/png' } })
    })
    vi.stubGlobal('fetch', requests)
    await expect(
      router_render(
        model.slug,
        {},
        {
          model,
          token: 'token',
          signal: controller.signal,
          form: {
            schema: form.schema,
            values: {
              ...form.values,
              image_url: 'https://example.com/aborted@revision.png'
            }
          }
        }
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(requests).toHaveBeenCalledTimes(1)
  })
})
