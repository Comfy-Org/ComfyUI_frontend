import { describe, expect, it } from 'vitest'

import type { PullRequestSummary } from './release-sheriff'
import {
  isSheriffPr,
  parseOnCallEmails,
  planActions,
  resolveSheriff
} from './release-sheriff'

const config = {
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

  it('ignores feature branches that merely start with version-bump-', () => {
    expect(isSheriffPr(pr())).toBe(false)
    expect(isSheriffPr(pr({ headRefName: 'feat/version-bump-ui' }))).toBe(false)
    expect(
      isSheriffPr(pr({ headRefName: 'version-bump-fix-subscription-i18n' }))
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
    ).toEqual([{ number: 7, assign: true, requestReview: true }])
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
      { number: 1, assign: false, requestReview: true },
      { number: 2, assign: true, requestReview: false }
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
        author: { login: 'sheriff' }
      })
    ]

    expect(planActions(prs, 'sheriff')).toEqual([
      { number: 1, assign: true, requestReview: false },
      { number: 2, assign: true, requestReview: false }
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
