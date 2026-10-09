import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { test } from '@e2e/fixtures/agentInputOrderFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  hostPrompt,
  hostVisibleValues,
  messageId,
  sourceNodeId,
  staleCanvasPrompt,
  targetNodeId,
  threadId
} from '@e2e/fixtures/data/agent/inputOrder'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

test.describe(
  'Agent follower input mapping after saved autogrow inputs',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('applies the host named input bindings over a stale canvas', async ({
      page,
      inputOrderHost
    }) => {
      const executionInputs = () =>
        page.evaluate(async () =>
          Object.fromEntries(
            Object.entries((await window.app!.graphToPrompt()).output).map(
              ([id, node]) => [id, node.inputs]
            )
          )
        )

      const nodes = new VueNodeHelpers(page)
      const source = nodes.getNodeLocator(sourceNodeId)
      const target = nodes.getNodeLocator(targetNodeId)

      await test.step('canvas starts on the stale revision', async () => {
        await expect.poll(executionInputs).toEqual(staleCanvasPrompt)
      })

      await test.step('host answers the subscribe with its catch-up', async () => {
        const panel = new AgentPanel(page)
        await panel.open()
        await panel.selectWorkflow()
        await panel.sendMessage('Show the saved workflow')
        await expect(
          panel.root.getByText(enMessages.agent.thinking).first()
        ).toBeVisible()
        await inputOrderHost.waitForSubscribe()
        inputOrderHost.send({
          type: 'agent_message_done',
          data: { message_id: messageId, thread_id: threadId }
        })
      })

      await test.step('host values replace the stale ones on the canvas', async () => {
        await expect(
          source.getByLabel('width', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(hostVisibleValues.width)
        await expect(
          source.getByLabel('height', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(hostVisibleValues.height)
        await expect(
          source.getByLabel('length', { exact: true }).getByRole('spinbutton')
        ).toHaveValue(hostVisibleValues.length)
        await expect(
          source.getByRole('textbox', { name: 'prompt', exact: true })
        ).toHaveValue(hostVisibleValues.prompt)
        await expect(
          target.getByRole('combobox', { name: 'ref_image_size', exact: true })
        ).toHaveText(hostVisibleValues.refImageSize)
      })

      await test.step('host bindings reach the execution payload', async () => {
        await expect.poll(executionInputs).toEqual(hostPrompt)
      })
    })
  }
)
