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

  it('rejects oversized streamed SVGs and cancels the reader', async () => {
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
    ).rejects.toThrow('byte limit')
    expect(cancel).toHaveBeenCalledOnce()
  })

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
