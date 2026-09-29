import type { Request } from '@playwright/test'

import type { ListMembersResponse } from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  WEB_SESSION,
  WEB_SESSION_COOKIE,
  WEB_SESSION_FEATURES,
  WEB_SESSION_MINT,
  currentWorkspace
} from '@e2e/fixtures/data/webSession'
import { WORKSPACE_SWITCHER_WORKSPACES } from '@e2e/fixtures/data/workspaceSwitcher'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspaceList } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

interface TokenMint {
  body: unknown
  authorization: string | undefined
  workspace: string | undefined
}

interface WebSessionFixtures {
  tokenMints: TokenMint[]
  workspaceReads: Request[]
}

/**
 * Boots the cloud app with `unified_web_session` on, through the merged
 * `/api/features` body, and a cookie session answered from typed mocks.
 * `tokenMints` and `workspaceReads` record requests from before navigation.
 */
export const webSessionTest = comfyPageFixture.extend<WebSessionFixtures>({
  tokenMints: async ({ context }, use) => {
    const mints: TokenMint[] = []
    context.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/auth/token')) {
        const headers = request.headers()
        mints.push({
          body: request.postDataJSON(),
          authorization: headers['authorization'],
          workspace: headers['x-comfy-workspace-id']
        })
      }
    })
    await use(mints)
  },
  workspaceReads: async ({ context }, use) => {
    const reads: Request[] = []
    context.on('request', (request) => {
      const { pathname } = new URL(request.url())
      if (
        request.method() === 'GET' &&
        pathname === '/api/workspaces/current'
      ) {
        reads.push(request)
      }
    })
    await use(reads)
  },
  page: async ({ page, context, tokenMints, workspaceReads }, use) => {
    void tokenMints
    void workspaceReads

    await page.route('**/api/features', async (route) => {
      const response = await route.fetch()
      const backendFeatures: RemoteConfig = await response.json()
      await route.fulfill(
        jsonRoute({ ...backendFeatures, ...WEB_SESSION_FEATURES })
      )
    })

    await page.route('**/api/auth/session', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill(jsonRoute(WEB_SESSION))
    })

    await page.route('**/api/auth/token', (route) =>
      route.fulfill(jsonRoute(WEB_SESSION_MINT))
    )

    await mockBilling(page, { workspaceId: 'ws-team' })

    await mockWorkspaceList(page, WORKSPACE_SWITCHER_WORKSPACES)

    await page.route('**/api/workspace/members**', (route) =>
      route.fulfill({
        json: {
          members: [],
          pagination: { offset: 0, limit: 50, total: 0, has_more: false }
        } satisfies ListMembersResponse
      })
    )

    await page.route('**/api/workspaces/current', async (route) => {
      const workspaceId = await route
        .request()
        .headerValue('x-comfy-workspace-id')
      const workspace = WORKSPACE_SWITCHER_WORKSPACES.find(
        ({ id }) => id === workspaceId
      )
      if (!workspace) {
        await route.fulfill({ status: 404 })
        return
      }
      await route.fulfill(jsonRoute(currentWorkspace(workspace)))
    })

    await context.addCookies([{ ...WEB_SESSION_COOKIE, url: APP_URL }])

    await use(page)
  }
})
