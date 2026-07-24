import { expect } from '@playwright/test'

import { jobOutputInsertionCases } from '@e2e/fixtures/data/jobOutputInsertion'
import { expectNoErrorUiForObservationWindow } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { jobOutputInsertionTest as test } from '@e2e/fixtures/jobOutputInsertionFixture'

test.describe(
  'Job output insertion',
  { tag: ['@cloud', '@ui', '@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      await comfyPage.toast.closeToasts()
      await expectNoErrorUiForObservationWindow(comfyPage)
      await comfyPage.queuePanel.open()
    })

    for (const scenario of jobOutputInsertionCases) {
      test(`does not surface errors when inserting the owned ${scenario.mediaKind} job asset`, async ({
        comfyPage
      }) => {
        const initialLoaderCount = (
          await comfyPage.nodeOps.getNodeRefsByType(scenario.nodeType)
        ).length

        await comfyPage.queuePanel.addOutputToCurrentWorkflow(scenario.job.id)

        await expect
          .poll(
            async () =>
              (await comfyPage.nodeOps.getNodeRefsByType(scenario.nodeType))
                .length
          )
          .toBe(initialLoaderCount + 1)

        await expectNoErrorUiForObservationWindow(comfyPage)
      })
    }
  }
)
