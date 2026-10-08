import { describe, expect, it, vi } from 'vitest'

import { createGitHubClient } from './github.ts'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

describe('GitHub client', () => {
  it('rejects a GraphQL response that reports errors with HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({
          data: null,
          errors: [{ message: 'Could not resolve to a node' }]
        })
      )
    )
    const github = createGitHubClient('token', 'Comfy-Org/ComfyUI_frontend')

    await expect(github.graphql('mutation {}', {})).rejects.toThrow(
      'GitHub GraphQL failed: Could not resolve to a node'
    )
  })

  it('reads every page until a short page', async () => {
    const fullPage = Array.from({ length: 100 }, (_, id) => ({ id }))
    const fetchPage = vi.fn<typeof fetch>(async (input) =>
      jsonResponse(String(input).endsWith('page=1') ? fullPage : [{ id: 100 }])
    )
    vi.stubGlobal('fetch', fetchPage)
    const github = createGitHubClient('token', 'Comfy-Org/ComfyUI_frontend')

    await expect(github.paginate('/pulls/42/reviews')).resolves.toHaveLength(
      101
    )
  })

  it('refuses to send the token to another origin', async () => {
    const fetchAny = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchAny)
    const github = createGitHubClient('token', 'Comfy-Org/ComfyUI_frontend')

    await expect(github.request('https://example.com/user')).rejects.toThrow(
      'Refusing to send credentials'
    )
    expect(fetchAny).not.toHaveBeenCalled()
  })
})
