import { describe, expect, it, vi } from 'vitest'

import { router_render } from './router-render'
import { WORKSHOP_ROUTER_BASE_URL } from './workshop-env'
import { releaseRouterOutputs } from './workshop-response'

const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='
  ),
  (character) => character.charCodeAt(0)
)

describe('shared Router rendering', () => {
  it('reuses uploaded bytes and the same request body for an explicit retry', async () => {
    const source = new Blob([png], { type: 'image/png' })
    let grants = 0
    const bodies: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (url, init) => {
        if (String(url).endsWith('/customers/storage')) {
          grants++
          return Response.json({
            upload_url: `https://storage.example/upload-${grants}`,
            download_url: `https://storage.example/image-${grants}.png`
          })
        }
        if (init?.method === 'PUT') return new Response(null)
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
          'same-attempt'
        )
        bodies.push(String(init?.body))
        return bodies.length === 1
          ? new Response('Provider unavailable', { status: 502 })
          : new Response(png, { headers: { 'Content-Type': 'image/png' } })
      })
    )
    const slug = 'wavespeed--seedvr2-image--edit-images'
    const parameters = { source_images: [source] }
    const options = { token: 'retry-token', idempotencyKey: 'same-attempt' }
    await expect(
      router_render(slug, parameters, options)
    ).rejects.toMatchObject({ reason: 'provider' })
    const result = await router_render(slug, parameters, options)
    try {
      expect(grants).toBe(1)
      expect(bodies).toHaveLength(2)
      expect(bodies[1]).toBe(bodies[0])
      expect(result.outputs[0].kind).toBe('image')
    } finally {
      releaseRouterOutputs(result.outputs)
    }
  })

  it('uploads binary inputs through storage and renders its returned URL', async () => {
    const grant = {
      upload_url: 'https://storage.example/input-upload',
      download_url: 'https://storage.example/input.png'
    }
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (url, init) => {
        calls.push(String(url))
        const headers = new Headers(init?.headers)
        if (url === `${WORKSHOP_ROUTER_BASE_URL}/customers/storage`) {
          expect(headers.get('Authorization')).toBe('Bearer test-key')
          return Response.json(grant)
        }
        if (url === grant.upload_url) {
          expect(init?.method).toBe('PUT')
          expect(headers.has('Authorization')).toBe(false)
          if (!(init?.body instanceof File)) throw new Error('Missing bytes')
          expect(new Uint8Array(await init.body.arrayBuffer())).toEqual(png)
          return new Response(null, { status: 200 })
        }
        expect(url).toBe(
          `${WORKSHOP_ROUTER_BASE_URL}/v2/models/wavespeed/seedvr2`
        )
        expect(JSON.parse(String(init?.body))).toMatchObject({
          image: grant.download_url
        })
        expect(headers.get('Idempotency-Key')).toBe('render-once')
        return new Response(png, {
          headers: {
            'Content-Type': 'image/png',
            'X-Comfy-Request-Id': 'request-123'
          }
        })
      })
    )
    const result = await router_render(
      'wavespeed--seedvr2-image--edit-images',
      { source_images: [new Blob([png], { type: 'image/png' })] },
      { token: 'test-key', idempotencyKey: 'render-once' }
    )
    try {
      expect(calls).toHaveLength(3)
      expect(result.requestId).toBe('request-123')
      expect(result.outputs[0]).toMatchObject({ kind: 'image' })
      expect(result.outputs[0].url).toMatch(/^blob:/)
    } finally {
      releaseRouterOutputs(result.outputs)
    }
  })

  it('downloads URL inputs and encodes bytes for a Base64 endpoint', async () => {
    const source = 'https://media.example/reference.png'
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (url, init) => {
        calls.push(String(url))
        if (url === source) {
          expect(new Headers(init?.headers).has('Authorization')).toBe(false)
          return new Response(png, { headers: { 'Content-Type': 'image/png' } })
        }
        expect(url).toBe(
          `${WORKSHOP_ROUTER_BASE_URL}/v2/models/vertexai/gemini-3-pro-image`
        )
        expect(JSON.parse(String(init?.body))).toMatchObject({
          contents: [
            {
              parts: [
                { text: 'Paint this in watercolor' },
                {
                  inlineData: {
                    data: btoa(String.fromCharCode(...png)),
                    mimeType: 'image/png'
                  }
                }
              ]
            }
          ]
        })
        return Response.json({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      data: btoa(String.fromCharCode(...png)),
                      mimeType: 'image/png'
                    }
                  }
                ]
              }
            }
          ]
        })
      })
    )
    const result = await router_render(
      'vertexai--gemini-3-pro-image--edit-images',
      { prompt: 'Paint this in watercolor', reference_images: [source] },
      { token: 'test-key' }
    )
    try {
      expect(calls).toHaveLength(2)
      expect(result.outputs[0].kind).toBe('image')
    } finally {
      releaseRouterOutputs(result.outputs)
    }
  })

  it('cancels after a storage grant without uploading or generating', async () => {
    const controller = new AbortController()
    const requests = vi.fn<typeof fetch>(async () => {
      controller.abort()
      return Response.json({
        upload_url: 'https://storage.example/upload',
        download_url: 'https://storage.example/input.png'
      })
    })
    vi.stubGlobal('fetch', requests)
    await expect(
      router_render(
        'wavespeed--seedvr2-image--edit-images',
        { source_images: [new Blob([png], { type: 'image/png' })] },
        { token: 'test-key', signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(requests).toHaveBeenCalledTimes(1)
  })
})
