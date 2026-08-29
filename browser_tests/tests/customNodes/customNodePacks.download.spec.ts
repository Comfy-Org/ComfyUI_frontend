import { readFile } from 'node:fs/promises'

import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  customNodeDownloadArchive,
  customNodeDownloadRecord
} from '@e2e/fixtures/data/customNodePacks'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

test.describe('Custom node packs', { tag: ['@cloud', '@ui'] }, () => {
  test.beforeEach(async ({ page }) => {
    await setupCloudApp(page, {
      workspace: workspace('personal', 'owner')
    })
    await page.route(
      '**/api/customnodes',
      async (route) => await route.fulfill({ json: [customNodeDownloadRecord] })
    )
    await page.route(
      `**/api/customnodes/${customNodeDownloadRecord.revision_id}/download`,
      async (route) =>
        await route.fulfill({
          contentType: 'application/zip',
          headers: {
            'Content-Disposition': 'attachment; filename="echo-pack.zip"'
          },
          body: customNodeDownloadArchive
        })
    )
  })

  test('downloads an uploaded pack with its exact ZIP contents', async ({
    page,
    request
  }) => {
    const comfyPage = new ComfyPage(page, request)
    await page.goto(APP_URL)
    await comfyPage.waitForAppReady()
    const closeTemplateDialog = page.getByRole('button', {
      name: 'Close dialog'
    })
    if (await closeTemplateDialog.isVisible()) {
      await closeTemplateDialog.click()
    }

    // 1. Open Custom Nodes from the Node Library.
    await comfyPage.menu.nodeLibraryTabV2.open()
    const customNodesButton =
      comfyPage.menu.nodeLibraryTabV2.sidebarContent.getByRole('button', {
        name: 'Custom Nodes',
        exact: true
      })
    await expect(customNodesButton).toBeVisible()
    await customNodesButton.click()

    // 2. Verify the uploaded pack and its Download action are visible.
    await expect(
      page.getByRole('heading', {
        name: 'Custom node packs',
        exact: true
      })
    ).toBeVisible()
    const pack = page.getByRole('listitem').filter({ hasText: 'Echo Pack' })
    await expect(pack.getByText('Echo Pack', { exact: true })).toBeVisible()
    const downloadButton = pack.getByRole('button', {
      name: 'Download',
      exact: true
    })
    await expect(downloadButton).toBeVisible()

    // 3. Download the pack and verify its filename and exact ZIP bytes.
    const downloadPromise = page.waitForEvent('download')
    await downloadButton.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('Echo Pack.zip')

    const downloadPath = await download.path()
    if (downloadPath === null) {
      throw new Error('Playwright did not persist the downloaded ZIP')
    }
    expect(await readFile(downloadPath)).toEqual(customNodeDownloadArchive)
  })
})
