import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

type Environment = Record<string, string | undefined>

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error('Expected an object from the API')
  }
  return value
}

function required(env: Environment, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function uuid(env: Environment, name: string): string {
  const value = required(env, name)
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${name}`)
  }
  return value
}

async function request(
  fetcher: typeof fetch,
  url: string,
  token: string,
  body?: unknown
): Promise<unknown> {
  const response = await fetcher(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'error',
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok)
    throw new Error(`API request failed: HTTP ${response.status}`)
  return response.json()
}

function includesReviewer(value: unknown): boolean {
  if (!Array.isArray(value)) throw new Error('Invalid PR reviewer metadata')
  return value.some((user: unknown) => object(user).login === 'huang47')
}

export async function dispatchReview(
  event: unknown,
  env: Environment,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (env.SWARMHOST_REVIEW_ENABLED !== 'true') return 'Disabled'
  const repo = required(env, 'GITHUB_REPOSITORY')
  if (repo !== 'Comfy-Org/ComfyUI_frontend') return 'Repository is not enabled'
  const number = object(event).number
  if (
    !Number.isSafeInteger(number) ||
    typeof number !== 'number' ||
    number < 1
  ) {
    throw new Error('Invalid pull request number')
  }
  const playbookId = uuid(env, 'SWARMHOST_REVIEW_PLAYBOOK_ID')
  const projectId = uuid(env, 'SWARMHOST_REVIEW_PROJECT_ID')
  const version = Number(required(env, 'SWARMHOST_REVIEW_PLAYBOOK_VERSION'))
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('Invalid SWARMHOST_REVIEW_PLAYBOOK_VERSION')
  }
  const token = required(env, 'SWARMHOST_TOKEN')
  const pr = object(
    await request(
      fetcher,
      `https://api.github.com/repos/${repo}/pulls/${number}`,
      required(env, 'GITHUB_TOKEN')
    )
  )
  if (
    pr.state !== 'open' ||
    pr.draft !== false ||
    object(pr.user).login === 'huang47' ||
    (!includesReviewer(pr.assignees) &&
      !includesReviewer(pr.requested_reviewers))
  ) {
    return 'Pull request is not eligible'
  }
  const head = object(pr.head).sha
  if (typeof head !== 'string' || !/^[0-9a-f]{40}$/.test(head)) {
    throw new Error('Invalid current PR head SHA')
  }
  const result = object(
    await request(
      fetcher,
      `https://swarmhost.engcomfy.com/api/playbooks/${playbookId}/dispatch`,
      token,
      {
        version,
        target_project_id: projectId,
        client_request_id: `shh-review:${repo}:${number}:${head}`,
        params: {
          repo_full_name: repo,
          pr_number: String(number),
          head_sha: head,
          pr_url: `https://github.com/${repo}/pull/${number}`
        }
      }
    )
  )
  if (
    typeof result.id !== 'string' ||
    !['queued', 'provisioning', 'dispatched'].includes(String(result.status))
  ) {
    throw new Error('SwarmHost did not accept the review dispatch')
  }
  return `Review dispatch ${result.id}: ${result.status}`
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const event: unknown = JSON.parse(
      readFileSync(required(process.env, 'GITHUB_EVENT_PATH'), 'utf8')
    )
    process.stdout.write(`${await dispatchReview(event, process.env)}\n`)
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Review dispatch failed'
    )
    process.exitCode = 1
  }
}
