import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { z } from 'zod'

const userSchema = z.object({ login: z.string(), type: z.string() })
const fileSchema = z.object({
  filename: z.string(),
  previous_filename: z.string().optional()
})
const commentSchema = z.object({
  id: z.number(),
  user: userSchema.nullable(),
  body: z.string(),
  updated_at: z.string()
})
const reviewSchema = z.object({
  id: z.number(),
  user: userSchema.nullable(),
  state: z.enum([
    'APPROVED',
    'CHANGES_REQUESTED',
    'COMMENTED',
    'DISMISSED',
    'PENDING'
  ]),
  commit_id: z.string().nullable(),
  submitted_at: z.string().nullable()
})
const prSchema = z.object({
  number: z.number(),
  state: z.string(),
  draft: z.boolean(),
  user: userSchema,
  head: z.object({ sha: z.string() }),
  base: z.object({ ref: z.string(), sha: z.string() }),
  changed_files: z.number(),
  updated_at: z.string()
})
const queueSchema = z.object({
  data: z.object({
    repository: z.object({
      mergeQueue: z.object({
        entries: z.object({
          nodes: z.array(
            z.object({
              position: z.number(),
              headCommit: z.object({ oid: z.string() }).nullable(),
              pullRequest: z.object({ number: z.number() })
            })
          ),
          pageInfo: z.object({ hasNextPage: z.boolean() })
        })
      })
    })
  })
})

type Review = z.infer<typeof reviewSchema>

export function approvalFailure({
  files,
  reviews,
  head,
  author,
  frontend,
  website
}: {
  files: z.infer<typeof fileSchema>[]
  reviews: Review[]
  head: string
  author: string
  frontend: Set<string>
  website: Set<string>
}): string | null {
  const websiteOnly =
    files.length > 0 &&
    files.every(
      (file) =>
        file.filename.startsWith('apps/website/') &&
        (!file.previous_filename ||
          file.previous_filename.startsWith('apps/website/'))
    )
  const decisions = new Map<string, Review>()
  for (const review of reviews.toSorted(
    (a, b) =>
      (a.submitted_at ?? '').localeCompare(b.submitted_at ?? '') || a.id - b.id
  )) {
    if (
      review.user?.type === 'User' &&
      review.state !== 'COMMENTED' &&
      review.state !== 'PENDING'
    ) {
      decisions.set(review.user.login.toLowerCase(), review)
    }
  }
  const approved = [...decisions].some(
    ([login, review]) =>
      login !== author.toLowerCase() &&
      review.state === 'APPROVED' &&
      review.commit_id === head &&
      (frontend.has(login) || (websiteOnly && website.has(login)))
  )
  if (approved) return null
  return websiteOnly
    ? 'A current-head approval from comfy_frontend_devs OR comfy_website_devs is required.'
    : 'A current-head approval from comfy_frontend_devs is required.'
}

const repository = 'Comfy-Org/ComfyUI_frontend'
const repoPath = `/repos/${repository}`

