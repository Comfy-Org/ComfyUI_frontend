import { describe, expect, it } from 'vitest'

import { fetchRequests, respondToFetch } from './fetch'

const TOKEN_URL = 'https://api.example.com/api/auth/token'

describe('respondToFetch', () => {
  it.for([
    { name: 'exact URL', route: TOKEN_URL },
    { name: 'pattern', route: /\/auth\/token$/ },
    { name: 'method and URL', route: { method: 'post', url: TOKEN_URL } },
    { name: 'method only', route: { method: 'POST' } }
  ])('answers a request matched by $name', async ({ route }) => {
    respondToFetch(route, () => Response.json({ token: 'abc' }))

    const response = await fetch(TOKEN_URL, { method: 'POST' })

    expect(await response.json()).toEqual({ token: 'abc' })
  })

  it.for([
    { name: 'a different URL', request: () => fetch(`${TOKEN_URL}/other`) },
    { name: 'a different method', request: () => fetch(TOKEN_URL) }
  ])('lets $name fall through to the network guard', async ({ request }) => {
    respondToFetch({ method: 'POST', url: TOKEN_URL }, () => Response.json({}))

    await expect(request()).rejects.toThrow(/Blocked a real network request/)
  })

  it('builds a fresh response for every call', async () => {
    respondToFetch(TOKEN_URL, () => Response.json({ token: 'abc' }))

    const first = await fetch(TOKEN_URL)
    const second = await fetch(TOKEN_URL)

    expect([await first.json(), await second.json()]).toEqual([
      { token: 'abc' },
      { token: 'abc' }
    ])
  })

  it('checks later routes first and falls back once they are used up', async () => {
    respondToFetch(TOKEN_URL, () => Response.json({ attempt: 'retry' }))
    respondToFetch(TOKEN_URL, () => Promise.reject(new TypeError('offline')), {
      times: 1
    })

    await expect(fetch(TOKEN_URL)).rejects.toThrow('offline')
    expect(await (await fetch(TOKEN_URL)).json()).toEqual({ attempt: 'retry' })
  })

  it('matches URL and Request inputs by their href', async () => {
    respondToFetch(TOKEN_URL, () => new Response('ok'))

    expect(await (await fetch(new URL(TOKEN_URL))).text()).toBe('ok')
    expect(await (await fetch(new Request(TOKEN_URL))).text()).toBe('ok')
  })
})

describe('fetchRequests', () => {
  it('reports the URL, method, headers, and body of matching requests', async () => {
    respondToFetch({}, () => new Response(null, { status: 204 }))

    await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer firebase' },
      body: JSON.stringify({ workspace_id: 'ws-1' })
    })
    await fetch('https://api.example.com/api/features')

    const [request, ...others] = fetchRequests(TOKEN_URL)
    expect(others).toEqual([])
    expect(request.method).toBe('POST')
    expect(request.headers.get('Authorization')).toBe('Bearer firebase')
    expect(JSON.parse(String(request.body))).toEqual({ workspace_id: 'ws-1' })
    expect(fetchRequests().map(({ url }) => url)).toEqual([
      TOKEN_URL,
      'https://api.example.com/api/features'
    ])
  })
})
