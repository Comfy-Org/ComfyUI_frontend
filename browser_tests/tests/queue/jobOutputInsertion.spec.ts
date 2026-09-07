import { expect } from '@playwright/test'

import { assetRequestIncludesTag } from '@e2e/fixtures/assetApiFixture'
import { jobOutputInsertionCases } from '@e2e/fixtures/data/jobOutputInsertion'
import { expectNoErrorUiAfterVerification } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { jobOutputInsertionTest as test } from '@e2e/fixtures/jobOutputInsertionFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe(
  'Job output insertion',
  { tag: ['@cloud', '@ui', '@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      await comfyPage.toast.closeToasts()
      const panel = new PropertiesPanelHelper(comfyPage.page)
      await panel.open(comfyPage.actionbar.propertiesButton)
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect(panel.errorsTab).toBeHidden()
      await comfyPage.queuePanel.open()
    })

    for (const scenario of jobOutputInsertionCases) {
      test(`does not surface errors when inserting the owned ${scenario.mediaKind} job asset`, async ({
        comfyPage
      }) => {
        const panel = new PropertiesPanelHelper(comfyPage.page)
        await expect(panel.root).toBeVisible()
        const initialLoaderCount = (
          await comfyPage.nodeOps.getNodeRefsByType(scenario.nodeType)
        ).length
        const assetsVerificationResponse = comfyPage.page.waitForResponse(
          (response) =>
            response.request().method().toUpperCase() === 'GET' &&
            response.status() === 200 &&
            new URL(response.url()).pathname.endsWith('/api/assets') &&
            assetRequestIncludesTag(response.url(), 'output')
        )

        await comfyPage.queuePanel.addOutputToCurrentWorkflow(scenario.job.id)

        await expect
          .poll(
            async () =>
              (await comfyPage.nodeOps.getNodeRefsByType(scenario.nodeType))
                .length
          )
          .toBe(initialLoaderCount + 1)

        await expectNoErrorUiAfterVerification(
          comfyPage,
          panel,
          assetsVerificationResponse
        )
      })
    }
  }
)
