import { describe, expect, it, vi } from 'vitest'

import type { PullRequestSummary } from './release-sheriff'
import {
  CONFIG,
  fetchGithubLogins,
  fetchOnCallEmails,
  isSheriffPr,
  nextInRotation,
  parseGithubLogins,
  parseOnCallEmails,
  parseRotationKeys,
  planActions,
  resolveSheriff,
  singleLine
} from './release-sheriff'

const config = {
  fallbackGithubLogin: 'fallback-dev',
  githubLoginByUser: { sheriff: 'sheriff-dev' }
}

function pr(overrides: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {
    number: 1,
    title: 'fix: something',
    isDraft: false,
    headRefName: 'fix/something',
    labels: [],
    assignees: [],
    reviewRequests: [],
    latestReviews: [],
    reviewDecision: null,
    author: { login: 'someone' },
    ...overrides
  }
}

describe('parseOnCallEmails', () => {
  it('reads and dedupes current on-call users from the included graph', () => {
    const payload = {
      included: [
        { type: 'shifts', attributes: { start: '2026-07-22T00:00:00Z' } },
        { type: 'users', attributes: { email: 'a@comfy.org', name: 'A' } },
        { type: 'users', attributes: { email: 'a@comfy.org' } },
        { type: 'users', attributes: { email: 'b@comfy.org' } }
      ]
    }

    expect(parseOnCallEmails(payload)).toEqual(['a@comfy.org', 'b@comfy.org'])
  })

  it('ignores payloads without usable user records', () => {
    expect(parseOnCallEmails(null)).toEqual([])
    expect(parseOnCallEmails({ included: 'nope' })).toEqual([])
    expect(parseOnCallEmails({ included: [{ type: 'users' }] })).toEqual([])
    expect(
      parseOnCallEmails({
        included: [{ type: 'users', attributes: { email: ' ' } }]
      })
    ).toEqual([])
  })
})

describe('parseGithubLogins', () => {
  it('reads github:<user>:<login> tags and ignores unrelated ones', () => {
    const payload = {
      data: {
        attributes: {
          tags: [
            'github:ben:benceruleanlu',
            'team:frontend',
            'github:drjkl:drjkl',
            'github:malformed',
            42
          ]
        }
      }
    }

    expect(parseGithubLogins(payload)).toEqual({
      ben: 'benceruleanlu',
      drjkl: 'drjkl'
    })
  })

  it('ignores payloads without a usable tag list', () => {
    expect(parseGithubLogins(null)).toEqual({})
    expect(parseGithubLogins({ data: {} })).toEqual({})
    expect(parseGithubLogins({ data: { attributes: { tags: 'no' } } })).toEqual(
      {}
    )
  })
})

describe('nextInRotation', () => {
  const rotation = ['a', 'b', 'c']

  it('wraps around and ignores case', () => {
    expect(nextInRotation(rotation, 'B')).toBe('c')
    expect(nextInRotation(rotation, 'c')).toBe('a')
  })

  it('has no answer when the sheriff is alone or absent', () => {
    expect(nextInRotation(['solo'], 'solo')).toBeNull()
    expect(nextInRotation(rotation, 'stranger')).toBeNull()
    expect(nextInRotation([], 'a')).toBeNull()
  })
})

describe('parseRotationKeys', () => {
  const payload = {
    included: [
      {
        type: 'layers',
        id: 'l1',
        relationships: { members: { data: [{ id: 'm2' }, { id: 'm1' }] } }
      },
      {
        type: 'members',
        id: 'm1',
        relationships: { user: { data: { id: 'u1' } } }
      },
      {
        type: 'members',
        id: 'm2',
        relationships: { user: { data: { id: 'u2' } } }
      },
      { type: 'users', id: 'u1', attributes: { email: 'ann@comfy.org' } },
      { type: 'users', id: 'u2', attributes: { email: 'bo@comfy.org' } }
    ]
  }

  it('preserves member order, which is what makes "next" meaningful', () => {
    expect(parseRotationKeys(payload)).toEqual(['bo', 'ann'])
  })

  it('reads nothing from a payload without a member graph', () => {
    expect(parseRotationKeys(null)).toEqual([])
    expect(parseRotationKeys({ included: 'nope' })).toEqual([])
  })
})

describe('singleLine', () => {
  it('cannot emit a line that closes a GITHUB_OUTPUT heredoc early', () => {
    expect(singleLine('before\n__EOF__\nafter')).toBe('before __EOF__ after')
  })

  it('collapses incidental whitespace', () => {
    expect(singleLine('  a\t\tb \n c  ')).toBe('a b c')
  })
})

