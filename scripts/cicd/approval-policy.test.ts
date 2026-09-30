import { readFileSync } from 'node:fs'

import { assert, describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

import { approvalFailure, runApprovalPolicy } from './approval-policy'

type Policy = Parameters<typeof approvalFailure>[0]
type Review = Policy['reviews'][number]

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: 1,
    user: { login: 'web', type: 'User' },
    state: 'APPROVED',
    commit_id: 'head-7',
    submitted_at: '2026-09-30T00:00:00Z',
    ...overrides
  }
}

function comment({
  user = { login: 'author', type: 'User' },
  body = 'To Be Reviewed',
  id = 31
}: { user?: Review['user']; body?: string; id?: number } = {}) {
  return { id, user, body, updated_at: '2026-09-30T00:00:00Z' }
}

function policy(overrides: Partial<Policy> = {}): Policy {
  return {
    files: [{ filename: 'apps/website/page.astro' }],
    reviews: [review()],
    head: 'head-7',
    author: 'author',
    frontend: new Set(['front']),
    website: new Set(['web']),
    ...overrides
  }
}

describe('eligible approval', () => {
  it.for([
    { files: [{ filename: 'apps/website/page.astro' }], allowed: true },
    { files: [{ filename: 'apps/website/nested/AGENTS.md' }], allowed: true },
    { files: [{ filename: 'apps/website-other/page.astro' }], allowed: false },
    { files: [{ filename: 'src/main.ts' }], allowed: false },
    {
      files: [{ filename: 'apps/website/a' }, { filename: 'pnpm-lock.yaml' }],
      allowed: false
    },
    {
      files: [{ filename: 'apps/website/a', previous_filename: 'src/a' }],
      allowed: false
    },
    {
      files: [{ filename: 'src/a', previous_filename: 'apps/website/a' }],
      allowed: false
    },
    {
      files: [
        { filename: 'apps/website/b', previous_filename: 'apps/website/a' }
      ],
      allowed: true
    },
    { files: [], allowed: false }
  ])('website reviewer: $files => $allowed', ({ files, allowed }) => {
    expect(approvalFailure(policy({ files })) === null).toBe(allowed)
  })

  it.for(['apps/website/a', 'src/a'])(
    'frontend reviewer can approve %s',
    (filename) => {
      expect(
        approvalFailure(
          policy({
            files: [{ filename }],
            reviews: [review({ user: { login: 'FrOnT', type: 'User' } })]
          })
        )
      ).toBeNull()
    }
  )

  it.for<{ name: string; reviews: Review[]; allowed: boolean }>([
    { name: 'no approval', reviews: [], allowed: false },
    {
      name: 'outsider',
      reviews: [review({ user: { login: 'outsider', type: 'User' } })],
      allowed: false
    },
    {
      name: 'author',
      reviews: [review({ user: { login: 'author', type: 'User' } })],
      allowed: false
    },
    {
      name: 'bot',
      reviews: [review({ user: { login: 'web', type: 'Bot' } })],
      allowed: false
    },
    { name: 'deleted user', reviews: [review({ user: null })], allowed: false },
    {
      name: 'old commit',
      reviews: [review({ commit_id: 'old-head' })],
      allowed: false
    },
    {
      name: 'dismissed',
      reviews: [review({ state: 'DISMISSED' })],
      allowed: false
    },
    {
      name: 'later comment preserves approval',
      reviews: [review(), review({ id: 2, state: 'COMMENTED' })],
      allowed: true
    },
    {
      name: 'pending review preserves approval',
      reviews: [review(), review({ id: 2, state: 'PENDING' })],
      allowed: true
    },
    {
      name: 'request changes replaces approval',
      reviews: [review({ id: 9, state: 'CHANGES_REQUESTED' }), review()],
      allowed: false
    },
    {
      name: 'dismissal does not revive older approval',
      reviews: [review(), review({ id: 2, state: 'DISMISSED' })],
      allowed: false
    },
    {
      name: 'reapproval',
      reviews: [review({ state: 'CHANGES_REQUESTED' }), review({ id: 2 })],
      allowed: true
    },
    {
      name: 'an older pending review submitted last overrides approval',
      reviews: [
        review({ id: 8 }),
        review({
          id: 3,
          state: 'CHANGES_REQUESTED',
          submitted_at: '2026-09-30T01:00:00Z'
        })
      ],
      allowed: false
    }
  ])('$name', ({ reviews, allowed }) => {
    expect(
      approvalFailure(
        policy({ reviews, website: new Set(['web', 'author']) })
      ) === null
    ).toBe(allowed)
  })
})

