import { describe, expect, it } from 'vitest'

import {
  classifyCommits,
  evaluateLine,
  minorLineOf,
  releaseBranchFor
} from './check-stranded-release-commits'

describe('minorLineOf', () => {
  it('reduces a patch version to its minor line', () => {
    expect(minorLineOf('1.47.10')).toBe('1.47')
    expect(minorLineOf('2.0.0')).toBe('2.0')
  })

  it('returns null for a non-semver input', () => {
    expect(minorLineOf('nightly')).toBeNull()
    expect(minorLineOf('1.47')).toBeNull()
  })
})

describe('releaseBranchFor', () => {
  it('maps a minor line to its core release branch', () => {
    expect(releaseBranchFor('1.47')).toBe('core/1.47')
  })
})

describe('classifyCommits', () => {
  it('separates fix commits from everything else', () => {
    const { fixes, others } = classifyCommits([
      {
        sha: 'a1',
        subject: 'fix(select): lift Reka dropdowns above modal stack'
      },
      { sha: 'b2', subject: 'feat: add workflow context to RUM events' },
      { sha: 'c3', subject: '[backport core/1.47] fix: preserve image pixels' },
      { sha: 'd4', subject: 'docs: tidy the runbook' }
    ])

    expect(fixes.map((c) => c.sha)).toEqual(['a1', 'c3'])
    expect(others.map((c) => c.sha)).toEqual(['b2', 'd4'])
  })

  it('does not treat an unrelated word containing "fix" as a fix commit', () => {
    const { fixes } = classifyCommits([
      { sha: 'e5', subject: 'refactor: rename prefix helper' }
    ])
    expect(fixes).toHaveLength(0)
  })

  it('catches non-conventional fix subjects', () => {
    // #14116 shipped as "Fix migration of ..." with no colon — a real stranded
    // fix that a conventional-commit-only pattern silently misses.
    const { fixes } = classifyCommits([
      {
        sha: 'f6',
        subject:
          '[backport core/1.47] Fix migration of legacy reordered linked subgraph widgets (#14116)'
      },
      { sha: 'g7', subject: 'Fixes flaky subgraph test' }
    ])
    expect(fixes.map((c) => c.sha)).toEqual(['f6', 'g7'])
  })
})

describe('evaluateLine', () => {
  const line = {
    branch: 'core/1.47',
    latestTag: 'v1.47.10',
    publishedVersion: '1.47.10'
  }

  it('reports no findings when nothing is stranded', () => {
    expect(evaluateLine({ ...line, commits: [] }).findings).toEqual([])
  })

  it('flags stranded fix commits as a failure', () => {
    const { findings, failed } = evaluateLine({
      ...line,
      commits: [
        {
          sha: 'a1',
          subject: 'fix(select): lift Reka dropdowns above modal stack'
        }
      ]
    })

    expect(failed).toBe(true)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      branch: 'core/1.47',
      severity: 'failure',
      strandedFixCount: 1
    })
  })

  it('does not fail the build for stranded non-fix commits alone', () => {
    const { findings, failed } = evaluateLine({
      ...line,
      commits: [{ sha: 'b2', subject: 'feat: add workflow context' }]
    })

    expect(failed).toBe(false)
    expect(findings[0]).toMatchObject({
      severity: 'notice',
      strandedFixCount: 0
    })
  })

  it('flags a published version that lags the branch tag', () => {
    const { findings, failed } = evaluateLine({
      ...line,
      publishedVersion: '1.47.9',
      commits: []
    })

    expect(failed).toBe(true)
    expect(findings.some((f) => f.kind === 'published-version-lag')).toBe(true)
  })

  it('treats a missing published version as a failure rather than passing silently', () => {
    const { failed } = evaluateLine({
      ...line,
      publishedVersion: null,
      commits: []
    })

    expect(failed).toBe(true)
  })
})
