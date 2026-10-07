import { describe, expect, it, vi } from 'vitest'

import {
  activePolicyApprovals,
  approveCurrentHead,
  armMergeAutomation,
  policyReviewFloor,
  runFastLane,
  stopMergeAutomation
} from './automation.ts'
import type {
  GitHubClient,
  PullRequest,
  ResolvedRuntimeConfig
} from './types.ts'

const headSha = '0123456789abcdef0123456789abcdef01234567'

function runtimeConfig(): ResolvedRuntimeConfig {
  return {
    token: 'not-used-by-tests',
    repository: 'Comfy-Org/ComfyUI_frontend',
    pullRequestNumber: 42,
    eventHeadSha: headSha,
    eventName: 'pull_request_target',
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
      merge: { mode: 'automatic', method: 'SQUASH' }
    }
  }
}

function pull(): PullRequest {
  return { node_id: 'PR_1', head: { sha: headSha } }
}

function unusedRequest(): Promise<never> {
  return Promise.reject(new Error('request was not expected'))
}

function unusedPaginate(): Promise<never> {
  return Promise.reject(new Error('pagination was not expected'))
}

describe('approval lifecycle', () => {
  it('selects active policy approvals across current and stale heads', () => {
    const policyBody =
      '[Package fast lane] Policy-only approval. Lane: website.'
    expect(
      activePolicyApprovals(
        [
          {
            id: 1,
            state: 'APPROVED',
            commit_id: 'old-head',
            body: policyBody,
            user: { login: 'christian-byrne' }
          },
          {
            id: 2,
            state: 'APPROVED',
            commit_id: headSha,
            body: policyBody,
            user: { login: 'christian-byrne' }
          },
          {
            id: 3,
            state: 'DISMISSED',
            body: policyBody,
            user: { login: 'christian-byrne' }
          }
        ],
        'christian-byrne'
      ).map((review) => review.id)
    ).toEqual([1, 2])
  })

  it('withdraws a new approval when post-approval verification fails', async () => {
    const verificationError = new Error('verification unavailable')
    const calls: { path: string; method: string }[] = []
    const github: GitHubClient = {
      async request(path, options = {}) {
        calls.push({ path, method: options.method ?? 'GET' })
        if (options.method === 'POST') return { id: 123 }
        if (options.method === 'PUT') return null
        throw verificationError
      },
      async paginate() {
        throw new Error('pagination should not follow a failed pull request')
      },
      graphql: unusedRequest
    }

    await expect(
      approveCurrentHead(github, runtimeConfig(), [], vi.fn())
    ).rejects.toBe(verificationError)
    expect(calls).toEqual([
      { path: '/pulls/42/reviews', method: 'POST' },
      { path: '/pulls/42', method: 'GET' },
      { path: '/pulls/42/reviews/123/dismissals', method: 'PUT' }
    ])
  })

  it('withdraws an existing policy approval on hold even when merge teardown fails', async () => {
    const dismissals: string[] = []
    const github: GitHubClient = {
      async request(path, options = {}) {
        if (path === 'https://api.github.com/user') {
          return { login: 'christian-byrne' }
        }
        if (options.method === 'PUT') {
          dismissals.push(path)
          return null
        }
        return {
          state: 'open',
          node_id: 'PR_1',
          user: { login: 'bertfy' },
          labels: [{ name: 'website-fast-lane:hold' }],
          head: {
            sha: headSha,
            repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
          },
          base: {
            ref: 'main',
            repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
          }
        }
      },
      async paginate() {
        return [
          {
            id: 123,
            state: 'APPROVED',
            commit_id: headSha,
            body: '[Package fast lane] Policy-only approval. Lane: website.',
            submitted_at: '2026-10-06T10:00:00Z',
            user: { login: 'christian-byrne' }
          }
        ]
      },
      graphql: () => Promise.reject(new Error('merge state unavailable'))
    }

    await expect(runFastLane(github, runtimeConfig(), vi.fn())).rejects.toThrow(
      'failed to complete fast-lane compensation'
    )
    expect(dismissals).toEqual(['/pulls/42/reviews/123/dismissals'])
  })

  it('does not create a second approval for the same identity and head', async () => {
    const summary = vi.fn()
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql: unusedRequest
    }
    await expect(
      approveCurrentHead(
        github,
        runtimeConfig(),
        [
          {
            state: 'APPROVED',
            commit_id: headSha,
            body: '[Package fast lane] Policy-only approval. Lane: website.',
            user: { login: 'christian-byrne' }
          }
        ],
        summary
      )
    ).resolves.toBe(true)
    expect(summary).toHaveBeenCalledWith(
      `Already approved ${headSha.slice(0, 12)} as @christian-byrne.`
    )
  })
})

