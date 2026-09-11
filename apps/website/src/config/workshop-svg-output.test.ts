import { describe, expect, it, vi } from 'vitest'

import { workshopContractSchema } from './workshop-contract'
import { parseRouterResponse, releaseRouterOutputs } from './workshop-response'
import { svgOutputs } from './workshop-svg-output'

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M0 0h8v8H0z"/></svg>'
const png = new Blob(
  [
    Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
      ),
      (character) => character.charCodeAt(0)
    )
  ],
  { type: 'image/png' }
)
const contract = workshopContractSchema.parse({
  id: 'fixture/vector',
  sourceCommit: 'a'.repeat(40),
  inputSchema: { type: 'object' },
  output: { format: 'auto', contentTypes: ['*/*'] }
})

async function rasterize() {
  return png
}

describe('SVG output conversion', () => {
  it('exposes a PNG preview and preserves the original as an inert download', async () => {
    const outputs = await svgOutputs(
      new Blob([svg]),
      'vector.svg',
      undefined,
      rasterize
    )
    try {
      expect(outputs.map(({ kind, fileName }) => ({ kind, fileName }))).toEqual(
        [
          { kind: 'image', fileName: 'vector.png' },
          { kind: 'other', fileName: 'vector.svg' }
        ]
      )
      const preview = await fetch(outputs[0].url)
      expect(preview.headers.get('Content-Type')).toBe('image/png')
      expect(await preview.arrayBuffer()).toEqual(await png.arrayBuffer())
      const original = await fetch(outputs[1].url)
      expect(original.headers.get('Content-Type')).toBe(
        'application/octet-stream'
      )
      expect(await original.text()).toBe(svg)
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it.for(['https://example.com/vector.svg', 'https://example.com/output/123'])(
    'rasterizes a provider JSON result at %s',
    async (url) => {
      const localFetch = fetch
      vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).startsWith('https:')
          ? Promise.resolve(
              new Response(init?.method === 'HEAD' ? null : svg, {
                headers: { 'Content-Type': 'image/svg+xml' }
              })
            )
          : localFetch(input, init)
      )
      const outputs = await parseRouterResponse(
        contract,
        Response.json({ data: [{ url }] }),
        undefined,
        rasterize
      )
      try {
        expect(outputs.map(({ kind }) => kind)).toEqual([
          'image',
          'other',
          'text'
        ])
        expect(await (await fetch(outputs[1].url)).text()).toBe(svg)
      } finally {
        releaseRouterOutputs(outputs)
      }
    }
  )

  it('keeps an undecodable SVG inert', async () => {
    const outputs = await svgOutputs(
      new Blob([svg]),
      'vector.svg',
      undefined,
      async () => {
        throw new Error('Invalid SVG')
      }
    )
    try {
      expect(outputs.map(({ kind }) => kind)).toEqual(['other'])
      expect((await fetch(outputs[0].url)).headers.get('Content-Type')).toBe(
        'application/octet-stream'
      )
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('revokes retained bytes when rendering is cancelled', async () => {
    const controller = new AbortController()
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const stopped = new Error('Stopped rendering')
    await expect(
      svgOutputs(new Blob([svg]), 'vector.svg', controller.signal, async () => {
        controller.abort(stopped)
        throw stopped
      })
    ).rejects.toThrow(stopped)
    expect(revoke).toHaveBeenCalledOnce()
  })

  it('preserves the inert original when only the preview deadline expires', async () => {
    const deadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    const outputs = await svgOutputs(
      new Blob([svg]),
      'vector.svg',
      new AbortController().signal,
      async () => {
        deadline.abort(new DOMException('Preview timed out', 'TimeoutError'))
        throw deadline.signal.reason
      }
    )
    try {
      expect(outputs).toHaveLength(1)
      expect(outputs[0]).toMatchObject({
        kind: 'other',
        fileName: 'vector.svg'
      })
      const response = await fetch(outputs[0].url)
      expect(response.headers.get('Content-Type')).toBe(
        'application/octet-stream'
      )
      expect(await response.text()).toBe(svg)
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('keeps a link to oversized remote SVGs and cancels the reader', async () => {
    const cancel = vi.fn()
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1))
            },
            cancel
          })
        )
    )
    await expect(
      svgOutputs(
        'https://example.com/vector.svg',
        'vector.svg',
        undefined,
        rasterize
      )
    ).resolves.toEqual([
      {
        kind: 'other',
        url: 'https://example.com/vector.svg',
        fileName: 'vector.svg'
      }
    ])
    expect(cancel).toHaveBeenCalledOnce()
  })

  it.for(['network', 302, 403, 500, 'empty', 'oversize'])(
    'preserves a successful provider URL when SVG retrieval fails: %s',
    async (failure) => {
      const render = vi.fn(rasterize)
      vi.stubGlobal('fetch', async () => {
        if (failure === 'network') throw new TypeError('Failed to fetch')
        if (failure === 'empty') return new Response('')
        if (failure === 'oversize')
          return new Response(svg, {
            headers: { 'Content-Length': String(4 * 1024 * 1024 + 1) }
          })
        if (typeof failure !== 'number') throw new Error('Invalid test status')
        return new Response(null, { status: failure })
      })
      const outputs = await parseRouterResponse(
        contract,
        Response.json({ url: 'https://example.com/vector.svg' }),
        undefined,
        render
      )
      try {
        expect(outputs[0]).toMatchObject({
          kind: 'other',
          url: 'https://example.com/vector.svg',
          fileName: 'fixture-vector-1.svg'
        })
        expect(render).not.toHaveBeenCalled()
      } finally {
        releaseRouterOutputs(outputs)
      }
    }
  )

  it('falls back on a download deadline but preserves caller cancellation', async () => {
    const deadline = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    vi.stubGlobal('fetch', async () => {
      deadline.abort(new DOMException('Timed out', 'TimeoutError'))
      throw deadline.signal.reason
    })
    await expect(
      svgOutputs('https://example.com/slow.svg', 'slow.svg')
    ).resolves.toEqual([
      {
        kind: 'other',
        url: 'https://example.com/slow.svg',
        fileName: 'slow.svg'
      }
    ])

    const caller = new AbortController()
    const reason = new Error('User cancelled')
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      new AbortController().signal
    )
    vi.stubGlobal('fetch', async () => {
      caller.abort(reason)
      throw reason
    })
    await expect(
      svgOutputs(
        'https://example.com/cancelled.svg',
        'cancelled.svg',
        caller.signal
      )
    ).rejects.toBe(reason)
  })

  it.for([
    'javascript:alert(1)',
    'http://example.com/a.svg',
    'https://user:password@example.com/a.svg',
    'not-a-url'
  ])(
    'never turns unsafe SVG sources into fallback links: %s',
    async (source) => {
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      await expect(svgOutputs(source, 'vector.svg')).rejects.toThrow(
        'Unsafe SVG URL'
      )
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('enforces the SVG limit while streaming a direct Router response', async () => {
    const cancel = vi.fn()
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1))
        },
        cancel
      }),
      { headers: { 'Content-Type': 'image/svg+xml' } }
    )
    await expect(
      parseRouterResponse(contract, response, undefined, rasterize)
    ).rejects.toThrow('output exceeds the limit')
    expect(cancel).toHaveBeenCalledOnce()
  })
})
