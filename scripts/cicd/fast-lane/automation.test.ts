import { describe, expect, it, vi } from 'vitest'

import { runFastLane, stopMergeAutomation } from './automation.ts'
import { POLICY_REVIEW_PREFIX } from './policy.ts'
import type {
  GitHubClient,
  MergeAutomationState,
  PullRequest,
  PullRequestFile,
  PullRequestReview,
  RuntimeConfig
} from './types.ts'

const headSha = '0123456789abcdef0123456789abcdef01234567'
const policyBody = `${POLICY_REVIEW_PREFIX} Lane: website.`
const floorTime = '2026-10-06T10:00:00Z'
const afterFloor = '2026-10-06T10:01:00Z'
const beforeFloor = '2026-10-06T09:59:00Z'

type Write = [operation: string, payload: unknown]

interface FakeOptions {
  viewer?: string
  pull?: Partial<PullRequest>
  reviews?: PullRequestReview[]
  files?: PullRequestFile[]
  mergeState?: Omit<MergeAutomationState, 'id'>
  failingMutations?: string[]
  failDismissals?: boolean
}

function runtimeConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    repository: 'Comfy-Org/ComfyUI_frontend',
    pullRequestNumber: 42,
    eventHeadSha: headSha,
    defaultBranch: 'main',
    lane: {
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
      merge: { mode: 'automatic', method: 'MERGE' }
    },
    ...overrides
  }
}

function policyApproval(
  id: number,
  commitId = headSha,
  submittedAt = floorTime
): PullRequestReview {
  return {
    id,
    state: 'APPROVED',
    commit_id: commitId,
    body: policyBody,
    submitted_at: submittedAt,
    user: { login: 'christian-byrne' }
  }
}

function fakeGitHub(options: FakeOptions = {}) {
  const writes: Write[] = []
  const pull: PullRequest = {
    state: 'open',
    draft: false,
    node_id: 'PR_1',
    changed_files: options.files?.length ?? 1,
    user: { login: 'bertfy' },
    labels: [],
    head: { sha: headSha, repo: { full_name: 'Comfy-Org/ComfyUI_frontend' } },
    base: { ref: 'main', repo: { full_name: 'Comfy-Org/ComfyUI_frontend' } },
    ...options.pull
  }
  const reviews = [...(options.reviews ?? [])]
  const files = options.files ?? [
    { filename: 'apps/website/src/pages/index.astro' }
  ]

  const github: GitHubClient = {
    async request(path, init = {}) {
      if (path === 'https://api.github.com/user') {
        return { login: options.viewer ?? 'christian-byrne' }
      }
      if (init.method === 'POST') {
        const body: PullRequestReview = JSON.parse(String(init.body))
        writes.push([`POST ${path}`, body])
        const created = {
          ...policyApproval(900, body.commit_id, afterFloor),
          body: body.body
        }
        reviews.push(created)
        return created
      }
      if (init.method === 'PUT') {
        writes.push([`PUT ${path}`, JSON.parse(String(init.body))])
        if (options.failDismissals) throw new Error('dismissal rejected')
        return null
      }
      return pull
    },
    async paginate(path) {
      return path.endsWith('/files') ? files : reviews
    },
    async graphql(query, variables) {
      const operation = /(?:query|mutation) (\w+)/.exec(query)?.[1] ?? ''
      if (operation === 'PackageFastLaneMergeState') {
        return {
          node: {
            id: 'PR_1',
            headRefOid: pull.head?.sha,
            ...options.mergeState
          }
        }
      }
      writes.push([operation, variables])
      if (options.failingMutations?.includes(operation)) {
        throw new Error(`${operation} failed`)
      }
      return {}
    }
  }
  return { github, writes }
}

const approvalPost: Write = [
  'POST /pulls/42/reviews',
  expect.objectContaining({ event: 'APPROVE', commit_id: headSha })
]
const enableAutoMerge: Write = [
  'PackageFastLaneEnableAutoMerge',
  { pullRequestId: 'PR_1', expectedHeadOid: headSha, mergeMethod: 'MERGE' }
]
const disableAutoMerge: Write = [
  'PackageFastLaneDisableAutoMerge',
  { pullRequestId: 'PR_1' }
]
const dequeue: Write = ['PackageFastLaneDequeue', { pullRequestId: 'PR_1' }]

