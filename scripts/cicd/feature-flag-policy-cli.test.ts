import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { main } from './feature-flag-policy'

const runGh = vi.fn<(args: string[], input?: string) => string>()
const readFile = vi.fn<(path: string) => string>()
const appendFile = vi.fn<(path: string, text: string) => void>()
const sha = 'a'.repeat(40)
const pull = {
  state: 'open',
  head: { sha },
  body: '',
  labels: [{ name: 'risk:high' }]
}

interface Fixtures {
  pull?: unknown
  pulls?: Record<string, unknown>
  requests?: unknown
  current?: unknown
  request?: unknown
  publicationError?: Error
}

function runPolicy(fixtures: Fixtures = {}) {
  let pullReads = 0
  const initial = 'pull' in fixtures ? fixtures.pull : pull
  const current = 'current' in fixtures ? fixtures.current : initial
  runGh.mockImplementation((args) => {
    const requestedPr = args[0].match(
      /^repos\/Comfy-Org\/ComfyUI_frontend\/pulls\/(\d+)$/
    )?.[1]
    if (requestedPr && fixtures.pulls)
      return JSON.stringify(fixtures.pulls[requestedPr])
    if (args[0] === 'repos/Comfy-Org/ComfyUI_frontend/pulls/17526') {
      pullReads += 1
      return JSON.stringify(pullReads > 1 ? current : initial)
    }
    if (
      args.join(' ') ===
      '--method POST repos/Comfy-Org/ComfyUI_frontend/check-runs --input -'
    ) {
      if (fixtures.publicationError) throw fixtures.publicationError
      return '{}'
    }
    throw new Error(`Unexpected request: ${args.join(' ')}`)
  })
  readFile.mockImplementation((path) => {
    if (path === '/request.json')
      return JSON.stringify(
        'requests' in fixtures
          ? fixtures.requests
          : [
              'request' in fixtures
                ? fixtures.request
                : { pr_number: 17526, head_sha: sha }
            ]
      )
    throw new Error(`Unexpected path: ${path}`)
  })
  main({ request: runGh, readFile, appendFile })
}

beforeEach(() => {
  vi.stubEnv('GITHUB_REPOSITORY', 'Comfy-Org/ComfyUI_frontend')
  vi.stubEnv('PR_NUMBER', '17526')
  vi.stubEnv('POLICY_REQUEST_PATH', '/request.json')
  vi.stubEnv('EXPECTED_HEAD_SHA', sha)
  vi.stubEnv('TRUSTED_DEFAULT_BRANCH_DISPATCH', 'false')
  vi.stubEnv('GITHUB_STEP_SUMMARY', '')
})

function expectNoPublication() {
  expect(runGh.mock.calls.some(([args]) => args.includes('POST'))).toBe(false)
  expect(appendFile).not.toHaveBeenCalled()
}

function publishedCheck() {
  const posts = runGh.mock.calls.filter(([args]) => args.includes('POST'))
  expect(posts).toHaveLength(1)
  const check: unknown = JSON.parse(posts[0][1] ?? '{}')
  return z
    .object({
      head_sha: z.string(),
      conclusion: z.string(),
      output: z.object({ title: z.string(), summary: z.string() })
    })
    .parse(check)
}

