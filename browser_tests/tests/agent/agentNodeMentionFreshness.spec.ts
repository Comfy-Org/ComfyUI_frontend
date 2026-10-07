import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe(
  'Node mention freshness (FE-3220)',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.use({ objectInfo: 'server' })

    test.beforeEach(async ({ comfyPage, agentPanel }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await agentPanel.open()
      await agentPanel.selectWorkflow('single_ksampler')
    })

    test('refreshes nodes after renaming, deleting and undoing in the target workflow', async ({
      comfyPage,
      agentPanel
    }) => {
      await agentPanel.composer.fill('Keep this draft @')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await expect(
        agentPanel.root.getByRole('menuitem', { name: 'KSampler', exact: true })
      ).toBeVisible()
      await agentPanel.composer.press('Escape')
      await comfyPage.vueNodes.renameNode('3', 'Color grade')
      await comfyPage.nextFrame()
      await agentPanel.composer.fill('Keep this draft @')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await expect(
        agentPanel.root.getByRole('menuitem', {
          name: 'Color grade',
          exact: true
        })
      ).toBeVisible()
      await expect(
        agentPanel.root.getByRole('menuitem', { name: 'KSampler', exact: true })
      ).toHaveCount(0)
      await agentPanel.composer.press('Escape')
      await comfyPage.vueNodes.deleteNode('3')
      await comfyPage.nextFrame()
      await agentPanel.composer.fill('Keep this draft @')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await expect(
        agentPanel.root.getByText(enMessages.agent.noNodesToMention, {
          exact: true
        })
      ).toBeVisible()
      await expect(
        agentPanel.root.getByRole('menuitem', {
          name: 'Color grade',
          exact: true
        })
      ).toHaveCount(0)
      await agentPanel.composer.press('Escape')
      await comfyPage.canvas.focus()
      await comfyPage.page.keyboard.press('ControlOrMeta+z')
      await comfyPage.nextFrame()
      await agentPanel.composer.fill('Keep this draft @')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await agentPanel.root
        .getByRole('menuitem', { name: 'Color grade', exact: true })
        .click()
      await expect(
        agentPanel.composer.getByTestId('node-reference-chip')
      ).toHaveText('Color grade #3')
      await expect(agentPanel.composer).toContainText('Keep this draft')
    })
  }
)