function dismissal(id: number): Write {
  return [
    `PUT /pulls/42/reviews/${id}/dismissals`,
    { message: expect.stringContaining('Fast-lane approval withdrawn') }
  ]
}

const armedByLane = {
  autoMergeRequest: {
    enabledAt: afterFloor,
    enabledBy: { login: 'christian-byrne' }
  }
}

describe('runFastLane', () => {
  it.for([
    {
      name: 'a trusted author',
      options: {},
      config: {},
      writes: [approvalPost, enableAutoMerge]
    },
    {
      name: 'a non-allowlisted author on the operator label event',
      options: {
        pull: {
          user: { login: 'someone-else' },
          labels: [{ name: 'website-fast-lane:approve' }]
        }
      },
      config: {
        labelEvent: { actor: 'drjkl', label: 'website-fast-lane:approve' }
      },
      writes: [approvalPost, enableAutoMerge]
    },
    {
      name: 'a head that already has the policy approval',
      options: { reviews: [policyApproval(1)] },
      config: {},
      writes: [enableAutoMerge]
    },
    {
      name: 'a clean head',
      options: { mergeState: { mergeStateStatus: 'CLEAN' } },
      config: {},
      writes: [
        approvalPost,
        [
          'PackageFastLaneEnqueue',
          { pullRequestId: 'PR_1', expectedHeadOid: headSha }
        ]
      ]
    },
    {
      name: 'a manual lane',
      options: {},
      config: {
        lane: {
          ...runtimeConfig().lane,
          merge: { mode: 'manual', method: 'MERGE' }
        }
      },
      writes: [approvalPost]
    },
    {
      name: 'a head that advanced before arming',
      options: { mergeState: { headRefOid: 'f'.repeat(40) } },
      config: {},
      writes: [approvalPost]
    }
  ] satisfies {
    name: string
    options: FakeOptions
    config: Partial<RuntimeConfig>
    writes: Write[]
  }[])('approves and arms $name', async ({ options, config, writes }) => {
    const fake = fakeGitHub(options)

    await runFastLane(fake.github, runtimeConfig(config), vi.fn())

    expect(fake.writes).toEqual(writes)
  })

  it.for([
    {
      name: 'a mixed-path change',
      options: {
        files: [
          { filename: 'apps/website/src/pages/index.astro' },
          { filename: 'src/main.ts' }
        ]
      }
    },
    {
      name: 'a truncated changed-file list',
      options: { pull: { changed_files: 2 } }
    },
    {
      name: 'an active human change request',
      options: {
        reviews: [
          { state: 'CHANGES_REQUESTED', user: { login: 'DrJKL', type: 'User' } }
        ]
      }
    },
    {
      name: 'a pull request authored by the approval identity',
      options: { pull: { user: { login: 'christian-byrne' } } }
    },
    {
      name: 'a non-allowlisted author whose labeled run was replaced',
      options: {
        pull: {
          user: { login: 'someone-else' },
          labels: [{ name: 'website-fast-lane:approve' }]
        }
      }
    },
    {
      name: 'a run for a head that has since advanced',
      options: {
        pull: { head: { sha: 'f'.repeat(40) } },
        reviews: [policyApproval(1, 'f'.repeat(40))],
        mergeState: armedByLane
      }
    }
  ] satisfies { name: string; options: FakeOptions }[])(
    'writes nothing for $name',
    async ({ options }) => {
      const fake = fakeGitHub(options)

      await runFastLane(fake.github, runtimeConfig(), vi.fn())

      expect(fake.writes).toEqual([])
    }
  )

  it('withdraws approval and merge state when the approval label is removed', async () => {
    const fake = fakeGitHub({
      pull: { user: { login: 'someone-else' }, labels: [] },
      reviews: [policyApproval(1)],
      mergeState: armedByLane
    })

    await runFastLane(fake.github, runtimeConfig(), vi.fn())

    expect(fake.writes).toEqual([disableAutoMerge, dismissal(1)])
  })

  it('rejects a token that belongs to another account before writing', async () => {
    const fake = fakeGitHub({ viewer: 'someone-else' })

    await expect(
      runFastLane(fake.github, runtimeConfig(), vi.fn())
    ).rejects.toThrow('FAST_LANE_TOKEN belongs to someone-else')
    expect(fake.writes).toEqual([])
  })

  it('withdraws every policy approval on hold even when merge teardown fails', async () => {
    const fake = fakeGitHub({
      pull: { labels: [{ name: 'website-fast-lane:hold' }] },
      reviews: [policyApproval(122, 'old-head'), policyApproval(123)],
      mergeState: armedByLane,
      failingMutations: ['PackageFastLaneDisableAutoMerge']
    })
    const summary = vi.fn()

    await expect(
      runFastLane(fake.github, runtimeConfig(), summary)
    ).rejects.toThrow('failed to complete fast-lane compensation')
    expect(fake.writes).toEqual([
      disableAutoMerge,
      dismissal(122),
      dismissal(123)
    ])
    expect(summary).not.toHaveBeenCalled()
  })

  it('withdraws its approval once when arming fails', async () => {
    const fake = fakeGitHub({
      failingMutations: ['PackageFastLaneEnableAutoMerge']
    })

    await expect(
      runFastLane(fake.github, runtimeConfig(), vi.fn())
    ).rejects.toThrow('PackageFastLaneEnableAutoMerge failed')
    expect(fake.writes).toEqual([approvalPost, enableAutoMerge, dismissal(900)])
  })
})

