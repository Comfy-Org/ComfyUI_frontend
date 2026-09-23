import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import {
  inlineReferencesTest as test,
  referenceNode,
  referenceWorkflow
} from '@e2e/fixtures/agentInlineReferencesFixture'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

test.use({
  connectWebSocketToServer: false,
  nodeDefinitions: { ColorBalance: referenceNode }
})

// The first workflow saved through the target picker gets this id from
// `agentWorkflowSelectionFixture`; here that is "Portrait study", the tab the
// staged node comes from.
const PORTRAIT_CLOUD_ID = 'a81718a4-02ae-41e6-ae85-000000000001'
const TURN_ACCEPTED: AgentTurnAccepted = {
  message_id: '0f7f0e9a-3c9a-4d0e-9a1b-2c6f5f4e8d11',
  thread_id: 'b1d6a0b7-8a1d-4a27-8a2f-6c9d1a4b7e03',
  workflow_id: PORTRAIT_CLOUD_ID
}

test(
  'attributes a staged node to the workflow it came from after navigating away',
  { tag: ['@cloud', '@ui'] },
  async ({ page, workflowSelection }, testInfo) => {
    const turns: AgentPostMessageRequest[] = []
    // Registered after the fixture's broader `**/api/agent/threads**` route so
    // this one wins for the send and can answer with a real acceptance.
    await page.route('**/api/agent/threads/*/messages', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      turns.push(zAgentPostMessageRequest.parse(route.request().postDataJSON()))
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(TURN_ACCEPTED)
      })
    })

    await page.locator('#comfy-file-input').setInputFiles({
      name: 'Portrait study.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(referenceWorkflow))
    })
    await page
      .getByRole('button', { name: enMessages.agent.entryButton, exact: true })
      .click()
    const panel = page.locator('#agent-panel-root')
    const targetPicker = panel.getByRole('button', {
      name: enMessages.agent.switchWorkflow
    })
    await targetPicker.click()
    await page.getByRole('menuitemradio', { name: /Portrait study/ }).click()
    await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
    workflowSelection.finishSave(true)
    await expect(targetPicker).toHaveText('Portrait study')

    const editor = panel.getByRole('textbox')
    await editor.fill('Warm up @')
    await panel
      .getByRole('menuitem', { name: enMessages.agent.nodes, exact: true })
      .click()
    await panel.getByRole('menuitem', { name: /Color balance/ }).click()
    await expect(editor).toHaveText('Warm up Color balance #12 ')

    // Navigate away from the target: the node is still Portrait study's, but
    // the workflow on screen at send time is a different tab.
    await page
      .getByRole('button', {
        name: enMessages.sideToolbar.newBlankWorkflow,
        exact: true
      })
      .click()
    await expect(
      page.locator('.workflow-tabs .p-togglebutton-checked')
    ).toHaveText('Unsaved Workflow (2)')
    await expect(targetPicker).toHaveText('Portrait study')
    await expect(editor).toHaveText('Warm up Color balance #12 ')
    await testInfo.attach('staged-node-from-other-tab', {
      body: await panel.screenshot({
        animations: 'disabled',
        path: testInfo.outputPath('staged-node-from-other-tab.png')
      }),
      contentType: 'image/png'
    })

    await editor.press('Enter')
    await expect(panel.getByTestId('user-message-bubble')).toHaveText(
      'Warm up @[Node: Color balance #12]'
    )

    expect(turns).toHaveLength(1)
    // The regression: `node_ids` alone leaves the backend to guess an owner,
    // and guessing "the workflow on screen" is wrong here. Replacing the
    // captured target with the active workflow in `AgentPanelRoot.vue` drops
    // `workflow_id` from this payload, so this assertion discriminates.
    expect(turns[0].selection).toEqual({
      node_ids: ['12'],
      workflow_id: PORTRAIT_CLOUD_ID
    })
    expect(turns[0].workflow_id).toBe(PORTRAIT_CLOUD_ID)
  }
)
