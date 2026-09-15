import { describe, expect, it, vi } from 'vitest'

import { prepareModelRouterRender, router_render } from './router-render'
import { initialWorkshopPageState } from './workshop-page-state'
import { getRouterWorkshopModelDetail } from './workshop-router-content'
import { createWorkshopUrlUploader } from './workshop-url-upload'
import { prepareWorkshopRouterInput } from './workshop-request'

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
    'https://example.com/image@2x.png',
    'http://127.0.0.1/private@revision.png',
    'https://cdn.jsdelivr.net.evil/gh/Comfy-Org/workflow_templates@revision/image.png',
    'https://cdn.jsdelivr.net/gh/other/repo@revision/image.png',
    'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates/image.png'
  ])('does not locally download an unapproved source: %s', async (source) => {
    const { model, form } = setup('wan--image-to-video-3.0--animate-images')
    const transport = storage()
    const prepared = await prepareModelRouterRender(
      model,
      {},
      {
        form: {
          schema: form.schema,
          values: { ...form.values, image_url: source }
        },
        uploadFile: transport.uploadFile
      }
    )
    expect(prepared.body).toHaveProperty('input.media.0.url', source)
    expect(transport.requests).not.toHaveBeenCalled()
  })

  it('rejects a credential-bearing lookalike before any download', async () => {
    const { model, form } = setup('wan--image-to-video-3.0--animate-images')
    const transport = storage()
    await expect(
      prepareModelRouterRender(
        model,
        {},
        {
          form: {
            schema: form.schema,
            values: {
              ...form.values,
              image_url:
                'https://cdn.jsdelivr.net@127.0.0.1/private@revision.png'
            }
          },
          uploadFile: transport.uploadFile
        }
      )
    ).rejects.toMatchObject({ reason: 'validation' })
    expect(transport.requests).not.toHaveBeenCalled()
  })

  it('uses contract policy, not the Router model name, to enable rehosting', async () => {
    const { model, form } = setup('wan--image-to-video-3.0--animate-images')
    if (!model.execution) throw new Error('Missing contract')
    const transport = storage()
    const source =
      'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@revision/contract-policy.png'
    const values = { ...form.values, image_url: source }
    const signal = new AbortController().signal
    const unchanged = await prepareWorkshopRouterInput(
      { ...model.execution, rehostUrlInputs: false },
      values,
      signal,
      undefined,
      transport.uploadFile
    )
    expect(unchanged).toHaveProperty('input.media.0.url', source)
    expect(transport.requests).not.toHaveBeenCalled()
    const rehosted = await prepareWorkshopRouterInput(
      { ...model.execution, id: 'fixture/custom', rehostUrlInputs: true },
      values,
      signal,
      undefined,
      transport.uploadFile
    )
    expect(rehosted).toHaveProperty(
      'input.media.0.url',
      'https://storage.example/image-1.png'
    )
    expect(transport.requests).toHaveBeenCalledWith(
      source,
      expect.objectContaining({ redirect: 'error', credentials: 'omit' })
    )
  })

  it.for([
    'wan--reference-to-video-3.0--animate-images',
    'wan--reference-to-video-3.0-prime--animate-images'
  ])('preserves reference order and retry bodies for %s', async (slug) => {
    const { model, form } = setup(slug)
    const transport = storage()
    const values = {
      ...form.values,
      prompt: 'Combine the references',
      image_url: `https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@revision/${slug}/first.png`,
      image_url_2: `https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@revision/${slug}/second.png`
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
      image_url:
        'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@revision/active.png'
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
              image_url: `https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@revision/other-${i}.png`
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
          image_url:
            'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@revision/failure.png'
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
              image_url:
                'https://cdn.jsdelivr.net/gh/Comfy-Org/workflow_templates@revision/aborted.png'
            }
          }
        }
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(requests).toHaveBeenCalledTimes(1)
  })
})
