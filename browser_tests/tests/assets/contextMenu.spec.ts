import { expect, mergeTests } from '@playwright/test'
import type { Response } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import { expectNoErrorUiAfterVerification } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import {
  JobsRouteMocker,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import {
  betaJob,
  generatedJobs,
  mockGeneratedSidebarRoutes,
  viewFiles
} from '@e2e/tests/assets/routeMockFixtures'
import {
  JOB_GAMMA_DETAIL,
  SAMPLE_JOBS
} from '@e2e/tests/assets/sidebarFixtures'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const test = comfyPageFixture
const routeTest = mergeTests(comfyPageFixture, jobsRouteFixture)

function isGeneratedAssetVerificationResponse(response: Response): boolean {
  const url = new URL(response.url())
  return (
    response.request().method().toUpperCase() === 'GET' &&
    response.status() === 200 &&
    url.pathname.endsWith('/api/jobs') &&
    url.searchParams.get('status')?.split(',').includes('completed') === true
  )
}

const bulkInsertionTest = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const jobsRoutes = new JobsRouteMocker(page)
    await jobsRoutes.mockJobsQueue([])
    await jobsRoutes.mockJobsHistory(generatedJobs)
    await page.route('**/internal/files/input**', async (route) => {
      if (route.request().method().toUpperCase() !== 'GET') {
        await route.fallback()
        return
      }
      await route.fulfill({ json: [] })
    })
    await mockViewFiles(page, viewFiles)
    await use(page)
  }
})

test.describe('Assets sidebar - context menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Right-clicking an asset shows context menu', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible()
  })

  test('Context menu contains Download action for output asset', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Download')).toBeVisible()
  })

  test('Context menu contains Inspect action for image assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Inspect asset')).toBeVisible()
  })

  test('Context menu contains Delete action for output assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Delete')).toBeVisible()
  })

  test('Context menu contains Copy job ID for output assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await comfyPage.page
      .locator('.p-contextmenu')
      .waitFor({ state: 'visible', timeout: 3000 })

    await expect(tab.contextMenuItem('Copy job ID')).toBeVisible()
  })

  test('Context menu contains workflow actions for output assets', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await expect(contextMenu).toBeVisible()

    await expect(
      tab.contextMenuItem('Open as workflow in new tab')
    ).toBeVisible()
    await expect(tab.contextMenuItem('Export workflow')).toBeVisible()
  })

  test('Cancelling export-workflow filename prompt does not show an error toast', async ({
    comfyPage
  }) => {
    await comfyPage.assets.mockJobDetail('job-gamma', JOB_GAMMA_DETAIL)

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Export workflow').click()

    const promptDialog = comfyPage.page.getByRole('dialog', {
      name: 'Export Workflow'
    })
    await expect(promptDialog).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(promptDialog).toBeHidden()

    await expect(comfyPage.toast.toastErrors).toBeHidden({ timeout: 1500 })
  })

  test('Confirming export-workflow prompt downloads the file and shows a success toast', async ({
    comfyPage
  }) => {
    await comfyPage.assets.mockJobDetail('job-gamma', JOB_GAMMA_DETAIL)

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Export workflow').click()

    const promptDialog = comfyPage.page.getByRole('dialog', {
      name: 'Export Workflow'
    })
    await expect(promptDialog).toBeVisible()

    const downloadPromise = comfyPage.page.waitForEvent('download')
    await promptDialog.getByRole('button', { name: 'Confirm' }).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('abstract_art.json')

    await expect(comfyPage.toast.toastSuccesses).toBeVisible()
  })

  test('Export-workflow shows a warning toast when the asset has no workflow', async ({
    comfyPage
  }) => {
    const { workflow: _, ...detailWithoutWorkflow } = JOB_GAMMA_DETAIL
    await comfyPage.assets.mockJobDetail('job-gamma', detailWithoutWorkflow)

    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Export workflow').click()

    await expect(comfyPage.toast.toastWarnings).toBeVisible()
    await expect(comfyPage.toast.toastSuccesses).toBeHidden({ timeout: 1500 })
  })

  test('Bulk context menu shows when multiple assets selected', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const cards = tab.assetCards
    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2)

    await tab.dismissToasts()

    await cards.first().click()
    await comfyPage.page.keyboard.down('Control')
    await cards.nth(1).click()
    await comfyPage.page.keyboard.up('Control')

    await expect(tab.selectedCards).toHaveCount(2)
    await expect(tab.selectionFooter).toBeVisible()

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await cards.first().dispatchEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
    await expect(contextMenu).toBeVisible()

    await expect(tab.contextMenuItem('Download all')).toBeVisible()
  })
})

