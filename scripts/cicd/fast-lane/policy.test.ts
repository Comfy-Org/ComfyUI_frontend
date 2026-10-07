import { describe, expect, it } from 'vitest'

import { parseFastLaneConfig } from './config.ts'
import {
  approvalForHead,
  changedPaths,
  eligibilityFailure,
  hasActiveHumanChangeRequest,
  hasAuthorizedApprovalLabel,
  hasCompleteChangedFileList,
  isApprovalForHead,
  isInsideLane
} from './policy.ts'
import type { FastLaneConfig, PullRequest, PullRequestReview } from './types.ts'

const lane: FastLaneConfig = {
  schemaVersion: 1,
  id: 'website',
  pathPrefixes: ['apps/website/'],
  approval: {
    identity: 'christian-byrne',
    trustedAuthors: ['bertfy'],
    approvalLabel: 'website-fast-lane:approve',
    trustedLabelers: ['drjkl'],
    holdLabel: 'website-fast-lane:hold'
  },
  merge: { mode: 'automatic', method: 'SQUASH' }
}

function eligiblePull(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    state: 'open',
    draft: false,
    user: { login: 'bertfy' },
    labels: [],
    head: {
      sha: 'head-sha',
      repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
    },
    base: {
      ref: 'main',
      repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
    },
    ...overrides
  }
}

function failure(
  pull: PullRequest,
  authorization: {
    hasPolicyApprovalForHead?: boolean
    eventName?: string
    eventAction?: string
    eventActor?: string
    eventLabel?: string
  } = {}
): string | undefined {
  return eligibilityFailure({
    pull,
    lane,
    repository: 'Comfy-Org/ComfyUI_frontend',
    defaultBranch: 'main',
    expectedHeadSha: 'head-sha',
    hasPolicyApprovalForHead: authorization.hasPolicyApprovalForHead ?? false,
    eventName: authorization.eventName ?? 'pull_request_target',
    eventAction: authorization.eventAction,
    eventActor: authorization.eventActor,
    eventLabel: authorization.eventLabel
  })
}

describe('lane configuration', () => {
  it('normalizes logins while preserving the reviewed path policy', () => {
    expect(
      parseFastLaneConfig({
        ...lane,
        approval: {
          ...lane.approval,
          identity: 'Christian-Byrne',
          trustedAuthors: ['BertFY', 'bertfy'],
          trustedLabelers: ['DrJKL']
        }
      })
    ).toEqual(lane)
  })

  it.for([
    { key: 'schema version', value: { ...lane, schemaVersion: 2 } },
    { key: 'empty path policy', value: { ...lane, pathPrefixes: [] } },
    {
      key: 'ambiguous path prefix',
      value: { ...lane, pathPrefixes: ['apps/website'] }
    },
    {
      key: 'unknown merge mode',
      value: { ...lane, merge: { mode: 'sometimes', method: 'SQUASH' } }
    }
  ])('rejects $key', ({ value }) => {
    expect(() => parseFastLaneConfig(value)).toThrow()
  })
})

describe('changed-path boundary', () => {
  it('requires a complete, non-empty set inside the configured prefixes', () => {
    const files = [{ filename: 'apps/website/src/pages/index.astro' }]
    expect(hasCompleteChangedFileList(files, 1)).toBe(true)
    expect(hasCompleteChangedFileList(files, 2)).toBe(false)
    expect(isInsideLane(changedPaths(files) ?? [], lane.pathPrefixes)).toBe(
      true
    )
    expect(isInsideLane([], lane.pathPrefixes)).toBe(false)
    expect(
      isInsideLane(
        ['apps/website/src/pages/index.astro', 'pnpm-lock.yaml'],
        lane.pathPrefixes
      )
    ).toBe(false)
    expect(isInsideLane(['apps/website-evil/file.ts'], lane.pathPrefixes)).toBe(
      false
    )
  })

  it.for([
    {
      name: 'rename into the lane',
      file: {
        status: 'renamed',
        previous_filename: 'src/sensitive.ts',
        filename: 'apps/website/sensitive.ts'
      },
      expected: ['apps/website/sensitive.ts', 'src/sensitive.ts']
    },
    {
      name: 'copy into the lane',
      file: {
        status: 'copied',
        previous_filename: 'src/sensitive.ts',
        filename: 'apps/website/sensitive.ts'
      },
      expected: ['apps/website/sensitive.ts', 'src/sensitive.ts']
    }
  ])('retains both paths for a $name', ({ file, expected }) => {
    const paths = changedPaths([file])
    expect(paths).toEqual(expected)
    expect(isInsideLane(paths ?? [], lane.pathPrefixes)).toBe(false)
  })

  it('fails closed when a rename omits its previous path', () => {
    expect(
      changedPaths([{ status: 'renamed', filename: 'apps/website/new.astro' }])
    ).toBeUndefined()
  })
})

