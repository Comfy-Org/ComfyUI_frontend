import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { test } from '@e2e/fixtures/agentInputOrderFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { messageId, threadId } from '@e2e/fixtures/data/agent/inputOrder'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

test.describe(
  'Agent follower input mapping after saved autogrow inputs',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('keeps unequal dimensions on their named inputs and preserves unrelated values', async ({
      page,
      inputOrderHost
    }) => {
      const panel = new AgentPanel(page)
      await panel.open()
      await panel.selectWorkflow()
      await panel.root
        .getByRole('textbox', { name: /^Describe ideas/ })
        .fill('Show the saved workflow')
      await panel.root
        .getByRole('button', { name: enMessages.agent.send })
        .click()
      await inputOrderHost.waitForSubscribe()
      inputOrderHost.send({
        type: 'agent_message_done',
        data: { message_id: messageId, thread_id: threadId }
      })

      const nodes = new VueNodeHelpers(page)
      const source = nodes.getNodeLocator('1')
      const target = nodes.getNodeLocator('2')
      await expect(source).toBeVisible()
      await expect(target).toBeVisible()
      await expect(
        source.getByLabel('width', { exact: true }).getByRole('spinbutton')
      ).toHaveValue('832')
      await expect(
        source.getByLabel('height', { exact: true }).getByRole('spinbutton')
      ).toHaveValue('448')
      await expect(
        source.getByLabel('length', { exact: true }).getByRole('spinbutton')
      ).toHaveValue('37')
      await expect(
        source.getByRole('textbox', { name: 'prompt', exact: true })
      ).toHaveValue('Keep the reference framing')
      await expect(
        target.getByRole('combobox', { name: 'ref_image_size', exact: true })
      ).toHaveText('max')

      await expect
        .poll(() =>
          page.evaluate(async () => (await window.app!.graphToPrompt()).output)
        )
        .toMatchObject({
          '1': {
            inputs: {
              width: 832,
              height: 448,
              length: 37,
              prompt: 'Keep the reference framing'
            }
          },
          '2': {
            inputs: {
              width: ['1', 0],
              height: ['1', 1],
              length: ['1', 2],
              prompt: ['1', 3],
              'ref_images.ref_image_0': ['1', 4],
              'ref_images.ref_image_1': ['1', 5],
              ref_image_size: 'max'
            }
          }
        })
    })
  }
)
