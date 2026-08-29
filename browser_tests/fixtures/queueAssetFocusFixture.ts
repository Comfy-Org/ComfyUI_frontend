import type { Page, Route } from '@playwright/test'
import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  JobsRouteMocker
} from '@e2e/fixtures/jobsRouteFixture'

const ASSETS_ROUTE_PATTERN = /\/api\/assets(?:\?.*)?$/
export const TARGET_JOB_ID = '00000000-0000-4000-8000-000000000003'
const requestsByPage = new WeakMap<Page, string[]>()

function createOutputAsset(id: string, jobId: string, name: string): Asset {
  return {
    id,
    name,
    mime_type: 'image/png',
    tags: ['output'],
    job_id: jobId,
    created_at: '2026-08-29T00:00:00Z',
    updated_at: '2026-08-29T00:00:00Z'
  }
}

function outputPage(after: string | null): ListAssetsResponse {
  if (after === 'queue-focus-page-2') {
    return {
      assets: [
        createOutputAsset(
          '10000000-0000-4000-8000-000000000003',
          TARGET_JOB_ID,
          'queue-focus-target.png'
        )
      ],
      total: 3,
      has_more: false
    }
  }

  if (after === 'queue-focus-page-1') {
    return {
      assets: [
        createOutputAsset(
          '10000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000002',
          'queue-focus-middle.png'
        )
      ],
      total: 3,
      has_more: true,
      next_cursor: 'queue-focus-page-2'
    }
  }

  return {
    assets: [
      createOutputAsset(
        '10000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000001',
        'queue-focus-newest.png'
      )
    ],
    total: 3,
    has_more: true,
    next_cursor: 'queue-focus-page-1'
  }
}

function requestsOutputAssets(url: URL): boolean {
  return (url.searchParams.get('tags_any') ?? '').split(',').includes('output')
}

export const queueAssetFocusTest = comfyPageFixture.extend<{
  outputAssetRequests: string[]
}>({
  page: async ({ page }, use) => {
    const outputAssetRequests: string[] = []
    requestsByPage.set(page, outputAssetRequests)
    const jobsRoutes = new JobsRouteMocker(page)

    await jobsRoutes.mockJobsScenario({
      history: [createRouteMockJob({ id: TARGET_JOB_ID })],
      queue: []
    })

    const assetsRouteHandler = async (route: Route) => {
      const url = new URL(route.request().url())
      if (!requestsOutputAssets(url)) {
        await route.fulfill({
          json: {
            assets: [],
            total: 0,
            has_more: false
          } satisfies ListAssetsResponse
        })
        return
      }

      outputAssetRequests.push(url.toString())
      await route.fulfill({ json: outputPage(url.searchParams.get('after')) })
    }

    await page.route(ASSETS_ROUTE_PATTERN, assetsRouteHandler)
    await use(page)
    await page.unroute(ASSETS_ROUTE_PATTERN, assetsRouteHandler)
    requestsByPage.delete(page)
  },
  outputAssetRequests: async ({ page }, use) => {
    await use(requestsByPage.get(page) ?? [])
  }
})
