import type { GitHubClient } from './types.ts'

const API_VERSION = '2022-11-28'
const PAGE_SIZE = 100
const GRAPHQL_URL = 'https://api.github.com/graphql'

function apiUrl(root: string, requestPath: string): string {
  return requestPath.startsWith('https://')
    ? requestPath
    : `${root}${requestPath}`
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

interface GraphqlEnvelope {
  data?: unknown
  errors?: { message?: string }[]
}

function graphqlEnvelope(value: unknown): GraphqlEnvelope {
  if (typeof value !== 'object' || value === null) {
    throw new Error('GitHub GraphQL returned an invalid response')
  }
  return value
}

function graphqlErrorMessage(error: { message?: string }): string {
  return error.message ?? 'unknown error'
}

function graphqlData(value: unknown): unknown {
  const envelope = graphqlEnvelope(value)
  const errors = envelope.errors ?? []
  if (errors.length === 0) return envelope.data
  throw new Error(
    `GitHub GraphQL failed: ${errors.map(graphqlErrorMessage).join('; ')}`
  )
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
