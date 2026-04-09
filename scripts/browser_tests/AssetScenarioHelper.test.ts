import type { Page, Route } from '@playwright/test'
import { describe, expect, it, vi } from 'vitest'

import { AssetScenarioHelper } from '../../browser_tests/fixtures/helpers/AssetScenarioHelper'
import { createMockJob } from '../../browser_tests/fixtures/helpers/jobFixtures'

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

function getRouteHandler(
  routes: RegisteredRoute[],
  matcher: (pattern: string | RegExp) => boolean
): RouteHandler {
  const registeredRoute = routes.find(({ pattern }) => matcher(pattern))

  if (!registeredRoute) {
    throw new Error('Expected route handler to be registered')
  }

  return registeredRoute.handler
}

function createRouteInvocation(url: string): {
  route: Route
  getFulfilled: () => FulfillOptions | undefined
} {
  let fulfilled: FulfillOptions | undefined

  const route = {
    request: () =>
      ({
        url: () => url
      }) as ReturnType<Route['request']>,
    fulfill: vi.fn(async (options?: FulfillOptions) => {
      if (!options) {
        throw new Error('Expected route to be fulfilled with options')
      }

      fulfilled = options
    })
  } satisfies Pick<Route, 'request' | 'fulfill'>

  return {
    route: route as unknown as Route,
    getFulfilled: () => fulfilled
  }
}

function bodyToText(body: FulfillOptions['body']): string {
  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf-8')
  }

  return `${body ?? ''}`
}

async function invokeViewRoute(
  handler: RouteHandler,
  url: string
): Promise<string> {
  const invocation = createRouteInvocation(url)

  await handler(invocation.route)

  const fulfilled = invocation.getFulfilled()
  expect(fulfilled).toBeDefined()

  return bodyToText(fulfilled?.body)
}

describe('AssetScenarioHelper', () => {
  it('serves generated outputs and imported files through the view route', async () => {
    const { page, routes } = createPageStub()
    const helper = new AssetScenarioHelper(page as unknown as Page)

    await helper.seedGeneratedHistory([
      createMockJob({
        id: 'job-generated',
        preview_output: {
          filename: 'generated.json',
          subfolder: '',
          type: 'output',
          nodeId: '1',
          mediaType: 'images'
        }
      })
    ])
    await helper.seedImportedFiles(['imported.txt'])

    const viewRouteHandler = getRouteHandler(
      routes,
      (pattern) =>
        pattern instanceof RegExp && /api\\\/view/.test(pattern.source)
    )

    await expect(
      invokeViewRoute(
        viewRouteHandler,
        'http://localhost/api/view?filename=generated.json&type=output&subfolder='
      )
    ).resolves.toBe(JSON.stringify({ mocked: true }, null, 2))

    await expect(
      invokeViewRoute(
        viewRouteHandler,
        'http://localhost/api/view?filename=imported.txt&type=input&subfolder='
      )
    ).resolves.toBe('mocked asset content')
  })
})