describe('merge automation', () => {
  it('uses the earliest policy review as the automation ownership floor', () => {
    expect(
      policyReviewFloor(
        [
          {
            state: 'APPROVED',
            body: '[Package fast lane] Policy-only approval. Later head.',
            submitted_at: '2026-10-06T10:03:00Z',
            user: { login: 'christian-byrne' }
          },
          {
            state: 'DISMISSED',
            body: '[Package fast lane] Policy-only approval. Earlier head.',
            submitted_at: '2026-10-06T10:00:00Z',
            user: { login: 'christian-byrne' }
          }
        ],
        'christian-byrne'
      )?.submitted_at
    ).toBe('2026-10-06T10:00:00Z')
  })

  it('arms native auto-merge for the exact head and configured method', async () => {
    const graphql = vi
      .fn<GitHubClient['graphql']>()
      .mockResolvedValueOnce({
        node: {
          id: 'PR_1',
          headRefOid: headSha,
          mergeStateStatus: 'BLOCKED',
          autoMergeRequest: null,
          mergeQueueEntry: null
        }
      })
      .mockResolvedValueOnce({
        enablePullRequestAutoMerge: { clientMutationId: null }
      })
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql
    }

    await armMergeAutomation(github, pull(), headSha, runtimeConfig(), vi.fn())

    expect(graphql).toHaveBeenCalledTimes(2)
    expect(graphql.mock.calls[1][0]).toContain('enablePullRequestAutoMerge')
    expect(graphql.mock.calls[1][1]).toEqual({
      pullRequestId: 'PR_1',
      expectedHeadOid: headSha,
      mergeMethod: 'SQUASH'
    })
  })

  it('enqueues a clean exact head without queue jumping', async () => {
    const graphql = vi
      .fn<GitHubClient['graphql']>()
      .mockResolvedValueOnce({
        node: {
          id: 'PR_1',
          headRefOid: headSha,
          mergeStateStatus: 'CLEAN',
          autoMergeRequest: null,
          mergeQueueEntry: null
        }
      })
      .mockResolvedValueOnce({
        enqueuePullRequest: { clientMutationId: null }
      })
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql
    }

    await armMergeAutomation(github, pull(), headSha, runtimeConfig(), vi.fn())

    expect(graphql.mock.calls[1][0]).toContain('jump: false')
    expect(graphql.mock.calls[1][1]).toEqual({
      pullRequestId: 'PR_1',
      expectedHeadOid: headSha
    })
  })

  it('does not arm a head that advanced after policy approval', async () => {
    const advancedSha = 'abcdef0123456789abcdef0123456789abcdef01'
    const graphql = vi.fn<GitHubClient['graphql']>().mockResolvedValueOnce({
      node: {
        id: 'PR_1',
        headRefOid: advancedSha,
        mergeStateStatus: 'CLEAN',
        autoMergeRequest: null,
        mergeQueueEntry: null
      }
    })
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql
    }

    await expect(
      armMergeAutomation(
        github,
        { node_id: 'PR_1', head: { sha: advancedSha } },
        headSha,
        runtimeConfig(),
        vi.fn()
      )
    ).rejects.toThrow('head advanced')
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it('does not mutate merge state in a manual lane', async () => {
    const config = runtimeConfig()
    config.lane.merge.mode = 'manual'
    const graphql = vi.fn<GitHubClient['graphql']>()
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql
    }

    await armMergeAutomation(github, pull(), headSha, config, vi.fn())

    expect(graphql).not.toHaveBeenCalled()
  })

  it('withdraws only merge state created by the policy identity after its review', async () => {
    const graphql = vi
      .fn<GitHubClient['graphql']>()
      .mockResolvedValueOnce({
        node: {
          id: 'PR_1',
          headRefOid: headSha,
          autoMergeRequest: {
            enabledAt: '2026-10-06T10:01:00Z',
            enabledBy: { login: 'christian-byrne' }
          },
          mergeQueueEntry: {
            id: 'MQE_1',
            enqueuedAt: '2026-10-06T10:02:00Z',
            enqueuer: { login: 'christian-byrne' }
          }
        }
      })
      .mockResolvedValue({})
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql
    }

    await stopMergeAutomation(github, pull(), 'christian-byrne', {
      submitted_at: '2026-10-06T10:00:00Z'
    })

    expect(graphql).toHaveBeenCalledTimes(3)
    expect(graphql.mock.calls[1][0]).toContain('dequeuePullRequest')
    expect(graphql.mock.calls[1][1]).toEqual({ pullRequestId: 'PR_1' })
    expect(graphql.mock.calls[2][0]).toContain('disablePullRequestAutoMerge')
  })

  it('leaves pre-existing merge state alone', async () => {
    const graphql = vi.fn<GitHubClient['graphql']>().mockResolvedValueOnce({
      node: {
        id: 'PR_1',
        headRefOid: headSha,
        autoMergeRequest: {
          enabledAt: '2026-10-06T09:59:00Z',
          enabledBy: { login: 'christian-byrne' }
        },
        mergeQueueEntry: null
      }
    })
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql
    }

    await stopMergeAutomation(github, pull(), 'christian-byrne', {
      submitted_at: '2026-10-06T10:00:00Z'
    })

    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it('still disables auto-merge when dequeue fails', async () => {
    const graphql = vi
      .fn<GitHubClient['graphql']>()
      .mockResolvedValueOnce({
        node: {
          id: 'PR_1',
          headRefOid: headSha,
          autoMergeRequest: {
            enabledAt: '2026-10-06T10:01:00Z',
            enabledBy: { login: 'christian-byrne' }
          },
          mergeQueueEntry: {
            id: 'MQE_1',
            enqueuedAt: '2026-10-06T10:02:00Z',
            enqueuer: { login: 'christian-byrne' }
          }
        }
      })
      .mockRejectedValueOnce(new Error('already dequeued'))
      .mockResolvedValueOnce({})
    const github: GitHubClient = {
      request: unusedRequest,
      paginate: unusedPaginate,
      graphql
    }

    await expect(
      stopMergeAutomation(github, pull(), 'christian-byrne', {
        submitted_at: '2026-10-06T10:00:00Z'
      })
    ).rejects.toThrow('failed to stop all merge automation')
    expect(graphql).toHaveBeenCalledTimes(3)
    expect(graphql.mock.calls[2][0]).toContain('disablePullRequestAutoMerge')
  })
})
