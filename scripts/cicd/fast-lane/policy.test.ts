import { describe, expect, it } from 'vitest'

import {
  activePolicyApprovals,
  changedPaths,
  eligibilityFailure,
  hasActiveHumanChangeRequest,
  hasCompleteChangedFileList,
  isAuthorizedLabelEvent,
  isInsideLane,
  isPolicyApprovalForHead,
  POLICY_REVIEW_PREFIX,
  policyReviewFloor
} from './policy.ts'
import type {
  FastLaneConfig,
  LabelEvent,
  PullRequest,
  PullRequestReview
} from './types.ts'

const policyBody = `${POLICY_REVIEW_PREFIX} Lane: website.`

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

const operatorLabelEvent: LabelEvent = {
  actor: 'drjkl',
  label: 'website-fast-lane:approve'
}

const headApproval: PullRequestReview = {
  state: 'APPROVED',
  commit_id: 'head-sha',
  body: policyBody,
  user: { login: 'christian-byrne' }
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

function outsiderPull(labels: string[]): PullRequest {
  return eligiblePull({
    user: { login: 'someone-else' },
    labels: labels.map((name) => ({ name }))
  })
}

function failure(
  pull: PullRequest,
  {
    reviews = [],
    labelEvent
  }: { reviews?: PullRequestReview[]; labelEvent?: LabelEvent } = {}
): string | undefined {
  return eligibilityFailure({
    pull,
    reviews,
    lane,
    repository: 'Comfy-Org/ComfyUI_frontend',
    defaultBranch: 'main',
    labelEvent
  })
}

describe('changed-path boundary', () => {
  it.for([
    { name: 'a matching count', expectedCount: 1, expected: true },
    { name: 'a truncated list', expectedCount: 2, expected: false },
    { name: 'an unknown count', expectedCount: undefined, expected: false }
  ])('treats $name as complete: $expected', ({ expectedCount, expected }) => {
    expect(
      hasCompleteChangedFileList(
        [{ filename: 'apps/website/src/pages/index.astro' }],
        expectedCount
      )
    ).toBe(expected)
  })

  it.for([
    {
      name: 'a lane path',
      paths: ['apps/website/src/pages/index.astro'],
      expected: true
    },
    { name: 'no paths', paths: [], expected: false },
    {
      name: 'a lane path and a root file',
      paths: ['apps/website/src/pages/index.astro', 'pnpm-lock.yaml'],
      expected: false
    },
    {
      name: 'a sibling directory sharing the prefix',
      paths: ['apps/website-evil/file.ts'],
      expected: false
    }
  ])('treats $name as inside the lane: $expected', ({ paths, expected }) => {
    expect(isInsideLane(paths, lane.pathPrefixes)).toBe(expected)
  })

  it.for([
    { name: 'rename', status: 'renamed' },
    { name: 'copy', status: 'copied' }
  ])('retains both paths for a $name into the lane', ({ status }) => {
    expect(
      changedPaths([
        {
          status,
          previous_filename: 'src/sensitive.ts',
          filename: 'apps/website/sensitive.ts'
        }
      ])
    ).toEqual(['apps/website/sensitive.ts', 'src/sensitive.ts'])
  })

  it('fails closed when a rename omits its previous path', () => {
    expect(
      changedPaths([{ status: 'renamed', filename: 'apps/website/new.astro' }])
    ).toBeUndefined()
  })
})

describe('approval label events', () => {
  it.for([
    {
      name: 'the trusted operator label event',
      event: operatorLabelEvent,
      expected: true
    },
    {
      name: 'an untrusted labeler',
      event: { ...operatorLabelEvent, actor: 'someone-else' },
      expected: false
    },
    {
      name: 'a different label from the operator',
      event: { ...operatorLabelEvent, label: 'area:website' },
      expected: false
    },
    { name: 'a run without a label event', event: undefined, expected: false }
  ])('authorizes $name: $expected', ({ event, expected }) => {
    expect(isAuthorizedLabelEvent(lane, event)).toBe(expected)
  })
})

describe('eligibility', () => {
  it.for([
    { name: 'a trusted author', pull: eligiblePull() },
    {
      name: 'a non-allowlisted author on the operator label event',
      pull: outsiderPull(['website-fast-lane:approve']),
      labelEvent: operatorLabelEvent
    },
    {
      name: 'a non-allowlisted author whose head approval and label remain',
      pull: outsiderPull(['website-fast-lane:approve']),
      reviews: [headApproval]
    }
  ])('accepts $name', ({ pull, reviews, labelEvent }) => {
    expect(failure(pull, { reviews, labelEvent })).toBeUndefined()
  })

  it.for([
    {
      name: 'draft',
      pull: eligiblePull({ draft: true }),
      message: 'not open and ready'
    },
    {
      name: 'closed pull request',
      pull: eligiblePull({ state: 'closed' }),
      message: 'not open and ready'
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
      name: 'pull request authored by the approval identity',
      pull: eligiblePull({ user: { login: 'Christian-Byrne' } }),
      message: 'cannot approve its own pull request'
    },
    {
      name: 'non-allowlisted author without the label',
      pull: outsiderPull([]),
      message: 'is not applied'
    },
    {
      name: 'non-allowlisted author whose label was removed after approval',
      pull: outsiderPull([]),
      reviews: [headApproval],
      message: 'is not applied'
    },
    {
      name: 'non-allowlisted author with the label but no current event',
      pull: outsiderPull(['website-fast-lane:approve']),
      message: 'lacks a current authorized event'
    },
    {
      name: 'hold label',
      pull: eligiblePull({ labels: [{ name: 'website-fast-lane:hold' }] }),
      message: 'hold is applied'
    },
    {
      name: 'human change request',
      pull: eligiblePull(),
      reviews: [
        { state: 'CHANGES_REQUESTED', user: { login: 'DrJKL', type: 'User' } }
      ],
      message: 'active human change request'
    }
  ])('rejects $name', ({ pull, reviews, message }) => {
    expect(failure(pull, { reviews })).toContain(message)
  })
})

describe('human change requests', () => {
  it.for([
    {
      name: 'a change request followed by a comment',
      reviews: [
        { state: 'CHANGES_REQUESTED', user: { login: 'DrJKL', type: 'User' } },
        { state: 'COMMENTED', user: { login: 'DrJKL', type: 'User' } }
      ],
      expected: true
    },
    {
      name: 'an app change request and a later human approval',
      reviews: [
        {
          state: 'CHANGES_REQUESTED',
          user: { login: 'coderabbitai[bot]', type: 'Bot' }
        },
        { state: 'CHANGES_REQUESTED', user: { login: 'DrJKL', type: 'User' } },
        { state: 'APPROVED', user: { login: 'DrJKL', type: 'User' } }
      ],
      expected: false
    },
    {
      name: 'a change request that was dismissed',
      reviews: [{ state: 'DISMISSED', user: { login: 'DrJKL', type: 'User' } }],
      expected: false
    }
  ])('treats $name as active: $expected', ({ reviews, expected }) => {
    expect(hasActiveHumanChangeRequest(reviews)).toBe(expected)
  })
})

describe('policy reviews', () => {
  it.for([
    {
      name: 'the identity on the head in any case',
      review: { ...headApproval, user: { login: 'Christian-Byrne' } },
      expected: true
    },
    {
      name: 'an older head',
      review: { ...headApproval, commit_id: 'old-sha' },
      expected: false
    },
    {
      name: 'another reviewer',
      review: { ...headApproval, user: { login: 'drjkl' } },
      expected: false
    },
    {
      name: 'a dismissed approval of the head',
      review: { ...headApproval, state: 'DISMISSED' },
      expected: false
    },
    {
      name: 'an unmarked approval by the identity',
      review: { ...headApproval, body: 'Looks good to me' },
      expected: false
    }
  ])(
    'treats $name as the head policy approval: $expected',
    ({ review, expected }) => {
      expect(
        isPolicyApprovalForHead(review, 'christian-byrne', 'head-sha')
      ).toBe(expected)
    }
  )

  it('selects active policy approvals across heads', () => {
    expect(
      activePolicyApprovals(
        [
          { ...headApproval, id: 1, commit_id: 'old-head' },
          { ...headApproval, id: 2 },
          { ...headApproval, id: 3, state: 'DISMISSED' },
          { ...headApproval, id: 4, body: 'Looks good to me' }
        ],
        'christian-byrne'
      ).map((review) => review.id)
    ).toEqual([1, 2])
  })

  it('uses the earliest policy review as the automation ownership floor', () => {
    expect(
      policyReviewFloor(
        [
          {
            ...headApproval,
            submitted_at: '2026-10-06T10:03:00Z'
          },
          {
            ...headApproval,
            state: 'DISMISSED',
            submitted_at: '2026-10-06T10:00:00Z'
          },
          {
            ...headApproval,
            body: 'Looks good to me.',
            submitted_at: '2026-10-06T09:00:00Z'
          }
        ],
        'christian-byrne'
      )?.submitted_at
    ).toBe('2026-10-06T10:00:00Z')
  })
})
