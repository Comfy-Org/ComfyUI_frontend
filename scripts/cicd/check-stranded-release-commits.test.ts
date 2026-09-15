import { describe, expect, it } from 'vitest'

import {
  classifyCommits,
  evaluateLine,
  minorLineOf,
  evaluatePin,
  hasPendingBump,
  shouldRequestDispatch,
  newestStableVersion,
  parsePinnedVersion,
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

describe('parsePinnedVersion', () => {
  it('reads the pinned frontend version out of requirements.txt', () => {
    expect(
      parsePinnedVersion(
        'torch\ncomfyui-frontend-package==1.47.11\nnumpy>=1.25.0'
      )
    ).toBe('1.47.11')
  })

  it('reads a >= constraint', () => {
    expect(parsePinnedVersion('comfyui-frontend-package>=2.0.3')).toBe('2.0.3')
  })

  it('returns null when the package is absent', () => {
    expect(parsePinnedVersion('torch\nnumpy')).toBeNull()
  })

  it('does not match a similarly named package', () => {
    expect(
      parsePinnedVersion('comfyui-frontend-package-nightly==1.47.11')
    ).toBeNull()
  })
})

describe('newestStableVersion', () => {
  it('orders numerically rather than lexically', () => {
    expect(newestStableVersion(['1.9.0', '1.10.0', '1.47.9'])).toBe('1.47.9')
    expect(newestStableVersion(['1.47.9', '1.47.10'])).toBe('1.47.10')
  })

  it('ignores pre-release formats', () => {
    expect(newestStableVersion(['1.47.10', '1.48.0a1', '1.22.3a6'])).toBe(
      '1.47.10'
    )
  })

  it('returns null when nothing is a stable release', () => {
    expect(newestStableVersion(['1.22.3a1', 'nightly'])).toBeNull()
  })
})

describe('evaluatePin', () => {
  it('fails when the pin lags a newer patch on the same line', () => {
    // The state right after 1.47.11 published: stable still installs 1.47.10,
    // so the fix has not reached a single user yet.
    const finding = evaluatePin({
      pinned: '1.47.10',
      newestOnPinnedLine: '1.47.11'
    })
    expect(finding).toMatchObject({ kind: 'pin-lag', severity: 'failure' })
  })

  it('passes when the pin is current for its line', () => {
    expect(
      evaluatePin({ pinned: '1.47.11', newestOnPinnedLine: '1.47.11' })
    ).toBeNull()
  })
})

describe('hasPendingBump', () => {
  it('detects a bump that landed but was never tagged', () => {
    // core/1.48 on 2026-08-10: #14973 merged the 1.48.8 bump, but draft_release
    // 403'd so v1.48.8 never existed. Dispatching again just burns 1.48.9.
    expect(
      hasPendingBump({ branchVersion: '1.48.8', latestTag: 'v1.48.7' })
    ).toBe(true)
  })

  it('is false when the branch matches its latest tag', () => {
    expect(
      hasPendingBump({ branchVersion: '1.48.7', latestTag: 'v1.48.7' })
    ).toBe(false)
  })

  it('tolerates a tag without the v prefix', () => {
    expect(
      hasPendingBump({ branchVersion: '1.48.7', latestTag: '1.48.7' })
    ).toBe(false)
  })
})

describe('shouldRequestDispatch', () => {
  it('requests a dispatch when the branch matches its tag', () => {
    expect(
      shouldRequestDispatch({ latestTag: 'v1.48.7', branchVersion: '1.48.7' })
    ).toBe(true)
  })

  it('declines when a bump already landed unreleased', () => {
    expect(
      shouldRequestDispatch({ latestTag: 'v1.48.7', branchVersion: '1.48.8' })
    ).toBe(false)
  })

  it('fails closed when either value is unavailable', () => {
    // Unreadable package.json or a tagless branch means we cannot prove a bump
    // is not already pending. Dispatching on an unproven assumption is what
    // burned 1.48.8 and 1.48.9.
    expect(
      shouldRequestDispatch({ latestTag: 'v1.48.7', branchVersion: null })
    ).toBe(false)
    expect(
      shouldRequestDispatch({ latestTag: null, branchVersion: '1.48.7' })
    ).toBe(false)
    expect(
      shouldRequestDispatch({ latestTag: null, branchVersion: null })
    ).toBe(false)
  })
})
