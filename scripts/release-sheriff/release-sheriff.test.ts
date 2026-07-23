import { describe, expect, it } from 'vitest'

import type {
  PullRequestSummary,
  ReleaseSheriffConfig
} from './release-sheriff'
import {
  parseOnCallEmails,
  planSheriffActions,
  resolveSheriff,
  sheriffScopeOf
} from './release-sheriff'

const config: ReleaseSheriffConfig = {
  datadog: { site: 'datadoghq.com', scheduleId: 'schedule-1' },
  fallbackGithubLogin: 'fallback-dev',
  githubLoginByEmail: { 'Sheriff@comfy.org': 'sheriff-dev' }
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
    reviewDecision: null,
    author: { login: 'someone' },
    ...overrides
  }
}

describe('parseOnCallEmails', () => {
  it('reads current on-call users out of the included graph', () => {
    const payload = {
      data: { type: 'schedule_oncall_responders' },
      included: [
        {
          type: 'schedule_oncall_responder',
          attributes: { position: 'current' }
        },
        { type: 'shifts', attributes: { start: '2026-07-22T00:00:00Z' } },
        { type: 'users', attributes: { email: 'sheriff@comfy.org', name: 'S' } }
      ]
    }

    expect(parseOnCallEmails(payload)).toEqual(['sheriff@comfy.org'])
  })

  it('deduplicates users appearing across multiple shifts', () => {
    const payload = {
      included: [
        { type: 'users', attributes: { email: 'a@comfy.org' } },
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

describe('resolveSheriff', () => {
  it('maps the on-call email to a GitHub login regardless of case', () => {
    expect(resolveSheriff(['SHERIFF@comfy.org'], config)).toEqual({
      login: 'sheriff-dev',
      source: 'datadog',
      email: 'SHERIFF@comfy.org',
      unmappedEmails: []
    })
  })

  it('skips unmapped users and reports them alongside the fallback', () => {
    expect(
      resolveSheriff(['ghost@comfy.org', 'sheriff@comfy.org'], config)
    ).toEqual({
      login: 'sheriff-dev',
      source: 'datadog',
      email: 'sheriff@comfy.org',
      unmappedEmails: ['ghost@comfy.org']
    })
  })

  it('falls back when nothing resolves', () => {
    expect(resolveSheriff([], config)).toMatchObject({
      login: 'fallback-dev',
      source: 'fallback'
    })
    expect(resolveSheriff(['ghost@comfy.org'], config)).toMatchObject({
      login: 'fallback-dev',
      source: 'fallback',
      unmappedEmails: ['ghost@comfy.org']
    })
  })

  it('reports no sheriff when the fallback is unset', () => {
    const withoutFallback = { ...config, fallbackGithubLogin: '  ' }

    expect(resolveSheriff([], withoutFallback)).toMatchObject({
      login: null,
      source: 'none'
    })
  })
})

describe('sheriffScopeOf', () => {
  it('matches backport PRs by label and by title', () => {
    expect(sheriffScopeOf(pr({ labels: [{ name: 'backport' }] }))).toBe(
      'backport-label'
    )
    expect(sheriffScopeOf(pr({ title: '[Backport core/1.46] fix: x' }))).toBe(
      'backport-title'
    )
  })

  it('matches version bump PRs by release label and branch name', () => {
    expect(sheriffScopeOf(pr({ labels: [{ name: 'Release' }] }))).toBe(
      'release-label'
    )
    expect(sheriffScopeOf(pr({ headRefName: 'version-bump-1.45.22' }))).toBe(
      'version-bump-branch'
    )
  })

  it('ignores unrelated PRs', () => {
    expect(sheriffScopeOf(pr())).toBeNull()
    expect(
      sheriffScopeOf(pr({ headRefName: 'feat/version-bump-ui' }))
    ).toBeNull()
  })
})

describe('planSheriffActions', () => {
  it('assigns and requests review on an untouched backport PR', () => {
    const actions = planSheriffActions(
      [pr({ number: 7, labels: [{ name: 'backport' }] })],
      'sheriff-dev'
    )

    expect(actions).toEqual([
      { number: 7, scope: 'backport-label', assign: true, requestReview: true }
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
      }),
      pr({
        number: 3,
        labels: [{ name: 'backport' }],
        assignees: [{ login: 'dev' }],
        reviewRequests: [{ login: 'dev' }]
      })
    ]

    expect(planSheriffActions(prs, 'sheriff-dev')).toEqual([
      {
        number: 1,
        scope: 'backport-label',
        assign: false,
        requestReview: true
      },
      { number: 2, scope: 'backport-label', assign: true, requestReview: false }
    ])
  })

  it('does not request review on approved PRs or the sheriff’s own PRs', () => {
    const prs = [
      pr({
        number: 1,
        labels: [{ name: 'backport' }],
        reviewDecision: 'APPROVED'
      }),
      pr({
        number: 2,
        labels: [{ name: 'backport' }],
        author: { login: 'sheriff-dev' }
      })
    ]

    expect(planSheriffActions(prs, 'sheriff-dev')).toEqual([
      {
        number: 1,
        scope: 'backport-label',
        assign: true,
        requestReview: false
      },
      { number: 2, scope: 'backport-label', assign: true, requestReview: false }
    ])
  })

  it('skips drafts and out-of-scope PRs', () => {
    const prs = [
      pr({ number: 1, labels: [{ name: 'backport' }], isDraft: true }),
      pr({ number: 2 })
    ]

    expect(planSheriffActions(prs, 'sheriff-dev')).toEqual([])
  })
})
