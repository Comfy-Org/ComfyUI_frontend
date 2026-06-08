import type { Locator, WebSocketRoute } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { TestIds } from '@e2e/fixtures/selectors'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const KSAMPLER_NODE = '3'

async function runOnBackgroundTab(
  comfyPage: ComfyPage,
  ws: WebSocketRoute
): Promise<{ exec: ExecutionHelper; jobId: string; backgroundTab: Locator }> {
  const topbar = comfyPage.menu.topbar

  await comfyPage.workflow.waitForActiveWorkflow()
  await comfyPage.workflow.waitForWorkflowIdle()

  const exec = new ExecutionHelper(comfyPage, ws)
  const jobId = await exec.run()
  await comfyPage.nextFrame()

  await topbar.newWorkflowButton.click()
  await comfyPage.workflow.waitForWorkflowIdle()
  await expect(topbar.getActiveTab()).toContainText('(2)')

  const backgroundTab = topbar.getTab(0)
  exec.executionStart(jobId)
  await expect(
    backgroundTab.getByRole('img', { name: 'Running' })
  ).toBeVisible()

  return { exec, jobId, backgroundTab }
}

test.describe('Workflow tab status indicator', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.setup()
  })

  test('replaces the running indicator with completed when the job finishes', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    const { exec, jobId, backgroundTab } = await runOnBackgroundTab(
      comfyPage,
      ws
    )

    exec.executionSuccess(jobId)

    await expect(
      backgroundTab.getByRole('img', { name: 'Completed' })
    ).toBeVisible()
    await expect(
      backgroundTab.getByRole('img', { name: 'Running' })
    ).toHaveCount(0)
  })

  test('shows failed when the background job errors', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    const { exec, jobId, backgroundTab } = await runOnBackgroundTab(
      comfyPage,
      ws
    )

    exec.executionError(jobId, KSAMPLER_NODE, 'boom')

    // The error opens a modal dialog that aria-hides the rest of the app
    // (focus trap), taking the tab out of the accessibility tree. Dismiss it
    // so the badge is reachable by role.
    const errorDialog = comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
    await expect(errorDialog).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')
    await expect(errorDialog).toBeHidden()

    await expect(
      backgroundTab.getByRole('img', { name: 'Failed' })
    ).toBeVisible()
  })

  test('drops the indicator on user interrupt rather than showing an error', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    const { exec, jobId, backgroundTab } = await runOnBackgroundTab(
      comfyPage,
      ws
    )

    exec.executionInterrupted(jobId, KSAMPLER_NODE)

    await expect(backgroundTab.getByRole('img')).toHaveCount(0)
  })

  test('clears the indicator once the tab is activated', async ({
    comfyPage,
    getWebSocket
  }) => {
    const ws = await getWebSocket()
    const { exec, jobId, backgroundTab } = await runOnBackgroundTab(
      comfyPage,
      ws
    )

    exec.executionSuccess(jobId)
    await expect(
      backgroundTab.getByRole('img', { name: 'Completed' })
    ).toBeVisible()

    const currentTab = comfyPage.menu.topbar.getActiveTab()

    await expect(
      backgroundTab.getByRole('img', { name: 'Completed' })
    ).toBeVisible()
    await backgroundTab.click()
    await expect(backgroundTab.getByRole('img')).toHaveCount(0)

    await currentTab.click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect(backgroundTab.getByRole('img')).toHaveCount(0)
  })
})
