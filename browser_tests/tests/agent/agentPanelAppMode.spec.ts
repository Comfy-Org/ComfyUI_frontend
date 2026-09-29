import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { WorkspaceStore } from '@e2e/types/globals'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'

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
    await new AgentPanel(page).open()

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

  test('keeps a user-closed panel hidden when toggling app mode and back', async ({
    comfyPage
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    const dockedPanel = page.getByTestId('docked-agent-panel')
    const storedOpenState = () =>
      page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)

    await test.step('close and persist the panel state', async () => {
      await expect(dockedPanel).toBeVisible({ timeout: 8_000 })
      await dockedPanel
        .getByRole('button', { name: enMessages.g.close, exact: true })
        .click()
      await expect(dockedPanel).toHaveCount(0)
      await expect.poll(storedOpenState).toBe('false')
    })

    await test.step('keep the panel closed in app mode', async () => {
      await comfyPage.appMode.toggleAppMode()
      await expect(dockedPanel).toHaveCount(0)
      await expect.poll(storedOpenState).toBe('false')
    })

    await test.step('keep the panel closed after returning to graph mode', async () => {
      await comfyPage.appMode.toggleAppMode()
      await expect(dockedPanel).toHaveCount(0)
      await expect.poll(storedOpenState).toBe('false')
    })
  })

  test('activation reopens a stored-closed panel across app mode changes', async ({
    comfyPage
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    const dockedPanel = page.getByTestId('docked-agent-panel')
    const storedOpenState = () =>
      page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)

    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [OPEN_STORAGE_KEY, 'false']
    )
    await comfyPage.workflow.reloadAndWaitForApp()

    await expect(dockedPanel).toBeVisible({ timeout: 8_000 })
    await expect.poll(storedOpenState).toBe('true')

    await comfyPage.appMode.toggleAppMode()
    await expect(dockedPanel).toBeVisible()
    await expect.poll(storedOpenState).toBe('true')

    await comfyPage.appMode.toggleAppMode()
    await expect(dockedPanel).toBeVisible()
    await expect.poll(storedOpenState).toBe('true')
  })
})