function githubFixture() {
  const pulls = new Map(
    [7, 12].map((number) => [
      number,
      {
        number,
        state: 'open',
        draft: false,
        user: { login: 'author', type: 'User' },
        head: { sha: `head-${number}` },
        base: { ref: 'main', sha: 'base' },
        changed_files: 1,
        updated_at: '2026-09-30T00:00:00Z'
      }
    ])
  )
  const files = new Map<number, Policy['files']>([
    [7, [{ filename: 'apps/website/a' }]],
    [12, [{ filename: 'src/a' }]]
  ])
  const reviews = new Map<number, Review[]>([
    [7, [review()]],
    [
      12,
      [review({ commit_id: 'head-12', user: { login: 'front', type: 'User' } })]
    ]
  ])
  const comments = new Map<number, ReturnType<typeof comment>[]>([
    [7, []],
    [12, []]
  ])
  const members = new Map([
    ['comfy_frontend_devs', [{ login: 'front', type: 'User' }]],
    ['comfy_website_devs', [{ login: 'web', type: 'User' }]]
  ])
  const entries: {
    position: number
    headCommit: { oid: string }
    pullRequest: { number: number }
  }[] = []
  const writes: { sha: string; conclusion: string; summary: string }[] = []
  const checks = new Map<number, string>()
  const failures = new Set<string>()
  const reads = new Map<string, number>()
  const onRead = vi.fn<(path: string, count: number) => void>()
  function readData(url: URL) {
    const path = url.pathname
    const page = Number(url.searchParams.get('page') ?? '1')
    if (path === '/graphql')
      return {
        data: {
          repository: {
            mergeQueue: {
              entries: {
                nodes: entries,
                pageInfo: { hasNextPage: false }
              }
            }
          }
        }
      }
    if (path.endsWith('/pulls')) return [{ number: 7 }]
    const match = path.match(
      /\/(?:pulls|issues)\/(\d+)(?:\/(files|reviews|comments))?$/
    )
    if (match) {
      const number = Number(match[1])
      if (!match[2]) return pulls.get(number)
      const collection = z
        .enum(['files', 'reviews', 'comments'])
        .parse(match[2])
      const rows = { files, reviews, comments }[collection].get(number)
      return rows?.slice((page - 1) * 100, page * 100)
    }
    const team = path.match(/\/teams\/([^/]+)\/members$/)?.[1]
    if (team) return members.get(team)?.slice((page - 1) * 100, page * 100)
    throw new Error(`Unexpected request: ${url}`)
  }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = new Request(input, init)
    const url = new URL(req.url)
    const path = url.pathname
    const count = (reads.get(path) ?? 0) + 1
    reads.set(path, count)
    onRead(path, count)
    if (failures.has(path)) return new Response('', { status: 403 })
    if (path.endsWith('/check-runs') && req.method === 'POST') {
      const body = z
        .object({
          head_sha: z.string(),
          name: z.literal('approval-policy'),
          status: z.literal('in_progress')
        })
        .parse(await req.json())
      const id = checks.size + 1
      checks.set(id, body.head_sha)
      return Response.json({ id })
    }
    if (req.method === 'PATCH') {
      const body = z
        .object({
          conclusion: z.string(),
          output: z.object({ summary: z.string() })
        })
        .parse(await req.json())
      const sha = checks.get(Number(path.split('/').at(-1)))
      if (!sha) throw new Error('Check must be started before completion')
      writes.push({
        sha,
        conclusion: body.conclusion,
        summary: body.output.summary
      })
      return Response.json({})
    }
    return Response.json(readData(url))
  })
  return {
    pulls,
    files,
    reviews,
    comments,
    members,
    entries,
    writes,
    failures,
    onRead
  }
}

