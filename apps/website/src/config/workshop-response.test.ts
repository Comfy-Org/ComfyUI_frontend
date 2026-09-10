import { describe, expect, it, vi } from 'vitest'

import { workshopContractSchema } from './workshop-contract'
import { parseRouterResponse, releaseRouterOutputs } from './workshop-response'

const contract = workshopContractSchema.parse({
  id: 'fixture/native',
  sourceCommit: 'a'.repeat(40),
  inputSchema: { type: 'object' },
  output: { format: 'auto', contentTypes: ['*/*'] }
})
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='

describe('native Router output handling', () => {
  it('preserves text and unknown fields while extracting mixed URL and inline media safely', async () => {
    const response = {
      text: '<script>never execute</script>',
      data: [{ b64_json: png }],
      video: { url: 'https://assets.example/generated.mp4' },
      audio: 'https://assets.example/generated.wav',
      model: 'https://assets.example/generated.glb',
      duplicate: 'https://assets.example/generated.mp4',
      unrelated: { identifier: 17 },
      unsafe: [
        'javascript:alert(1)',
        'https://user:password@example.com/private',
        'https://[invalid'
      ]
    }
    const outputs = await parseRouterResponse(contract, Response.json(response))
    try {
      expect(outputs.map((output) => output.kind)).toEqual([
        'image',
        'video',
        'audio',
        '3d',
        'text'
      ])
      const image = await fetch(outputs[0].url)
      expect(image.headers.get('Content-Type')).toBe('image/png')
      expect(new Uint8Array(await image.arrayBuffer())).toEqual(
        Uint8Array.from(atob(png), (char) => char.charCodeAt(0))
      )
      expect(JSON.parse(outputs.at(-1)?.text ?? '')).toEqual(response)
      expect(await (await fetch(outputs.at(-1)?.url ?? '')).json()).toEqual(
        response
      )
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('uses declared MIME types for binary audio instead of requiring a JSON envelope', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const outputs = await parseRouterResponse(
      contract,
      new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } })
    )
    expect(outputs[0].kind).toBe('audio')
    expect(
      new Uint8Array(await (await fetch(outputs[0].url)).arrayBuffer())
    ).toEqual(bytes)
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    releaseRouterOutputs(outputs)
    expect(revoke).toHaveBeenCalledWith(outputs[0].url)
  })

  it('keeps full text downloadable when the display preview is bounded', async () => {
    const content = 'a'.repeat(70_000)
    const outputs = await parseRouterResponse(
      contract,
      new Response(content, { headers: { 'Content-Type': 'text/plain' } })
    )
    try {
      expect(outputs[0].text).toHaveLength(65_536)
      expect(outputs[0].truncated).toBe(true)
      expect(await (await fetch(outputs[0].url)).text()).toBe(content)
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('does not turn an HTML reply into active same-origin HTML', async () => {
    const outputs = await parseRouterResponse(
      contract,
      new Response('<script>danger()</script>', {
        headers: { 'Content-Type': 'text/html' }
      })
    )
    try {
      expect(outputs[0].kind).toBe('other')
      expect((await fetch(outputs[0].url)).headers.get('Content-Type')).toBe(
        'application/octet-stream'
      )
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('rejects broken JSON, unexpected MIME, empty and oversized replies', async () => {
    const jsonContract = {
      ...contract,
      output: { format: 'auto' as const, contentTypes: ['application/json'] }
    }
    await expect(
      parseRouterResponse(
        jsonContract,
        new Response('{', { headers: { 'Content-Type': 'application/json' } })
      )
    ).rejects.toThrow()
    await expect(
      parseRouterResponse(jsonContract, new Response('not JSON'))
    ).rejects.toThrow('Unexpected')
    await expect(
      parseRouterResponse(contract, new Response(''))
    ).rejects.toThrow('Empty')
    await expect(
      parseRouterResponse(
        contract,
        new Response('short', {
          headers: { 'Content-Length': String(128 * 1024 * 1024 + 1) }
        })
      )
    ).rejects.toThrow('limit')
  })
})
