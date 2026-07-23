import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { validatePullRequestEvidenceBatch } from './validate-evidence.ts'
import type {
  EvidenceValidation,
  PullRequestEvidencePayload,
  ScreencastProbe
} from './validate-evidence.ts'
import {
  createGitHubMembershipLookup,
  validatePullRequestMaintainers
} from './validate-maintainer.ts'
import type {
  MembershipLookup,
  PullRequestAssigneePayload
} from './validate-maintainer.ts'

type MergeGroupEvent = {
  merge_group?: {
    head_ref?: string | null
    head_sha?: string | null
  } | null
}

type PullRequestPayload = PullRequestEvidencePayload &
  PullRequestAssigneePayload & {
    number: number
  }

export type RepoRequest = (path: string) => Promise<unknown>

function pullRequestNumber(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !('number' in value)) return null
  const number = value.number
  return typeof number === 'number' && Number.isInteger(number) && number > 0
    ? number
    : null
}

function currentPullRequest(value: unknown): PullRequestPayload {
  const number = pullRequestNumber(value)
  if (!number || !value || typeof value !== 'object') {
    throw new Error('GitHub returned malformed pull request metadata.')
  }

  const body =
    'body' in value && typeof value.body === 'string' ? value.body : ''
  const assignees =
    'assignees' in value && Array.isArray(value.assignees)
      ? value.assignees
          .filter(
            (assignee): assignee is { login?: string; type?: string } =>
              Boolean(assignee) && typeof assignee === 'object'
          )
          .map((assignee) => ({
            login:
              typeof assignee.login === 'string' ? assignee.login : undefined,
            type: typeof assignee.type === 'string' ? assignee.type : undefined
          }))
      : []

  return { assignees, body, number }
}

function fallbackPullRequestNumber(headRef: string): number | null {
  const match = headRef.match(/\/pr-(\d+)-[0-9a-f]{40}$/i)
  if (!match) return null
  const number = Number(match[1])
  return Number.isSafeInteger(number) && number > 0 ? number : null
}

export async function loadMergeGroupPullRequests(
  event: MergeGroupEvent,
  request: RepoRequest
): Promise<PullRequestPayload[]> {
  const headSha = event.merge_group?.head_sha?.trim() ?? ''
  const headRef = event.merge_group?.head_ref?.trim() ?? ''
  if (!/^[0-9a-f]{40}$/i.test(headSha)) {
    throw new Error('Merge group head SHA is missing or malformed.')
  }

  const associated = await request(
    `commits/${encodeURIComponent(headSha)}/pulls`
  )
  if (!Array.isArray(associated)) {
    throw new Error('GitHub returned malformed associated pull request data.')
  }

  let numbers: number[]
  if (associated.length > 0) {
    numbers = associated.map((pullRequest) => {
      const number = pullRequestNumber(pullRequest)
      if (!number) {
        throw new Error('GitHub returned a malformed associated pull request.')
      }
      return number
    })
  } else {
    const fallback = fallbackPullRequestNumber(headRef)
    if (!fallback) {
      throw new Error(
        'No pull request was associated with the merge group and head_ref did not identify one.'
      )
    }
    numbers = [fallback]
  }

  const uniqueNumbers = [...new Set(numbers)]
  return Promise.all(
    uniqueNumbers.map(async (number) =>
      currentPullRequest(await request(`pulls/${number}`))
    )
  )
}

export async function validateMergeGroupPolicy(
  event: MergeGroupEvent,
  request: RepoRequest,
  membershipFor: MembershipLookup,
  screencastProbe?: ScreencastProbe
): Promise<EvidenceValidation> {
  const pullRequests = await loadMergeGroupPullRequests(event, request)
  const [evidence, maintainers] = await Promise.all([
    validatePullRequestEvidenceBatch(pullRequests, screencastProbe),
    validatePullRequestMaintainers(pullRequests, membershipFor)
  ])
  const errors = [...evidence.errors, ...maintainers.errors]
  return { errors, valid: errors.length === 0 }
}

function createRepoRequest(repository: string, token: string): RepoRequest {
  const [owner, repo, ...extra] = repository.split('/')
  if (!owner || !repo || extra.length > 0) {
    throw new Error('GITHUB_REPOSITORY must be owner/repo.')
  }

  return async (path): Promise<unknown> => {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${path}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2026-03-10'
        },
        signal: AbortSignal.timeout(30_000)
      }
    )
    if (!response.ok) {
      throw new Error(
        `GitHub repository metadata lookup failed: ${response.status}`
      )
    }
    return response.json()
  }
}

function writeOutput(valid: boolean): void {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `valid=${valid}\n`)
  }
}

async function runCli(): Promise<void> {
  const [eventPath] = process.argv.slice(2)
  const repoToken = process.env.GITHUB_TOKEN?.trim()
  const membershipToken = process.env.COMFY_ORG_MEMBERS_READ_TOKEN?.trim()
  const repository = process.env.GITHUB_REPOSITORY?.trim()
  if (!eventPath || !repoToken || !membershipToken || !repository) {
    throw new Error(
      'Event path, GITHUB_TOKEN, GITHUB_REPOSITORY, and COMFY_ORG_MEMBERS_READ_TOKEN are required.'
    )
  }

  const event = JSON.parse(readFileSync(eventPath, 'utf8')) as MergeGroupEvent
  const result = await validateMergeGroupPolicy(
    event,
    createRepoRequest(repository, repoToken),
    createGitHubMembershipLookup(membershipToken)
  )
  writeOutput(result.valid)
  if (result.valid) {
    process.stdout.write('Merge group contribution policy satisfied.\n')
    return
  }

  result.errors.forEach((error) => console.error(`::error::${error}`))
  process.exitCode = 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli().catch((error: unknown) => {
    writeOutput(false)
    const message = error instanceof Error ? error.message : String(error)
    console.error(`::error::${message}`)
    process.exitCode = 1
  })
}