export async function runApprovalPolicy(
  event: unknown,
  token: string,
  pr?: string
) {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    method = 'POST'
  ): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...(body === undefined
        ? { method: 'GET' }
        : { method, body: JSON.stringify(body) }),
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok)
      throw new Error(
        `GitHub ${body === undefined ? 'GET' : method} ${path}: ${response.status}`
      )
    return schema.parse(await response.json())
  }

  async function paginate<T>(path: string, schema: z.ZodType<T>) {
    const result: T[] = []
    for (let page = 1; ; page++) {
      const rows = await request(
        `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
        z.array(schema)
      )
      result.push(...rows)
      if (rows.length < 100) return result
    }
  }

  const run = z
    .object({
      workflow_run: z
        .object({
          event: z.enum(['pull_request', 'pull_request_review', 'merge_group']),
          head_sha: z.string(),
          head_branch: z.string(),
          head_repository: z.object({ owner: z.object({ login: z.string() }) }),
          pull_requests: z.array(z.object({ number: z.number() }))
        })
        .optional()
    })
    .parse(event).workflow_run
  const numbers = pr
    ? [z.coerce.number().int().positive().parse(pr)]
    : (run?.pull_requests.map((pull) => pull.number) ?? [])
  if (run && run.event !== 'merge_group' && numbers.length === 0) {
    const head = encodeURIComponent(
      `${run.head_repository.owner.login}:${run.head_branch}`
    )
    const pulls = await paginate(
      `${repoPath}/pulls?state=open&base=main&head=${head}`,
      z.object({ number: z.number() })
    )
    numbers.push(...pulls.map((pull) => pull.number))
  }

  async function queue() {
    const response = await request('/graphql', queueSchema, {
      query: `{
        repository(owner: "Comfy-Org", name: "ComfyUI_frontend") {
          mergeQueue(branch: "main") {
            entries(first: 100) {
              nodes { position headCommit { oid } pullRequest { number } }
              pageInfo { hasNextPage }
            }
          }
        }
      }`
    })
    const entries = response.data.repository.mergeQueue.entries
    if (entries.pageInfo.hasNextPage)
      throw new Error('Merge queue exceeds 100 entries')
    return entries.nodes.toSorted((a, b) => a.position - b.position)
  }

  async function approvedPull(
    number: number,
    expectedHead: string | undefined,
    teams: Pick<Parameters<typeof approvalFailure>[0], 'frontend' | 'website'>
  ) {
    const pull = await request(`${repoPath}/pulls/${number}`, prSchema)
    if (pull.state !== 'open' || pull.draft || pull.base.ref !== 'main') {
      throw new Error(`PR #${number} is not an open, ready main PR`)
    }
    if (expectedHead && pull.head.sha !== expectedHead) {
      throw new Error('PR head changed before evaluation')
    }
    const [files, reviews, comments] = await Promise.all([
      paginate(`${repoPath}/pulls/${number}/files`, fileSchema),
      paginate(`${repoPath}/pulls/${number}/reviews`, reviewSchema),
      paginate(`${repoPath}/issues/${number}/comments`, commentSchema)
    ])
    if (files.length !== pull.changed_files) {
      throw new Error(`PR #${number}: incomplete changed-file list`)
    }
    const override = comments.find(
      (comment) =>
        comment.user?.type === 'User' &&
        comment.user.login.toLowerCase() === pull.user.login.toLowerCase() &&
        comment.body.trim() === 'To Be Reviewed'
    )
    const failure = approvalFailure({
      files,
      reviews,
      head: pull.head.sha,
      author: pull.user.login,
      ...teams
    })
    if (failure && !override) throw new Error(`PR #${number}: ${failure}`)
    return { pull, reviews, comments, override }
  }

  async function verifyGroup(sha: string, pullNumbers: number[]) {
    const entries = await queue()
    const index = entries.findIndex((entry) => entry.headCommit?.oid === sha)
    const liveNumbers = entries
      .slice(0, index + 1)
      .map((entry) => entry.pullRequest.number)
    if (
      index < 0 ||
      JSON.stringify(liveNumbers) !== JSON.stringify(pullNumbers)
    ) {
      throw new Error('Merge group changed during evaluation')
    }
  }

  async function evaluate(
    sha: string,
    pullNumbers: number[],
    mergeGroup = false
  ) {
    const check = await request(
      `${repoPath}/check-runs`,
      z.object({ id: z.number() }),
      { name: 'approval-policy', head_sha: sha, status: 'in_progress' }
    )
    let conclusion: 'success' | 'failure' = 'failure'
    let summary: string
    try {
      const [front, web] = await Promise.all([
        paginate(
          '/orgs/Comfy-Org/teams/comfy_frontend_devs/members',
          userSchema
        ),
        paginate('/orgs/Comfy-Org/teams/comfy_website_devs/members', userSchema)
      ])
      const frontend = new Set(front.map((user) => user.login.toLowerCase()))
      const website = new Set(web.map((user) => user.login.toLowerCase()))
      const snapshots = await Promise.all(
        pullNumbers.map((number) =>
          approvedPull(number, mergeGroup ? undefined : sha, {
            frontend,
            website
          })
        )
      )
      for (const { pull, reviews, comments } of snapshots) {
        const [live, liveReviews, liveComments] = await Promise.all([
          request(`${repoPath}/pulls/${pull.number}`, prSchema),
          paginate(`${repoPath}/pulls/${pull.number}/reviews`, reviewSchema),
          paginate(`${repoPath}/issues/${pull.number}/comments`, commentSchema)
        ])
        if (
          JSON.stringify(live) !== JSON.stringify(pull) ||
          JSON.stringify(liveReviews) !== JSON.stringify(reviews) ||
          JSON.stringify(liveComments) !== JSON.stringify(comments)
        ) {
          throw new Error('PR changed during evaluation; re-run the policy')
        }
      }
      if (mergeGroup) await verifyGroup(sha, pullNumbers)
      conclusion = 'success'
      summary = snapshots
        .map(({ pull, override }) =>
          override
            ? `PR #${pull.number}: author bypassed approval with [To Be Reviewed](https://github.com/${repository}/pull/${pull.number}#issuecomment-${override.id}).`
            : `PR #${pull.number}: eligible current-head approval.`
        )
        .join('\n')
    } catch (error) {
      summary = error instanceof Error ? error.message : String(error)
    }
    await request(
      `${repoPath}/check-runs/${check.id}`,
      z.unknown(),
      {
        status: 'completed',
        conclusion,
        output: { title: 'Approval policy', summary }
      },
      'PATCH'
    )
    console.log(`${sha}: ${conclusion}: ${summary}`)
  }

  for (const number of new Set(numbers)) {
    const pull = await request(`${repoPath}/pulls/${number}`, prSchema)
    if (pull.state === 'open' && pull.base.ref === 'main') {
      await evaluate(pull.head.sha, [number])
    }
  }
  const entries = await queue()
  for (const [index, entry] of entries.entries()) {
    if (entry.headCommit) {
      await evaluate(
        entry.headCommit.oid,
        entries.slice(0, index + 1).map((item) => item.pullRequest.number),
        true
      )
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const token = z.string().min(1).parse(process.env.GH_TOKEN)
  const eventPath = z.string().min(1).parse(process.env.GITHUB_EVENT_PATH)
  await runApprovalPolicy(
    JSON.parse(readFileSync(eventPath, 'utf8')),
    token,
    process.env.APPROVAL_POLICY_PR
  )
}
