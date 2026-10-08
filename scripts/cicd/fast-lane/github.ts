import type { GitHubClient } from './types.ts'

const API_VERSION = '2022-11-28'
const PAGE_SIZE = 100
const GRAPHQL_URL = 'https://api.github.com/graphql'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function apiUrl(root: string, requestPath: string): string {
  if (!requestPath.startsWith('https://')) return `${root}${requestPath}`
  if (new URL(requestPath).origin !== 'https://api.github.com') {
    throw new Error(`Refusing to send credentials to ${requestPath}`)
  }
  return requestPath
}

async function assertSuccessful(
  response: Response,
  method: string,
  requestPath: string
): Promise<void> {
  if (response.ok) return
  const body = (await response.text()).slice(0, 500)
  throw new Error(
    `GitHub API ${method} ${requestPath} failed: ${response.status} ${body}`
  )
}

function arrayPage(value: unknown, requestPath: string): unknown[] {
  if (Array.isArray(value)) return value
  throw new Error(`GitHub API ${requestPath} did not return an array`)
}

function graphqlData(value: unknown): unknown {
  if (!isRecord(value)) {
    throw new Error('GitHub GraphQL returned an invalid response')
  }
  const errors = Array.isArray(value.errors) ? value.errors : []
  if (errors.length === 0) return value.data
  const messages = errors.map((error) =>
    isRecord(error) && typeof error.message === 'string'
      ? error.message
      : 'unknown error'
  )
  throw new Error(`GitHub GraphQL failed: ${messages.join('; ')}`)
}

export function createGitHubClient(
  token: string,
  repository: string
): GitHubClient {
  const root = `https://api.github.com/repos/${repository}`
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': API_VERSION,
    'user-agent': 'comfy-package-fast-lane/1.0'
  }

  async function request(
    requestPath: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const requestHeaders = new Headers(headers)
    new Headers(options.headers).forEach((value, name) => {
      requestHeaders.set(name, value)
    })
    const response = await fetch(apiUrl(root, requestPath), {
      ...options,
      headers: requestHeaders
    })
    await assertSuccessful(response, options.method ?? 'GET', requestPath)
    if (response.status === 204) return null
    return response.json()
  }

  async function paginate(requestPath: string): Promise<unknown[]> {
    const rows: unknown[] = []
    for (let page = 1; ; page += 1) {
      const separator = requestPath.includes('?') ? '&' : '?'
      const body = arrayPage(
        await request(
          `${requestPath}${separator}per_page=${PAGE_SIZE}&page=${page}`
        ),
        requestPath
      )
      rows.push(...body)
      if (body.length < PAGE_SIZE) return rows
    }
  }

  async function graphql(
    query: string,
    variables: Record<string, unknown>
  ): Promise<unknown> {
    return graphqlData(
      await request(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables })
      })
    )
  }

  return { request, paginate, graphql }
}
