import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import workflow from '@e2e/assets/nodes/single_ksampler.json' with { type: 'json' }
import {
  agentTest as test,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

test.describe(
  'Node mention freshness (FE-3220)',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ page, agentFlagEnabled }) => {
      await bootAgentApp(page, agentFlagEnabled, {
        vueNodes: true,
        objectInfo: { KSampler: agentReplayNodeDefs.KSampler },
        beforeNavigate: (page) =>
          mockWorkflowPersistence(page, 'a81718a4-02ae-41e6-ae85-c33b7bb880f6')
      })
      await loadIntoBootWorkflow(page, zComfyWorkflow.parse(workflow))
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
    })

    test('refreshes nodes after renaming, deleting and undoing in the target workflow', async ({
      page
    }) => {
      const agentPanel = new AgentPanel(page)
      const vueNodes = new VueNodeHelpers(page)
      await agentPanel.composer.fill('Keep this draft @')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await expect(
        agentPanel.root.getByRole('menuitem', { name: 'KSampler', exact: true })
      ).toBeVisible()
      await agentPanel.composer.press('Escape')
      await agentPanel.composer.press('Backspace')
      await vueNodes.renameNode('3', 'Color grade')
      await nextFrame(page)
      await expect(
        vueNodes.getNodeLocator('3').getByTestId('node-title')
      ).toHaveText('Color grade')
      await agentPanel.composer.pressSequentially('@')
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
      await agentPanel.composer.press('Backspace')
      await vueNodes.deleteNode('3')
      await nextFrame(page)
      await expect(vueNodes.getNodeLocator('3')).toHaveCount(0)
      await agentPanel.composer.pressSequentially('@')
      await agentPanel.root
        .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
        .click()
      await expect(
        agentPanel.root.getByText(enMessages.agent.noNodesToReference, {
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
      await agentPanel.composer.press('Backspace')
      await new Topbar(page).triggerTopbarCommand(['Edit', 'Undo'])
      await nextFrame(page)
      await expect(
        vueNodes.getNodeLocator('3').getByTestId('node-title')
      ).toHaveText('Color grade')
      await expect(agentPanel.composer).toHaveText('Keep this draft ')
      await agentPanel.composer.pressSequentially('@')
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