describe('CONFIG', () => {
  // The shipped config sat on placeholder values for weeks: every run warned
  // "No Datadog On-Call schedule configured", assigned the fallback, and still
  // went green. Reaching the credentials guard proves the schedule is wired.
  it('is wired up far enough to attempt a Datadog lookup', async () => {
    const result = await fetchOnCallEmails(CONFIG, {})

    expect(result.warning).toMatch(/DATADOG_API_KEY \/ DATADOG_APP_KEY/)
  })
})

describe('fetchOnCallEmails', () => {
  const datadog = { datadogSite: 'datadoghq.com', scheduleId: 'sched-1' }
  const creds = { apiKey: 'api', appKey: 'app' }

  it('warns and skips the request when no schedule is configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchOnCallEmails(
      { ...datadog, scheduleId: '' },
      creds
    )

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/no datadog on-call schedule/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('warns and skips the request when credentials are missing', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchOnCallEmails(datadog, { apiKey: 'api' })

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/DATADOG_API_KEY \/ DATADOG_APP_KEY/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('warns on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      })
    )

    const result = await fetchOnCallEmails(datadog, creds)

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/503 Service Unavailable/)
  })

  it('warns when the request is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    const result = await fetchOnCallEmails(datadog, creds)

    expect(result.emails).toEqual([])
    expect(result.warning).toMatch(/lookup failed \(Error: boom\)/)
  })

  it('returns the parsed on-call emails and no warning on success', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          included: [
            { type: 'users', attributes: { email: 'sheriff@comfy.org' } }
          ]
        })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchOnCallEmails(datadog, creds)

    expect(result).toEqual({ emails: ['sheriff@comfy.org'], warning: null })

    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe(
      'https://api.datadoghq.com/api/v2/on-call/schedules/sched-1/responders' +
        '?include=responders.shifts.user&filter%5Bposition%5D=current'
    )
    expect(init.headers).toMatchObject({
      'DD-API-KEY': 'api',
      'DD-APPLICATION-KEY': 'app'
    })
  })

  it('reads the login directory from the schedule itself', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: { attributes: { tags: ['github:sheriff:sheriff-dev'] } }
        })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchGithubLogins(datadog, creds)

    expect(result).toEqual({
      githubLoginByUser: { sheriff: 'sheriff-dev' },
      rotation: [],
      unmappedMembers: [],
      warning: null
    })
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'https://api.datadoghq.com/api/v2/on-call/schedules/sched-1' +
        '?include=layers.members.user'
    )
  })

  it('separates tagged members from those still missing a login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { attributes: { tags: ['github:ann:ann-gh'] } },
            included: [
              {
                type: 'layers',
                id: 'l1',
                relationships: {
                  members: { data: [{ id: 'm1' }, { id: 'm2' }] }
                }
              },
              {
                type: 'members',
                id: 'm1',
                relationships: { user: { data: { id: 'u1' } } }
              },
              {
                type: 'members',
                id: 'm2',
                relationships: { user: { data: { id: 'u2' } } }
              },
              {
                type: 'users',
                id: 'u1',
                attributes: { email: 'ann@comfy.org' }
              },
              { type: 'users', id: 'u2', attributes: { email: 'bo@comfy.org' } }
            ]
          })
      })
    )

    const result = await fetchGithubLogins(datadog, creds)

    expect(result.rotation).toEqual(['ann-gh'])
    expect(result.unmappedMembers).toEqual(['bo'])
  })

  it('degrades the directory to empty when Datadog is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

    const result = await fetchGithubLogins(datadog, creds)

    expect(result.githubLoginByUser).toEqual({})
    expect(result.unmappedMembers).toEqual([])
    expect(result.warning).toMatch(/lookup failed/)
  })
})

describe('resolveSheriff', () => {
  it('maps the on-call email to a GitHub login regardless of case', () => {
    expect(resolveSheriff(['SHERIFF@comfy.org'], config)).toEqual({
      login: 'sheriff-dev',
      source: 'datadog',
      unmappedEmails: []
    })
  })

  it('skips unmapped users and reports them alongside the resolved login', () => {
    expect(
      resolveSheriff(['ghost@comfy.org', 'sheriff@comfy.org'], config)
    ).toEqual({
      login: 'sheriff-dev',
      source: 'datadog',
      unmappedEmails: ['ghost@comfy.org']
    })
  })

  it('falls back when nothing resolves', () => {
    expect(resolveSheriff(['ghost@comfy.org'], config)).toEqual({
      login: 'fallback-dev',
      source: 'fallback',
      unmappedEmails: ['ghost@comfy.org']
    })
  })

  it('reports no sheriff when the fallback is unset', () => {
    expect(
      resolveSheriff([], { ...config, fallbackGithubLogin: '  ' })
    ).toMatchObject({ login: null, source: 'none' })
  })
})

