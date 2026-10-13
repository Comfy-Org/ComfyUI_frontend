import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { WorkspaceStore } from '@e2e/types/globals'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const OPEN_STORAGE_KEY = 'Comfy.AgentPanel.open'

test.describe('In-App Agent panel across view modes', { tag: '@cloud' }, () => {
  test('T-16 / PM-653 / FE-1298 keeps a single docked panel root and active workflow in app mode', async ({
    agentPanel,
    comfyPage
  }) => {
    test.setTimeout(30_000)

    const page = comfyPage.page
    const activeWorkflowPath = () =>
      page.evaluate(
        () =>
          (window.app!.extensionManager as WorkspaceStore).workflow
            .activeWorkflow?.path
      )
    const selectedWorkflowPath = await activeWorkflowPath()

    expect(selectedWorkflowPath).toBeTruthy()

    await expect(agentPanel.openButton).toBeVisible()
    await agentPanel.open()

    await expect(agentPanel.root).toHaveCount(1)
    await expect(agentPanel.root).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), OPEN_STORAGE_KEY)
      )
      .toBe('true')

    await expect(agentPanel.dockedPanelShell).toHaveCSS(
      'border-left-width',
      '0px'
    )

    // Enter app mode: the docked panel re-hosts under LinearView.
    await comfyPage.appMode.toggleAppMode()
    await expect(agentPanel.root).toHaveCount(1)
    await expect(agentPanel.root).toBeVisible()
    await expect.poll(activeWorkflowPath).toBe(selectedWorkflowPath)
    await expect(agentPanel.dockedPanelShell).toHaveCSS(
      'border-left-width',
      '1px'
    )

    // Return to graph mode: the docked panel re-hosts under GraphCanvas.
    await comfyPage.appMode.toggleAppMode()
    await expect(agentPanel.root).toHaveCount(1)
    await expect(agentPanel.root).toBeVisible()
    await expect.poll(activeWorkflowPath).toBe(selectedWorkflowPath)
    await expect(agentPanel.dockedPanelShell).toHaveCSS(
      'border-left-width',
      '0px'
    )
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
