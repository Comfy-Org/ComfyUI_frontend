import { describe, expect, it, vi } from 'vitest'

import { postDecision } from './stage-client'

describe('postDecision', () => {
  it.for([
    ['a saved decision', () => Response.json({ ok: true }), true],
    ['a refused decision', () => Response.json({ ok: false }), false],
    ['a broken response', () => new Response('nope'), false]
  ] as const)('reports %s', async ([, reply, saved]) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(reply())
    vi.stubGlobal('fetch', fetch)
    expect(await postDecision('c', ['a', 'b'], 'APPROVED')).toBe(saved)
    const body = fetch.mock.calls[0][1]?.body as FormData
    expect(JSON.parse(String(body.get('decision')))).toEqual({
      ids: ['a', 'b'],
      status: 'APPROVED'
    })
  })
})
