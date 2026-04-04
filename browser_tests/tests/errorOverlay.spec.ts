import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('Error overlay labels', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  function getOverlay(page: Page) {
    return page.getByTestId(TestIds.dialogs.errorOverlay)
  }

  function getSeeErrorsButton(page: Page) {
    return getOverlay(page).getByTestId(TestIds.dialogs.errorOverlaySeeErrors)
  }

  test('Should display singular error count label for single error', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

    await expect(getOverlay(comfyPage.page)).toBeVisible()
    await expect(getOverlay(comfyPage.page)).toContainText(/1 ERROR/i)
  })

  test('Should display "Show missing nodes" button for missing node errors', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

    await expect(getOverlay(comfyPage.page)).toBeVisible()
    await expect(getSeeErrorsButton(comfyPage.page)).toContainText(
      /Show missing nodes/i
    )
  })

  test('Should display "Show missing models" button for missing model errors', async ({
    comfyPage
  }) => {
    const cleanupOk = await comfyPage.page.evaluate(async (url: string) => {
      const response = await fetch(`${url}/api/devtools/cleanup_fake_model`)
      return response.ok
    }, comfyPage.url)
    expect(cleanupOk).toBeTruthy()

    await comfyPage.workflow.loadWorkflow('missing/missing_models')

    await expect(getOverlay(comfyPage.page)).toBeVisible()
    await expect(getSeeErrorsButton(comfyPage.page)).toContainText(
      /Show missing models/i
    )
  })

  test('Should display "Show missing inputs" button for missing media errors', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_media_single')

    await expect(getOverlay(comfyPage.page)).toBeVisible()
    await expect(getSeeErrorsButton(comfyPage.page)).toContainText(
      /Show missing inputs/i
    )
  })

  test('Should display generic "See Errors" button for multiple error types', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes_and_media')

    await expect(getOverlay(comfyPage.page)).toBeVisible()
    await expect(getSeeErrorsButton(comfyPage.page)).toContainText(
      /See Errors/i
    )
  })
})

test.describe('Error overlay See Errors flow', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
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

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeVisible()
  })

  test('Error overlay shows error message', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()
    await expect(overlay).toHaveText(/\S/)
  })

  test('"See Errors" opens right side panel', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()

    await expect(comfyPage.page.getByTestId('properties-panel')).toBeVisible()
  })

  test('"See Errors" dismisses the overlay', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()

    await expect(overlay).not.toBeVisible()
  })

  test('"Dismiss" closes overlay without opening panel', async ({
    comfyPage
  }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByTestId(TestIds.dialogs.errorOverlayDismiss).click()

    await expect(overlay).not.toBeVisible()
    await expect(
      comfyPage.page.getByTestId('properties-panel')
    ).not.toBeVisible()
  })

  test('Close button (X) dismisses overlay', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByRole('button', { name: /close/i }).click()

    await expect(overlay).not.toBeVisible()
  })
})
