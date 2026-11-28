import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const PLATFORM_ORIGIN = 'https://platform.e2e.test'

export const PLATFORM_FRAME_SIZE = {
  margin: 24,
  maxWidth: 1120,
  maxHeight: 1024,
  preinstallWidth: 720,
  preinstallHeight: 520
} as const

type PlatformFrameRequest =
  | { step: 'new'; handsOverWorkflow: true }
  | { step: 'preinstall'; deploymentId: string }

interface DialogBox {
  x: number
  y: number
  width: number
  height: number
}

interface PlatformFrame {
  openBuildWizard: () => Promise<void>
  openPreinstall: () => Promise<void>
  dialogBox: () => Promise<DialogBox | null>
}

async function bootCloudWithPlatformFrame(page: Page) {
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

function dialogOf(page: Page) {
  return page.getByTestId('platform-frame-host')
}

async function openFrame(
  page: Page,
  request: PlatformFrameRequest,
  wayIn: string
) {
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
  const dialog = dialogOf(page)
  await expect(dialog).toBeVisible()
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  )
}

async function roundedDialogBox(page: Page): Promise<DialogBox | null> {
  const box = await dialogOf(page).boundingBox()
  if (!box) return null
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height)
  }
}

export const platformFrameTest = base.extend<{
  platformFrame: PlatformFrame
}>({
  platformFrame: async ({ page }, use) => {
    await bootCloudWithPlatformFrame(page)
    await use({
      openBuildWizard: () =>
        openFrame(page, { step: 'new', handsOverWorkflow: true }, 'extensions'),
      openPreinstall: () =>
        openFrame(
          page,
          { step: 'preinstall', deploymentId: 'dep-1' },
          'preinstall'
        ),
      dialogBox: () => roundedDialogBox(page)
    })
  }
})
