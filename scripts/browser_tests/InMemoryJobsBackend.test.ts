import type { Page, Route } from '@playwright/test'
import type {
  JobDetailResponse,
  JobEntry,
  JobsListResponse
} from '@comfyorg/ingest-types'
import { describe, expect, it, vi } from 'vitest'

import { InMemoryJobsBackend } from '../../browser_tests/fixtures/helpers/InMemoryJobsBackend';
import type { SeededJob } from '../../browser_tests/fixtures/helpers/InMemoryJobsBackend';

type RouteHandler = (route: Route) => Promise<void>

type RegisteredRoute = {
  pattern: string | RegExp
  handler: RouteHandler
}

type PageStub = Pick<Page, 'route' | 'unroute'>

type FulfillOptions = NonNullable<Parameters<Route['fulfill']>[0]>

function createPageStub(): {
  page: PageStub
  routes: RegisteredRoute[]
} {
  const routes: RegisteredRoute[] = []
  const page = {
    route: vi.fn(async (pattern: string | RegExp, handler: RouteHandler) => {
      routes.push({ pattern, handler })
    }),
    unroute: vi.fn(async () => {})
  } satisfies PageStub

  return { page, routes }
}

function createSeededJob({
  id,
  status = 'completed',
  createTime,
  executionStartTime = createTime,
  executionEndTime = createTime + 1_000,
  workflowId
}: {
  id: string
  status?: JobEntry['status']
  createTime: number
  executionStartTime?: number
  executionEndTime?: number
  workflowId?: string
}): SeededJob {
  const previewOutput = { filename: `${id}.png` }
  const terminalState =
    status === 'completed' || status === 'failed' || status === 'cancelled'

  const listItem: JobEntry = {
    id,
    status,
    create_time: createTime,
    ...(workflowId ? { workflow_id: workflowId } : {}),
    ...(terminalState
      ? {
          preview_output: previewOutput,
          outputs_count: 1,
          execution_start_time: executionStartTime,
          execution_end_time: executionEndTime
        }
      : {})
  }

  const detail: JobDetailResponse = {
    id,
    status,
    create_time: createTime,
    update_time: executionEndTime,
    ...(workflowId ? { workflow_id: workflowId } : {}),
    ...(terminalState
      ? {
          preview_output: previewOutput,
          outputs_count: 1,
          outputs: {}
        }
      : {})
  }

  return { listItem, detail }
}

function getRouteHandler(routes: RegisteredRoute[], url: string): RouteHandler {
  const registeredRoute = routes.find(({ pattern }) =>
    typeof pattern === 'string' ? pattern === url : pattern.test(url)
  )

  if (!registeredRoute) {
    throw new Error(`Expected route handler for ${url}`)
  }

  return registeredRoute.handler
}

function createRouteInvocation({
  url,
  method = 'POST',
  requestBody
}: {
  url: string
  method?: string
  requestBody?: unknown
}): {
  route: Route
  continued: ReturnType<typeof vi.fn>
  getFulfilled: () => FulfillOptions | undefined
} {
  let fulfilled: FulfillOptions | undefined
  const continued = vi.fn(async () => {})

  const route = {
    request: () =>
      ({
        method: () => method,
        url: () => url,
        postDataJSON: () => requestBody
      }) as ReturnType<Route['request']>,
    continue: continued,
    fulfill: vi.fn(async (options?: FulfillOptions) => {
      if (!options) {
        throw new Error('Expected route to be fulfilled with options')
      }

      fulfilled = options
    })
  } satisfies Pick<Route, 'request' | 'fulfill'>

  return {
    route: route as unknown as Route,
    continued,
    getFulfilled: () => fulfilled
  }
}

function bodyToText(body: FulfillOptions['body']): string {
  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf-8')
  }

  return `${body ?? ''}`
}

async function invokeJsonRoute<T>(
  handler: RouteHandler,
  args: {
    url: string
    requestBody?: unknown
  }
): Promise<{
  status: number | undefined
  body: T
}> {
  const invocation = createRouteInvocation(args)

  await handler(invocation.route)

  const fulfilled = invocation.getFulfilled()
  expect(fulfilled).toBeDefined()

  return {
    status: fulfilled?.status,
    body: JSON.parse(bodyToText(fulfilled?.body)) as T
  }
}

