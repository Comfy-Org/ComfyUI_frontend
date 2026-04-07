import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { Page, Route } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AssetScenarioHelper } from '../../browser_tests/fixtures/helpers/AssetScenarioHelper'
import type {
  GeneratedJobFixture,
  ImportedAssetFixture
} from '../../browser_tests/fixtures/helpers/assetScenarioTypes'

type RouteHandler = (route: Route) => Promise<void>

type RegisteredRoute = {
  pattern: string | RegExp
  handler: RouteHandler
}

type PageStub = Pick<Page, 'route' | 'unroute'>

type AssetScenarioHelperTestAccess = {
  seed(args: {
    generated: GeneratedJobFixture[]
    imported: ImportedAssetFixture[]
  }): Promise<void>
}

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
  let tempDir: string | undefined

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  it('serves seeded files using filename, type, and subfolder together', async () => {
    tempDir = await mkdtemp(
      path.join(tmpdir(), 'asset-scenario-helper-view-route-')
    )

    const outputFile = path.join(tempDir, 'output.txt')
    const nestedOutputFile = path.join(tempDir, 'nested-output.txt')
    const inputFile = path.join(tempDir, 'input.txt')

    await Promise.all([
      writeFile(outputFile, 'root output'),
      writeFile(nestedOutputFile, 'nested output'),
      writeFile(inputFile, 'input asset')
    ])

    const { page, routes } = createPageStub()
    const helper = new AssetScenarioHelper(page as unknown as Page)
    const testAccess = helper as unknown as AssetScenarioHelperTestAccess

    await testAccess.seed({
      generated: [
        {
          jobId: 'job-root',
          outputs: [
            {
              filename: 'shared-name.txt',
              type: 'output',
              subfolder: '',
              filePath: outputFile,
              contentType: 'text/plain'
            }
          ]
        },
        {
          jobId: 'job-nested',
          outputs: [
            {
              filename: 'shared-name.txt',
              type: 'output',
              subfolder: 'nested/folder',
              filePath: nestedOutputFile,
              contentType: 'text/plain'
            }
          ]
        }
      ],
      imported: [
        {
          name: 'shared-name.txt',
          filePath: inputFile,
          contentType: 'text/plain'
        }
      ]
    })

    const viewRouteHandler = getRouteHandler(
      routes,
      (pattern) =>
        pattern instanceof RegExp && /api\\\/view/.test(pattern.source)
    )

    await expect(
      invokeViewRoute(
        viewRouteHandler,
        'http://localhost/api/view?filename=shared-name.txt&type=output&subfolder='
      )
    ).resolves.toBe('root output')

    await expect(
      invokeViewRoute(
        viewRouteHandler,
        'http://localhost/api/view?filename=shared-name.txt&type=output&subfolder=nested%2Ffolder'
      )
    ).resolves.toBe('nested output')

    await expect(
      invokeViewRoute(
        viewRouteHandler,
        'http://localhost/api/view?filename=shared-name.txt&type=input&subfolder='
      )
    ).resolves.toBe('input asset')
  })
})