describe('isSheriffPr', () => {
  it('matches backports and release version-bump PRs', () => {
    expect(isSheriffPr(pr({ labels: [{ name: 'backport' }] }))).toBe(true)
    expect(isSheriffPr(pr({ title: '[Backport core/1.46] fix: x' }))).toBe(true)
    expect(isSheriffPr(pr({ labels: [{ name: 'Release' }] }))).toBe(true)
    expect(isSheriffPr(pr({ headRefName: 'version-bump-1.45.22' }))).toBe(true)
    expect(isSheriffPr(pr({ headRefName: 'version-bump-1.46.0-beta.1' }))).toBe(
      true
    )
  })

  it('matches anything opened by automation, whatever it is about', () => {
    for (const login of [
      'app/dependabot',
      'app/cloud-code-bot',
      'comfy-pr-bot'
    ])
      expect(isSheriffPr(pr({ author: { login } }))).toBe(true)
  })

  it('ignores humans whose login merely resembles a bot', () => {
    expect(isSheriffPr(pr({ author: { login: 'dependabot-fan' } }))).toBe(false)
    expect(isSheriffPr(pr({ author: null }))).toBe(false)
  })

  it('ignores feature branches that merely start with version-bump-', () => {
    expect(isSheriffPr(pr())).toBe(false)
    expect(isSheriffPr(pr({ headRefName: 'feat/version-bump-ui' }))).toBe(false)
    expect(
      isSheriffPr(pr({ headRefName: 'version-bump-fix-subscription-i18n' }))
    ).toBe(false)
  })

  it('ignores PRs that merely mention backport in the title', () => {
    expect(
      isSheriffPr(pr({ title: 'feat(ci): auto-assign backport PRs' }))
    ).toBe(false)
    expect(
      isSheriffPr(pr({ title: 'docs: explain the backport process' }))
    ).toBe(false)
  })
})

describe('planActions', () => {
  it('assigns and requests review on an untouched backport PR', () => {
    expect(
      planActions(
        [pr({ number: 7, labels: [{ name: 'backport' }] })],
        'sheriff'
      )
    ).toEqual([
      { number: 7, assign: true, requestReview: true, reviewer: 'sheriff' }
    ])
  })

  it('never overwrites an existing assignee or review request', () => {
    const prs = [
      pr({
        number: 1,
        labels: [{ name: 'backport' }],
        assignees: [{ login: 'dev' }]
      }),
      pr({
        number: 2,
        labels: [{ name: 'backport' }],
        reviewRequests: [{ login: 'dev' }]
      })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([
      { number: 1, assign: false, requestReview: true, reviewer: 'sheriff' },
      { number: 2, assign: true, requestReview: false, reviewer: 'sheriff' }
    ])
  })

  it('does not request review on approved PRs, nor from the sheriff on their own', () => {
    const prs = [
      pr({
        number: 1,
        labels: [{ name: 'backport' }],
        reviewDecision: 'APPROVED'
      }),
      pr({
        number: 2,
        labels: [{ name: 'backport' }],
        author: { login: 'Sheriff' }
      })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([
      { number: 1, assign: true, requestReview: false, reviewer: 'sheriff' },
      { number: 2, assign: true, requestReview: false, reviewer: null }
    ])
  })

  it('asks the next person in the rotation to review the sheriff’s own PR', () => {
    const own = pr({
      number: 3,
      labels: [{ name: 'backport' }],
      author: { login: 'Sheriff' }
    })

    expect(planActions([own], 'sheriff', ['a', 'sheriff', 'b'])).toEqual([
      { number: 3, assign: true, requestReview: true, reviewer: 'b' }
    ])
  })

  it('does not re-request review from a sheriff who already reviewed', () => {
    const prs = [
      pr({
        number: 1,
        labels: [{ name: 'backport' }],
        assignees: [{ login: 'dev' }],
        latestReviews: [{ author: { login: 'Sheriff' } }],
        reviewDecision: 'CHANGES_REQUESTED'
      }),
      pr({
        number: 2,
        labels: [{ name: 'backport' }],
        latestReviews: [{ author: { login: 'someone-else' } }]
      })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([
      { number: 2, assign: true, requestReview: true, reviewer: 'sheriff' }
    ])
  })

  it('skips drafts and out-of-scope PRs', () => {
    const prs = [
      pr({ number: 1, labels: [{ name: 'backport' }], isDraft: true }),
      pr({ number: 2 })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([])
  })
})