test.describe('Assets sidebar - delete confirmation', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
    await comfyPage.assets.mockDeleteHistory()
    await comfyPage.assets.mockInputFiles([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Right-click delete shows confirmation dialog', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Delete this asset?')).toBeVisible()
    await expect(
      dialog.getByText('This asset will be permanently removed.')
    ).toBeVisible()
  })

  test('Confirming delete removes asset and shows success toast', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const initialCount = await tab.assetCards.count()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()

    await comfyPage.confirmDialog.delete.click()

    await expect(dialog).toBeHidden()
    await expect(tab.assetCards).toHaveCount(initialCount - 1)

    const successToast = comfyPage.page.locator('.p-toast-message-success')
    await expect(successToast).toBeVisible()
  })

  test('Cancelling delete preserves asset', async ({ comfyPage }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const initialCount = await tab.assetCards.count()

    await tab.assetCards.first().click({ button: 'right' })
    await tab.contextMenuItem('Delete').click()

    const dialog = comfyPage.confirmDialog.root
    await expect(dialog).toBeVisible()

    await comfyPage.confirmDialog.reject.click()

    await expect(dialog).toBeHidden()
    await expect(tab.assetCards).toHaveCount(initialCount)
  })
})

routeTest.describe('Assets sidebar - delete via history refresh', () => {
  routeTest.beforeEach(async ({ jobsRoutes, page }) => {
    await mockGeneratedSidebarRoutes(page, jobsRoutes, [])
  })

  routeTest(
    'deletes a generated output asset through explicit history refresh',
    async ({ comfyPage, jobsRoutes }) => {
      const tab = comfyPage.menu.assetsTab

      await comfyPage.setup()
      await tab.open()
      await expect(tab.getAssetCardByName('alpha')).toBeVisible()

      const deleteRequests = await jobsRoutes.mockDeleteHistory()
      await jobsRoutes.mockJobsHistory([betaJob])

      await tab.getAssetCardByName('alpha').click({ button: 'right' })
      await tab.contextMenuItem('Delete').click()
      await comfyPage.confirmDialog.delete.click()

      await expect.poll(() => deleteRequests).toHaveLength(1)
      expect(deleteRequests[0]).toEqual({ delete: ['alpha'] })
      await expect(tab.getAssetCardByName('alpha')).toHaveCount(0)
      await expect(comfyPage.toast.toastSuccesses).toContainText(
        'Asset deleted successfully'
      )
    }
  )
})

test('Insert as node', { tag: '@vue-nodes' }, async ({ comfyPage }) => {
  await comfyPage.assets.mockOutputHistory([
    createMockJob({
      id: 'job1',
      preview_output: {
        filename: `1.png`,
        type: 'temp',
        nodeId: '1',
        mediaType: 'images'
      }
    }),
    createMockJob({
      id: 'job2',
      preview_output: {
        filename: `2.png`,
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      }
    }),
    createMockJob({
      id: 'job2',
      preview_output: {
        filename: `3.png`,
        type: 'input',
        nodeId: '1',
        mediaType: 'images'
      }
    })
  ])
  const { assetsTab } = comfyPage.menu
  await assetsTab.open()
  await assetsTab.waitForAssets()
  await expect(assetsTab.assetCards).toHaveCount(3)
  for (const [index, expectedName] of [
    [0, '1.png [temp]'],
    [1, '2.png [output]'],
    [2, '3.png']
  ] as const) {
    await comfyPage.nodeOps.clearGraph()
    await assetsTab.assetCards.nth(index).scrollIntoViewIfNeeded()
    await assetsTab.assetCards.nth(index).click({ button: 'right' })

    await expect(comfyPage.contextMenu.primeVueMenu).toBeVisible()
    await comfyPage.contextMenu.primeVueMenu.getByText('Insert as node').click()

    await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(1)
    const nodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const fileWidget = await nodes[0].getWidget(0)
    await expect.poll(() => fileWidget.getValue()).toBe(expectedName)
  }
})

bulkInsertionTest.describe(
  'Assets sidebar - bulk insert as nodes',
  { tag: ['@vue-nodes', '@ui', '@node', '@widget'] },
  () => {
    bulkInsertionTest.use({
      initialSettings: {
        'Comfy.RightSidePanel.ShowErrorsTab': true
      }
    })

    bulkInsertionTest.beforeEach(async ({ comfyPage }) => {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      await comfyPage.toast.closeToasts()
      const panel = new PropertiesPanelHelper(comfyPage.page)
      await panel.open(comfyPage.actionbar.propertiesButton)
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect(panel.errorsTab).toBeHidden()

      const tab = comfyPage.menu.assetsTab
      await tab.open()
      await expect(tab.assetCards).toHaveCount(2)
    })

    bulkInsertionTest(
      'does not surface errors for inserted output assets',
      async ({ comfyPage }) => {
        const tab = comfyPage.menu.assetsTab
        const panel = new PropertiesPanelHelper(comfyPage.page)
        await expect(panel.root).toBeVisible()

        await tab.getAssetCardByName('alpha').click()
        await comfyPage.page.keyboard.down('ControlOrMeta')
        await tab.getAssetCardByName('beta').click()
        await comfyPage.page.keyboard.up('ControlOrMeta')
        await expect(tab.selectedCards).toHaveCount(2)

        const generatedAssetVerificationResponse =
          comfyPage.page.waitForResponse(isGeneratedAssetVerificationResponse)

        await tab.getAssetCardByName('alpha').dispatchEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2
        })
        await expect(comfyPage.contextMenu.primeVueMenu).toBeVisible()
        await tab.contextMenuItem('Insert all assets as nodes').click()

        await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(2)

        await expectNoErrorUiAfterVerification(
          comfyPage,
          panel,
          generatedAssetVerificationResponse
        )
      }
    )
  }
)
