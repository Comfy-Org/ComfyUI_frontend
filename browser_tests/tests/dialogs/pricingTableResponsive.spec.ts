import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudBillingApiFixture as test } from '@e2e/fixtures/cloudBillingApiFixture'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const BOOT_FEATURES = {
  team_workspaces_enabled: true,
  billing_control_enabled: true
} satisfies RemoteConfig
const BOOT_SETTINGS = {
  'Comfy.Assets.UseAssetAPI': false,
  'Comfy.TutorialCompleted': true,
  'Comfy.RightSidePanel.ShowErrorsTab': false
}

interface HorizontalLayout {
  document: {
    clientWidth: number
    scrollWidth: number
  }
  viewportWidth: number
  dialog: {
    left: number
    right: number
  }
  pricing: {
    clientWidth: number
    left: number
    right: number
    scrollWidth: number
  }
  interactive: {
    left: number
    right: number
  }
}

async function mockGraphBootExtras(page: Page) {
  await page.route('**/api/settings/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({}))
  })
  await page.route('**/api/prompt', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
  })
  await page.route('**/api/queue', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
  })
}

async function setupCloudPricing(page: Page) {
  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: BOOT_SETTINGS
  })
  await mockGraphBootExtras(page)
  await mockWorkspace(page, workspace('personal', 'owner'), [])
  await bootCloud(page)
}

async function getHorizontalLayout(
  pricingContent: Locator
): Promise<HorizontalLayout> {
  return pricingContent.evaluate((element) => {
    const dialog = element.closest('[role="dialog"]')
    if (!(dialog instanceof HTMLElement)) {
      throw new Error('Pricing content is not inside a dialog')
    }

    const dialogRect = dialog.getBoundingClientRect()
    const pricingRect = element.getBoundingClientRect()
    const interactiveRects = Array.from(
      element.querySelectorAll<HTMLElement>('a, button, input')
    )
      .map((interactive) => interactive.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)

    return {
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      },
      viewportWidth: window.innerWidth,
      dialog: {
        left: dialogRect.left,
        right: dialogRect.right
      },
      pricing: {
        clientWidth: element.clientWidth,
        left: pricingRect.left,
        right: pricingRect.right,
        scrollWidth: element.scrollWidth
      },
      interactive: {
        left: Math.min(...interactiveRects.map((rect) => rect.left)),
        right: Math.max(...interactiveRects.map((rect) => rect.right))
      }
    }
  })
}

test.describe('Responsive pricing table', { tag: '@cloud' }, () => {
  for (const viewport of [
    { width: 576, height: 900 },
    { width: 390, height: 844 }
  ]) {
    test(`TB-20 fits a ${viewport.width}px viewport without horizontal overflow`, async ({
      billingApi,
      page
    }) => {
      test.slow()
      await page.setViewportSize(viewport)
      await billingApi.setup()
      await setupCloudPricing(page)

      await page.goto(`${APP_URL}/?pricing=1`)

      const heading = page.getByRole('heading', { name: 'Choose a Plan' })
      await expect(heading).toBeVisible({ timeout: 45_000 })

      const pricingContent = page.getByRole('dialog').filter({ has: heading })
      const layout = await getHorizontalLayout(pricingContent)

      expect.soft(layout.dialog.left).toBeGreaterThanOrEqual(0)
      expect.soft(layout.dialog.right).toBeLessThanOrEqual(layout.viewportWidth)
      expect
        .soft(layout.pricing.left)
        .toBeGreaterThanOrEqual(layout.dialog.left)
      expect.soft(layout.pricing.right).toBeLessThanOrEqual(layout.dialog.right)
      expect
        .soft(layout.interactive.left)
        .toBeGreaterThanOrEqual(layout.pricing.left)
      expect
        .soft(layout.interactive.right)
        .toBeLessThanOrEqual(layout.pricing.right)
      expect
        .soft(layout.pricing.scrollWidth)
        .toBeLessThanOrEqual(layout.pricing.clientWidth)
      expect
        .soft(layout.document.scrollWidth)
        .toBeLessThanOrEqual(layout.document.clientWidth)
    })
  }
})
