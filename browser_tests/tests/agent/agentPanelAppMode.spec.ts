import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { WorkspaceStore } from '@e2e/types/globals'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { openAgentPanel } from '@e2e/fixtures/components/AgentPanel'

const OPEN_AGENT_LABEL = enMessages.agent.entryButton
const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

test.describe('In-App Agent panel across view modes', { tag: '@cloud' }, () => {
  test('T-16 / PM-653 / FE-1298 keeps a single docked panel root and active workflow in app mode', async ({
    comfyPage
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    const panelRoot = page.locator('#agent-panel-root')
    const activeWorkflowPath = () =>
      page.evaluate(
        () =>
          (window.app!.extensionManager as WorkspaceStore).workflow
            .activeWorkflow?.path
      )
    const selectedWorkflowPath = await activeWorkflowPath()

    expect(selectedWorkflowPath).toBeTruthy()

    const openButton = page.getByRole('button', {
      name: OPEN_AGENT_LABEL,
      exact: true
    })
    await expect(openButton).toBeVisible()
    await openAgentPanel(page)

    await expect(panelRoot).toHaveCount(1)
    await expect(panelRoot).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
      )
      .toBe('true')

    // Enter app mode: the docked panel re-hosts under LinearView.
    await comfyPage.appMode.toggleAppMode()
    await expect(panelRoot).toHaveCount(1)
    await expect(panelRoot).toBeVisible()
    await expect.poll(activeWorkflowPath).toBe(selectedWorkflowPath)

    // Return to graph mode: the docked panel re-hosts under GraphCanvas.
    await comfyPage.appMode.toggleAppMode()
    await expect(panelRoot).toHaveCount(1)
    await expect(panelRoot).toBeVisible()
    await expect.poll(activeWorkflowPath).toBe(selectedWorkflowPath)
  })

  test('keeps a stored-closed panel hidden when toggling app mode and back', async ({
    comfyPage
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    const dockedPanel = page.getByTestId('docked-agent-panel')
    const storedOpenState = () =>
      page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)

    // Startup activation intentionally opens the panel. Close it through the
    // user-facing control so this case starts from a settled, persisted close.
    await expect(dockedPanel).toBeVisible()
    await dockedPanel
      .getByRole('button', { name: enMessages.g.close, exact: true })
      .click()

    await expect(dockedPanel).toHaveCount(0)
    await expect.poll(storedOpenState).toBe('false')

    await comfyPage.appMode.toggleAppMode()
    await expect(dockedPanel).toHaveCount(0)
    await expect.poll(storedOpenState).toBe('false')

    await comfyPage.appMode.toggleAppMode()
    await expect(dockedPanel).toHaveCount(0)
    await expect.poll(storedOpenState).toBe('false')
  })
})
