import type { Page } from '@playwright/test'

import {
  FIRST_RUN_BILLING_STATUS,
  FIRST_RUN_FEATURES,
  FIRST_RUN_NO_ASSETS,
  FIRST_RUN_PROMPT,
  FIRST_RUN_TEMPLATES
} from '@e2e/fixtures/data/firstRunTour'
import { mockTemplateIndex } from '@e2e/fixtures/data/templateFixtures'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export async function mockFirstRunTourBackend(page: Page) {
  await page.route('**/api/features', (route) =>
    route.fulfill(jsonRoute(FIRST_RUN_FEATURES))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(FIRST_RUN_BILLING_STATUS))
  )
  await page.route('**/api/assets**', (route) =>
    route.fulfill(jsonRoute(FIRST_RUN_NO_ASSETS))
  )
}

export async function installFirstRunRaceRoutes(
  page: Page,
  deferCatalog: boolean
) {
  let acceptPrompt!: () => void
  let promptRequested!: () => void
  const promptResponseReady = new Promise<void>((resolve) => {
    acceptPrompt = resolve
  })
  const promptRequest = new Promise<void>((resolve) => {
    promptRequested = resolve
  })

  await page.route('**/api/prompt', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    promptRequested()
    await promptResponseReady
    await route.fulfill(jsonRoute(FIRST_RUN_PROMPT))
  })

  let releaseCatalog!: () => void
  let catalogRequested!: () => void
  const catalogReady = new Promise<void>((resolve) => {
    releaseCatalog = resolve
  })
  const catalogRequest = new Promise<void>((resolve) => {
    catalogRequested = resolve
  })

  await page.route(/\/templates\/index\.json(?:\?.*)?$/, async (route) => {
    catalogRequested()
    if (deferCatalog) await catalogReady
    await route.fulfill(jsonRoute(mockTemplateIndex(FIRST_RUN_TEMPLATES)))
  })

  return {
    waitForPrompt: () => promptRequest,
    waitForCatalog: () => catalogRequest,
    async acceptPrompt() {
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/prompt') &&
          response.request().method() === 'POST'
      )
      acceptPrompt()
      await (await response).finished()
    },
    async releaseCatalog() {
      const response = page.waitForResponse(
        /\/templates\/index\.json(?:\?.*)?$/
      )
      releaseCatalog()
      await (await response).finished()
    },
    releasePending() {
      acceptPrompt()
      releaseCatalog()
    }
  }
}