describe('GitHub approval check', () => {
  it('reads every file, review, and team member page before publishing', async () => {
    const fixture = githubFixture()
    const pull = fixture.pulls.get(7)
    assert.exists(pull)
    fixture.pulls.set(7, { ...pull, changed_files: 101 })
    fixture.files.set(7, [
      ...Array.from({ length: 100 }, () => ({ filename: 'apps/website/a' })),
      { filename: 'src/a' }
    ])
    fixture.reviews.set(7, [
      ...Array.from({ length: 100 }, (_, id) =>
        review({ id, state: 'COMMENTED' })
      ),
      review({ id: 101, user: { login: 'last-front', type: 'User' } })
    ])
    fixture.members.set('comfy_frontend_devs', [
      ...Array.from({ length: 100 }, (_, i) => ({
        login: `front-${i}`,
        type: 'User'
      })),
      { login: 'last-front', type: 'User' }
    ])

    await runApprovalPolicy({}, 'token', '7')

    expect(fixture.writes).toEqual([
      {
        sha: 'head-7',
        conclusion: 'success',
        summary: 'PR #7: eligible current-head approval.'
      }
    ])
  })

  it('rejects an incomplete changed-file response', async () => {
    const fixture = githubFixture()
    const pull = fixture.pulls.get(7)
    assert.exists(pull)
    fixture.pulls.set(7, { ...pull, changed_files: 3001 })

    await runApprovalPolicy({}, 'token', '7')

    expect(fixture.writes).toEqual([
      {
        sha: 'head-7',
        conclusion: 'failure',
        summary: 'PR #7: incomplete changed-file list'
      }
    ])
  })

  it('fails the check when organization membership cannot be read', async () => {
    const fixture = githubFixture()
    fixture.failures.add('/orgs/Comfy-Org/teams/comfy_frontend_devs/members')

    await runApprovalPolicy({}, 'token', '7')

    expect(fixture.writes).toEqual([
      {
        sha: 'head-7',
        conclusion: 'failure',
        summary: expect.stringContaining('403')
      }
    ])
  })

  it('does not publish success after a concurrent review dismissal', async () => {
    const fixture = githubFixture()
    fixture.onRead.mockImplementation((path, count) => {
      if (path.endsWith('/7/reviews') && count === 2)
        fixture.reviews.set(7, [review({ state: 'DISMISSED' })])
    })

    await runApprovalPolicy({}, 'token', '7')

    expect(fixture.writes).toEqual([
      {
        sha: 'head-7',
        conclusion: 'failure',
        summary: 'PR changed during evaluation; re-run the policy'
      }
    ])
  })

  it('resolves fork review signals without relying on their merge SHA', async () => {
    const fixture = githubFixture()

    await runApprovalPolicy(
      {
        workflow_run: {
          event: 'pull_request_review',
          head_sha: 'merge-sha',
          head_branch: 'feature',
          head_repository: { owner: { login: 'fork-owner' } },
          pull_requests: []
        }
      },
      'token'
    )

    expect(fixture.writes).toEqual([
      {
        sha: 'head-7',
        conclusion: 'success',
        summary: 'PR #7: eligible current-head approval.'
      }
    ])
  })

  it.for([
    { name: 'author', entry: comment(), conclusion: 'success' },
    {
      name: 'surrounding whitespace and login case',
      entry: comment({
        body: '\nTo Be Reviewed\n',
        user: { login: 'AuThOr', type: 'User' }
      }),
      conclusion: 'success'
    },
    {
      name: 'another person',
      entry: comment({ user: { login: 'front', type: 'User' } }),
      conclusion: 'failure'
    },
    {
      name: 'bot author',
      entry: comment({ user: { login: 'author', type: 'Bot' } }),
      conclusion: 'failure'
    },
    {
      name: 'deleted commenter',
      entry: comment({ user: null }),
      conclusion: 'failure'
    },
    {
      name: 'quoted phrase',
      entry: comment({ body: '> To Be Reviewed' }),
      conclusion: 'failure'
    },
    {
      name: 'phrase inside prose',
      entry: comment({ body: 'Do not use To Be Reviewed here.' }),
      conclusion: 'failure'
    }
  ])('author override: $name', async ({ entry, conclusion }) => {
    const fixture = githubFixture()
    fixture.reviews.set(12, [])
    fixture.comments.set(12, [entry])

    await runApprovalPolicy({}, 'token', '12')

    expect(fixture.writes).toMatchObject([{ sha: 'head-12', conclusion }])
  })

  it('finds a paginated author override and links it in the check', async () => {
    const fixture = githubFixture()
    fixture.reviews.set(7, [])
    fixture.comments.set(7, [
      ...Array.from({ length: 100 }, (_, id) =>
        comment({ id, body: 'Discussion' })
      ),
      comment({ id: 101 })
    ])

    await runApprovalPolicy({}, 'token', '7')

    expect(fixture.writes).toEqual([
      {
        sha: 'head-7',
        conclusion: 'success',
        summary:
          'PR #7: author bypassed approval with [To Be Reviewed](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7#issuecomment-101).'
      }
    ])
  })

  it.for([
    { name: 'deleted', remaining: [] },
    { name: 'edited', remaining: [comment({ body: 'Please review first' })] }
  ])('rejects an override $name during evaluation', async ({ remaining }) => {
    const fixture = githubFixture()
    fixture.reviews.set(7, [])
    fixture.comments.set(7, [comment()])
    fixture.onRead.mockImplementation((path, count) => {
      if (path.endsWith('/7/comments') && count === 2)
        fixture.comments.set(7, remaining)
    })

    await runApprovalPolicy({}, 'token', '7')

    expect(fixture.writes).toEqual([
      {
        sha: 'head-7',
        conclusion: 'failure',
        summary: 'PR changed during evaluation; re-run the policy'
      }
    ])
  })

  it('revokes bypass on its PR and group without bypassing other queued PRs', async () => {
    const fixture = githubFixture()
    fixture.reviews.set(7, [])
    fixture.reviews.set(12, [])
    fixture.comments.set(7, [comment()])
    fixture.entries.push(
      {
        position: 1,
        headCommit: { oid: 'group-7' },
        pullRequest: { number: 7 }
      },
      {
        position: 2,
        headCommit: { oid: 'group-12' },
        pullRequest: { number: 12 }
      }
    )

    await runApprovalPolicy({}, 'token', '7')
    fixture.comments.set(7, [])
    await runApprovalPolicy({}, 'token', '7')

    expect(
      fixture.writes.map(({ sha, conclusion }) => ({ sha, conclusion }))
    ).toEqual([
      { sha: 'head-7', conclusion: 'success' },
      { sha: 'group-7', conclusion: 'success' },
      { sha: 'group-12', conclusion: 'failure' },
      { sha: 'head-7', conclusion: 'failure' },
      { sha: 'group-7', conclusion: 'failure' },
      { sha: 'group-12', conclusion: 'failure' }
    ])
  })

  it.for<{ state: Review['state']; conclusion: string }>([
    { state: 'APPROVED', conclusion: 'success' },
    { state: 'DISMISSED', conclusion: 'failure' }
  ])(
    'checks every included PR for HEADGREEN groups: $state',
    async ({ state, conclusion }) => {
      const fixture = githubFixture()
      fixture.reviews.set(7, [review({ state })])
      fixture.entries.push(
        {
          position: 1,
          headCommit: { oid: 'group-7' },
          pullRequest: { number: 7 }
        },
        {
          position: 2,
          headCommit: { oid: 'group-12' },
          pullRequest: { number: 12 }
        }
      )

      await runApprovalPolicy(
        {
          workflow_run: {
            event: 'merge_group',
            head_sha: 'group-12',
            head_branch: 'gh-readonly-queue/main/pr-12',
            head_repository: { owner: { login: 'Comfy-Org' } },
            pull_requests: []
          }
        },
        'token'
      )

      expect(
        fixture.writes.map(({ sha, conclusion }) => ({ sha, conclusion }))
      ).toEqual([
        {
          sha: 'group-7',
          conclusion
        },
        {
          sha: 'group-12',
          conclusion
        }
      ])
    }
  )
})

