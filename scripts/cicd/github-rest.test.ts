import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchGitHubJson } from './github-rest'

const BODY = { parents: [{ sha: 'abc' }] }
const PATH = '/repos/o/r/commits/x'
/** The backoff length is not what any of these cases is about. */
const NO_DELAY = 0

function responding(...outcomes: (number | Error)[]) {
  const fetchMock = vi.fn(() => {
    const outcome = outcomes.shift()
    if (outcome instanceof Error) return Promise.reject(outcome)
    return Promise.resolve(
      new Response(JSON.stringify(BODY), { status: outcome })
    )
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchGitHubJson', () => {
  beforeEach(() => {
    vi.stubEnv('GH_TOKEN', 'token')
  })

  // The caller has no fallback: a transient failure costs the whole report.
  it.for<[label: string, first: number | Error]>([
    ['a server error', 500],
    ['a gateway error', 502],
    ['a transport failure', new TypeError('fetch failed')]
  ])('retries past %s', async ([, first]) => {
    const fetchMock = responding(first, 200)

    await expect(fetchGitHubJson(PATH, NO_DELAY)).resolves.toEqual(BODY)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // Our own mistake, not the network's: retrying it only delays the failure.
  it('raises a client error without retrying', async () => {
    const fetchMock = responding(404, 200)

    await expect(fetchGitHubJson(PATH, NO_DELAY)).rejects.toThrow(
      'GitHub returned 404'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after three failed attempts', async () => {
    const fetchMock = responding(500, 503, 500)

    await expect(fetchGitHubJson(PATH, NO_DELAY)).rejects.toThrow(
      'GitHub returned 500'
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  // Unauthenticated reads of a private repo answer 404, which would read as
  // "no such commit" and send the ancestor walk one commit further back.
  it('refuses to call the API without a token', async () => {
    const fetchMock = responding(200)
    vi.stubEnv('GH_TOKEN', '')
    vi.stubEnv('GITHUB_TOKEN', '')

    await expect(fetchGitHubJson(PATH, NO_DELAY)).rejects.toThrow(
      'GH_TOKEN is required'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