describe('approval policy', () => {
  const operatorLabelEvent = {
    name: 'pull_request_target',
    action: 'labeled',
    actor: 'DrJKL',
    label: 'website-fast-lane:approve'
  }

  it.for([
    {
      name: 'the trusted operator label event',
      labels: ['website-fast-lane:approve'],
      event: operatorLabelEvent,
      expected: true
    },
    {
      name: 'an untrusted labeler',
      labels: ['website-fast-lane:approve'],
      event: { ...operatorLabelEvent, actor: 'someone-else' },
      expected: false
    },
    {
      name: 'a different label from the operator',
      labels: ['website-fast-lane:approve'],
      event: { ...operatorLabelEvent, label: 'area:website' },
      expected: false
    },
    {
      name: 'an unlabeled event',
      labels: ['website-fast-lane:approve'],
      event: { ...operatorLabelEvent, action: 'unlabeled' },
      expected: false
    },
    {
      name: 'a pull_request event',
      labels: ['website-fast-lane:approve'],
      event: { ...operatorLabelEvent, name: 'pull_request' },
      expected: false
    },
    {
      name: 'a label already removed from the pull request',
      labels: [],
      event: operatorLabelEvent,
      expected: false
    }
  ])('authorizes $name: $expected', ({ labels, event, expected }) => {
    const pull = eligiblePull({
      user: { login: 'someone-else' },
      labels: labels.map((name) => ({ name }))
    })
    expect(hasAuthorizedApprovalLabel(pull, lane, event)).toBe(expected)
  })

  it('gates a non-trusted author on a current label event or a head approval', () => {
    const pull = eligiblePull({
      user: { login: 'someone-else' },
      labels: [{ name: 'website-fast-lane:approve' }]
    })
    expect(
      failure(pull, {
        eventName: 'pull_request_target',
        eventAction: 'synchronize',
        eventActor: 'someone-else'
      })
    ).toContain('lacks a current authorized event')
    expect(
      failure(pull, {
        hasPolicyApprovalForHead: true,
        eventName: 'workflow_run'
      })
    ).toBeUndefined()
    expect(
      failure(pull, {
        eventName: 'pull_request_target',
        eventAction: 'labeled',
        eventActor: 'DrJKL',
        eventLabel: 'website-fast-lane:approve'
      })
    ).toBeUndefined()
  })

  it('keeps a human change request active after a comment-only review', () => {
    const reviews: PullRequestReview[] = [
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'DrJKL', type: 'User' }
      },
      { state: 'COMMENTED', user: { login: 'DrJKL', type: 'User' } }
    ]
    expect(hasActiveHumanChangeRequest(reviews)).toBe(true)
  })

  it('ignores app reviews and clears a human request only decisively', () => {
    expect(
      hasActiveHumanChangeRequest([
        {
          state: 'CHANGES_REQUESTED',
          user: { login: 'coderabbitai[bot]', type: 'Bot' }
        },
        {
          state: 'CHANGES_REQUESTED',
          user: { login: 'DrJKL', type: 'User' }
        },
        { state: 'APPROVED', user: { login: 'DrJKL', type: 'User' } }
      ])
    ).toBe(false)
  })

  it('binds policy approval to the identity and exact head', () => {
    expect(
      isApprovalForHead(
        {
          state: 'APPROVED',
          commit_id: 'head-sha',
          user: { login: 'Christian-Byrne' }
        },
        'christian-byrne',
        'head-sha'
      )
    ).toBe(true)
    expect(
      isApprovalForHead(
        {
          state: 'APPROVED',
          commit_id: 'old-sha',
          user: { login: 'christian-byrne' }
        },
        'christian-byrne',
        'head-sha'
      )
    ).toBe(false)
  })

  it('only selects marked policy approvals for withdrawal', () => {
    const reviews: PullRequestReview[] = [
      {
        id: 1,
        state: 'APPROVED',
        commit_id: 'head-sha',
        body: 'Looks good to me',
        user: { login: 'christian-byrne' }
      },
      {
        id: 2,
        state: 'APPROVED',
        commit_id: 'head-sha',
        body: '[Package fast lane] Policy-only approval. Lane: website.',
        user: { login: 'christian-byrne' }
      }
    ]
    const prefix = '[Package fast lane] Policy-only approval.'

    expect(
      approvalForHead(reviews, 'christian-byrne', 'head-sha', prefix)?.id
    ).toBe(2)
    expect(
      approvalForHead(
        reviews.slice(0, 1),
        'christian-byrne',
        'head-sha',
        prefix
      )
    ).toBeUndefined()
  })
})

describe('fixed eligibility invariants', () => {
  it('accepts the configured trusted-author path', () => {
    expect(failure(eligiblePull())).toBeUndefined()
  })

  it.for([
    {
      name: 'draft',
      pull: eligiblePull({ draft: true }),
      message: 'not open and ready'
    },
    {
      name: 'fork',
      pull: eligiblePull({
        head: {
          sha: 'head-sha',
          repo: { full_name: 'bertfy/ComfyUI_frontend' }
        }
      }),
      message: 'fork pull requests'
    },
    {
      name: 'other base',
      pull: eligiblePull({
        base: {
          ref: 'release',
          repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
        }
      }),
      message: 'applies only to main'
    },
    {
      name: 'stale head',
      pull: eligiblePull({
        head: {
          sha: 'new-head',
          repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
        }
      }),
      message: 'head advanced'
    },
    {
      name: 'hold label',
      pull: eligiblePull({
        labels: [{ name: 'website-fast-lane:hold' }]
      }),
      message: 'hold is applied'
    }
  ])('rejects $name', ({ pull, message }) => {
    expect(failure(pull)).toContain(message)
  })
})
