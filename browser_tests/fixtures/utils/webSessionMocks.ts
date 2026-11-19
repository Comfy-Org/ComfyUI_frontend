import type { BrowserContext, Page } from '@playwright/test'

import type {
  CreateSessionResponse,
  DeleteSessionResponse
} from '@comfyorg/ingest-types'

import { NO_WEB_SESSION, WEB_SESSION } from '@e2e/fixtures/data/webSession'

/**
 * Answers `/api/auth/session` like ingest: no session until a sign-in proof
 * creates one.
 */
export async function mockWebSessionServer(
  routeTarget: Page | BrowserContext
): Promise<void> {
  let signedIn = false
  await routeTarget.route('**/api/auth/session', (route) => {
    switch (route.request().method()) {
      case 'POST':
        signedIn = true
        return route.fulfill({
          json: { success: true } satisfies CreateSessionResponse
        })
      case 'DELETE':
        signedIn = false
        return route.fulfill({
          json: { success: true } satisfies DeleteSessionResponse
        })
      default:
        return signedIn
          ? route.fulfill({ json: WEB_SESSION })
          : route.fulfill({ status: 401, json: NO_WEB_SESSION })
    }
  })
}