describe('InMemoryJobsBackend', () => {
  it('lists jobs sorted by create_time descending by default', async () => {
    const { page, routes } = createPageStub()
    const backend = new InMemoryJobsBackend(page as unknown as Page)

    await backend.seed([
      createSeededJob({ id: 'job-oldest', createTime: 1_000 }),
      createSeededJob({ id: 'job-newest', createTime: 3_000 }),
      createSeededJob({ id: 'job-middle', createTime: 2_000 })
    ])

    const listRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/jobs'
    )
    const response = await invokeJsonRoute<JobsListResponse>(listRouteHandler, {
      url: 'http://localhost/api/jobs?offset=-1&limit=0'
    })

    expect(response.body.jobs.map((job) => job.id)).toEqual([
      'job-newest',
      'job-middle',
      'job-oldest'
    ])
    expect(response.body.pagination).toEqual({
      offset: 0,
      limit: 3,
      total: 3,
      has_more: false
    })
  })

  it('filters by status and workflow_id, then sorts and paginates by execution_duration', async () => {
    const { page, routes } = createPageStub()
    const backend = new InMemoryJobsBackend(page as unknown as Page)

    await backend.seed([
      createSeededJob({
        id: 'job-fast',
        status: 'completed',
        workflowId: 'wf-1',
        createTime: 1_000,
        executionEndTime: 1_100
      }),
      createSeededJob({
        id: 'job-slow',
        status: 'completed',
        workflowId: 'wf-1',
        createTime: 2_000,
        executionEndTime: 2_900
      }),
      createSeededJob({
        id: 'job-failed',
        status: 'failed',
        workflowId: 'wf-1',
        createTime: 3_000,
        executionEndTime: 3_400
      }),
      createSeededJob({
        id: 'job-other-workflow',
        status: 'completed',
        workflowId: 'wf-2',
        createTime: 4_000,
        executionEndTime: 4_050
      })
    ])

    const listRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/jobs'
    )

    const firstPage = await invokeJsonRoute<JobsListResponse>(
      listRouteHandler,
      {
        url: 'http://localhost/api/jobs?status=completed&workflow_id=wf-1&sort_by=execution_duration&sort_order=asc&offset=0&limit=1'
      }
    )
    expect(firstPage.body.jobs.map((job) => job.id)).toEqual(['job-fast'])
    expect(firstPage.body.pagination).toEqual({
      offset: 0,
      limit: 1,
      total: 2,
      has_more: true
    })

    const secondPage = await invokeJsonRoute<JobsListResponse>(
      listRouteHandler,
      {
        url: 'http://localhost/api/jobs?status=completed&workflow_id=wf-1&sort_by=execution_duration&sort_order=asc&offset=1&limit=1'
      }
    )
    expect(secondPage.body.jobs.map((job) => job.id)).toEqual(['job-slow'])
    expect(secondPage.body.pagination).toEqual({
      offset: 1,
      limit: 1,
      total: 2,
      has_more: false
    })
  })

  it('returns job detail by id and 404 for unknown jobs', async () => {
    const { page, routes } = createPageStub()
    const backend = new InMemoryJobsBackend(page as unknown as Page)

    await backend.seed([createSeededJob({ id: 'job-123', createTime: 1_000 })])

    const detailRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/jobs/job-123'
    )

    const found = await invokeJsonRoute<JobDetailResponse>(detailRouteHandler, {
      url: 'http://localhost/api/jobs/job-123'
    })
    expect(found.status).toBe(200)
    expect(found.body).toMatchObject({
      id: 'job-123',
      status: 'completed',
      create_time: 1_000
    })

    const missing = await invokeJsonRoute<{ error: string }>(
      detailRouteHandler,
      {
        url: 'http://localhost/api/jobs/missing-job'
      }
    )
    expect(missing.status).toBe(404)
    expect(missing.body).toEqual({ error: 'Job not found' })
  })

  it('deletes only the requested history ids', async () => {
    const { page, routes } = createPageStub()
    const backend = new InMemoryJobsBackend(page as unknown as Page)

    await backend.seed([
      createSeededJob({ id: 'job-a', createTime: 1_000 }),
      createSeededJob({ id: 'job-b', createTime: 2_000 }),
      createSeededJob({ id: 'job-c', createTime: 3_000 })
    ])

    const historyRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/history'
    )
    await invokeJsonRoute<Record<string, never>>(historyRouteHandler, {
      url: 'http://localhost/api/history',
      requestBody: { delete: ['job-a', 'job-c'] }
    })

    const listRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/jobs'
    )
    const response = await invokeJsonRoute<JobsListResponse>(listRouteHandler, {
      url: 'http://localhost/api/jobs'
    })

    expect(response.body.jobs.map((job) => job.id)).toEqual(['job-b'])
  })

  it('continues non-POST history requests without fulfilling them', async () => {
    const { page, routes } = createPageStub()
    const backend = new InMemoryJobsBackend(page as unknown as Page)

    await backend.seed([createSeededJob({ id: 'job-a', createTime: 1_000 })])

    const historyRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/history'
    )
    const invocation = createRouteInvocation({
      url: 'http://localhost/api/history',
      method: 'GET'
    })

    await historyRouteHandler(invocation.route)

    expect(invocation.continued).toHaveBeenCalledOnce()
    expect(invocation.getFulfilled()).toBeUndefined()
  })

  it('clears terminal history while preserving pending and in_progress jobs', async () => {
    const { page, routes } = createPageStub()
    const backend = new InMemoryJobsBackend(page as unknown as Page)

    await backend.seed([
      createSeededJob({
        id: 'job-pending',
        status: 'pending',
        createTime: 1_000
      }),
      createSeededJob({
        id: 'job-in-progress',
        status: 'in_progress',
        createTime: 2_000
      }),
      createSeededJob({
        id: 'job-completed',
        status: 'completed',
        createTime: 3_000
      }),
      createSeededJob({
        id: 'job-failed',
        status: 'failed',
        createTime: 4_000
      })
    ])

    const historyRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/history'
    )
    await invokeJsonRoute<Record<string, never>>(historyRouteHandler, {
      url: 'http://localhost/api/history',
      requestBody: { clear: true }
    })

    const listRouteHandler = getRouteHandler(
      routes,
      'http://localhost/api/jobs'
    )
    const response = await invokeJsonRoute<JobsListResponse>(listRouteHandler, {
      url: 'http://localhost/api/jobs'
    })

    expect(response.body.jobs.map((job) => job.id)).toEqual([
      'job-in-progress',
      'job-pending'
    ])
  })
})
