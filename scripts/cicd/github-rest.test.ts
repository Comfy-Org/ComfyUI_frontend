import { beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchGitHubJson } from './github-rest'

const BODY = { parents: [{ sha: 'abc' }] }
const PATH = '/repos/o/r/commits/x'
/** The backoff length is not what any of these cases is about. */
const NO_DELAY = 0

type Outcome = number | Error | [status: number, headers: HeadersInit]

function responding(...outcomes: Outcome[]) {
  const fetchMock = vi.fn(() => {
    const outcome = outcomes.shift()
    if (outcome instanceof Error) return Promise.reject(outcome)
    const [status, headers] = Array.isArray(outcome) ? outcome : [outcome, {}]
    return Promise.resolve(
      new Response(JSON.stringify(BODY), { status, headers })
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
  // GitHub signals rate limits with 403 and 429, so neither the status alone
  // nor "4xx is our fault" separates them from a genuine client error.
  it.for<[label: string, first: Outcome]>([
    ['a server error', 500],
    ['a gateway error', 502],
    ['a transport failure', new TypeError('fetch failed')],
    ['a secondary rate limit', 429],
    ['a primary rate limit', [403, { 'x-ratelimit-remaining': '0' }]],
    ['a 403 asking us to wait', [403, { 'retry-after': '0' }]]
  ])('retries past %s', async ([, first]) => {
    const fetchMock = responding(first, 200)

    await expect(fetchGitHubJson(PATH, NO_DELAY)).resolves.toEqual(BODY)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  // Our own mistake, not the network's: retrying only delays the failure. A
  // 403 carrying no rate-limit signal is an answer about permissions.
  it.for<[label: string, only: Outcome]>([
    ['a missing commit', 404],
    ['a forbidden read', 403],
    ['a rejected query', 422]
  ])('raises %s without retrying', async ([, only]) => {
    const fetchMock = responding(only, 200)

    await expect(fetchGitHubJson(PATH, NO_DELAY)).rejects.toThrow('GitHub')
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
