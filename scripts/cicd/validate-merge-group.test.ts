import { describe, expect, it, vi } from 'vitest'

import {
  loadMergeGroupPullRequests,
  validateMergeGroupPolicy
} from './validate-merge-group'
import type { RepoRequest } from './validate-merge-group'

const HEAD_SHA = 'a'.repeat(40)

function validBody(): string {
  return `## Reproduction or validation steps
1. Run the metadata check
2. Inspect the generated result

## Evidence type
- [ ] Visual
- [x] Non-visual

## Non-visual rationale
N/A: This changes CI metadata only.

## Test or log evidence
\`pnpm test:unit\` passed.`
}

function activeHuman() {
  return {
    membership: { state: 'active' },
    teamMembership: { state: 'active' },
    user: { login: 'maintainer', suspended_at: null, type: 'User' }
  }
}

describe('loadMergeGroupPullRequests', () => {
  it('uses associated PRs and refetches current metadata for every PR', async () => {
    const request: RepoRequest = vi.fn(async (path) => {
      if (path === `commits/${HEAD_SHA}/pulls`) {
        return [
          { body: 'stale', number: 41 },
          { body: 'stale', number: 42 }
        ]
      }
      if (path === 'pulls/41') {
        return {
          assignees: [{ login: 'maintainer', type: 'User' }],
          body: 'current 41',
          number: 41
        }
      }
      if (path === 'pulls/42') {
        return {
          assignees: [{ login: 'owner', type: 'User' }],
          body: 'current 42',
          number: 42
        }
      }
      throw new Error(`Unexpected path: ${path}`)
    })

    const result = await loadMergeGroupPullRequests(
      { merge_group: { head_ref: 'unused', head_sha: HEAD_SHA } },
      request
    )

    expect(result.map(({ body, number }) => ({ body, number }))).toEqual([
      { body: 'current 41', number: 41 },
      { body: 'current 42', number: 42 }
    ])
  })

  it('falls back to the exact queue head_ref PR token when associations are empty', async () => {
    const request: RepoRequest = vi.fn(async (path) => {
      if (path === `commits/${HEAD_SHA}/pulls`) return []
      if (path === 'pulls/13556') {
        return { assignees: [], body: validBody(), number: 13556 }
      }
      throw new Error(`Unexpected path: ${path}`)
    })

    const result = await loadMergeGroupPullRequests(
      {
        merge_group: {
          head_ref: `refs/heads/gh-readonly-queue/main/pr-13556-${HEAD_SHA}`,
          head_sha: HEAD_SHA
        }
      },
      request
    )

    expect(result).toHaveLength(1)
    expect(result[0].number).toBe(13556)
  })

  it('fails when neither API associations nor an exact head_ref token exist', async () => {
    const request: RepoRequest = vi.fn().mockResolvedValue([])

    await expect(
      loadMergeGroupPullRequests(
        {
          merge_group: {
            head_ref: `refs/heads/gh-readonly-queue/main/not-a-pr-${HEAD_SHA}`,
            head_sha: HEAD_SHA
          }
        },
        request
      )
    ).rejects.toThrow('No pull request was associated with the merge group')
  })

  it('propagates associated-pulls API failures', async () => {
    await expect(
      loadMergeGroupPullRequests(
        { merge_group: { head_ref: 'unused', head_sha: HEAD_SHA } },
        vi.fn().mockRejectedValue(new Error('GitHub API unavailable'))
      )
    ).rejects.toThrow('GitHub API unavailable')
  })
})

describe('validateMergeGroupPolicy', () => {
  it('validates current evidence and human-team ownership for every PR', async () => {
    const request: RepoRequest = vi.fn(async (path) => {
      if (path === `commits/${HEAD_SHA}/pulls`) {
        return [{ number: 41 }, { number: 42 }]
      }
      const number = Number(path.replace('pulls/', ''))
      return {
        assignees: [{ login: 'maintainer', type: 'User' }],
        body: validBody(),
        number
      }
    })

    const result = await validateMergeGroupPolicy(
      { merge_group: { head_ref: 'unused', head_sha: HEAD_SHA } },
      request,
      vi.fn().mockResolvedValue(activeHuman())
    )

    expect(result.valid).toBe(true)
  })

  it('prefixes failures from any current PR in the group', async () => {
    const request: RepoRequest = vi.fn(async (path) => {
      if (path === `commits/${HEAD_SHA}/pulls`) {
        return [{ number: 41 }, { number: 42 }]
      }
      const number = Number(path.replace('pulls/', ''))
      return {
        assignees: [{ login: 'maintainer', type: 'User' }],
        body: number === 41 ? validBody() : '',
        number
      }
    })

    const result = await validateMergeGroupPolicy(
      { merge_group: { head_ref: 'unused', head_sha: HEAD_SHA } },
      request,
      vi.fn().mockResolvedValue(activeHuman())
    )

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.startsWith('PR #42:'))).toBe(
      true
    )
  })
})
