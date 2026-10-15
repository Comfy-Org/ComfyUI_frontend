import { describe, expect, it, vi } from 'vitest'

import { postDecision } from './stage-client'

describe('postDecision', () => {
  it.for([
    ['a saved decision', () => Response.json({ ok: true }), true],
    ['a refused decision', () => Response.json({ ok: false }), false],
    ['a broken response', () => new Response('nope'), false]
  ] as const)('reports %s', async ([, reply, saved]) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(reply())
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    expect(await postDecision('c', ['a', 'b'], 'APPROVED')).toBe(saved)
    const body = fetch.mock.calls[0][1]?.body as FormData
    expect(JSON.parse(String(body.get('decision')))).toEqual({
      ids: ['a', 'b'],
      status: 'APPROVED'
    })
  })
  it('sends quick decisions one after another, in order', async () => {
    const order: string[] = []
    let inFlight = 0
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(async (_, init) => {
        inFlight += 1
        expect(inFlight).toBe(1)
        const body = init?.body as FormData
        order.push(JSON.parse(String(body.get('decision'))).ids[0])
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight -= 1
        return Response.json({ ok: true })
      })
    vi.mocked(globalThis.fetch).mockImplementation(fetch)
    const results = await Promise.all(
      ['a', 'b', 'c'].map((id) => postDecision('c', [id], 'APPROVED'))
    )
    expect(results).toEqual([true, true, true])
    expect(order).toEqual(['a', 'b', 'c'])
  })
})