describe('publication boundaries', () => {
  it('requires producer metadata', () => {
    vi.stubEnv('POLICY_REQUEST_PATH', '')
    expect(runPolicy).toThrow('POLICY_REQUEST_PATH is required.')
    expectNoPublication()
  })

  it.for([
    null,
    {},
    { ...pull, head: null },
    { ...pull, head: { sha: 'invalid' } },
    { ...pull, body: [] },
    { ...pull, state: 'closed' },
    { ...pull, labels: null }
  ])('rejects invalid or closed pull metadata: %j', (value) => {
    expect(() => runPolicy({ pull: value })).toThrow(
      'Invalid pull request metadata.'
    )
    expectNoPublication()
  })

  it.for([[null], [1], [{}], [{ name: 1 }]])(
    'rejects malformed labels: %j',
    (labels) => {
      expect(() => runPolicy({ pull: { ...pull, labels } })).toThrow(
        'Invalid pull request labels.'
      )
      expectNoPublication()
    }
  )

  it.for([
    { ...pull, head: { sha: 'b'.repeat(40) } },
    { ...pull, body: '## Feature flag\n- **Flag**: safe_feature' },
    { ...pull, labels: [{ name: 'risk:low' }] },
    { ...pull, labels: [...pull.labels, { name: 'flag-dispute' }] },
    { ...pull, labels: [...pull.labels, { name: 'risk-dispute:low' }] }
  ])('does not publish advice after its inputs change: %j', (current) => {
    expect(() => runPolicy({ current })).toThrow(
      'Pull request changed during evaluation'
    )
    expectNoPublication()
  })

  it.for([
    null,
    {},
    { pr_number: '17526', head_sha: sha },
    { pr_number: 1, head_sha: sha },
    { pr_number: 17526, head_sha: 'b'.repeat(40) }
  ])(
    'binds a PR-event artifact to the independently resolved target: %j',
    (request) => {
      expect(() => runPolicy({ request })).toThrow(
        'Policy request does not match'
      )
      expectNoPublication()
    }
  )

  it('rejects a PR that has advanced beyond the triggering run', () => {
    expect(() =>
      runPolicy({ pull: { ...pull, head: { sha: 'b'.repeat(40) } } })
    ).toThrow('Policy request does not match the current PR head.')
    expectNoPublication()
  })

  it('rejects repeated PR-event targets before making API requests', () => {
    const request = { pr_number: 17526, head_sha: sha }
    expect(() => runPolicy({ requests: [request, request] })).toThrow(
      'A PR-event policy request must contain exactly one target.'
    )
    expect(runGh).not.toHaveBeenCalled()
    expectNoPublication()
  })

  it('does not treat missing workflow target data as a trusted dispatch', () => {
    vi.stubEnv('PR_NUMBER', '')
    vi.stubEnv('EXPECTED_HEAD_SHA', '')
    expect(runPolicy).toThrow('Policy request does not match')
    expectNoPublication()
  })

  it('allows a trusted default-branch dispatch to select a live PR through request metadata', () => {
    vi.stubEnv('PR_NUMBER', '')
    vi.stubEnv('EXPECTED_HEAD_SHA', '')
    vi.stubEnv('TRUSTED_DEFAULT_BRANCH_DISPATCH', 'true')
    runPolicy()
    expect(publishedCheck().head_sha).toBe(sha)
  })

  it('still rejects a stale trusted dispatch request', () => {
    vi.stubEnv('TRUSTED_DEFAULT_BRANCH_DISPATCH', 'true')
    expect(() =>
      runPolicy({ request: { pr_number: 17526, head_sha: 'b'.repeat(40) } })
    ).toThrow('Policy request does not match the current PR head.')
    expectNoPublication()
  })

  it('does not append a summary when publication fails', () => {
    vi.stubEnv('GITHUB_STEP_SUMMARY', '/summary.md')
    const publicationError = new Error('Check publication failed')
    expect(() => runPolicy({ publicationError })).toThrow(
      publicationError.message
    )
    expect(appendFile).not.toHaveBeenCalled()
  })

  it('publishes current label-based advice and ignores artifact-supplied verdicts', () => {
    vi.stubEnv('GITHUB_STEP_SUMMARY', '/summary.md')
    runPolicy({
      request: {
        pr_number: 17526,
        head_sha: sha,
        verdict: 'pass',
        labels: ['risk:low']
      }
    })
    const check = publishedCheck()
    expect(check).toMatchObject({
      head_sha: sha,
      conclusion: 'neutral',
      output: { title: 'Feature flag policy: FAIL (advisory)' }
    })
    expect(appendFile).toHaveBeenCalledExactlyOnceWith(
      '/summary.md',
      `${check.output.summary}\n`
    )
  })

  it('compares label sets independently of order and case', () => {
    runPolicy({
      pull: {
        ...pull,
        labels: [{ name: 'risk:high' }, { name: 'risk-dispute:low' }]
      },
      current: {
        ...pull,
        labels: [{ name: 'RISK-DISPUTE:LOW' }, { name: 'risk:high' }]
      }
    })
    expect(publishedCheck().output.title).toContain('PASS')
  })
})

it.for([null, {}, []])(
  'rejects invalid request lists before publication: %j',
  (requests) => {
    expect(() => runPolicy({ requests })).toThrow(
      'Policy request must contain at least one target.'
    )
    expectNoPublication()
  }
)

it('attempts the remaining batch when one target cannot be evaluated', () => {
  vi.stubEnv('TRUSTED_DEFAULT_BRANCH_DISPATCH', 'true')
  const secondSha = 'b'.repeat(40)
  expect(() =>
    runPolicy({
      requests: [
        { pr_number: 17526, head_sha: sha },
        { pr_number: 17527, head_sha: secondSha }
      ],
      pulls: {
        '17526': { ...pull, state: 'closed' },
        '17527': {
          ...pull,
          head: { sha: secondSha },
          labels: [{ name: 'risk:low' }]
        }
      }
    })
  ).toThrow('PR #17526: Invalid pull request metadata.')
  expect(publishedCheck()).toMatchObject({
    head_sha: secondSha,
    output: { title: 'Feature flag policy: PASS (advisory)' }
  })
})
