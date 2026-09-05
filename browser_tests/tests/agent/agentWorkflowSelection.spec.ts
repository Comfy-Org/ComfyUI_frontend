import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'

const test = mergeTests(agentTest, workflowSelectionTest)

test.describe(
  'Explicit Agent workflow selection',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('keeps a fresh draft and shows inline saving until the selected workflow is ready', async ({
      page,
      workflowSelection
    }, testInfo) => {
      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      const panel = page.locator('#agent-panel-root')
      const composer = panel.getByRole('textbox', { includeHidden: true })
      await expect(
        panel.getByText(enMessages.agent.selectWorkflowForAgent)
      ).toBeVisible()
      await composer.fill('Find a workflow for skin upscaling')
      await composer.press('Enter')
      await expect(
        page.getByPlaceholder(enMessages.agent.searchWorkflows)
      ).toBeFocused()
      await expect(
        page.getByRole('menuitemradio', { checked: true })
      ).toHaveCount(0)
      await expect(composer).toHaveValue('Find a workflow for skin upscaling')
      expect(workflowSelection.postedMessages).toHaveLength(0)

      const row = page.getByRole('menuitemradio', {
        name: /Unsaved Workflow/
      })
      await row.press('Enter')
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      await expect(page.getByRole('menu').getByRole('status')).toHaveText(
        enMessages.agent.savingWorkflow
      )
      await expect(row).toHaveAttribute('aria-busy', 'true')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await testInfo.attach('inline-workflow-saving', {
        body: await page.screenshot({
          path: testInfo.outputPath('inline-workflow-saving.png')
        }),
        contentType: 'image/png'
      })
      workflowSelection.finishSave(true)
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(
        panel.getByRole('button', { name: enMessages.agent.switchWorkflow })
      ).toHaveText('Unsaved Workflow')
      await expect(composer).toHaveValue('Find a workflow for skin upscaling')
      expect(workflowSelection.postedMessages).toHaveLength(0)

      await panel.getByRole('button', { name: enMessages.g.close }).click()
      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      await expect(
        panel.getByRole('button', { name: enMessages.agent.switchWorkflow })
      ).toHaveText('Unsaved Workflow')
    })

    test('keeps the failed selection open and allows retry without a naming dialog', async ({
      page,
      workflowSelection
    }) => {
      await page
        .getByRole('button', { name: enMessages.agent.askComfyAgent })
        .click()
      const panel = page.locator('#agent-panel-root')
      const composer = panel.getByRole('textbox', { includeHidden: true })
      await composer.fill('Keep this draft')
      await panel
        .getByRole('button', { name: enMessages.agent.switchWorkflow })
        .click()
      const row = page.getByRole('menuitemradio', {
        name: /Unsaved Workflow/
      })
      await row.click()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
      workflowSelection.finishSave(false)
      await expect(page.getByRole('menu').getByRole('status')).toHaveCount(0)
      await expect(row).toBeEnabled()
      await expect(row).not.toBeChecked()
      await expect(
        page.getByText(enMessages.shareWorkflow.saveFailedTitle)
      ).toBeVisible()
      await expect(composer).toHaveValue('Keep this draft')
      await row.click()
      await expect.poll(() => workflowSelection.savedPaths.length).toBe(2)
      workflowSelection.finishSave(true)
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(
        panel.getByRole('button', { name: enMessages.agent.switchWorkflow })
      ).toHaveText('Unsaved Workflow')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(workflowSelection.postedMessages).toHaveLength(0)
    })
  }
)
