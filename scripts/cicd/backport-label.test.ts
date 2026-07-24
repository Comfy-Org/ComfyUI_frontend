import { describe, expect, it } from 'vitest'

import type { PullRequestSummary } from './backport-label'
import {
  isBackportBranchForBase,
  planBackportLabels,
  toSafeBranchName
} from './backport-label'

function pr(
  number: number,
  headRefName: string,
  baseRefName: string,
  labels: string[] = []
): PullRequestSummary {
  return {
    number,
    headRefName,
    baseRefName,
    labels: labels.map((name) => ({ name }))
  }
}

describe('toSafeBranchName', () => {
  it('replaces every slash, matching the workflow tr', () => {
    expect(toSafeBranchName('cloud/1.47')).toBe('cloud-1.47')
    expect(toSafeBranchName('core/1.45')).toBe('core-1.45')
    expect(toSafeBranchName('release/hotfix/urgent')).toBe(
      'release-hotfix-urgent'
    )
  })

  it('leaves slashless branches alone', () => {
    expect(toSafeBranchName('main')).toBe('main')
  })
})

describe('isBackportBranchForBase', () => {
  it('recognises the branches pr-backport.yaml generates', () => {
    expect(
      isBackportBranchForBase('backport-13875-to-cloud-1.47', 'cloud/1.47')
    ).toBe(true)
    expect(
      isBackportBranchForBase('backport-13875-to-core-1.47', 'core/1.47')
    ).toBe(true)
    expect(
      isBackportBranchForBase('backport-13971-to-cloud-1.45', 'cloud/1.45')
    ).toBe(true)
  })

  it('recognises non-release targets that use the branch: label form', () => {
    expect(
      isBackportBranchForBase('backport-42-to-release-hotfix', 'release/hotfix')
    ).toBe(true)
  })

  it('rejects a branch whose encoded target is not the PR base', () => {
    expect(
      isBackportBranchForBase('backport-13875-to-cloud-1.47', 'cloud/1.45')
    ).toBe(false)
    expect(
      isBackportBranchForBase('backport-13875-to-cloud-1.47', 'main')
    ).toBe(false)
  })

  it('rejects ordinary branches that merely mention backport', () => {
    expect(isBackportBranchForBase('fix/backport-tooling', 'cloud/1.47')).toBe(
      false
    )
    expect(isBackportBranchForBase('backport-cloud-1.47', 'cloud/1.47')).toBe(
      false
    )
    expect(
      isBackportBranchForBase('glary/backport-label-invariant', 'main')
    ).toBe(false)
  })

  it('requires a numeric source PR number', () => {
    expect(
      isBackportBranchForBase('backport-abc-to-cloud-1.47', 'cloud/1.47')
    ).toBe(false)
  })
})

describe('planBackportLabels', () => {
  // The four PRs from the incident: #13875 and #13971 both hit cherry-pick
  // conflicts, so pr-backport.yaml never reached its `gh pr create --label
  // "backport"` call and the backports were opened by hand with only the
  // auto-applied size label.
  it('flags hand-created backport PRs that are missing the label', () => {
    expect(
      planBackportLabels([
        pr(14018, 'backport-13875-to-cloud-1.47', 'cloud/1.47', ['size:M']),
        pr(14019, 'backport-13875-to-core-1.47', 'core/1.47', ['size:M']),
        pr(14020, 'backport-13971-to-cloud-1.47', 'cloud/1.47', ['size:M']),
        pr(14021, 'backport-13971-to-cloud-1.45', 'cloud/1.45', ['size:M'])
      ])
    ).toEqual([14018, 14019, 14020, 14021])
  })

  it('leaves workflow-created backports alone', () => {
    expect(
      planBackportLabels([
        pr(13830, 'backport-13825-to-cloud-1.47', 'cloud/1.47', [
          'backport',
          'size:L'
        ])
      ])
    ).toEqual([])
  })

  it('ignores PRs that are not backports', () => {
    expect(
      planBackportLabels([
        pr(14022, 'glary/release-sheriff-auto-assign', 'main', ['size:L']),
        pr(14023, 'fix/backport-docs', 'main')
      ])
    ).toEqual([])
  })

  it('returns each PR once, in ascending order', () => {
    expect(
      planBackportLabels([
        pr(20, 'backport-2-to-core-1.47', 'core/1.47'),
        pr(10, 'backport-1-to-cloud-1.47', 'cloud/1.47'),
        pr(20, 'backport-2-to-core-1.47', 'core/1.47')
      ])
    ).toEqual([10, 20])
  })

  it('handles an empty candidate list', () => {
    expect(planBackportLabels([])).toEqual([])
  })
})
