import type { BrowserContext } from '@playwright/test'

const PLATFORM_FLAG_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
}

/**
 * The platform's `distributions_enabled` answer that a signed-in local build
 * asks for when a workflow actions menu opens (DPLAT-1825).
 */
export async function mockDistributionsFlag(
  context: BrowserContext,
  enabled: boolean
): Promise<void> {
  await context.route('**/api/flags/distributions-enabled', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: PLATFORM_FLAG_CORS })
      : route.fulfill({ json: { enabled }, headers: PLATFORM_FLAG_CORS })
  )
}
