import { describe, expect, it, vi } from 'vitest'

import { bindWorkflowInputs, createWorkflowClient } from './workflow-execution'

describe('workflow input binding', () => {
  const graph = {
    '1': { class_type: 'LoadImage', inputs: { image: 'example.png' } }
  }
  it('binds uploaded assets without mutating the pinned graph', () => {
    const result = bindWorkflowInputs(graph, [
      {
        node: '1',
        input: 'image',
        value: { __type: 'core/ASSET', info: { id: 'asset-1' } }
      }
    ])
    expect(result['1'].inputs.image).toEqual({
      __type: 'core/ASSET',
      info: { id: 'asset-1' }
    })
    expect(graph['1'].inputs.image).toBe('example.png')
  })
  it('refuses stale bindings before submitting', () => {
    expect(() =>
      bindWorkflowInputs(graph, [{ node: '2', input: 'image', value: 'x' }])
    ).toThrow()
    expect(() =>
      bindWorkflowInputs(graph, [{ node: '1', input: 'missing', value: 'x' }])
    ).toThrow()
  })
})

describe('workflow transport', () => {
  it('never sends credentials to an untrusted follow-up URL', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const client = createWorkflowClient(
      'https://cloud.comfy.org',
      async () => 'token',
      fetcher
    )
    await expect(
      client.read('https://example.com/steal', new AbortController().signal)
    ).rejects.toThrow('origin')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not automatically retry an ambiguous submission', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Network error'))
    const client = createWorkflowClient(
      'https://cloud.comfy.org',
      async () => 'token',
      fetcher
    )
    await expect(
      client.submit({}, new AbortController().signal)
    ).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get('Authorization')
    ).toBe('Bearer token')
  })
  it('surfaces insufficient credits instead of presenting a fake output', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 402 }))
    const client = createWorkflowClient(
      'https://cloud.comfy.org',
      async () => 'token',
      fetcher
    )
    await expect(
      client.submit({}, new AbortController().signal)
    ).rejects.toThrow('credits')
  })

  it('recognizes the canvas API payment-required response even when it uses 429', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { type: 'PAYMENT_REQUIRED' } }), {
        status: 429
      })
    )
    const client = createWorkflowClient(
      'https://cloud.comfy.org',
      async () => 'token',
      fetcher
    )
    await expect(
      client.submit({}, new AbortController().signal)
    ).rejects.toThrow('Insufficient credits')
  })

  it('binds the server-returned upload path, including its subfolder', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'photo-renamed.png',
          subfolder: 'inputs',
          type: 'input'
        })
      )
    )
    const client = createWorkflowClient(
      'https://cloud.comfy.org',
      async () => 'token',
      fetcher
    )
    const file = new File(['image'], 'photo.png', { type: 'image/png' })
    await expect(
      client.upload(file, new AbortController().signal)
    ).resolves.toBe('inputs/photo-renamed.png')
    const body = fetcher.mock.calls[0][1]?.body
    expect(body).toBeInstanceOf(FormData)
    if (!(body instanceof FormData))
      throw new Error('Expected multipart upload')
    expect(body.get('overwrite')).toBe('false')
    expect(body.get('image')).toBeInstanceOf(File)
  })
})