it('keeps privileged execution on main behind an environment and a dedicated App', () => {
  const workflow = z
    .object({
      on: z.object({
        issue_comment: z.object({
          types: z.tuple([
            z.literal('created'),
            z.literal('edited'),
            z.literal('deleted')
          ])
        })
      }),
      permissions: z.object({ contents: z.literal('read') }).strict(),
      jobs: z.object({
        evaluate: z.object({
          environment: z.literal('approval-policy'),
          steps: z.array(
            z.object({
              uses: z.string().optional(),
              with: z.record(z.unknown()).optional(),
              run: z.string().optional(),
              env: z.record(z.string()).optional()
            })
          )
        })
      })
    })
    .parse(
      parse(readFileSync('.github/workflows/pr-approval-policy.yaml', 'utf8'))
    )
  expect(
    workflow.jobs.evaluate.steps.filter((step) =>
      step.uses?.startsWith('actions/checkout')
    )
  ).toEqual([
    {
      uses: 'actions/checkout@v7',
      with: { ref: 'refs/heads/main', 'persist-credentials': false }
    }
  ])
  expect(
    workflow.jobs.evaluate.steps.find((step) =>
      step.uses?.startsWith('actions/create-github-app-token')
    )?.with
  ).toMatchObject({
    'permission-checks': 'write',
    'permission-members': 'read',
    'private-key': '${{ secrets.APPROVAL_POLICY_APP_PRIVATE_KEY }}'
  })
  expect(workflow.jobs.evaluate.steps.find((step) => step.run)).toMatchObject({
    run: 'pnpm exec tsx scripts/cicd/approval-policy.ts',
    env: {
      APPROVAL_POLICY_PR:
        '${{ inputs.pull-request || github.event.issue.number }}'
    }
  })
})
