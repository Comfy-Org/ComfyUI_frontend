import { describe, expect, it, vi } from 'vitest'

import { workshopContractSchema } from './workshop-contract'
import { parseRouterResponse, releaseRouterOutputs } from './workshop-response'

const contract = workshopContractSchema.parse({
  id: 'fixture/native',
  sourceCommit: 'a'.repeat(40),
  inputSchema: { type: 'object' },
  output: { format: 'auto', contentTypes: ['*/*'] }
})

describe('Router output MIME discovery', () => {
  it('uses public asset headers to display extensionless raster output', async () => {
    vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
      expect(options.method).toBe('HEAD')
      expect(options.credentials).toBe('omit')
      expect(options.redirect).toBe('error')
      expect(options.referrerPolicy).toBe('no-referrer')
      expect(new Headers(options.headers).has('Authorization')).toBe(false)
      return new Response(null, {
        headers: { 'Content-Type': 'IMAGE/WEBP; charset=binary' }
      })
    })
    const url = 'https://assets.example/generated?id=opaque'
    const outputs = await parseRouterResponse(
      contract,
      Response.json({ data: [{ url }], duplicate: url })
    )
    try {
      expect(outputs.map(({ kind }) => kind)).toEqual(['image', 'text'])
      expect(outputs[0]).toMatchObject({
        url,
        fileName: 'fixture-native-1.webp'
      })
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it.for(['image/svg+xml', 'text/html', 'application/octet-stream'])(
    'keeps extensionless %s output inert when no preview can be rendered',
    async (mime) => {
      vi.stubGlobal(
        'fetch',
        async (_url: unknown, options: RequestInit) =>
          new Response(options.method === 'HEAD' ? null : '<svg/>', {
            headers: { 'Content-Type': mime }
          })
      )
      const outputs = await parseRouterResponse(
        contract,
        Response.json({ url: 'https://assets.example/generated' }),
        undefined,
        async () => {
          throw new Error('Invalid SVG dimensions')
        }
      )
      try {
        expect(outputs.map(({ kind }) => kind)).toEqual(['other', 'text'])
        expect(outputs[0].fileName).toBe(
          mime === 'image/svg+xml'
            ? 'fixture-native-1.svg'
            : 'fixture-native-1.bin'
        )
        if (mime === 'image/svg+xml') expect(outputs[0].url).toMatch(/^blob:/)
      } finally {
        releaseRouterOutputs(outputs)
      }
    }
  )

  it('preserves raster URLs, downloads known SVG, and never requests unsafe URLs', async () => {
    const fetch = vi.fn(async () => new Response('<svg/>'))
    vi.stubGlobal('fetch', fetch)
    const outputs = await parseRouterResponse(
      contract,
      Response.json({
        image: 'https://assets.example/generated.png',
        svg: 'https://assets.example/generated.svg',
        authenticated: 'https://user:password@assets.example/generated',
        http: 'http://assets.example/generated'
      }),
      undefined,
      async () => {
        throw new Error('Invalid SVG dimensions')
      }
    )
    try {
      expect(outputs.map(({ kind }) => kind)).toEqual([
        'image',
        'other',
        'text'
      ])
      expect(fetch).toHaveBeenCalledExactlyOnceWith(
        'https://assets.example/generated.svg',
        expect.objectContaining({ credentials: 'omit', redirect: 'error' })
      )
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('preserves downloadable output when CORS or HEAD discovery fails', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    const url = 'https://assets.example/generated'
    const outputs = await parseRouterResponse(contract, Response.json({ url }))
    try {
      expect(outputs[0]).toMatchObject({ url, kind: 'other' })
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('cancels discovery and releases inline output when the run is aborted', async () => {
    const controller = new AbortController()
    const started = Promise.withResolvers<void>()
    vi.stubGlobal('fetch', (_url: unknown, options: RequestInit) => {
      started.resolve()
      return new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(options.signal?.reason),
          { once: true }
        )
      })
    })
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const parsed = parseRouterResponse(
      contract,
      Response.json({
        image: 'data:image/png;base64,iVBORw0KGgo=',
        url: 'https://assets.example/generated'
      }),
      controller.signal
    )
    const rejected = expect(parsed).rejects.toThrow('cancelled')
    await started.promise
    controller.abort(new Error('cancelled'))
    await rejected
    expect(revoke).toHaveBeenCalledOnce()
  })

  it('bounds slow discovery across the whole response and keeps its outputs', async () => {
    vi.useFakeTimers()
    const started = Promise.withResolvers<void>()
    let inFlight = 0
    let maximumInFlight = 0
    vi.stubGlobal('fetch', (_url: unknown, options: RequestInit) => {
      inFlight += 1
      maximumInFlight = Math.max(maximumInFlight, inFlight)
      if (inFlight === 4) started.resolve()
      return new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => {
            inFlight -= 1
            reject(options.signal?.reason)
          },
          { once: true }
        )
      })
    })
    const parsed = parseRouterResponse(
      contract,
      Response.json({
        urls: Array.from(
          { length: 10 },
          (_, index) => `https://assets.example/${index}`
        )
      })
    )
    await started.promise
    await vi.advanceTimersByTimeAsync(5_000)
    const outputs = await parsed
    try {
      expect(outputs).toHaveLength(11)
      expect(outputs.slice(0, -1).every(({ kind }) => kind === 'other')).toBe(
        true
      )
      expect(maximumInFlight).toBe(4)
      expect(inFlight).toBe(0)
    } finally {
      releaseRouterOutputs(outputs)
    }
  })
})
