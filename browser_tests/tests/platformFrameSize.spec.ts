import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const PLATFORM_ORIGIN = 'https://platform.e2e.test'
const MARGIN_PX = 24
const MAX_WIDTH_PX = 1120
const MAX_HEIGHT_PX = 1024
const PREINSTALL_MAX_WIDTH_PX = 720
const PREINSTALL_MAX_HEIGHT_PX = 520

type FrameRequest =
  | { step: 'new'; handsOverWorkflow: true }
  | { step: 'preinstall'; deploymentId: string }

async function bootWithPlatformFrame(page: Page) {
  await setupCloudApp(page, {
    workspace: workspace('personal', 'owner'),
    features: {
      comfy_platform_base_url: PLATFORM_ORIGIN,
      custom_deployments_editor_enabled: true
    }
  })
  await page.route(`${PLATFORM_ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html>' })
  )
  await page.goto(APP_URL)
  await page.waitForFunction(() => window.app?.isGraphReady === true, null, {
    timeout: 45_000
  })
}

async function openFrame(page: Page, request: FrameRequest, wayIn: string) {
  await page.evaluate(
    ([frameRequest, frameWayIn]) => {
      const pinia =
        document.getElementById('vue-app')?.__vue_app__?.config.globalProperties
          .$pinia
      if (!pinia) throw new Error('Pinia is not mounted')
      const frames = pinia._s.get('platformFrame')
      if (!frames) throw new Error('The platform frame store is not created')
      frames.open(frameRequest, frameWayIn)
    },
    [request, wayIn] as const
  )
}

async function frameBox(page: Page) {
  const dialog = page.getByTestId('platform-frame-host')
  await expect(dialog).toBeVisible()
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  )
  const box = await dialog.boundingBox()
  if (!box) throw new Error('Expected the platform frame dialog to lay out')
  return box
}

test.describe('Platform frame dialog size', { tag: '@cloud' }, () => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 }
  ]) {
    test(`leaves a 24px margin and caps at 1120 wide at ${viewport.width}x${viewport.height}`, async ({
      page
    }) => {
      test.slow()
      await page.setViewportSize(viewport)
      await bootWithPlatformFrame(page)
      await openFrame(
        page,
        { step: 'new', handsOverWorkflow: true },
        'extensions'
      )

      const box = await frameBox(page)

      expect(box.width).toBeCloseTo(MAX_WIDTH_PX, 0)
      expect(box.height).toBeCloseTo(viewport.height - 2 * MARGIN_PX, 0)
      expect(box.y).toBeCloseTo(MARGIN_PX, 0)
      expect(box.x).toBeCloseTo((viewport.width - MAX_WIDTH_PX) / 2, 0)
    })
  }

  test('fills a narrow screen less a 24px margin on every side', async ({
    page
  }) => {
    test.slow()
    await page.setViewportSize({ width: 1024, height: 700 })
    await bootWithPlatformFrame(page)
    await openFrame(
      page,
      { step: 'new', handsOverWorkflow: true },
      'extensions'
    )

    const box = await frameBox(page)

    expect(box).toEqual({
      x: MARGIN_PX,
      y: MARGIN_PX,
      width: 1024 - 2 * MARGIN_PX,
      height: 700 - 2 * MARGIN_PX
    })
  })

  test('caps at 1120 by 1024 on a large screen', async ({ page }) => {
    test.slow()
    await page.setViewportSize({ width: 1920, height: 1200 })
    await bootWithPlatformFrame(page)
    await openFrame(
      page,
      { step: 'new', handsOverWorkflow: true },
      'extensions'
    )

    const box = await frameBox(page)

    expect(box.width).toBeCloseTo(MAX_WIDTH_PX, 0)
    expect(box.height).toBeCloseTo(MAX_HEIGHT_PX, 0)
    expect(box.x).toBeCloseTo((1920 - MAX_WIDTH_PX) / 2, 0)
    expect(box.y).toBeCloseTo((1200 - MAX_HEIGHT_PX) / 2, 0)
  })

  test('keeps the pre-install dialog at 720 by 520', async ({ page }) => {
    test.slow()
    await page.setViewportSize({ width: 1440, height: 900 })
    await bootWithPlatformFrame(page)
    await openFrame(
      page,
      { step: 'preinstall', deploymentId: 'dep-1' },
      'preinstall'
    )

    const box = await frameBox(page)

    expect(box.width).toBeCloseTo(PREINSTALL_MAX_WIDTH_PX, 0)
    expect(box.height).toBeCloseTo(PREINSTALL_MAX_HEIGHT_PX, 0)
  })
})