describe('stopMergeAutomation', () => {
  it.for([
    {
      name: 'queue entry and auto-merge created by the lane after its floor',
      mergeState: {
        ...armedByLane,
        mergeQueueEntry: {
          id: 'MQE_1',
          enqueuedAt: afterFloor,
          enqueuer: { login: 'christian-byrne' }
        }
      },
      writes: [dequeue, disableAutoMerge]
    },
    {
      name: 'a queue entry by another account',
      mergeState: {
        ...armedByLane,
        mergeQueueEntry: {
          id: 'MQE_1',
          enqueuedAt: afterFloor,
          enqueuer: { login: 'drjkl' }
        }
      },
      writes: [disableAutoMerge]
    },
    {
      name: 'a queue entry from before the floor',
      mergeState: {
        mergeQueueEntry: {
          id: 'MQE_1',
          enqueuedAt: beforeFloor,
          enqueuer: { login: 'christian-byrne' }
        }
      },
      writes: []
    },
    {
      name: 'auto-merge enabled by another account',
      mergeState: {
        autoMergeRequest: {
          enabledAt: afterFloor,
          enabledBy: { login: 'drjkl' }
        }
      },
      writes: []
    },
    {
      name: 'auto-merge enabled before the floor',
      mergeState: {
        autoMergeRequest: {
          enabledAt: beforeFloor,
          enabledBy: { login: 'christian-byrne' }
        }
      },
      writes: []
    }
  ] satisfies {
    name: string
    mergeState: Omit<MergeAutomationState, 'id'>
    writes: Write[]
  }[])(
    'withdraws only lane-owned state for $name',
    async ({ mergeState, writes }) => {
      const fake = fakeGitHub({ mergeState })

      await stopMergeAutomation(
        fake.github,
        { node_id: 'PR_1' },
        'christian-byrne',
        { submitted_at: floorTime }
      )

      expect(fake.writes).toEqual(writes)
    }
  )

  it('still disables auto-merge when dequeue fails', async () => {
    const fake = fakeGitHub({
      mergeState: {
        ...armedByLane,
        mergeQueueEntry: {
          id: 'MQE_1',
          enqueuedAt: afterFloor,
          enqueuer: { login: 'christian-byrne' }
        }
      },
      failingMutations: ['PackageFastLaneDequeue']
    })

    await expect(
      stopMergeAutomation(fake.github, { node_id: 'PR_1' }, 'christian-byrne', {
        submitted_at: floorTime
      })
    ).rejects.toThrow('failed to stop all merge automation')
    expect(fake.writes).toEqual([dequeue, disableAutoMerge])
  })
})
