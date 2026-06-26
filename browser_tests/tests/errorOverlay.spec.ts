import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { cleanupFakeModel } from '@e2e/fixtures/helpers/ErrorsTabHelper'

test.describe('Error overlay', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  function getOverlay(page: Page) {
    return page.getByTestId(TestIds.dialogs.errorOverlay)
  }

  function getDetailsButton(page: Page) {
    return getOverlay(page).getByTestId(TestIds.dialogs.errorOverlaySeeErrors)
  }

  test.describe('Labels', () => {
    test('Should display single error copy and View details action', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

      const overlay = getOverlay(comfyPage.page)
      await expect(overlay).toBeVisible()
      await expect(overlay).not.toContainText(/1 ERROR/i)
      await expect(
        overlay.getByTestId(TestIds.dialogs.errorOverlayMessages)
      ).toHaveText(/\S/)
      await expect(getDetailsButton(comfyPage.page)).toContainText(
        /View details/i
      )
    })
  })

  test.describe('Persistence', () => {
    test('Does not resurface missing nodes on undo/redo', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

      const errorOverlay = getOverlay(comfyPage.page)
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()
      await expect(errorOverlay).toBeHidden()

      await comfyPage.canvas.click()
      await comfyPage.nextFrame()
      await comfyPage.page.keyboard.press('Control+a')
      await comfyPage.page.mouse.move(400, 300)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(450, 350, { steps: 5 })
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await comfyPage.keyboard.undo()
      await expect(errorOverlay).toBeHidden()

      await comfyPage.keyboard.redo()
      await expect(errorOverlay).toBeHidden()
    })

    test('Does not resurface error overlay when switching back to workflow with missing nodes', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Sidebar'
      )
      await comfyPage.menu.workflowsTab.open()

      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

      const errorOverlay = getOverlay(comfyPage.page)
      await expect(errorOverlay).toBeVisible()

      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlayDismiss)
        .click()
      await expect(errorOverlay).toBeHidden()

      await comfyPage.menu.workflowsTab.open()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')

      await comfyPage.menu.workflowsTab.switchToWorkflow('missing_nodes')

      await expect(errorOverlay).toBeHidden()
    })
  })

  test.describe('View details flow', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setup()
    })

    async function triggerExecutionError(comfyPage: {
      canvasOps: { disconnectEdge: () => Promise<void> }
      page: Page
      command: { executeCommand: (cmd: string) => Promise<void> }
    }) {
      await comfyPage.canvasOps.disconnectEdge()
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
    }

    test('Error overlay appears on execution error', async ({ comfyPage }) => {
      await triggerExecutionError(comfyPage)

      await expect(getOverlay(comfyPage.page)).toBeVisible()
    })

    test('Error overlay shows error message', async ({ comfyPage }) => {
      await triggerExecutionError(comfyPage)

      const overlay = getOverlay(comfyPage.page)
      await expect(overlay).toBeVisible()
      await expect(overlay).toHaveText(/\S/)
    })

    test('"View details" opens right side panel', async ({ comfyPage }) => {
      await triggerExecutionError(comfyPage)

      const overlay = getOverlay(comfyPage.page)
      await expect(overlay).toBeVisible()

      await overlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()

      await expect(overlay).toBeHidden()
      await expect(comfyPage.page.getByTestId('properties-panel')).toBeVisible()
    })

    test('"View details" dismisses the overlay', async ({ comfyPage }) => {
      await triggerExecutionError(comfyPage)

      const overlay = getOverlay(comfyPage.page)
      await expect(overlay).toBeVisible()

      await overlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()

      await expect(overlay).toBeHidden()
    })

    test('"Dismiss" closes overlay without opening panel', async ({
      comfyPage
    }) => {
      await triggerExecutionError(comfyPage)

      const overlay = getOverlay(comfyPage.page)
      await expect(overlay).toBeVisible()

      await overlay.getByTestId(TestIds.dialogs.errorOverlayDismiss).click()

      await expect(overlay).toBeHidden()
      await expect(comfyPage.page.getByTestId('properties-panel')).toBeHidden()
    })

    test('Close button (X) dismisses overlay', async ({ comfyPage }) => {
      await triggerExecutionError(comfyPage)

      const overlay = getOverlay(comfyPage.page)
      await expect(overlay).toBeVisible()

      await overlay.getByRole('button', { name: /close/i }).click()

      await expect(overlay).toBeHidden()
    })
  })

  test.describe('Count independence from node selection', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test.afterEach(async ({ comfyPage }) => {
      await cleanupFakeModel(comfyPage)
    })

    test('missing model count stays constant when a node is selected', async ({
      comfyPage
    }) => {
      // Regression: ErrorOverlay previously read the selection-filtered
      // missingModelGroups from useErrorGroups, so selecting one of two
      // missing-model nodes could shrink the overlay count. The overlay must
      // show the workflow total regardless of canvas selection.
      await comfyPage.workflow.loadWorkflow('missing/missing_models_distinct')

      const overlay = getOverlay(comfyPage.page)
      await expect(overlay).toBeVisible()
      await expect(overlay).toContainText(/2 errors found/i)
      await expect(
        overlay.getByTestId(TestIds.dialogs.errorOverlayMessages)
      ).toHaveText(/Resolve them before running the workflow\./i)

      const node = await comfyPage.nodeOps.getNodeRefById('1')
      await node.click('title')

      await expect(overlay).toContainText(/2 errors found/i)
      await expect(
        overlay.getByTestId(TestIds.dialogs.errorOverlayMessages)
      ).toHaveText(/Resolve them before running the workflow\./i)
    })
  })
})
