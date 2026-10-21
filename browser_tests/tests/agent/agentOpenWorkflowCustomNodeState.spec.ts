import { expect } from '@playwright/test'

import {
  BLANK_WORKFLOW,
  loadIntoBootWorkflow
} from '@e2e/fixtures/agentPanelFixture'
import { test } from '@e2e/fixtures/agentVhsSavedWorkflowFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  restoredVhsCanvas,
  savedVhsWorkflow
} from '@e2e/fixtures/data/agent/agentVhsSavedWorkflow'

test.describe(
  'A saved custom-node workflow opened by the Agent (PM-2018)',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('control: loading the saved workflow by hand restores every node and its saved values', async ({
      page,
      vhsCanvas
    }) => {
      await loadIntoBootWorkflow(page, savedVhsWorkflow())
      await expect.poll(() => vhsCanvas.state()).toEqual(restoredVhsCanvas)
    })

    test('the canvas keeps the output node and the saved widget values', async ({
      page,
      vhsCanvas,
      getAgentSocket
    }) => {
      await loadIntoBootWorkflow(page, BLANK_WORKFLOW)
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      const socket = await getAgentSocket()
      const outbound: string[] = []
      socket.onMessage((message) => outbound.push(String(message)))
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Load my saved VHS workflow.')
      await expect
        .poll(() => outbound, { timeout: 15_000 })
        .toContainEqual(expect.stringContaining('doc_subscribe'))

      vhsCanvas.sendAgentOpenedDocument(socket)

      await expect
        .poll(() => vhsCanvas.state().then((state) => state.types))
        .toContain('ImageInvert')
      await expect.poll(() => vhsCanvas.state()).toEqual(restoredVhsCanvas)
      await page.screenshot({
        path: test.info().outputPath('agent-opened-vhs-workflow.png')
      })
    })
  }
)
